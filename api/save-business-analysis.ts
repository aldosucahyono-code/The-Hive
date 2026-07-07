// api/save-business-analysis.ts
//
// Dipanggil dari dalam Workspace, setelah "+ Tambah Bisnis Baru" membuat
// business_profile baru DAN memanggil /api/generate-preview untuk analisa
// awalnya. Endpoint ini yang menyimpan hasil preview itu ke tabel
// `analyses`, terikat ke business_profile yang baru dibuat.
//
// Beda dengan /api/promote-draft: di sini business_profile SUDAH ADA
// (dibuat oleh /api/create-business), jadi tidak perlu wizard_drafts sama
// sekali — user memang sudah login dari awal.
//
// Analisa yang tersimpan lewat sini SELALU berstatus preview gratis (sama
// seperti pelanggan baru pertama kali coba THE HIVE) — karena tier/akses
// adalah milik business_profile masing-masing (lihat `subscriptions`),
// bukan otomatis ikut tier bisnis lain milik akun yang sama.
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

    const { businessProfileId, wizardData, preview } = req.body;

    if (!businessProfileId || typeof businessProfileId !== "string") {
      return res.status(400).json({ error: "businessProfileId wajib diisi" });
    }

    // Pastikan business_profile ini benar milik user yang sedang login.
    const { data: businessProfile, error: bpError } = await supabase
      .from("business_profiles")
      .select("id, user_id")
      .eq("id", businessProfileId)
      .single();

    if (bpError || !businessProfile || businessProfile.user_id !== userId) {
      return res.status(403).json({ error: "Business profile tidak valid untuk akun ini." });
    }

    const { data: analysis, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        business_profile_id: businessProfileId,
        raw_input: wizardData || null,
        ai_output: preview || null,
      })
      .select("id")
      .single();

    if (analysisError || !analysis) {
      console.error("save-business-analysis insert error:", analysisError);
      return res.status(500).json({ error: "Gagal menyimpan hasil analisa" });
    }

    return res.status(200).json({ analysisId: analysis.id });
  } catch (error) {
    console.error("save-business-analysis error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
