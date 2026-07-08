// api/permanently-delete-business.ts
//
// Dipanggil HANYA dari dalam "Recycle Bin" di Workspace — setelah bisnis
// sudah di-soft-delete (active = false) DAN pelanggan secara eksplisit
// pilih "Hapus Permanen" (dengan konfirmasi terpisah di frontend).
//
// Ini HARD DELETE sungguhan: baris business_profiles akan dihapus, dan
// karena semua tabel anak (analyses, subscriptions, business_health,
// master_roadmaps, payments, dst) dibuat dengan "on delete cascade",
// SELURUH data terkait bisnis ini ikut terhapus permanen dan TIDAK BISA
// dipulihkan lagi. Karena itu endpoint ini sengaja mensyaratkan bisnis
// sudah dalam status non-aktif (active = false) sebelum boleh dihapus
// permanen — mencegah penghapusan permanen langsung dari bisnis yang
// masih aktif dipakai.

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

    const { data: businessProfile, error: bpError } = await supabase
      .from("business_profiles")
      .select("id, user_id, active")
      .eq("id", businessProfileId)
      .single();

    if (bpError || !businessProfile || businessProfile.user_id !== userId) {
      return res.status(403).json({ error: "Business profile tidak valid untuk akun ini." });
    }

    if (businessProfile.active) {
      return res.status(400).json({
        error: "Bisnis ini masih aktif. Hapus (nonaktifkan) dulu sebelum menghapus permanen.",
      });
    }

    const { error: deleteError } = await supabase
      .from("business_profiles")
      .delete()
      .eq("id", businessProfileId);

    if (deleteError) {
      console.error("permanently-delete-business error:", deleteError);
      return res.status(500).json({ error: "Gagal menghapus bisnis secara permanen" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("permanently-delete-business error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
