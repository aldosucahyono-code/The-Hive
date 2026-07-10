// services/business/restore.ts
//
// Business logic untuk action "restore" (active = true kembali).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./create.js";
import { checkBusinessCap } from "./checkBusinessCap.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function restoreBusiness(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: businessProfile, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !businessProfile || businessProfile.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  // Batas jumlah usaha per akun (lihat services/business/checkBusinessCap.ts)
  // — tanpa ini, user bisa "akali" batas dengan cara archive 1 bisnis, buat
  // bisnis baru untuk isi slot yang kosong, lalu restore bisnis yang
  // di-archive tadi juga -> jumlah aktif jadi lebih banyak dari cap.
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

  const { error: updateError } = await supabase
    .from("business_profiles")
    .update({ active: true })
    .eq("id", businessProfileId);

  if (updateError) {
    console.error("services/business/restore error:", updateError);
    return { status: 500, body: { error: "Gagal memulihkan bisnis" } };
  }

  return { status: 200, body: { success: true } };
}
