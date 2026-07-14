-- Migration: Email Dorongan Personal Bulanan (di luar halaman admin)
-- Domain: nurture (email lifecycle/retention)
-- Date: 2026-07-15
--
-- ADDITIVE ONLY: satu tabel baru.
--
-- Konteks: permintaan pemilik produk -- pelanggan yang sudah memasukkan
-- emailnya di chat wizard (baik yang lanjut jadi akun ataupun cuma coba
-- preview gratis) dikirimi email personal 1-2x/bulan, isinya kata-kata
-- bijak perpaduan hidup/cinta/keluarga/bisnis, disesuaikan dengan
-- tantangan+harapan+jenis usaha yang mereka isi di wizard -- tujuannya
-- mengajak mereka aktif kembali ke THE HIVE, bukan jualan langsung.
-- Lihat services/nurture/sendNurtureBatch.ts (pengirim) dan
-- api/cron/generate-expiry-reports.ts (dipanggil cron lewat query
-- ?job=nurture -- menumpang di cron yang sudah ada karena limit Vercel
-- Hobby cuma boleh jumlah cron terbatas, sama seperti alasan action-router
-- api/workspace.ts untuk Serverless Function).
--
-- nurture_email_sends melacak SIAPA SUDAH DIKIRIMI KAPAN (supaya tidak
-- dobel dalam jangka waktu dekat) dan status berhenti-langganan (kalau
-- pelanggan klik link berhenti di email) -- keyed by email (bukan user_id)
-- karena target termasuk orang yang belum pernah bikin akun sama sekali,
-- cuma pernah isi wizard preview gratis.
--
-- Rollback:
--   drop table nurture_email_sends;

create table if not exists nurture_email_sends (
  email text primary key,
  last_sent_at timestamptz,
  send_count int not null default 0,
  unsubscribed boolean not null default false,
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_nurture_email_sends_last_sent_at on nurture_email_sends (last_sent_at);

-- Sama seperti tabel admin_*/ip_geo_cache: RLS aktif TANPA policy apapun --
-- hanya service_role (backend) yang bisa akses.
alter table nurture_email_sends enable row level security;
