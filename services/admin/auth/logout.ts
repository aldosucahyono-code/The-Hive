// services/admin/auth/logout.ts
//
// Buang sesi admin (admin_sessions) begitu admin klik "Keluar" di halaman
// admin -- single-use dari sudut pandang "kalau tab browser ini bocor/
// dipakai orang lain setelahnya, tokennya sudah tidak berlaku".

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function adminLogout(adminToken: string | undefined): Promise<ServiceResult> {
  if (!adminToken) {
    return { status: 200, body: { ok: true } };
  }
  await supabase.from("admin_sessions").delete().eq("id", adminToken);
  return { status: 200, body: { ok: true } };
}
