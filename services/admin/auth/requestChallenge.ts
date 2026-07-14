// services/admin/auth/requestChallenge.ts
//
// Langkah 1 dari 3 gerbang akses halaman admin (lihat
// migrations/2026-07-15c_admin_security.sql untuk desain lengkap dan
// services/admin/adminSecretPath.ts untuk lapis pertama/path rahasia):
// admin memasukkan emailnya -> kalau email itu benar terdaftar sebagai
// role admin/super_admin di profiles, kirim link verifikasi sekali pakai
// (10 menit) ke email itu lewat Resend.
//
// ANTI-ENUMERASI EMAIL: respons SELALU sama ("kalau email ini terdaftar,
// link sudah dikirim") baik email itu cocok atau tidak -- supaya orang yang
// mencoba-coba banyak email tidak bisa tahu email mana yang benar-benar
// admin hanya dari respons endpoint ini. Cabang "tidak cocok" diberi jeda
// buatan supaya waktu responnya mendekati cabang "cocok" (yang perlu insert
// DB + panggil API Resend) -- mengurangi (bukan menghilangkan total) celah
// timing-based enumeration.

import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../../business/create.js";
import { checkRateLimit } from "../../rateLimit/checkRateLimit.js";
import { ADMIN_SECRET_PATH } from "../adminSecretPath.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const GENERIC_RESPONSE: ServiceResult = {
  status: 200,
  body: { message: "Kalau email ini terdaftar sebagai admin, link verifikasi sudah dikirim. Cek inbox (dan folder spam)." },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEmailHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#0b0b0f; color:#e5e5e5; padding:24px;">
    <div style="max-width:480px;margin:0 auto;background:#16161d;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
      <p style="font-size:13px;color:#a3a3a3;margin:0 0 4px;">THE HIVE — Akses Admin</p>
      <h1 style="font-size:18px;margin:0 0 16px;color:#fff;">Verifikasi permintaan akses halaman admin</h1>
      <p style="font-size:14px;line-height:1.6;color:#d4d4d4;">Ada permintaan akses ke halaman admin THE HIVE dari email ini. Kalau ini benar kamu, klik tombol di bawah (berlaku 10 menit):</p>
      <p style="margin:24px 0;">
        <a href="${verifyUrl}" style="display:inline-block;background:#f5a623;color:#000;font-weight:700;padding:12px 24px;border-radius:10px;text-decoration:none;">Verifikasi &amp; Lanjut ke PIN</a>
      </p>
      <p style="font-size:12px;color:#a3a3a3;">Kalau ini bukan kamu, abaikan email ini saja — tidak ada yang terjadi tanpa link ini diklik DAN PIN yang benar sesudahnya.</p>
    </div>
  </body>
</html>`;
}

export async function adminRequestChallenge(payload: Record<string, unknown>, ip: string, userAgent: string): Promise<ServiceResult> {
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!email) {
    return { status: 400, body: { error: "Email wajib diisi." } };
  }

  // Batasi per IP DAN per email -- mencegah orang mencoba banyak email
  // sekaligus (enumerasi) maupun membanjiri satu inbox admin tertentu
  // dengan email verifikasi.
  const ipLimit = await checkRateLimit(`admin-challenge-ip:${ip}`, 8, 600);
  const emailLimit = await checkRateLimit(`admin-challenge-email:${email.toLowerCase()}`, 5, 3600);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return { status: 429, body: { error: "Terlalu banyak percobaan. Coba lagi beberapa saat lagi." } };
  }

  const { data: profile } = await supabase.from("profiles").select("email, role").ilike("email", email).maybeSingle();

  const isAdminEmail = !!profile && (profile.role === "admin" || profile.role === "super_admin");

  if (!isAdminEmail) {
    await sleep(300 + Math.random() * 200);
    return GENERIC_RESPONSE;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.error(
      "adminRequestChallenge: RESEND_API_KEY/RESEND_FROM_EMAIL belum diset di Vercel -- akses admin tidak bisa jalan sampai ini diset."
    );
    return GENERIC_RESPONSE;
  }

  const token = randomBytes(32).toString("hex");

  const { error: insertError } = await supabase.from("admin_login_challenges").insert({
    email: profile!.email,
    token,
    ip,
    user_agent: userAgent,
  });

  if (insertError) {
    console.error("adminRequestChallenge insert error:", insertError);
    return GENERIC_RESPONSE;
  }

  const verifyUrl = `https://thehive-bisnis.com/${ADMIN_SECRET_PATH}?verify=${token}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [profile!.email],
        subject: "Verifikasi akses admin THE HIVE",
        html: buildEmailHtml(verifyUrl),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("adminRequestChallenge: Resend gagal mengirim:", res.status, errText);
    }
  } catch (err) {
    console.error("adminRequestChallenge: error tak terduga mengirim email:", err);
  }

  return GENERIC_RESPONSE;
}
