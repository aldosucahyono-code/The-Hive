// services/businessOS/monthlySnapshot.ts
//
// Business OS Engine — Monthly Snapshot: sama seperti Weekly Review tapi
// window 30-hari-berjalan. Sesuai arahan PO eksplisit: "Belum PDF... snapshot
// bulanan harus sudah disimpan" — PERSIST-ONLY untuk saat ini, tidak ada
// requirement UI. Disiapkan supaya PDF nanti tinggal MEMBACA baris ini tanpa
// menghitung ulang apapun.

import { createClient } from "@supabase/supabase-js";
import { computeReviewMetrics } from "./reviewWindow.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * Menghitung & menyimpan Monthly Snapshot bisnis ini kalau belum ada untuk
 * periode (period_end) hari ini. Dipanggil dari event pipeline (submitUpdate,
 * toggleChecklistItem) yang sama seperti today_snapshot — non-fatal kalau
 * gagal (di-try/catch di pemanggilnya), supaya tidak pernah memblokir alur
 * utama pengguna.
 */
export async function ensureMonthlySnapshot(businessProfileId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("business_monthly_snapshot")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .eq("period_end", today)
    .maybeSingle();

  if (existing) return; // sudah di-cache untuk hari ini, tidak perlu hitung ulang

  const metrics = await computeReviewMetrics(businessProfileId, 30);

  const { data: stageRow } = await supabase
    .from("business_stage_state")
    .select("stage_detail")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("business_monthly_snapshot").upsert(
    {
      business_profile_id: businessProfileId,
      period_start: metrics.periodStart,
      period_end: metrics.periodEnd,
      targets_completed: metrics.targetsCompleted,
      decisions_made: metrics.decisionsMade,
      score_delta: metrics.scoreDelta,
      new_opportunities: metrics.newOpportunities,
      new_risks: metrics.newRisks,
      stage_detail_at_end: stageRow?.stage_detail || null,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "business_profile_id,period_end" }
  );

  if (error) {
    console.error("services/businessOS/monthlySnapshot: upsert error:", error);
  }
}
