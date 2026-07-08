// services/business/delete.ts
//
// Business logic untuk action "delete" — HARD DELETE sungguhan (cascade ke
// semua data terkait). Hanya boleh dijalankan kalau bisnis sudah non-aktif
// (active = false), mencegah penghapusan permanen bisnis yang masih dipakai.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function deleteBusinessPermanently(
  userId: string,
  payload: Record<string, unknown>
): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: businessProfile, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id, active")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !businessProfile || businessProfile.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  if (businessProfile.active) {
    return {
      status: 400,
      body: { error: "Bisnis ini masih aktif. Hapus (nonaktifkan) dulu sebelum menghapus permanen." },
    };
  }

  const { error: deleteError } = await supabase.from("business_profiles").delete().eq("id", businessProfileId);

  if (deleteError) {
    console.error("services/business/delete error:", deleteError);
    return { status: 500, body: { error: "Gagal menghapus bisnis secara permanen" } };
  }

  return { status: 200, body: { success: true } };
}
