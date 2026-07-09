// services/stage/determineStage.ts
//
// Business Stage Engine (Fase 1 — versi sederhana, lihat
// THE-HIVE-BUSINESS-COMMAND-CENTER-ARCHITECTURE.md §5). Layer BARU, murni
// baca Business Engine + business_profiles.business_stage (kolom lama yang
// SUDAH ADA, diisi wizard/create.ts) — tidak pernah mengubah kolom itu, dan
// tidak pernah menghitung ulang apapun dari Business Engine.
//
// Fase 1 sengaja hanya membedakan 2 kelompok ("preparation" / "running").
// 12-stage penuh (IDEA..EXIT) menyusul di fase lanjutan — lihat catatan
// jujur di §3 dokumen arsitektur soal stage 8-11 yang belum punya sinyal
// data objektif.
//
// Rule murni deterministik, TIDAK memanggil Claude API — cepat & gratis,
// bisa dipanggil sesering mungkin.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type StageGroup = "preparation" | "running";

export type StageResult = {
  stageGroup: StageGroup;
  source: "auto" | "manual_override";
  since: string;
};

/** Dipakai langsung (import) oleh services/today/computeSnapshot.ts — bukan
 * lewat HTTP — sama seperti pola submitUpdate.ts mengorkestrasi service lain
 * di Business Engine. ownership businessProfileId sudah dicek oleh pemanggil. */
export async function determineStageInternal(businessProfileId: string): Promise<StageResult> {
  // Cek override manual dulu — kalau ada, itu yang menang, TIDAK ditimpa
  // hasil auto (lihat §5.2: pelanggan selalu punya kontrol untuk mengoreksi).
  const { data: latestState } = await supabase
    .from("business_stage_state")
    .select("stage_group, source, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestState && latestState.source === "manual_override") {
    return {
      stageGroup: latestState.stage_group as StageGroup,
      source: "manual_override",
      since: latestState.created_at as string,
    };
  }

  const { data: business } = await supabase
    .from("business_profiles")
    .select("business_stage, created_at")
    .eq("id", businessProfileId)
    .single();

  const { count: updateCount } = await supabase
    .from("business_updates")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId);

  // Sinyal objektif (§3 tabel stage 1-7): kalau bisnis didaftarkan sebagai
  // "idea" DAN belum pernah isi Business Update sama sekali → masih di
  // kelompok persiapan. Begitu Business Update pertama masuk, atau bisnis
  // memang didaftarkan sebagai "sudah berjalan", masuk kelompok "running".
  const stageGroup: StageGroup =
    business?.business_stage === "idea" && (updateCount || 0) === 0 ? "preparation" : "running";

  if (!latestState || latestState.stage_group !== stageGroup) {
    // Baris baru hanya ditulis kalau memang ada perubahan — konsisten
    // dengan pola business_health (insert baris baru per perubahan nyata,
    // bukan setiap kali dibaca).
    const { data: inserted } = await supabase
      .from("business_stage_state")
      .insert({ business_profile_id: businessProfileId, stage_group: stageGroup, source: "auto" })
      .select("created_at")
      .single();

    return { stageGroup, source: "auto", since: inserted?.created_at || new Date().toISOString() };
  }

  return { stageGroup, source: "auto", since: latestState.created_at as string };
}

/** Endpoint action wrapper (kalau nanti dibutuhkan pelanggan mengoreksi
 * stage manual dari Journey tab — lihat §5.2/§9). Belum dipasang ke router
 * di Fase 1, disiapkan lebih dulu supaya bentuk kontraknya konsisten. */
export async function determineStage(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const result = await determineStageInternal(businessProfileId);
  return { status: 200, body: result };
}
