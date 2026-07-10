// services/workspace/listUpdates.ts
//
// Business logic untuk action "listUpdates" — mengambil riwayat Business
// Update sebuah business_profile. Dipakai Workspace untuk menampilkan
// histori, dan nanti oleh Business Health Engine (2.2) & Progress Engine
// (2.3) sebagai sumber data perhitungan.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function listBusinessUpdates(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const { data: updates, error } = await supabase
    .from("business_updates")
    .select(
      "id, content, pencapaian, tantangan, kondisi_penjualan, omset_value, pelanggan_baru, target_depan, category, severity, insight_headline_key, insight_headline_params, insight_action_key, created_at"
    )
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("services/workspace/listUpdates error:", error);
    return { status: 500, body: { error: "Gagal memuat riwayat update" } };
  }

  return { status: 200, body: { updates: updates || [] } };
}
