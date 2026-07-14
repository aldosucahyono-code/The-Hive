// services/workspace/leads/listLeadReferrals.ts
//
// Business logic untuk action "listLeadReferrals" -- riwayat referensi
// calon pelanggan baru yang pernah dicari untuk satu bisnis (lihat
// generateLeadReferrals.ts untuk cara pembuatannya). Dipanggil saat
// Workspace dibuka supaya pelanggan tidak kehilangan hasil pencarian
// sebelumnya begitu halaman di-refresh.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function listLeadReferrals(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: leads, error } = await supabase
    .from("business_lead_recommendations")
    .select("id, batch_id, lead_type, name, description, address, source_url, generated_at")
    .eq("business_profile_id", businessProfileId)
    .order("generated_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("listLeadReferrals error:", error);
    return { status: 500, body: { error: "Gagal memuat referensi pelanggan." } };
  }

  return { status: 200, body: { leads: leads || [] } };
}
