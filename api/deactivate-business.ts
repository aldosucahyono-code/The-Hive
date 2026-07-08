// api/deactivate-business.ts
//
// Dipanggil dari Workspace saat pelanggan klik "Hapus Bisnis Ini". Ini
// SOFT DELETE — cuma set business_profiles.active = false, TIDAK menghapus
// baris apapun. Riwayat analisa, pembayaran, dan subscription bisnis itu
// tetap aman tersimpan (untuk audit atau kalau suatu saat perlu dipulihkan
// manual), tapi bisnis ini tidak lagi muncul di Workspace/Business Switcher.
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

    const { businessProfileId } = req.body;
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

    const { error: updateError } = await supabase
      .from("business_profiles")
      .update({ active: false })
      .eq("id", businessProfileId);

    if (updateError) {
      console.error("deactivate-business update error:", updateError);
      return res.status(500).json({ error: "Gagal menghapus bisnis" });
    }

    // Kalau bisnis yang dihapus ini kebetulan jadi konteks aktif, kosongkan
    // dulu — Workspace yang akan pilih pengganti (bisnis lain yang tersisa,
    // atau tampilkan "Belum ada bisnis" kalau ini yang terakhir).
    await supabase
      .from("user_preferences")
      .update({ active_business_profile_id: null })
      .eq("user_id", userId)
      .eq("active_business_profile_id", businessProfileId);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("deactivate-business error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
