// services/workspace/getProgress.ts
//
// Membaca hasil Progress Engine (progress_snapshots) — murni baca, tidak
// menghitung apapun (perhitungan sudah dilakukan recalculateProgress.ts).
//
// Journey Progress = snapshot PALING AWAL (baseline, titik awal tetap)
//                     dibanding snapshot TERBARU.
// Period Progress   = snapshot SEBELUMNYA dibanding snapshot TERBARU.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getProgress(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const { data: snapshots, error } = await supabase
    .from("progress_snapshots")
    .select("id, period_start, period_end, business_score, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("period_start", { ascending: true });

  if (error) {
    console.error("services/workspace/getProgress error:", error);
    return { status: 500, body: { error: "Gagal memuat progress bisnis" } };
  }

  if (!snapshots || snapshots.length === 0) {
    return { status: 200, body: { journey: null, period: null } };
  }

  const baseline = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

  const journey = {
    baselineScore: baseline.business_score,
    baselineDate: baseline.period_start,
    currentScore: latest.business_score,
    currentDate: latest.period_start,
    delta: latest.business_score - baseline.business_score,
  };

  const period = previous
    ? {
        previousScore: previous.business_score,
        previousDate: previous.period_start,
        currentScore: latest.business_score,
        currentDate: latest.period_start,
        delta: latest.business_score - previous.business_score,
      }
    : null;

  return { status: 200, body: { journey, period } };
}
