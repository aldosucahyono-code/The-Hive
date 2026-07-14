// api/check-email.ts
//
// Router kecil TANPA otentikasi (semua actionnya dipakai SEBELUM user
// punya sesi login sama sekali) -- sengaja ditumpangkan di file yang
// sudah ada, bukan file baru, karena project ini sudah dekat batas 12
// Serverless Function di plan Vercel Hobby (lihat catatan di
// migrations/2026-07-13b_rate_limits.sql).
//
// Action default (body TANPA field "action" sama sekali) -- checkEmail:
// Dipanggil ChatFlow.tsx tepat setelah pengguna mengetik email di wizard.
// Tujuannya SEMATA-MATA untuk UX: menentukan apakah wizard perlu menawarkan
// opsi "kirim link masuk ke Workspace" alih-alih memaksa mengisi wizard dari
// nol lagi.
//
// PENTING soal keamanan (checkEmail): endpoint ini TIDAK PERNAH menjadi
// kunci akses. Ia hanya menjawab true/false ("email ini sudah pernah
// aktifkan Workspace atau belum"), dan bahkan kalau true, satu-satunya
// aksi yang terjadi adalah mengirim Magic Link ke email itu (lewat
// Supabase Auth) -- bukan langsung membuka Workspace. Pemilik email tetap
// harus membuka inbox-nya sendiri untuk benar-benar login. Jadi endpoint
// ini tidak membuka celah account takeover walau seseorang menebak-nebak
// email orang lain.
//
// Action "createLoginRelay" / "confirmLoginRelay" / "checkLoginRelay"
// (audit Juli 2026 -- "magic link harus bisa diverifikasi dari perangkat
// manapun, bukan cuma perangkat yang minta"):
// Sebelumnya Supabase Auth pakai flowType 'pkce', yang SECARA DESAIN cuma
// bisa ditukar jadi sesi di perangkat/browser yang SAMA dengan yang
// dipakai minta link (code verifier PKCE tersimpan di local storage
// perangkat asal, tidak ikut terkirim ke email). Kalau link dibuka di
// perangkat lain, penukaran gagal diam-diam. Sekarang flowType diganti ke
// 'implicit' (lihat src/lib/supabaseClient.ts) supaya token bisa diambil
// di perangkat MANAPUN yang membuka link -- tiga action di bawah ini jadi
// "kotak pos" sementara (tabel login_relay, lihat
// migrations/2026-07-14_login_relay.sql untuk alur lengkap + pertimbangan
// keamanan) supaya perangkat yang MENUNGGU (Device A, tempat user mulai
// login) bisa otomatis masuk begitu perangkat manapun (Device B, tempat
// link benar-benar diklik) berhasil verifikasi -- tanpa keduanya perlu
// WebSocket, cukup polling ringan dari Device A tiap beberapa detik.
//
// - createLoginRelay { email } -> Device A minta "rid" (id) baru, baris
//   status='pending' dibuat di login_relay.
// - confirmLoginRelay { rid, accessToken, refreshToken } -> Device B
//   (sudah berhasil dapat token dari Supabase implicit flow) menitipkan
//   token itu supaya Device A bisa mengambilnya.
// - checkLoginRelay { rid } -> Device A polling; begitu status='confirmed'
//   token dikembalikan SEKALI lalu baris langsung dihapus (single-use,
//   minim jendela token sesi tersimpan mentah di database).
//
// ENV VARIABLES (di Vercel, bukan di frontend):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "../services/rateLimit/checkRateLimit.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action } = req.body || {};

  if (action === "createLoginRelay") return handleCreateLoginRelay(req, res);
  if (action === "confirmLoginRelay") return handleConfirmLoginRelay(req, res);
  if (action === "checkLoginRelay") return handleCheckLoginRelay(req, res);

  return handleCheckEmail(req, res);
}

async function handleCheckEmail(req: VercelRequest, res: VercelResponse) {
  // Audit red-team Juli 2026: endpoint ini bisa dipakai enumerasi email
  // (lihat catatan di atas -- jawabannya sendiri sengaja tidak jadi kunci
  // akses apapun, tapi tetap bisa disalahgunakan untuk cek massal email
  // mana yang sudah terdaftar). 20x/10 menit per IP cukup longgar untuk
  // pengunjung sah (dipanggil sekali tiap kali mengetik email di wizard).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`check-email:${ip}`, 20, 600);
  if (!rl.allowed) {
    return res.status(200).json({ exists: false });
  }

  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email wajib diisi" });
    }

    const normalizedEmail = email.trim();

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      console.error("check-email query error:", error);
      // Gagal cek -> anggap belum terdaftar, supaya wizard tetap bisa
      // dilanjutkan seperti biasa (fail open ke pengalaman normal, bukan
      // fail closed yang memblokir orang baru).
      return res.status(200).json({ exists: false });
    }

    return res.status(200).json({ exists: !!data });
  } catch (error) {
    console.error("check-email error:", error);
    return res.status(200).json({ exists: false });
  }
}

async function handleCreateLoginRelay(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`create-login-relay:${ip}`, 10, 600);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi." });
  }

  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "email wajib diisi" });
    }

    const { data, error } = await supabase
      .from("login_relay")
      .insert({ email: email.trim() })
      .select("id")
      .single();

    if (error || !data) {
      console.error("createLoginRelay insert error:", error);
      return res.status(500).json({ error: "Gagal menyiapkan verifikasi login." });
    }

    return res.status(200).json({ rid: data.id });
  } catch (error) {
    console.error("createLoginRelay error:", error);
    return res.status(500).json({ error: "Gagal menyiapkan verifikasi login." });
  }
}

async function handleConfirmLoginRelay(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`confirm-login-relay:${ip}`, 20, 600);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi." });
  }

  try {
    const { rid, accessToken, refreshToken } = req.body;
    if (!rid || typeof rid !== "string" || !accessToken || !refreshToken) {
      return res.status(400).json({ error: "rid, accessToken, dan refreshToken wajib diisi" });
    }

    const { data: row, error: findError } = await supabase
      .from("login_relay")
      .select("id, expires_at")
      .eq("id", rid)
      .maybeSingle();

    if (findError || !row) {
      return res.status(404).json({ error: "Sesi verifikasi tidak ditemukan atau sudah kedaluwarsa. Minta link baru." });
    }
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      await supabase.from("login_relay").delete().eq("id", rid);
      return res.status(410).json({ error: "Sesi verifikasi sudah kedaluwarsa. Minta link baru." });
    }

    const { error: updateError } = await supabase
      .from("login_relay")
      .update({ status: "confirmed", access_token: accessToken, refresh_token: refreshToken })
      .eq("id", rid);

    if (updateError) {
      console.error("confirmLoginRelay update error:", updateError);
      return res.status(500).json({ error: "Gagal menyimpan konfirmasi login." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("confirmLoginRelay error:", error);
    return res.status(500).json({ error: "Gagal menyimpan konfirmasi login." });
  }
}

async function handleCheckLoginRelay(req: VercelRequest, res: VercelResponse) {
  const ip = getClientIp(req);
  // Device A polling tiap ~3 detik, maksimal sekitar 10-12 menit sebelum
  // menyerah di sisi client (lihat AuthContext.tsx) -> sekitar 200
  // permintaan wajar untuk SATU proses login yang sah. Dilonggarkan ke
  // 300x/15 menit per IP supaya tidak salah memblokir pengguna sah yang
  // menunggu agak lama, sambil tetap membatasi penyalahgunaan.
  const rl = await checkRateLimit(`check-login-relay:${ip}`, 300, 900);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi." });
  }

  try {
    const { rid } = req.body;
    if (!rid || typeof rid !== "string") {
      return res.status(400).json({ error: "rid wajib diisi" });
    }

    const { data: row, error } = await supabase
      .from("login_relay")
      .select("id, status, access_token, refresh_token, expires_at")
      .eq("id", rid)
      .maybeSingle();

    if (error || !row) {
      return res.status(200).json({ status: "expired" });
    }
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      await supabase.from("login_relay").delete().eq("id", rid);
      return res.status(200).json({ status: "expired" });
    }
    if (row.status !== "confirmed") {
      return res.status(200).json({ status: "pending" });
    }

    // Single-use: begitu Device A berhasil mengambil token, baris langsung
    // dihapus supaya tidak ada sesi mentah tersisa di database lebih lama
    // dari yang benar-benar perlu, dan supaya polling berikutnya (race
    // atau request duplikat) tidak mengembalikan token yang sama dua kali.
    await supabase.from("login_relay").delete().eq("id", rid);

    return res.status(200).json({
      status: "confirmed",
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
    });
  } catch (error) {
    console.error("checkLoginRelay error:", error);
    return res.status(500).json({ error: "Gagal memeriksa status verifikasi." });
  }
}
