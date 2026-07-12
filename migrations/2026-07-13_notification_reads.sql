-- Migration: Lonceng Notifikasi — penanda "terakhir dilihat" (Juli 2026)
-- Domain: notifications
--
-- SENGAJA BUKAN tabel "satu baris per notifikasi". Semua notifikasi
-- (achievement baru, Decision Journal tersimpan, laporan PDF selesai,
-- Platinum/Pro mau habis, pengingat Update Bisnis) dihitung ON-THE-FLY di
-- services/notifications/getNotifications.ts langsung dari tabel yang
-- SUDAH ADA (business_achievements, business_decisions, business_reports,
-- subscriptions, business_updates) — supaya tidak ada sumber kebenaran
-- kedua yang bisa berbeda dari data aslinya, dan tidak perlu menulis ke
-- tabel baru di banyak tempat berbeda setiap kali ada event baru.
--
-- Tabel ini HANYA menyimpan satu timestamp per business_profile: kapan
-- pemiliknya terakhir membuka dropdown lonceng. Notifikasi dianggap
-- "belum dibaca" kalau timestamp kejadiannya lebih baru dari
-- last_seen_at ini.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan): DROP TABLE notification_reads;

create table if not exists notification_reads (
  business_profile_id uuid primary key references business_profiles(id),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notification_reads enable row level security;

drop policy if exists notification_reads_select_own on notification_reads;
create policy notification_reads_select_own
  on notification_reads
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy insert/update untuk client — last_seen_at hanya ditulis
-- oleh service_role lewat services/notifications/markNotificationsSeen.ts,
-- dipanggil setiap kali pengguna membuka dropdown lonceng.
