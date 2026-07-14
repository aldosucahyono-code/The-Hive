// services/admin/auth/verifyEmailToken.ts
//
// Langkah 2 dari 3 gerbang akses halaman admin. Dipanggil begitu admin
// klik link di email (lihat requestChallenge.ts) -- memvalidasi token
// (belum kedaluwarsa, statusnya masih 'pending_email'), lalu memindahkan
// status ke 'pending_pin' supaya langkah 3 (verifyPin.ts) bisa jalan.
// Token yang sama dipakai lagi di langkah 3 -- ini BUKAN sesi penuh, cuma
// bukti "sudah klik link email", masih butuh PIN yang benar sebelum
// admin_sessions dibuat.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const INVALID_MESSAGE = "Link tidak valid atau sudah kedaluwarsa. Minta link verifikasi baru.";

export async function adminVerifyEmailToken(payload: Record<string, unknown>): Promise<ServiceResult> {
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  if (!token) {
    return { status: 400, body: { error: INVALID_MESSAGE } };
  }

  const { data: challenge, error } = await supabase
    .from("admin_login_challenges")
    .select("id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !challenge) {
    return { status: 404, body: { error: INVALID_MESSAGE } };
  }
  if (new Date(challenge.expires_at as string).getTime() < Date.now()) {
    return { status: 410, body: { error: INVALID_MESSAGE } };
  }
  if (challenge.status !== "pending_email") {
    // Sudah pernah dipakai (pending_pin/failed) -- jangan biarkan link yang
    // sama dipakai ulang untuk "reset" status balik.
    return { status: 409, body: { error: INVALID_MESSAGE } };
  }

  const { error: updateError } = await supabase
    .from("admin_login_challenges")
    .update({ status: "pending_pin" })
    .eq("id", challenge.id);

  if (updateError) {
    console.error("adminVerifyEmailToken update error:", updateError);
    return { status: 500, body: { error: "Gagal memverifikasi link. Coba lagi." } };
  }

  return { status: 200, body: { ok: true } };
}
