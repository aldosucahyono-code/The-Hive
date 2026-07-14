// services/admin/auth/verifyPin.ts
//
// Langkah 3 dari 3 (terakhir) gerbang akses halaman admin. Butuh token yang
// SUDAH lolos verifyEmailToken.ts (status 'pending_pin') + PIN 6 digit yang
// benar (disimpan di Vercel env var ADMIN_PIN, BUKAN di kode -- lihat
// migrations/2026-07-15c_admin_security.sql). Kalau benar, baris
// admin_login_challenges dihapus (single-use) dan admin_sessions baru
// dibuat -- sesi ini TERPISAH TOTAL dari Supabase Auth (lihat
// requireAdminSession.ts), inilah "kunci" yang dipakai halaman admin
// selanjutnya lewat header x-admin-token.
//
// Maksimal 5 percobaan PIN salah per challenge -- lewat itu, challenge
// langsung dianggap gagal (harus minta link baru dari awal, bukan cuma
// coba lagi PIN-nya).
//
// Audit Juli 2026 ("jangan sampai mudah dibobol"): setiap percobaan PIN
// SALAH dan setiap login BERHASIL dicatat ke admin_audit_log (lihat
// services/admin/auditLog.ts) -- ini gerbang paling sensitif di seluruh
// platform, jadi pemilik produk perlu bisa melihat riwayat percobaan
// masuknya, bukan cuma hasil akhirnya.

import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../../business/create.js";
import { checkRateLimitFailClosed } from "../../rateLimit/checkRateLimit.js";
import { logAdminAction } from "../auditLog.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const MAX_PIN_ATTEMPTS = 5;
const INVALID_MESSAGE = "Sesi verifikasi tidak valid atau sudah kedaluwarsa. Minta link verifikasi baru.";

/** Bandingkan PIN dengan waktu konstan (tidak bocor lewat timing) -- kalau
 * panjangnya beda, langsung anggap tidak cocok (aman, cuma sedikit kurang
 * "constant time" tepat di kasus ini, yang tidak masalah karena ADMIN_PIN
 * seharusnya selalu 6 digit). */
function pinMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function adminVerifyPin(payload: Record<string, unknown>, ip: string, userAgent: string): Promise<ServiceResult> {
  const token = typeof payload.token === "string" ? payload.token.trim() : "";
  const pin = typeof payload.pin === "string" ? payload.pin.trim() : "";
  if (!token || !pin) {
    return { status: 400, body: { error: "Token dan PIN wajib diisi." } };
  }

  // Audit Juli 2026: rate limit percobaan PIN GAGAL CLOSED (bukan default
  // fail-open checkRateLimit yang dipakai fitur publik lain) -- kalau
  // infrastruktur rate limit sendiri bermasalah, gerbang paling sensitif di
  // platform ini harus menolak dulu, bukan mempersilakan brute-force tanpa
  // batas. Trade-off ini SENGAJA dibalik dari fail-open publik: downtime
  // sesaat di halaman admin jauh lebih murah daripada kebobolan.
  const pinRateLimit = await checkRateLimitFailClosed(`admin-pin-ip:${ip}`, 20, 600);
  if (!pinRateLimit.allowed) {
    return { status: 429, body: { error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." } };
  }

  const { data: challenge, error } = await supabase
    .from("admin_login_challenges")
    .select("id, email, status, pin_attempts, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !challenge) {
    return { status: 404, body: { error: INVALID_MESSAGE } };
  }
  if (new Date(challenge.expires_at as string).getTime() < Date.now()) {
    return { status: 410, body: { error: INVALID_MESSAGE } };
  }
  if (challenge.status !== "pending_pin") {
    return { status: 409, body: { error: INVALID_MESSAGE } };
  }

  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) {
    console.error("adminVerifyPin: ADMIN_PIN belum diset di Vercel -- akses admin tidak bisa jalan sampai ini diset.");
    return { status: 500, body: { error: "Konfigurasi admin belum lengkap. Hubungi pemilik platform." } };
  }

  if (!pinMatches(pin, adminPin)) {
    const nextAttempts = (challenge.pin_attempts as number) + 1;
    if (nextAttempts >= MAX_PIN_ATTEMPTS) {
      await supabase.from("admin_login_challenges").update({ status: "failed", pin_attempts: nextAttempts }).eq("id", challenge.id);
      await logAdminAction({
        actorEmail: challenge.email as string,
        actorRole: "unknown",
        action: "adminLoginLockedOut",
        detail: { attempts: nextAttempts },
        ip,
        userAgent,
      });
      return { status: 429, body: { error: "Terlalu banyak percobaan PIN salah. Minta link verifikasi baru dari awal." } };
    }
    await supabase.from("admin_login_challenges").update({ pin_attempts: nextAttempts }).eq("id", challenge.id);
    await logAdminAction({
      actorEmail: challenge.email as string,
      actorRole: "unknown",
      action: "adminLoginWrongPin",
      detail: { attempt: nextAttempts },
      ip,
      userAgent,
    });
    return { status: 401, body: { error: `PIN salah. Percobaan tersisa: ${MAX_PIN_ATTEMPTS - nextAttempts}.` } };
  }

  // PIN benar -- pastikan role masih valid SEKARANG (jaga-jaga role dicabut
  // di antara langkah 1 dan langkah ini), lalu buat sesi admin baru yang
  // TERPISAH dari Supabase Auth, dan buang challenge-nya (single-use).
  const { data: profile } = await supabase.from("profiles").select("role").ilike("email", challenge.email as string).maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    await supabase.from("admin_login_challenges").delete().eq("id", challenge.id);
    return { status: 403, body: { error: "Akun ini tidak lagi punya akses admin." } };
  }

  const { data: session, error: sessionError } = await supabase
    .from("admin_sessions")
    .insert({ email: challenge.email, role: profile.role, ip, user_agent: userAgent })
    .select("id, role")
    .single();

  await supabase.from("admin_login_challenges").delete().eq("id", challenge.id);

  if (sessionError || !session) {
    console.error("adminVerifyPin session insert error:", sessionError);
    return { status: 500, body: { error: "Gagal membuat sesi admin. Coba lagi." } };
  }

  await logAdminAction({
    actorEmail: challenge.email as string,
    actorRole: session.role as string,
    action: "adminLoginSuccess",
    ip,
    userAgent,
  });

  return { status: 200, body: { adminToken: session.id, role: session.role, email: challenge.email } };
}
