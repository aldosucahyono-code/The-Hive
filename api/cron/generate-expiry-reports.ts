// api/cron/generate-expiry-reports.ts
//
// Task 13 ("pdf baru pada saat hari h user akan expired"): Vercel Cron,
// jalan sekali sehari (lihat vercel.json "crons"), mencari subscription
// yang expires_at JATUH HARI INI, lalu membuat PDF Perbandingan Periode
// (report_type "expiry") untuk tiap bisnis itu lewat
// services/reports/generateFinalReport.ts — satu-satunya jalur pembuatan
// laporan "expiry" (TIDAK ada tombol manual untuk ini, supaya tidak
// dobel-generate).
//
// Diproteksi header Authorization: Bearer <CRON_SECRET> (pola standar
// Vercel Cron) — endpoint ini TIDAK boleh bisa dipicu publik, karena
// memanggil Claude + Playwright (biaya nyata) untuk setiap baris yang cocok.
//
// CATATAN INFRA: perlu `CRON_SECRET` di env var Vercel, dan project harus
// di plan yang mendukung Vercel Cron (Hobby dibatasi 1x/hari — cukup untuk
// ini, tapi baca ulang catatan upgrade Vercel Pro yang sudah didiskusikan
// sebelumnya soal maxDuration 10s Hobby vs 60s+ Pro, karena endpoint ini
// memanggil Claude+Playwright per baris, bisa lama kalau banyak subscription
// expired di hari yang sama).
//
// Audit Juli 2026 ("email dorongan personal bulanan"): job KEDUA (kirim
// email nurture) DITUMPANGKAN di endpoint yang sama lewat query
// ?job=nurture (lihat vercel.json "crons" -- entri kedua menunjuk path yang
// sama dengan query string berbeda) -- SEMATA-MATA karena limit jumlah
// Vercel Cron/Serverless Function di plan Hobby sudah nyaris/pas batas,
// pola yang sama seperti kenapa action admin* menumpang di api/workspace.ts.
// Kalau query job tidak dikenali/kosong, perilaku default TETAP job expiry
// report (tidak mengubah cron yang sudah berjalan).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { generateFinalReport } from "../../services/reports/generateFinalReport.js";
import { sendNurtureBatch } from "../../services/nurture/sendNurtureBatch.js";
import { sendExpiryReminders } from "../../services/subscriptions/sendExpiryReminders.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.query.job === "nurture") {
    const result = await sendNurtureBatch();
    return res.status(200).json(result);
  }

  // Pengingat H-2 sebelum langganan PRO/PLATINUM habis (permintaan pemilik
  // produk Juli 2026) -- lihat services/subscriptions/sendExpiryReminders.ts
  // untuk detail lengkap. Menumpang di cron yang sama, pola SAMA dengan
  // ?job=nurture di atas.
  if (req.query.job === "expiry-reminder") {
    const result = await sendExpiryReminders();
    return res.status(200).json(result);
  }

  // Rentang "hari ini" (UTC — cukup untuk penanda hari, tidak perlu presisi
  // per-menit untuk keputusan "kirim laporan expiry sekarang atau tidak").
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)).toISOString();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)).toISOString();

  // Bugfix produk Juli 2026 ("PDF eksklusif PLATINUM, kurangi biaya generate
  // untuk PRO"): sebelumnya baris ini mengambil SEMUA subscription aktif
  // yang expired hari ini (PRO ikut), jadi PRO tetap dapat "Laporan
  // Perbandingan Periode" otomatis walau paketnya tidak lagi mencakup PDF.
  // Sekarang disaring hanya tier "platinum" — generateFinalReport.ts sendiri
  // juga sudah menolak tier selain platinum (defense in depth), tapi
  // filter di sini penting supaya PRO yang expired hari ini tidak
  // memanggil Claude+Playwright sama sekali (biaya nyata per baris).
  const { data: expiringRows, error } = await supabase
    .from("subscriptions")
    .select("id, business_profile_id, started_at, expires_at")
    .eq("status", "active")
    .eq("tier", "platinum")
    .gte("expires_at", startOfDay)
    .lte("expires_at", endOfDay);

  if (error) {
    console.error("cron/generate-expiry-reports: gagal query subscriptions:", error);
    return res.status(500).json({ error: "Gagal memuat subscription yang expired hari ini." });
  }

  const results: Array<{ businessProfileId: string; ok: boolean; error?: string }> = [];

  for (const row of expiringRows || []) {
    // Lewati kalau sudah pernah dibuat laporan expiry UNTUK PERIODE INI
    // (period_end = expires_at baris ini) — mencegah dobel-generate kalau
    // cron ini kebetulan jalan lebih dari sekali di hari yang sama.
    const { data: existingExpiry } = await supabase
      .from("business_reports")
      .select("id")
      .eq("business_profile_id", row.business_profile_id)
      .eq("report_type", "expiry")
      .eq("period_end", row.expires_at)
      .maybeSingle();
    if (existingExpiry) {
      results.push({ businessProfileId: row.business_profile_id, ok: true });
      continue;
    }

    const result = await generateFinalReport(row.business_profile_id, "expiry", "id", row.started_at, row.expires_at);
    results.push({ businessProfileId: row.business_profile_id, ok: result.ok, error: result.ok ? undefined : result.error });
    if (!result.ok) {
      console.error(`cron/generate-expiry-reports: gagal untuk business ${row.business_profile_id}:`, result.error);
    }
  }

  return res.status(200).json({ processed: results.length, results });
}
