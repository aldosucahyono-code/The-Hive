// services/workspace/getMembership.ts
//
// Endpoint tipis untuk Workspace membaca membership yang benar-benar aktif
// (lihat services/membership/getActiveMembership.ts untuk definisi "aktif").
// Verifikasi kepemilikan business_profile di sini, logika expiry ada di satu
// tempat (getActiveMembership) supaya tidak duplikat dengan services/beemo/chat.ts.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { getActiveMembership } from "../membership/getActiveMembership.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getMembership(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const membership = await getActiveMembership(businessProfileId);

  return { status: 200, body: { membership } };
}
