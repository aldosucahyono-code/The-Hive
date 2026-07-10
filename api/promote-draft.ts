// api/promote-draft.ts
//
// Serverless function (Vercel, Node.js runtime) BARU — dipanggil frontend
// TEPAT SETELAH user berhasil login (Aktifkan Workspace), kalau ada draftId
// tersimpan dari wizard preview gratis sebelumnya (localStorage:
// hive_pending_order).
//
// Tugasnya "menaikkan level" satu wizard_draft anonim menjadi:
//   1. business_profiles (kalau user belum pernah punya bisnis ini)
//   2. analyses           (baseline pertama untuk bisnis itu — otomatis
//                           ditandai is_baseline=true oleh trigger di DB)
//
// Idempotent: kalau draft ini sudah pernah dipromosikan sebelumnya (mis.
// user reload halaman payment 2x), langsung kembalikan business_profile_id
// & analysis_id yang sudah ada, tidak membuat duplikat.
//
// ENV VARIABLES (di Vercel, bukan di frontend):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Silakan login terlebih dahulu." });
    }
    const token = authHeader.slice("Bearer ".length);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Sesi login tidak valid. Silakan login ulang." });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    const { draftId } = req.body;
    if (!draftId || typeof draftId !== "string") {
      return res.status(400).json({ error: "draftId wajib diisi" });
    }

    // Jaga-jaga: pastikan baris `profiles` untuk user ini ada. Biasanya ini
    // sudah otomatis dibuat lewat trigger di auth.users, tapi upsert di sini
    // membuat endpoint ini tidak bergantung pada trigger itu selalu ada.
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
      return res.status(404).json({ error: "Draft tidak ditemukan" });
    }

    // Sudah pernah dipromosikan sebelumnya — kembalikan hasil yang sama,
    // jangan buat business_profile/analysis kedua kalinya.
    if (draft.status === "promoted" && draft.business_profile_id) {
      return res.status(200).json({
        businessProfileId: draft.business_profile_id,
        analysisId: draft.analysis_id,
      });
    }

    const wizardData = draft.wizard_data as Record<string, string>;

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
      console.error("promote-draft business_profiles insert error:", bpError);
      return res.status(500).json({ error: "Gagal membuat business profile" });
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
      console.error("promote-draft analyses insert error:", analysisError);
      return res.status(500).json({ error: "Gagal membuat analisa" });
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

    return res.status(200).json({
      businessProfileId: businessProfile.id,
      analysisId: analysis.id,
    });
  } catch (error) {
    console.error("promote-draft error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
