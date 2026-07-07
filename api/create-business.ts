// api/create-business.ts
//
// Dipanggil dari dalam Workspace (BUKAN dari wizard publik / landing page)
// saat pelanggan yang sudah login klik "+ Tambah Bisnis Baru". Karena user
// sudah terautentikasi, alur ini TIDAK lewat wizard_drafts -> promote-draft
// (mekanisme itu khusus untuk orang yang belum login) — langsung membuat
// business_profile baru untuk akun ini.
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

const VALID_STAGES = ["idea", "starting", "running", "scaling"];

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

    const { businessName, industry, businessStage } = req.body;

    if (!businessName || typeof businessName !== "string" || !businessName.trim()) {
      return res.status(400).json({ error: "Nama bisnis wajib diisi" });
    }

    const stage = VALID_STAGES.includes(businessStage) ? businessStage : "idea";

    const { data: businessProfile, error: bpError } = await supabase
      .from("business_profiles")
      .insert({
        user_id: userId,
        business_name: businessName.trim(),
        industry: industry && typeof industry === "string" ? industry.trim() : null,
        business_stage: stage,
      })
      .select("id")
      .single();

    if (bpError || !businessProfile) {
      console.error("create-business insert error:", bpError);
      return res.status(500).json({ error: "Gagal membuat business profile" });
    }

    // Langsung jadikan bisnis ini sebagai konteks aktif, supaya begitu
    // Workspace reload, pelanggan langsung melihat bisnis yang baru dibuat.
    const { error: prefError } = await supabase
      .from("user_preferences")
      .update({ active_business_profile_id: businessProfile.id })
      .eq("user_id", userId);

    if (prefError) {
      console.error("create-business update active context error:", prefError);
      // Tidak fatal — business profile tetap berhasil dibuat, cuma konteks
      // aktifnya tidak ke-set otomatis. Frontend tetap bisa set manual.
    }

    return res.status(200).json({ businessProfileId: businessProfile.id });
  } catch (error) {
    console.error("create-business error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
