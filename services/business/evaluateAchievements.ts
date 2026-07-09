// services/business/evaluateAchievements.ts
//
// BUSINESS ENGINE (Tahap 2.4) — Achievement Engine.
//
// PRINSIP KETAT sama seperti recalculateHealth.ts/recalculateProgress.ts:
// fungsi ini TIDAK BOLEH menghitung skor/metric baru, TIDAK BOLEH memanggil
// AI, TIDAK BOLEH menebak. Ia HANYA membandingkan angka yang sudah
// dihasilkan Business Update -> Business Health -> Progress Engine terhadap
// ambang batas yang tersimpan di achievement_definitions.condition_config.
// Lihat ACHIEVEMENT-ENGINE-PROPOSAL.md untuk rancangan lengkapnya.
//
// Dipanggil dari dua titik:
//   1. Akhir submitBusinessUpdate (setelah recalculateProgress) — menangkap
//      achievement berbasis Business Update/Health/Progress.
//   2. Awal getAchievements (saat Growth tab dibuka) — menangkap achievement
//      berbasis waktu murni (member_since_days) yang bisa jadi benar tanpa
//      ada Business Update baru. Proyek ini tidak punya cron job, jadi titik
//      baca ini adalah kesempatan paling ringan untuk mengecek tanpa
//      infrastruktur baru.
//
// Setiap pemanggilan idempoten — achievement yang sudah pernah unlock
// (dijaga UNIQUE constraint di business_achievements) tidak dicatat ulang.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const HEALTH_DIMENSION_CONDITION_TYPES: Record<string, string> = {
  sales_score: "sales",
  finance_score: "finance",
  customer_score: "customer",
  marketing_score: "marketing",
  operations_score: "operations",
  brand_score: "brand",
};

// condition_type yang belum dievaluasi otomatis — planned, ditandai
// is_hidden=true di katalog (lihat migrations/2026-07-09_achievement_engine.sql).
const UNSUPPORTED_CONDITION_TYPES = new Set(["target_completion", "manual", "future"]);

// Priority (Product Owner review v3, §3 proposal) — dipakai HANYA untuk
// memilih Next Milestone, tidak mengubah kriteria unlock apapun. Angka lebih
// kecil = lebih diprioritaskan. Achievement priority tinggi (mis. "critical")
// diutamakan sebagai Next Milestone dibanding achievement priority rendah
// meski remaining ratio-nya lebih kecil.
const PRIORITY_RANK: Record<string, number> = {
  critical: 0,
  important: 1,
  normal: 2,
  motivational: 3,
};

function priorityRank(priority: string | null | undefined): number {
  return PRIORITY_RANK[priority ?? "normal"] ?? PRIORITY_RANK.normal;
}

// Label satuan untuk Next Milestone (Product Owner feedback: kalimat "tinggal
// X lagi" harus konkret, bukan cuma judul polos). Ini murni pemetaan tampilan
// dari condition_type yang SUDAH ada — bukan data/logika baru, dan tidak
// mengubah kriteria unlock apapun.
const UNIT_LABELS: Record<string, { id: string; en: string }> = {
  business_updates_count: { id: "Business Update", en: "Business Update" },
  business_updates_streak_weeks: { id: "minggu", en: "week" },
  business_health_score: { id: "poin", en: "point" },
  sales_score: { id: "poin", en: "point" },
  finance_score: { id: "poin", en: "point" },
  customer_score: { id: "poin", en: "point" },
  marketing_score: { id: "poin", en: "point" },
  operations_score: { id: "poin", en: "point" },
  brand_score: { id: "poin", en: "point" },
  journey_growth: { id: "%", en: "%" },
  period_growth: { id: "%", en: "%" },
  member_since_days: { id: "hari", en: "day" },
};

function unitLabelFor(conditionType: string): { id: string; en: string } {
  return UNIT_LABELS[conditionType] ?? { id: "poin", en: "point" };
}

type Definition = {
  id: string;
  code: string;
  title_id: string;
  title_en: string;
  celebration_message_id: string | null;
  celebration_message_en: string | null;
  condition_type: string;
  condition_config: Record<string, unknown>;
  priority: string;
};

type CheckResult = { met: boolean; currentValue: number; threshold: number };

export type NewlyUnlocked = {
  code: string;
  titleId: string;
  titleEn: string;
  celebrationMessageId: string | null;
  celebrationMessageEn: string | null;
};

export type NextMilestone = {
  code: string;
  titleId: string;
  titleEn: string;
  currentValue: number;
  threshold: number;
  remainingRatio: number;
  priority: string;
  remaining: number;
  unitId: string;
  unitEn: string;
} | null;

export async function evaluateAchievements(
  businessProfileId: string,
  triggerSource: string
): Promise<{ newlyUnlocked: NewlyUnlocked[]; nextMilestone: NextMilestone }> {
  const { data: definitions } = await supabase
    .from("achievement_definitions")
    .select(
      "id, code, title_id, title_en, celebration_message_id, celebration_message_en, condition_type, condition_config, priority"
    )
    .eq("is_active", true)
    .eq("is_hidden", false);

  if (!definitions || definitions.length === 0) {
    return { newlyUnlocked: [], nextMilestone: null };
  }

  const { data: existingUnlocks } = await supabase
    .from("business_achievements")
    .select("achievement_definition_id")
    .eq("business_profile_id", businessProfileId);

  const unlockedIds = new Set((existingUnlocks || []).map((r) => r.achievement_definition_id as string));

  const newlyUnlocked: NewlyUnlocked[] = [];
  const lockedCandidates: Array<{ def: Definition; result: CheckResult }> = [];

  // Cache per-panggilan: beberapa condition_type membaca sumber data yang
  // SAMA (business_health per dimensi, progress_snapshots baseline/latest/
  // previous). Tanpa cache ini, tiap achievement definition memicu query-nya
  // sendiri walau datanya identik — jadi N query untuk N definition padahal
  // sumber datanya cuma segelintir baris. Cache di-scope ke satu pemanggilan
  // evaluateAchievements() saja (bukan lintas request), murni optimasi query,
  // tidak mengubah hasil evaluasi sama sekali.
  const healthCache: Map<string, number | null> = new Map();
  const snapshotCache: SnapshotCache = {};

  for (const def of definitions as Definition[]) {
    if (unlockedIds.has(def.id)) continue;
    if (UNSUPPORTED_CONDITION_TYPES.has(def.condition_type)) continue;

    const result = await runChecker(businessProfileId, def, healthCache, snapshotCache);
    if (!result) continue;

    if (result.met) {
      const { error } = await supabase.from("business_achievements").insert({
        business_profile_id: businessProfileId,
        achievement_definition_id: def.id,
        unlocked_by: "system",
        progress_value: result.currentValue,
        trigger_source: triggerSource,
      });
      if (!error) {
        newlyUnlocked.push({
          code: def.code,
          titleId: def.title_id,
          titleEn: def.title_en,
          celebrationMessageId: def.celebration_message_id,
          celebrationMessageEn: def.celebration_message_en,
        });
      }
    } else {
      lockedCandidates.push({ def, result });
    }
  }

  // Next Milestone: dari achievement yang BELUM terbuka, pilih dulu
  // berdasarkan priority (Product Owner review v3), baru remaining ratio
  // sebagai tie-breaker — bukan sisa absolut, supaya achievement dengan
  // satuan berbeda (jumlah update vs poin skor vs persen) bisa dibandingkan
  // secara adil. Priority lebih tinggi menang meski ratio-nya lebih besar,
  // mis. achievement "critical" tersisa 10% diutamakan dibanding achievement
  // "normal" yang tersisa 5%.
  let nextMilestone: NextMilestone = null;
  let bestPriorityRank = Infinity;
  let bestRemainingRatio = Infinity;
  for (const { def, result } of lockedCandidates) {
    if (result.threshold <= 0) continue;
    const remainingRatio = Math.max(0, (result.threshold - result.currentValue) / result.threshold);
    const rank = priorityRank(def.priority);
    const isBetter =
      rank < bestPriorityRank || (rank === bestPriorityRank && remainingRatio < bestRemainingRatio);
    if (isBetter) {
      bestPriorityRank = rank;
      bestRemainingRatio = remainingRatio;
      const unit = unitLabelFor(def.condition_type);
      nextMilestone = {
        code: def.code,
        titleId: def.title_id,
        titleEn: def.title_en,
        currentValue: result.currentValue,
        threshold: result.threshold,
        remainingRatio,
        priority: def.priority,
        remaining: Math.max(0, Math.round(result.threshold - result.currentValue)),
        unitId: unit.id,
        unitEn: unit.en,
      };
    }
  }

  return { newlyUnlocked, nextMilestone };
}

async function runChecker(
  businessProfileId: string,
  def: Definition,
  healthCache: Map<string, number | null>,
  snapshotCache: SnapshotCache
): Promise<CheckResult | null> {
  const config = def.condition_config || {};

  if (def.condition_type === "business_updates_count") {
    const threshold = Number(config.threshold ?? 1);
    const { count } = await supabase
      .from("business_updates")
      .select("id", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId);
    return { met: (count || 0) >= threshold, currentValue: count || 0, threshold };
  }

  if (def.condition_type === "business_updates_streak_weeks") {
    const threshold = Number(config.threshold ?? 4);
    const { data: snapshots } = await supabase
      .from("progress_snapshots")
      .select("period_start")
      .eq("business_profile_id", businessProfileId)
      .eq("period_type", "week")
      .order("period_start", { ascending: false })
      .limit(threshold);
    const streak = countConsecutiveWeeks((snapshots || []).map((s) => s.period_start as string));
    return { met: streak >= threshold, currentValue: streak, threshold };
  }

  if (def.condition_type === "business_health_score") {
    const threshold = Number(config.threshold ?? 80);
    const overall = await getOverallHealthCached(businessProfileId, healthCache);
    if (overall === null) return { met: false, currentValue: 0, threshold };
    return { met: overall >= threshold, currentValue: overall, threshold };
  }

  const dimension = HEALTH_DIMENSION_CONDITION_TYPES[def.condition_type];
  if (dimension) {
    const threshold = Number(config.threshold ?? 80);
    const score = await getDimensionHealthCached(businessProfileId, dimension, healthCache);
    if (score === null) return { met: false, currentValue: 0, threshold };
    return { met: score >= threshold, currentValue: score, threshold };
  }

  if (def.condition_type === "journey_growth" || def.condition_type === "period_growth") {
    const thresholdPercent = Number(config.thresholdPercent ?? 20);
    const latest = await getLatestSnapshotCached(businessProfileId, snapshotCache);
    const baseline =
      def.condition_type === "journey_growth"
        ? await getBaselineSnapshotCached(businessProfileId, snapshotCache)
        : await getPreviousSnapshotCached(businessProfileId, snapshotCache);

    if (!baseline || !latest || baseline.business_score <= 0) {
      return { met: false, currentValue: 0, threshold: thresholdPercent };
    }
    const percent = ((latest.business_score - baseline.business_score) / baseline.business_score) * 100;
    return { met: percent >= thresholdPercent, currentValue: Math.round(percent), threshold: thresholdPercent };
  }

  if (def.condition_type === "member_since_days") {
    const threshold = Number(config.threshold ?? 30);
    const { data: business } = await supabase
      .from("business_profiles")
      .select("created_at")
      .eq("id", businessProfileId)
      .single();
    if (!business) return { met: false, currentValue: 0, threshold };
    const days = Math.floor((Date.now() - new Date(business.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return { met: days >= threshold, currentValue: days, threshold };
  }

  return null;
}

function countConsecutiveWeeks(periodStartsDesc: string[]): number {
  if (periodStartsDesc.length === 0) return 0;
  let streak = 1;
  for (let i = 0; i < periodStartsDesc.length - 1; i++) {
    const current = new Date(periodStartsDesc[i]);
    const prevExpected = new Date(periodStartsDesc[i + 1]);
    const diffDays = Math.round((current.getTime() - prevExpected.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 7) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// Performance audit finding (Final Audit, Tahap 2.4): versi lama fungsi ini
// menarik SELURUH histori business_health (tanpa limit) lalu mengambil baris
// terbaru per dimensi di JS — query yang tumbuh terus seiring makin banyak
// Business Update. Diganti dengan getDimensionHealthCached() yang query
// ORDER BY evaluated_at DESC LIMIT 1 per dimensi (bounded, tidak tumbuh
// seiring waktu) DAN di-cache per pemanggilan evaluateAchievements(), supaya
// achievement "Business Health di Atas 80" dan 6 achievement per-dimensi
// (sales/finance/customer/marketing/operations/brand) berbagi query yang
// sama alih-alih masing-masing query sendiri.
async function getOverallHealthCached(
  businessProfileId: string,
  cache: Map<string, number | null>
): Promise<number | null> {
  const dims = ["marketing", "sales", "operations", "finance", "customer", "brand"];
  const scores = await Promise.all(dims.map((d) => getDimensionHealthCached(businessProfileId, d, cache)));
  const valid = scores.filter((s): s is number => typeof s === "number");
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, s) => sum + s, 0) / valid.length);
}

async function getDimensionHealthCached(
  businessProfileId: string,
  dimension: string,
  cache: Map<string, number | null>
): Promise<number | null> {
  if (cache.has(dimension)) return cache.get(dimension)!;
  const { data } = await supabase
    .from("business_health")
    .select("score")
    .eq("business_profile_id", businessProfileId)
    .eq("dimension", dimension)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const score = data ? (data.score as number) : null;
  cache.set(dimension, score);
  return score;
}

// Sama seperti health cache di atas: versi lama journey_growth/period_growth
// menarik SELURUH histori progress_snapshots (tanpa limit) padahal cuma
// butuh baseline (baris pertama), latest (baris terakhir), dan previous
// (baris kedua-dari-akhir, khusus period_growth). Diganti 3 query bertarget
// (LIMIT 1 / range 1-1), di-cache per pemanggilan supaya journey_growth dan
// period_growth berbagi query "latest" yang sama.
type SnapshotRow = { business_score: number; period_start: string };
type SnapshotCache = {
  latest?: SnapshotRow | null;
  baseline?: SnapshotRow | null;
  previous?: SnapshotRow | null;
};

async function getLatestSnapshotCached(businessProfileId: string, cache: SnapshotCache): Promise<SnapshotRow | null> {
  if (cache.latest !== undefined) return cache.latest;
  const { data } = await supabase
    .from("progress_snapshots")
    .select("business_score, period_start")
    .eq("business_profile_id", businessProfileId)
    .order("period_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  cache.latest = (data as SnapshotRow | null) ?? null;
  return cache.latest;
}

async function getBaselineSnapshotCached(businessProfileId: string, cache: SnapshotCache): Promise<SnapshotRow | null> {
  if (cache.baseline !== undefined) return cache.baseline;
  const { data } = await supabase
    .from("progress_snapshots")
    .select("business_score, period_start")
    .eq("business_profile_id", businessProfileId)
    .order("period_start", { ascending: true })
    .limit(1)
    .maybeSingle();
  cache.baseline = (data as SnapshotRow | null) ?? null;
  return cache.baseline;
}

async function getPreviousSnapshotCached(businessProfileId: string, cache: SnapshotCache): Promise<SnapshotRow | null> {
  if (cache.previous !== undefined) return cache.previous;
  const { data } = await supabase
    .from("progress_snapshots")
    .select("business_score, period_start")
    .eq("business_profile_id", businessProfileId)
    .order("period_start", { ascending: false })
    .range(1, 1);
  cache.previous = (data && data[0] ? (data[0] as SnapshotRow) : null);
  return cache.previous;
}
