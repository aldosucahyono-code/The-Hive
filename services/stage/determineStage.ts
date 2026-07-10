// services/stage/determineStage.ts
//
// Business Stage Engine.
//
// Fase 1 (asli): hanya membedakan 2 kelompok ("preparation" / "running") —
// stageGroup ini TETAP ADA dan TETAP dipakai Today Pulse (lihat
// services/today/computeSnapshot.ts), tidak diganti.
//
// Fase Living Business Loop (directive "CONTINUE — LIVING BUSINESS LOOP"):
// menambah stageDetail — 11 langkah untuk business_type='start', 6 langkah
// untuk business_type='grow' — persis seperti diminta PO. Ini PERLUASAN
// ADDITIVE terhadap business_stage_state (kolom stage_detail, lihat
// migrations/2026-07-10_living_business_loop.sql), sudah diantisipasi sejak
// komentar migrasi Fase 1 ("12-stage penuh menyusul di fase lanjutan").
//
// PRINSIP KETAT (tidak berubah dari Fase 1):
// - Rule murni deterministik, TIDAK memanggil Claude API.
// - Stage berubah berdasarkan EVENT NYATA (checklist selesai, Business
//   Update tersimpan, Business Health/Progress/Achievement berubah) — BUKAN
//   dipilih manual oleh Claude atau ditebak dari teks bebas.
// - determineStageInternal TIDAK menghitung ulang Business Health/Progress/
//   Achievement sendiri — signal itu WAJIB dikirim oleh pemanggil (yang
//   sudah memanggil getBusinessHealth/getProgress/getAchievements), supaya
//   tidak ada dua tempat yang menghitung angka yang sama.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type StageGroup = "preparation" | "running";

export type StageDetailStart =
  | "idea"
  | "validasi"
  | "persiapan"
  | "supplier"
  | "legalitas"
  | "branding"
  | "marketing"
  | "soft_opening"
  | "grand_opening"
  | "operasional"
  | "growth";

export type StageDetailGrow = "stabil" | "bertumbuh" | "optimasi" | "ekspansi" | "scale" | "systemize";

export type StageDetail = StageDetailStart | StageDetailGrow;

export type StageSignals = {
  overallScore: number | null;
  journeyDelta: number | null;
  achievementsUnlockedCount: number;
};

export type StageResult = {
  stageGroup: StageGroup;
  stageDetail: StageDetail;
  source: "auto" | "manual_override";
  since: string;
};

// Checklist item -> apa yang ditandainya (lihat PREPARATION_CHECKLIST_KEYS di
// src/components/Workspace.tsx / todayChecklistPrep1-10 di translations.ts):
//   prep1 = analisa lokasi, prep2 = cari supplier, prep3 = regulasi/izin,
//   prep4 = franchise/kemitraan (opsional, tidak semua bisnis relevan),
//   prep5 = hitung modal, prep6 = Google Business Profile,
//   prep7 = nama usaha & logo, prep8 = rencana Soft Opening,
//   prep9 = rencana Grand Opening, prep10 = harga jual awal.
// prep4 sengaja TIDAK dijadikan syarat "semua selesai" — bisnis yang bukan
// franchise/kemitraan tidak boleh terhambat progresnya oleh item yang memang
// tidak relevan untuknya.
const START_GATE_KEYS = ["prep1", "prep2", "prep3", "prep5", "prep6", "prep7", "prep8", "prep9", "prep10"];

function computeStartStageDetail(completedKeys: Set<string>, updateCount: number): StageDetailStart {
  const has = (k: string) => completedKeys.has(k);
  const allGateDone = START_GATE_KEYS.every(has);

  // Dicek dari langkah PALING JAUH ke belakang — supaya kalau pengguna
  // menandai beberapa item tidak berurutan, stage yang diambil tetap yang
  // paling jauh SUDAH BENAR-BENAR tercapai (bukan langkah pertama yang
  // kebetulan belum ditandai).
  if (allGateDone && updateCount >= 4) return "growth";
  if (allGateDone) return "operasional";
  if (has("prep9")) return "grand_opening";
  if (has("prep8")) return "soft_opening";
  if (has("prep10")) return "marketing";
  if (has("prep6") && has("prep7")) return "branding";
  if (has("prep3")) return "legalitas";
  if (has("prep2")) return "supplier";
  if (has("prep1") && has("prep5")) return "persiapan";
  if (completedKeys.size > 0 || updateCount > 0) return "validasi";
  return "idea";
}

function computeGrowStageDetail(signals: StageSignals): StageDetailGrow {
  const { overallScore, journeyDelta, achievementsUnlockedCount } = signals;
  if (overallScore === null) return "stabil";
  if (overallScore >= 90 && achievementsUnlockedCount >= 8) return "systemize";
  if (overallScore >= 85) return "scale";
  if (overallScore >= 75 && achievementsUnlockedCount >= 3) return "ekspansi";
  if (overallScore >= 60) return "optimasi";
  if (journeyDelta !== null && journeyDelta > 0) return "bertumbuh";
  return "stabil";
}

/** Dipakai langsung (import) oleh services/today/computeSnapshot.ts — bukan
 * lewat HTTP. ownership businessProfileId sudah dicek oleh pemanggil.
 * `signals` WAJIB dikirim pemanggil untuk businessType='grow' (dipakai
 * computeGrowStageDetail) — kalau tidak dikirim, fallback aman ke "stabil"
 * (bukan ditebak). Untuk businessType='start', signals tidak dipakai. */
export async function determineStageInternal(businessProfileId: string, signals?: StageSignals): Promise<StageResult> {
  // Cek override manual dulu — kalau ada, itu yang menang, TIDAK ditimpa
  // hasil auto (pelanggan selalu punya kontrol untuk mengoreksi).
  const { data: latestState } = await supabase
    .from("business_stage_state")
    .select("stage_group, stage_detail, source, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestState && latestState.source === "manual_override") {
    return {
      stageGroup: latestState.stage_group as StageGroup,
      stageDetail: (latestState.stage_detail as StageDetail) || "idea",
      source: "manual_override",
      since: latestState.created_at as string,
    };
  }

  const { data: business } = await supabase
    .from("business_profiles")
    .select("business_stage, business_type, created_at")
    .eq("id", businessProfileId)
    .single();

  const { count: updateCount } = await supabase
    .from("business_updates")
    .select("id", { count: "exact", head: true })
    .eq("business_profile_id", businessProfileId);

  const businessType: "start" | "grow" =
    business?.business_type === "start" || business?.business_type === "grow"
      ? business.business_type
      : business?.business_stage === "idea" || business?.business_stage === "starting"
        ? "start"
        : "grow";

  // Sinyal objektif (Fase 1, tetap dipakai Today Pulse): kalau bisnis
  // didaftarkan sebagai "idea" DAN belum pernah isi Business Update sama
  // sekali → masih di kelompok persiapan.
  const stageGroup: StageGroup =
    business?.business_stage === "idea" && (updateCount || 0) === 0 ? "preparation" : "running";

  let stageDetail: StageDetail;
  if (businessType === "start") {
    const { data: checklistRows } = await supabase
      .from("business_checklist_progress")
      .select("item_key")
      .eq("business_profile_id", businessProfileId);
    const completedKeys = new Set((checklistRows || []).map((r) => r.item_key as string));
    stageDetail = computeStartStageDetail(completedKeys, updateCount || 0);
  } else {
    stageDetail = computeGrowStageDetail(
      signals || { overallScore: null, journeyDelta: null, achievementsUnlockedCount: 0 }
    );
  }

  if (!latestState || latestState.stage_group !== stageGroup || latestState.stage_detail !== stageDetail) {
    // Baris baru hanya ditulis kalau memang ada perubahan — konsisten
    // dengan pola business_health (insert baris baru per perubahan nyata,
    // bukan setiap kali dibaca). Ini juga yang membuat Journey/Timeline bisa
    // menampilkan kapan bisnis naik fase.
    const { data: inserted } = await supabase
      .from("business_stage_state")
      .insert({ business_profile_id: businessProfileId, stage_group: stageGroup, stage_detail: stageDetail, source: "auto" })
      .select("created_at")
      .single();

    return { stageGroup, stageDetail, source: "auto", since: inserted?.created_at || new Date().toISOString() };
  }

  return { stageGroup, stageDetail, source: "auto", since: latestState.created_at as string };
}

/** Endpoint action wrapper (kalau nanti dibutuhkan pelanggan mengoreksi
 * stage manual dari Journey tab). Belum dipasang ke router, disiapkan lebih
 * dulu supaya bentuk kontraknya konsisten. Memanggil Business Health/
 * Progress/Achievement sendiri di sini (satu-satunya tempat yang boleh,
 * karena endpoint ini dipanggil berdiri sendiri, bukan dari computeSnapshot
 * yang sudah punya angkanya) — TIDAK menduplikasi rumus, hanya memanggil
 * fungsi yang sudah ada. */
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

  const { getBusinessHealth } = await import("../workspace/getBusinessHealth.js");
  const { getProgress } = await import("../workspace/getProgress.js");
  const { getAchievements } = await import("../workspace/getAchievements.js");

  const [healthRes, progressRes, achievementsRes] = await Promise.all([
    getBusinessHealth(userId, { businessProfileId }),
    getProgress(userId, { businessProfileId }),
    getAchievements(userId, { businessProfileId }),
  ]);

  const health = healthRes.body as { overall: number | null };
  const progress = progressRes.body as { journey: { delta: number } | null };
  const achievements = achievementsRes.body as { unlocked: unknown[] };

  const result = await determineStageInternal(businessProfileId, {
    overallScore: health.overall,
    journeyDelta: progress.journey?.delta ?? null,
    achievementsUnlockedCount: achievements.unlocked?.length || 0,
  });
  return { status: 200, body: result };
}
