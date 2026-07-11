// services/business/promoteDraft.ts
//
// Business logic untuk action "promoteDraft" di router /api/workspace.
// Sebelumnya endpoint terpisah (api/promote-draft.ts) — dipindah ke sini
// (audit Juli 2026) SEMATA-MATA supaya jumlah Vercel Serverless Functions
// tidak melebihi batas 12 di plan Hobby ("No more than 12 Serverless
// Functions can be added to a Deployment on the Hobby plan"). Tidak ada
// perubahan perilaku — request/response shape persis sama seperti endpoint
// lama, hanya dipanggil lewat POST /api/workspace dengan action
// "promoteDraft" alih-alih POST /api/promote-draft langsung.
//
// Dipanggil frontend TEPAT SETELAH user berhasil login (Aktifkan Workspace),
// kalau ada draftId tersimpan dari wizard preview gratis sebelumnya
// (localStorage: hive_pending_order).
//
// Tugasnya "menaikkan level" satu wizard_draft anonim menjadi:
//   1. business_profiles (kalau user belum pernah punya bisnis ini)
//   2. analyses           (baseline pertama untuk bisnis itu — otomatis
//                           ditandai is_baseline=true oleh trigger di DB)
//
// Idempotent: kalau draft ini sudah pernah dipromosikan sebelumnya (mis.
// user reload halaman payment 2x), langsung kembalikan business_profile_id
// & analysis_id yang sudah ada, tidak membuat duplikat.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./create.js";
import { checkBusinessCap } from "./checkBusinessCap.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Tebakan awal business_stage dari jawaban wizard. Ini masih kasar — nanti
 * bisa disempurnakan begitu Business Engine (Tahap 2 berikutnya) jalan,
 * tapi untuk sekarang cukup: "baru mau mulai" vs "sudah berjalan". */
function guessBusinessStage(jenisAnalisis: string | undefined): "idea" | "running" {
  return jenisAnalisis === "baru" ? "idea" : "running";
}

/** business_type (Business Context — Business Discovery & Dual Workspace
 * directive): "SATU FIELD, SATU STATUS" yang dibaca seluruh platform
 * (Workspace/Chat/PDF) untuk memilih versi mentor mana yang ditampilkan.
 * Ditentukan SEKALI di sini, dari jawaban Business Discovery yang sama
 * dengan guessBusinessStage — tidak berubah lagi setelahnya. */
function resolveBusinessType(jenisAnalisis: string | undefined): "start" | "grow" {
  return jenisAnalisis === "baru" ? "start" : "grow";
}

export async function promoteDraft(
  userId: string,
  userEmail: string | null,
  payload: Record<string, unknown>
): Promise<ServiceResult> {
  const draftId = payload.draftId;
  if (!draftId || typeof draftId !== "string") {
    return { status: 400, body: { error: "draftId wajib diisi" } };
  }

  // Jaga-jaga: pastikan baris `profiles` untuk user ini ada. Biasanya ini
  // sudah otomatis dibuat lewat trigger di auth.users, tapi upsert di sini
  // membuat action ini tidak bergantung pada trigger itu selalu ada.
  await supabase.from("profiles").upsert(
    { id: userId, email: userEmail },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const { data: draft, error: draftError } = await supabase
    .from("wizard_drafts")
    .select("id, wizard_data, preview_content, status, business_profile_id, analysis_id")
    .eq("id", draftId)
    .single();

  if (draftError || !draft) {
    return { status: 404, body: { error: "Draft tidak ditemukan" } };
  }

  const wizardData = draft.wizard_data as Record<string, string>;

  // Guard integritas data (fix bug: "bisnis pelanggan masuk ke akun
  // developer"). Root cause: PreviewReport.tsx (auto-promote) dan
  // PaymentPage.tsx (promote-draft setelah checkout) sebelumnya memanggil
  // action ini begitu ADA sesi login aktif di browser — tanpa mengecek
  // apakah sesi itu benar-benar milik orang yang mengisi wizard. Kalau
  // developer (atau siapapun) kebetulan sudah login di browser yang sama
  // saat wizard diisi dengan nama+email pelanggan lain, bisnisnya langsung
  // "naik level" ke akun yang sedang login itu — bukan ke akun pelanggan.
  // Di sinilah satu-satunya tempat yang tahu KEDUANYA (email yang diisi di
  // wizard, dan siapa yang sedang login) — jadi guard-nya diletakkan di
  // sini, bukan di frontend (frontend bisa dilewati/di-bypass).
  // Cocokkan case-insensitive + trim. Kalau wizard_data lama tidak punya
  // field email, jangan blokir (data legacy) — tapi untuk draft baru email
  // selalu wajib diisi di ChatFlow, jadi ini seharusnya selalu ada.
  const draftEmail = typeof wizardData?.email === "string" ? wizardData.email.trim().toLowerCase() : "";
  const sessionEmail = (userEmail || "").trim().toLowerCase();
  if (draftEmail && sessionEmail && draftEmail !== sessionEmail) {
    return {
      status: 409,
      body: {
        error: "Bisnis ini dibuat dengan email yang berbeda dari akun yang sedang login.",
        emailMismatch: true,
        draftEmail: wizardData.email,
      },
    };
  }

  // Sudah pernah dipromosikan sebelumnya — kembalikan hasil yang sama,
  // jangan buat business_profile/analysis kedua kalinya.
  if (draft.status === "promoted" && draft.business_profile_id) {
    return {
      status: 200,
      body: { businessProfileId: draft.business_profile_id, analysisId: draft.analysis_id },
    };
  }

  // Batas jumlah usaha per akun (lihat services/business/checkBusinessCap.ts)
  // — ini titik masuk pertama yang otentik (user sudah login) untuk alur
  // wizard gratis di landing page, jadi di sinilah pengecekan pertama kali
  // benar-benar bisa dilakukan dengan aman (bukan saat mengetik email di
  // wizard anonim, yang belum tentu benar-benar pemilik email itu).
  const capResult = await checkBusinessCap(userId);
  if (!capResult.allowed) {
    return {
      status: 403,
      body: {
        error: "Batas jumlah usaha untuk paket kamu saat ini sudah tercapai.",
        capExceeded: true,
        ...capResult,
      },
    };
  }

  const { data: businessProfile, error: bpError } = await supabase
    .from("business_profiles")
    .insert({
      user_id: userId,
      business_name: wizardData.namaBisnis || "Bisnis Tanpa Nama",
      industry: wizardData.jenisBisnis || null,
      business_stage: guessBusinessStage(wizardData.jenisAnalisis),
      business_type: resolveBusinessType(wizardData.jenisAnalisis),
    })
    .select("id")
    .single();

  if (bpError || !businessProfile) {
    console.error("services/business/promoteDraft business_profiles insert error:", bpError);
    return { status: 500, body: { error: "Gagal membuat business profile" } };
  }

  const { data: analysis, error: analysisError } = await supabase
    .from("analyses")
    .insert({
      business_profile_id: businessProfile.id,
      raw_input: wizardData,
      ai_output: draft.preview_content,
    })
    .select("id")
    .single();

  if (analysisError || !analysis) {
    console.error("services/business/promoteDraft analyses insert error:", analysisError);
    return { status: 500, body: { error: "Gagal membuat analisa" } };
  }

  await supabase
    .from("wizard_drafts")
    .update({
      status: "promoted",
      business_profile_id: businessProfile.id,
      analysis_id: analysis.id,
      promoted_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  return {
    status: 200,
    body: { businessProfileId: businessProfile.id, analysisId: analysis.id },
  };
}
