// api/restore-business.ts
//
// Dipanggil dari "Recycle Bin" di Workspace — memulihkan business_profile
// yang sebelumnya di-soft-delete (active = false) kembali jadi aktif.

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
      .select("id, user_id")
      .eq("id", businessProfileId)
      .single();

    if (bpError || !businessProfile || businessProfile.user_id !== userId) {
      return res.status(403).json({ error: "Business profile tidak valid untuk akun ini." });
    }

    const { error: updateError } = await supabase
      .from("business_profiles")
      .update({ active: true })
      .eq("id", businessProfileId);

    if (updateError) {
      console.error("restore-business update error:", updateError);
      return res.status(500).json({ error: "Gagal memulihkan bisnis" });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("restore-business error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
