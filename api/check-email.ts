// api/check-email.ts
//
// Dipanggil ChatFlow.tsx tepat setelah pengguna mengetik email di wizard.
// Tujuannya SEMATA-MATA untuk UX: menentukan apakah wizard perlu menawarkan
// opsi "kirim link masuk ke Workspace" alih-alih memaksa mengisi wizard dari
// nol lagi.
//
// PENTING soal keamanan: endpoint ini TIDAK PERNAH menjadi kunci akses.
// Ia hanya menjawab true/false ("email ini sudah pernah aktifkan Workspace
// atau belum"), dan bahkan kalau true, satu-satunya aksi yang terjadi adalah
// mengirim Magic Link ke email itu (lewat Supabase Auth) — bukan langsung
// membuka Workspace. Pemilik email tetap harus membuka inbox-nya sendiri
// untuk benar-benar login. Jadi endpoint ini tidak membuka celah account
// takeover walau seseorang menebak-nebak email orang lain.
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

  // Audit red-team Juli 2026: endpoint ini bisa dipakai enumerasi email
  // (lihat catatan di atas — jawabannya sendiri sengaja tidak jadi kunci
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
