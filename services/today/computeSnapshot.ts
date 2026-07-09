// services/today/computeSnapshot.ts
//
// Today Engine (Fase 1 — lihat THE-HIVE-BUSINESS-COMMAND-CENTER-ARCHITECTURE.md
// §4). Layer BARU di atas Business Engine — menggabungkan Business Stage
// Engine + fakta Business Engine yang sudah ada jadi satu payload ringkas
// (TodaySnapshot), di-cache 1x per bisnis per hari di tabel today_snapshot.
//
// PRINSIP KETAT (tidak boleh dilanggar):
//   1. Tidak menghitung ulang apapun yang sudah dihitung Business Engine —
//      overall score, journey/period delta semua dibaca lewat service yang
//      SUDAH ADA (getBusinessHealth, getProgress, getHealthTrend), dipanggil
//      langsung sebagai fungsi (in-process), bukan lewat HTTP.
//   2. Payload yang disimpan HANYA data terstruktur (angka, enum, key) — TIDAK
//      ada teks/kalimat yang sudah dirangkai. Ini sengaja meniru pola yang
//      sudah dipakai BusinessScorePanel (statusLabel dihitung dari skor lewat
//      kunci i18n saat render, bukan disimpan sebagai teks beku) — supaya
//      ganti bahasa ID/EN tidak butuh recompute snapshot.
//   3. Fase 1 TIDAK memanggil Claude API sama sekali (sesuai roadmap §15
//      Fase 1: "tanpa AI insight, cuma Business Pulse ambang sederhana").
//      Beemo Insight generatif menyusul Fase 8, membaca payload yang sama.
//
// Cache: 1 baris per bisnis per snapshot_date (constraint unique di migrasi).
// Dihitung ulang kalau: belum ada snapshot hari ini, ATAU dipanggil dengan
// forceRecompute=true (dipakai submitUpdate.ts nanti untuk invalidasi
// event-driven — BELUM disambungkan di Fase 1, lihat catatan di bagian
// bawah file ini).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { getBusinessHealth } from "../workspace/getBusinessHealth.js";
import { getProgress } from "../workspace/getProgress.js";
import { getAchievements } from "../workspace/getAchievements.js";
import { determineStageInternal } from "../stage/determineStage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type PulseLevel = "preparation" | "stable" | "attention" | "action_required";
type PulseReason = { key: string; params?: Record<string, string | number> };

type RuleItem = { key: string; params?: Record<string, string | number> };

// Rule Engine untuk "Peluang Terbaik" — TIDAK PAKAI AI. Ini murni lookup
// tetap: dimensi Business Health terlemah -> 1 saran tindakan yang relevan
// untuk dimensi itu. Sama semangatnya dengan UNIT_LABELS di
// evaluateAchievements.ts — tabel referensi statis, bukan opini yang
// dikarang saat runtime. Kalau saran ini dirasa kurang tepat, PERBAIKI
// isi tabelnya (§ dokumen arsitektur), bukan diganti jadi panggilan AI.
const DIMENSION_OPPORTUNITY_KEY: Record<string, string> = {
  marketing: "opportunityMarketing",
  sales: "opportunitySales",
  finance: "opportunityFinance",
  customer: "opportunityCustomer",
  operations: "opportunityOperations",
  brand: "opportunityBrand",
};

export type TodaySnapshotPayload = {
  stageGroup: "preparation" | "running";
  stageSource: "auto" | "manual_override";
  pulseLevel: PulseLevel;
  pulseReasons: PulseReason[];
  score: number | null;
  journeyDelta: number | null;
  periodDelta: number | null;
  daysSinceUpdate: number | null;
  lastUpdateAt: string | null;
  // Sampai 3 item, diurutkan berdasarkan urgensi — semua rule-based dari
  // Business Engine (data freshness, dimensi terlemah, kedekatan achievement).
  priorities: RuleItem[];
  topRisk: RuleItem | null;
  opportunity: RuleItem | null;
  whatChanged: Array<{ dimension: string; delta: number }> | null;
  nextMilestone: {
    titleId: string;
    titleEn: string;
    remaining: number;
    unitId: string;
    unitEn: string;
  } | null;
};

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  return Math.floor((now.getTime() - then) / (1000 * 60 * 60 * 24));
}

async function buildSnapshot(userId: string, businessProfileId: string): Promise<TodaySnapshotPayload> {
  const stage = await determineStageInternal(businessProfileId);

  // Reuse service Business Engine yang SUDAH ADA — tidak menghitung ulang.
  // getAchievements ikut dipanggil di sini (bukan cuma dari tab Growth) —
  // ini AMAN karena evaluateAchievements() di baliknya sudah idempotent &
  // di-cache per pemanggilan (lihat ACHIEVEMENT-ENGINE-FINAL.md §3), jadi
  // tidak menduplikasi logic, hanya menambah satu titik pemanggilan baru.
  const [healthRes, progressRes, achievementsRes] = await Promise.all([
    getBusinessHealth(userId, { businessProfileId }),
    getProgress(userId, { businessProfileId }),
    getAchievements(userId, { businessProfileId }),
  ]);

  const health = healthRes.body as { dimensions: Record<string, number> | null; overall: number | null };
  const progress = progressRes.body as {
    journey: { delta: number } | null;
    period: { delta: number } | null;
  };
  const achievementsBody = achievementsRes.body as {
    nextMilestone: {
      titleId: string;
      titleEn: string;
      remaining: number;
      unitId: string;
      unitEn: string;
      remainingRatio: number;
    } | null;
  };

  const { data: latestUpdate } = await supabase
    .from("business_updates")
    .select("created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const daysSinceUpdate = latestUpdate ? daysBetween(latestUpdate.created_at as string, now) : null;

  // --- Business Pulse: ambang sederhana, bukan skor baru (§4.2) ---
  let pulseLevel: PulseLevel;
  const reasons: PulseReason[] = [];

  if (stage.stageGroup === "preparation") {
    pulseLevel = "preparation";
  } else if (daysSinceUpdate === null) {
    pulseLevel = "action_required";
    reasons.push({ key: "neverUpdated" });
  } else if (daysSinceUpdate > 14) {
    pulseLevel = "action_required";
    reasons.push({ key: "updateOverdue", params: { days: daysSinceUpdate } });
  } else if (daysSinceUpdate > 7 || (progress.period && progress.period.delta < 0)) {
    pulseLevel = "attention";
    if (daysSinceUpdate > 7) reasons.push({ key: "updateOverdue", params: { days: daysSinceUpdate } });
    if (progress.period && progress.period.delta < 0) {
      reasons.push({ key: "scoreDown", params: { points: Math.abs(progress.period.delta) } });
    }
  } else {
    pulseLevel = "stable";
    if (progress.period && progress.period.delta > 0) {
      reasons.push({ key: "scoreUp", params: { points: progress.period.delta } });
    }
  }

  // --- Prioritas / Risiko / Peluang: Rule Engine, TANPA AI ---
  // Semua di bawah ini diturunkan dari angka yang sudah dihitung Business
  // Engine (health, progress, achievement) lewat aturan tetap (if/else),
  // BUKAN dari Claude API. Ini menjawab arahan Product Owner: "Opportunity
  // tidak harus AI. Opportunity bisa dibuat dari Business Engine."
  const weakestEntry = health.dimensions
    ? Object.entries(health.dimensions).reduce((a, b) => (b[1] < a[1] ? b : a), Object.entries(health.dimensions)[0])
    : null;

  const priorities: RuleItem[] = [];
  let topRisk: RuleItem | null = null;
  let opportunity: RuleItem | null = null;

  if (stage.stageGroup === "preparation") {
    // Fase persiapan: satu-satunya prioritas nyata adalah mulai mengisi
    // Business Update pertama — checklist detail persiapan dirender
    // terpisah di UI dari template statis (bukan dari Today Engine).
    priorities.push({ key: "startFirstUpdate" });
  } else {
    if (daysSinceUpdate === null || daysSinceUpdate > 7) {
      priorities.push({ key: "fillBusinessUpdate", params: { days: daysSinceUpdate ?? 0 } });
    }
    if (weakestEntry) {
      priorities.push({ key: "focusWeakDimension", params: { dimension: weakestEntry[0], score: weakestEntry[1] } });
    }
    if (achievementsBody.nextMilestone && achievementsBody.nextMilestone.remainingRatio < 0.3) {
      priorities.push({
        key: "achievementNudge",
        params: {
          remaining: achievementsBody.nextMilestone.remaining,
          titleId: achievementsBody.nextMilestone.titleId,
          titleEn: achievementsBody.nextMilestone.titleEn,
        },
      });
    }
    if (priorities.length === 0) priorities.push({ key: "keepGoing" });

    // Risiko terbesar — SATU sinyal negatif paling mendesak, urutan tetap:
    // data basi > skor turun > dimensi sangat rendah. Kalau tidak ada yang
    // cocok, jujur tidak ada risiko besar terdeteksi (tidak dipaksakan).
    if (daysSinceUpdate !== null && daysSinceUpdate > 14) {
      topRisk = { key: "riskUpdateOverdue", params: { days: daysSinceUpdate } };
    } else if (progress.period && progress.period.delta < 0) {
      topRisk = { key: "riskScoreDown", params: { points: Math.abs(progress.period.delta) } };
    } else if (weakestEntry && weakestEntry[1] < 45) {
      topRisk = { key: "riskWeakDimension", params: { dimension: weakestEntry[0], score: weakestEntry[1] } };
    }

    // Peluang terbaik — lookup tetap dari dimensi terlemah (lihat
    // DIMENSION_OPPORTUNITY_KEY di atas), bukan opini AI.
    if (weakestEntry) {
      opportunity = { key: DIMENSION_OPPORTUNITY_KEY[weakestEntry[0]] || "opportunityGeneric" };
    }
  }

  // --- Yang berubah sejak periode lalu: presentasi ulang getHealthTrend ---
  let whatChanged: Array<{ dimension: string; delta: number }> | null = null;
  const { data: trendRows } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false })
    .limit(12); // cukup untuk 2 batch terakhir (maks 6 dimensi x 2)

  if (trendRows && trendRows.length > 0) {
    const batches = new Map<string, Record<string, number>>();
    for (const row of trendRows) {
      const key = row.evaluated_at as string;
      if (!batches.has(key)) batches.set(key, {});
      batches.get(key)![row.dimension as string] = row.score as number;
    }
    const sortedKeys = Array.from(batches.keys()).sort((a, b) => b.localeCompare(a));
    if (sortedKeys.length >= 2) {
      const latest = batches.get(sortedKeys[0])!;
      const previous = batches.get(sortedKeys[1])!;
      whatChanged = Object.entries(latest)
        .filter(([dim]) => typeof previous[dim] === "number")
        .map(([dim, score]) => ({ dimension: dim, delta: score - previous[dim] }));
    }
  }

  const nextMilestone = achievementsBody.nextMilestone
    ? {
        titleId: achievementsBody.nextMilestone.titleId,
        titleEn: achievementsBody.nextMilestone.titleEn,
        remaining: achievementsBody.nextMilestone.remaining,
        unitId: achievementsBody.nextMilestone.unitId,
        unitEn: achievementsBody.nextMilestone.unitEn,
      }
    : null;

  return {
    stageGroup: stage.stageGroup,
    stageSource: stage.source,
    pulseLevel,
    pulseReasons: reasons,
    score: health.overall,
    journeyDelta: progress.journey?.delta ?? null,
    periodDelta: progress.period?.delta ?? null,
    daysSinceUpdate,
    lastUpdateAt: (latestUpdate?.created_at as string) || null,
    priorities,
    topRisk,
    opportunity,
    whatChanged,
    nextMilestone,
  };
}

export async function getTodaySnapshot(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("today_snapshot")
    .select("payload, computed_at")
    .eq("business_profile_id", businessProfileId)
    .eq("snapshot_date", today)
    .maybeSingle();

  if (existing && !payload.forceRecompute) {
    return { status: 200, body: { snapshot: existing.payload, computedAt: existing.computed_at } };
  }

  const snapshot = await buildSnapshot(userId, businessProfileId);

  const { data: saved, error: upsertError } = await supabase
    .from("today_snapshot")
    .upsert(
      { business_profile_id: businessProfileId, snapshot_date: today, payload: snapshot, computed_at: new Date().toISOString() },
      { onConflict: "business_profile_id,snapshot_date" }
    )
    .select("payload, computed_at")
    .single();

  if (upsertError) {
    console.error("services/today/computeSnapshot upsert error:", upsertError);
    // Tetap kembalikan hasil hitungan meski gagal cache, supaya UI tidak
    // gagal total hanya karena snapshot tidak tersimpan.
    return { status: 200, body: { snapshot, computedAt: new Date().toISOString() } };
  }

  return { status: 200, body: { snapshot: saved.payload, computedAt: saved.computed_at } };
}

// CATATAN Fase lanjutan (belum dikerjakan di Fase 1, dicatat supaya tidak
// lupa): submitUpdate.ts sebaiknya memanggil getTodaySnapshot(...,
// { forceRecompute: true }) setelah Business Engine selesai recalculate,
// persis pola yang sama seperti pemicu evaluateAchievements() — supaya
// Today berubah SAAT ITU JUGA, bukan menunggu snapshot besok. Sengaja TIDAK
// disambungkan di Fase 1 supaya perubahan ke submitUpdate.ts (file inti
// Business Engine) ditinjau terpisah, bukan ikut menumpang perubahan Today
// Engine yang murni additive.
