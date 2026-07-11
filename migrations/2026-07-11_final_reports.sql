-- Migration: Final Reports (Task 13 — "riwayat diganti final reports")
-- Domain: reports
-- Date: 2026-07-11
--
-- ADDITIVE ONLY. Tabel baru + satu Storage bucket baru, referensi biasa ke
-- business_profiles.
--
-- Konteks: sebelumnya halaman "Riwayat" hanya menampilkan daftar `analyses`
-- mentah (tidak ada PDF, tidak bisa didownload). Sekarang diganti "Final
-- Reports" dengan DUA jenis PDF per bisnis:
--   1. baseline  — PDF awal, rangkuman total semua analisa saat pertama kali
--      berlangganan (dibuat on-demand oleh services/reports/generateFinalReport.ts,
--      idempotent — cuma dibuat sekali, dibaca ulang setelahnya).
--   2. expiry    — PDF baru di hari H user akan expired, isinya perbandingan
--      semua yang telah dilakukan sepanjang periode + kesimpulan (dibuat
--      otomatis oleh api/cron/generate-expiry-reports.ts). PDF expiry
--      TERBARU juga jadi baseline acuan target bulan berikutnya kalau user
--      berlangganan lagi (dibaca lewat listReports, bukan kolom terpisah).
--
-- PDF disimpan sungguhan di Supabase Storage (bukan generate-on-demand tiap
-- kali dibuka) supaya "bisa didownload sewaktu waktu" (arsip di Pengaturan)
-- tanpa memanggil Claude berulang kali untuk laporan yang sama.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor (termasuk
-- bagian storage bucket). Claude tidak menjalankan ini secara langsung
-- terhadap database.
--
-- Rollback: DROP TABLE business_reports; DELETE FROM storage.buckets WHERE id = 'reports';

create table if not exists business_reports (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id),

  report_type text not null check (report_type in ('baseline', 'expiry')),
  storage_path text not null,       -- path di bucket 'reports', mis. "<business_profile_id>/baseline-<timestamp>.pdf"
  period_start timestamptz,          -- null untuk baseline (belum ada periode sebelumnya)
  period_end timestamptz,            -- null untuk baseline

  created_at timestamptz not null default now()
);

create index if not exists idx_business_reports_business_profile
  on business_reports (business_profile_id, created_at desc);

-- RLS ditambahkan langsung di migrasi yang sama (pelajaran dari Achievement
-- Engine — lihat catatan di migrations/2026-07-10_business_memory.sql).
alter table business_reports enable row level security;

drop policy if exists business_reports_select_own on business_reports;
create policy business_reports_select_own
  on business_reports
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy insert/update/delete untuk client — hanya service_role
-- lewat services/reports/generateFinalReport.ts.

-- Storage bucket PRIVATE (bukan public) — file PDF hanya bisa diakses lewat
-- signed URL sementara yang dibuat server-side (services/reports/listReports.ts),
-- supaya laporan bisnis pelanggan tidak bisa diakses lewat URL tebakan.
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- Tidak ada storage policy untuk client (anon/authenticated) — semua akses
-- (upload saat generate, signed URL saat download) lewat service_role key
-- di server, sama prinsipnya dengan RLS business_reports di atas.
