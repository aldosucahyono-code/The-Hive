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

  for (const def of definitions as Definition[]) {
    if (unlockedIds.has(def.id)) continue;
    if (UNSUPPORTED_CONDITION_TYPES.has(def.condition_type)) continue;

    const result = await runChecker(businessProfileId, def);
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
      nextMilestone = {
        code: def.code,
        titleId: def.title_id,
        titleEn: def.title_en,
        currentValue: result.currentValue,
        threshold: result.threshold,
        remainingRatio,
        priority: def.priority,
      };
    }
  }

  return { newlyUnlocked, nextMilestone };
}

async function runChecker(businessProfileId: string, def: Definition): Promise<CheckResult | null> {
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
    const overall = await getLatestOverallHealth(businessProfileId);
    if (overall === null) return { met: false, currentValue: 0, threshold };
    return { met: overall >= threshold, currentValue: overall, threshold };
  }

  const dimension = HEALTH_DIMENSION_CONDITION_TYPES[def.condition_type];
  if (dimension) {
    const threshold = Number(config.threshold ?? 80);
    const score = await getLatestDimensionHealth(businessProfileId, dimension);
    if (score === null) return { met: false, currentValue: 0, threshold };
    return { met: score >= threshold, currentValue: score, threshold };
  }

  if (def.condition_type === "journey_growth" || def.condition_type === "period_growth") {
    const thresholdPercent = Number(config.thresholdPercent ?? 20);
    const { data: snapshots } = await supabase
      .from("progress_snapshots")
      .select("business_score, period_start")
      .eq("business_profile_id", businessProfileId)
      .order("period_start", { ascending: true });

    if (!snapshots || snapshots.length === 0) {
      return { met: false, currentValue: 0, threshold: thresholdPercent };
    }

    const baseline = def.condition_type === "journey_growth" ? snapshots[0] : snapshots[snapshots.length - 2];
    const latest = snapshots[snapshots.length - 1];
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

async function getLatestOverallHealth(businessProfileId: string): Promise<number | null> {
  const dims = ["marketing", "sales", "operations", "finance", "customer", "brand"];
  const { data: rows } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false });
  if (!rows || rows.length === 0) return null;

  const latestByDimension: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (!seen.has(row.dimension)) {
      latestByDimension[row.dimension] = row.score;
      seen.add(row.dimension);
    }
  }
  const scores = dims.map((d) => latestByDimension[d]).filter((s) => typeof s === "number");
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

async function getLatestDimensionHealth(businessProfileId: string, dimension: string): Promise<number | null> {
  const { data } = await supabase
    .from("business_health")
    .select("score")
    .eq("business_profile_id", businessProfileId)
    .eq("dimension", dimension)
    .order("evaluated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? (data.score as number) : null;
}
