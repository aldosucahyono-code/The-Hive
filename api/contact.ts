// api/contact.ts
//
// Audit Juli 2026 ("channel support publik"): sebelum ini, satu-satunya
// jalur masukan/komplain adalah #ulasan-internal (FeedbackPage.tsx) yang
// SENGAJA disembunyikan (tidak ada link publik) dan cuma mailto. Endpoint
// ini melayani form kontak PUBLIK baru (#kontak, ContactPage.tsx) --
// disimpan ke database (tabel contact_messages, lihat
// migrations/2026-07-15_contact_messages.sql), BUKAN mailto, supaya tidak
// bergantung pada aplikasi email pengguna dan supaya pemilik produk bisa
// memantau semua pesan masuk lewat Supabase Table Editor.
//
// TANPA otentikasi (dipakai sebelum/tanpa user perlu login) -- sama
// seperti pola check-email.ts, jadi WAJIB rate-limited per IP untuk cegah
// spam/abuse.
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 5x/10 menit per IP -- form kontak wajar dipakai jarang oleh pengguna
  // sah (paling-paling sekali dua kali kalau salah ketik), tapi cukup
  // ketat untuk mempersulit spam massal ke tabel ini.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`contact:${ip}`, 5, 600);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi." });
  }

  try {
    const { name, email, message } = req.body || {};

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: "Email tidak valid." });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Pesan wajib diisi." });
    }

    const { error } = await supabase.from("contact_messages").insert({
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      email: email.trim(),
      message: message.trim(),
    });

    if (error) {
      console.error("contact insert error:", error);
      return res.status(500).json({ error: "Gagal mengirim pesan. Coba lagi dalam beberapa saat." });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("contact error:", error);
    return res.status(500).json({ error: "Gagal mengirim pesan. Coba lagi dalam beberapa saat." });
  }
}
