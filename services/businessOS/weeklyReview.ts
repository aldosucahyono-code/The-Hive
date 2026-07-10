// services/businessOS/weeklyReview.ts
//
// Business OS Engine — Weekly Review: rekap rule-based 7-hari-berjalan
// (targets selesai, keputusan dibuat, Business Score naik, peluang baru,
// risiko baru), di-cache 1x per bisnis per hari supaya tidak dihitung ulang
// setiap kali Workspace dibuka. Ditampilkan di Workspace, BUKAN PDF (PDF
// masih ditunda sesuai arahan PO).
//
// Semua angka berasal dari services/businessOS/reviewWindow.ts (murni baca
// ulang data yang sudah ada) — tidak ada logic penghitungan baru di file ini.

import { createClient } from "@supabase/supabase-js";
import { computeReviewMetrics } from "./reviewWindow.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

type ServiceResult = { status: number; body: Record<string, unknown> };

export type WeeklyReviewPayload = {
  weekStart: string;
  weekEnd: string;
  targetsCompleted: number;
  decisionsMade: number;
  scoreDelta: number | null;
  newOpportunities: number;
  newRisks: number;
};

async function checkOwnership(businessProfileId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();
  return !!data && data.user_id === userId;
}

/**
 * Menghitung ulang Weekly Review saat ini (rolling 7 hari, berakhir hari
 * ini) dan menyimpannya. Dipanggil dari getWeeklyReview() setiap kali cache
 * hari ini belum ada — TIDAK dipanggil setiap kali halaman dibuka (lihat
 * pengecekan cache di bawah), konsisten dengan prinsip Snapshot Engine yang
 * sudah dipakai today_snapshot.
 */
async function recomputeAndSave(businessProfileId: string): Promise<WeeklyReviewPayload> {
  const metrics = await computeReviewMetrics(businessProfileId, 7);

  const row = {
    business_profile_id: businessProfileId,
    week_start: metrics.periodStart,
    week_end: metrics.periodEnd,
    targets_completed: metrics.targetsCompleted,
    decisions_made: metrics.decisionsMade,
    score_delta: metrics.scoreDelta,
    new_opportunities: metrics.newOpportunities,
    new_risks: metrics.newRisks,
    computed_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("business_weekly_review")
    .upsert(row, { onConflict: "business_profile_id,week_end" });

  if (error) {
    console.error("services/businessOS/weeklyReview: upsert error:", error);
  }

  return {
    weekStart: metrics.periodStart,
    weekEnd: metrics.periodEnd,
    targetsCompleted: metrics.targetsCompleted,
    decisionsMade: metrics.decisionsMade,
    scoreDelta: metrics.scoreDelta,
    newOpportunities: metrics.newOpportunities,
    newRisks: metrics.newRisks,
  };
}

export async function getWeeklyReview(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  if (!(await checkOwnership(businessProfileId, userId))) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const today = new Date().toISOString().slice(0, 10);

  if (!payload.forceRecompute) {
    const { data: existing } = await supabase
      .from("business_weekly_review")
      .select("week_start, week_end, targets_completed, decisions_made, score_delta, new_opportunities, new_risks")
      .eq("business_profile_id", businessProfileId)
      .eq("week_end", today)
      .maybeSingle();

    if (existing) {
      return {
        status: 200,
        body: {
          review: {
            weekStart: existing.week_start,
            weekEnd: existing.week_end,
            targetsCompleted: existing.targets_completed,
            decisionsMade: existing.decisions_made,
            scoreDelta: existing.score_delta,
            newOpportunities: existing.new_opportunities,
            newRisks: existing.new_risks,
          },
        },
      };
    }
  }

  const review = await recomputeAndSave(businessProfileId);
  return { status: 200, body: { review } };
}

// Business OS Engine — dipakai internal oleh getBusinessOS.ts (aggregator)
// supaya tidak perlu melalui HTTP payload/ServiceResult wrapper.
// forceRecompute=true dipakai saat Business Update baru saja dikirim, supaya
// Weekly Review (targets/keputusan/score hari ini) ikut segar SAAT ITU JUGA,
// sama seperti forceRecompute pada Today Snapshot.
export async function getWeeklyReviewInternal(
  businessProfileId: string,
  forceRecompute = false
): Promise<WeeklyReviewPayload> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from("business_weekly_review")
    .select("week_start, week_end, targets_completed, decisions_made, score_delta, new_opportunities, new_risks")
    .eq("business_profile_id", businessProfileId)
    .eq("week_end", today)
    .maybeSingle();

  if (existing && !forceRecompute) {
    return {
      weekStart: existing.week_start,
      weekEnd: existing.week_end,
      targetsCompleted: existing.targets_completed,
      decisionsMade: existing.decisions_made,
      scoreDelta: existing.score_delta,
      newOpportunities: existing.new_opportunities,
      newRisks: existing.new_risks,
    };
  }

  return recomputeAndSave(businessProfileId);
}
