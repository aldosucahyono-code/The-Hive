-- Migration: Final Reports — race-condition guard (audit Juli 2026)
-- Domain: reports
-- Date: 2026-07-11
--
-- ADDITIVE ONLY. Menambah dua unique index ke business_reports (tabel yang
-- dibuat migrations/2026-07-11_final_reports.sql).
--
-- Kenapa: services/reports/generateFinalReport.ts sebelumnya cuma cek "sudah
-- ada laporan ini belum?" lewat SELECT terpisah SEBELUM INSERT (check-then-act)
-- — kalau dua request datang hampir bersamaan (klik ganda tombol "Buat PDF
-- Awal", atau cron generate-expiry-reports kebetulan jalan dobel), keduanya
-- bisa lolos pengecekan lalu SAMA-SAMA memanggil Claude+Playwright dan
-- menyimpan dua baris — biaya API dobel untuk hal yang seharusnya sekali.
-- Index unique ini memindahkan jaminan "cuma sekali" ke database (satu-
-- satunya tempat yang benar-benar bisa menjamin ini secara atomic), dan
-- generateFinalReport.ts sekarang menangkap error unique_violation (kode
-- Postgres 23505) lalu membaca balik baris yang sudah ada alih-alih gagal.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor, SETELAH
-- migrations/2026-07-11_final_reports.sql. Claude tidak menjalankan ini
-- secara langsung terhadap database.
--
-- Rollback:
--   drop index if exists idx_business_reports_baseline_unique;
--   drop index if exists idx_business_reports_expiry_unique;

-- Maksimal SATU baris "baseline" per bisnis, selamanya.
create unique index if not exists idx_business_reports_baseline_unique
  on business_reports (business_profile_id)
  where report_type = 'baseline';

-- Maksimal SATU baris "expiry" per bisnis PER periode (period_end) — bisnis
-- yang sama boleh punya banyak laporan expiry dari periode berlangganan
-- yang berbeda-beda, tapi tidak dua laporan expiry untuk periode yang sama.
create unique index if not exists idx_business_reports_expiry_unique
  on business_reports (business_profile_id, period_end)
  where report_type = 'expiry';
