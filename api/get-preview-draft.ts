// api/get-preview-draft.ts
//
// Audit Juli 2026 (masukan ChatGPT + QA: "user isi 15 pertanyaan, tunggu
// hampir 1 menit, lalu tab tertutup -- semua hilang"). Sebelumnya hasil
// preview gratis HANYA hidup di React state (ChatWizard.tsx) -- wizard_drafts
// di database sudah punya kolom preview_content sejak awal (lihat
// api/save-submission.ts), tapi baris itu cuma pernah dibuat SAAT user
// sudah login (auto-promote di PreviewReport.tsx), bukan segera setelah
// preview jadi. Sekarang runPreviewAnalysis() di ChatWizard.tsx memanggil
// save-submission SEGERA setelah preview berhasil (lihat komentar di sana),
// menyimpan `id` hasilnya ke localStorage. Endpoint ini adalah pasangan
// baca-nya -- dipanggil saat ChatWizard mount dan menemukan id tersimpan,
// supaya tab yang ditutup lalu dibuka lagi bisa langsung menampilkan hasil
// yang sama tanpa mengulang wizard atau memanggil Claude lagi.
//
// Aman diakses anonim karena `id` adalah UUID acak (tidak bisa ditebak) --
// pola yang sama seperti signed URL. RLS wizard_drafts tetap menutup akses
// browser langsung; endpoint ini satu-satunya jalan baca, lewat service_role.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "../services/rateLimit/checkRateLimit.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// UUID v4 sederhana -- cukup untuk menolak input yang jelas bukan id valid
// sebelum menyentuh database sama sekali.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const ip = getClientIp(req);
    // Lebih ketat dari save-submission (15/10menit) karena ini murni baca
    // dan tidak ada alasan sah untuk dipanggil berkali-kali dalam waktu
    // singkat -- 1x saat mount cukup, tapi diberi sedikit ruang untuk retry.
    const rl = await checkRateLimit(`get-preview-draft:${ip}`, 10, 600);
    if (!rl.allowed) {
      return res.status(429).json({ error: "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi." });
    }

    const { id } = req.body as { id?: string };
    if (!id || typeof id !== "string" || !UUID_RE.test(id)) {
      return res.status(400).json({ error: "id tidak valid" });
    }

    const { data, error } = await supabase
      .from("wizard_drafts")
      .select("wizard_data, preview_content, created_at")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("get-preview-draft error:", error);
      return res.status(500).json({ error: "Gagal memuat draft." });
    }
    if (!data || !data.preview_content) {
      return res.status(404).json({ error: "Draft tidak ditemukan." });
    }

    return res.status(200).json({ wizardData: data.wizard_data, preview: data.preview_content });
  } catch (err) {
    console.error("get-preview-draft error:", err);
    return res.status(500).json({ error: "Terjadi kesalahan server." });
  }
}
