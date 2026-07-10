// services/businessOS/reviewWindow.ts
//
// Business OS Engine — logic BERSAMA untuk Weekly Review (7 hari) dan Monthly
// Snapshot (30 hari). Satu fungsi dipakai oleh keduanya supaya tidak ada
// duplikasi cara menghitung "targets selesai / keputusan dibuat / Business
// Score naik / peluang baru / risiko baru" (lihat services/businessOS/
// weeklyReview.ts dan services/businessOS/monthlySnapshot.ts).
//
// PRINSIP KETAT — semua angka di sini murni MEMBACA ULANG data yang SUDAH
// ADA dan SUDAH nyata, TIDAK ADA logic/AI baru:
//   - targetsCompleted <- business_achievements.unlocked_at dalam window
//     (pencapaian yang sudah diverifikasi Achievement Engine — proxy paling
//     jujur untuk "target/langkah selesai" lintas businessType START & GROW,
//     karena tidak ada tabel "target" terstruktur dengan status selesai)
//   - decisionsMade    <- business_decisions.created_at dalam window
//   - scoreDelta       <- selisih today_snapshot.payload.score antara titik
//     data TERLAMA vs TERBARU dalam window (null kalau titik data <2 — jujur,
//     bukan 0 palsu)
//   - newOpportunities/newRisks <- jumlah signal (today_snapshot.payload
//     .opportunity.key / .topRisk.key) yang BERUBAH dibanding hari
//     sebelumnya di dalam window (menghitung pergantian sinyal, bukan
//     menghitung ulang Competitor/Health Engine)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type ReviewMetrics = {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  targetsCompleted: number;
  decisionsMade: number;
  scoreDelta: number | null;
  newOpportunities: number;
  newRisks: number;
};

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * windowDays=7 untuk Weekly Review, 30 untuk Monthly Snapshot. Window
 * "berjalan" (rolling), berakhir HARI INI, bukan mengikuti kalender
 * Senin-Minggu — supaya bisa dihitung kapan saja tanpa menunggu batas
 * kalender.
 */
export async function computeReviewMetrics(businessProfileId: string, windowDays: number): Promise<ReviewMetrics> {
  const now = new Date();
  const periodEnd = toDateOnly(now);
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (windowDays - 1));
  const periodStart = toDateOnly(startDate);

  const startIso = new Date(`${periodStart}T00:00:00.000Z`).toISOString();
  const endIso = new Date(`${periodEnd}T23:59:59.999Z`).toISOString();

  const [{ count: targetsCompleted }, { count: decisionsMade }, { data: snapshotRows }] = await Promise.all([
    supabase
      .from("business_achievements")
      .select("id", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("unlocked_at", startIso)
      .lte("unlocked_at", endIso),
    supabase
      .from("business_decisions")
      .select("id", { count: "exact", head: true })
      .eq("business_profile_id", businessProfileId)
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("today_snapshot")
      .select("snapshot_date, payload")
      .eq("business_profile_id", businessProfileId)
      .gte("snapshot_date", periodStart)
      .lte("snapshot_date", periodEnd)
      .order("snapshot_date", { ascending: true }),
  ]);

  const rows = snapshotRows || [];

  let scoreDelta: number | null = null;
  if (rows.length >= 2) {
    const oldestScore = (rows[0].payload as Record<string, unknown>)?.score as number | null | undefined;
    const latestScore = (rows[rows.length - 1].payload as Record<string, unknown>)?.score as number | null | undefined;
    if (typeof oldestScore === "number" && typeof latestScore === "number") {
      scoreDelta = latestScore - oldestScore;
    }
  }

  // Hitung pergantian signal opportunity/topRisk hari-ke-hari dalam window —
  // "baru" berarti key (dan parameter pembedanya) berbeda dari hari sebelum
  // itu di dalam window yang sama.
  let newOpportunities = 0;
  let newRisks = 0;
  let prevOpportunityKey: string | null = null;
  let prevRiskKey: string | null = null;

  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const opportunity = payload?.opportunity as { key?: string; params?: Record<string, unknown> } | null;
    const topRisk = payload?.topRisk as { key?: string; params?: Record<string, unknown> } | null;

    const opportunitySignature = opportunity?.key
      ? `${opportunity.key}:${JSON.stringify(opportunity.params || {})}`
      : null;
    const riskSignature = topRisk?.key ? `${topRisk.key}:${JSON.stringify(topRisk.params || {})}` : null;

    if (opportunitySignature && opportunitySignature !== prevOpportunityKey) {
      newOpportunities += 1;
      prevOpportunityKey = opportunitySignature;
    } else if (!opportunitySignature) {
      prevOpportunityKey = null;
    }

    if (riskSignature && riskSignature !== prevRiskKey) {
      newRisks += 1;
      prevRiskKey = riskSignature;
    } else if (!riskSignature) {
      prevRiskKey = null;
    }
  }

  return {
    periodStart,
    periodEnd,
    targetsCompleted: targetsCompleted || 0,
    decisionsMade: decisionsMade || 0,
    scoreDelta,
    newOpportunities,
    newRisks,
  };
}
