// services/nurture/unsubscribe.ts
//
// Business logic untuk action PUBLIK "nurtureUnsubscribe" di router
// /api/workspace (lihat PUBLIC_ACTIONS di api/workspace.ts -- tidak butuh
// login Supabase ATAUPUN sesi admin, karena link berhenti-langganan di
// email harus bisa diklik siapapun tanpa login). Divalidasi lewat token
// unik per email (192-bit random, migrations/2026-07-15f_nurture_emails.sql),
// bukan lewat email itu sendiri -- supaya orang tidak bisa iseng
// berhenti-langganankan email orang lain hanya dengan menebak alamat
// emailnya. Rate limit per IP tetap dipasang (konsisten dengan endpoint
// publik lain di platform ini) sebagai lapis pertahanan tambahan, meski
// menebak token 192-bit secara praktis mustahil.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { checkRateLimit } from "../rateLimit/checkRateLimit.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function nurtureUnsubscribe(payload: Record<string, unknown>, ip: string): Promise<ServiceResult> {
  const rl = await checkRateLimit(`nurture-unsubscribe-ip:${ip}`, 20, 3600);
  if (!rl.allowed) {
    return { status: 429, body: { error: "Terlalu banyak permintaan. Coba lagi beberapa saat lagi." } };
  }

  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) {
    return { status: 400, body: { error: "Token wajib diisi." } };
  }

  const { data, error } = await supabase
    .from("nurture_email_sends")
    .update({ unsubscribed: true })
    .eq("unsubscribe_token", token)
    .select("email")
    .maybeSingle();

  if (error) {
    console.error("nurtureUnsubscribe error:", error);
    return { status: 500, body: { error: "Gagal memproses permintaan." } };
  }
  if (!data) {
    return { status: 404, body: { error: "Link tidak valid atau sudah kedaluwarsa." } };
  }

  return { status: 200, body: { ok: true } };
}
