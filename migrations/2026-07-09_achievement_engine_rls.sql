-- Migration: Achievement Engine — Row Level Security (Tahap 2.4, security gap fix)
-- Domain: achievement
-- Date: 2026-07-09
--
-- HARUS DIJALANKAN SETELAH:
--   1. migrations/2026-07-09_achievement_engine.sql
--   2. migrations/2026-07-09_achievement_engine_refinements.sql
--
-- KENAPA MIGRASI INI ADA: seluruh tabel lain di skema THE HIVE (~20 tabel,
-- lihat AUDIT-THE-HIVE-2026-07-09.md §T3) memakai Row Level Security.
-- Dua tabel Achievement Engine sempat dibuat tanpa RLS. Secara default,
-- Supabase memberi grant SELECT/INSERT/UPDATE/DELETE ke role `anon` dan
-- `authenticated` pada tabel baru di schema public — tanpa RLS, kedua
-- tabel ini bisa diakses langsung lewat REST API publik Supabase pakai
-- anon key (yang memang tertanam di frontend bundle), melewati seluruh
-- pengecekan otorisasi di /api/workspace.
--
-- ADDITIVE ONLY: hanya mengaktifkan RLS + menambah policy BARU pada dua
-- tabel yang kita buat sendiri. Tidak ada ALTER pada kolom/tipe data,
-- tidak menyentuh tabel Business Engine lain, tidak ada data yang
-- diubah/dihapus. `service_role` (dipakai backend kita di
-- evaluateAchievements.ts/getAchievements.ts) selalu bypass RLS di
-- Supabase terlepas dari policy apapun di sini — jadi tidak ada fungsi
-- backend yang akan berhenti bekerja setelah migrasi ini.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor, setelah
-- dua migrasi Achievement Engine sebelumnya. Claude tidak menjalankan ini
-- secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan):
--   drop policy if exists achievement_definitions_select_authenticated on achievement_definitions;
--   drop policy if exists business_achievements_select_own on business_achievements;
--   alter table achievement_definitions disable row level security;
--   alter table business_achievements disable row level security;

alter table achievement_definitions enable row level security;
alter table business_achievements enable row level security;

-- achievement_definitions — katalog referensi (bukan data pelanggan).
-- Boleh dibaca oleh siapapun yang sudah login (dipakai getAchievements()
-- untuk join judul/deskripsi), TIDAK ada insert/update/delete lewat
-- client — mutasi katalog hanya lewat service_role (nanti: Super Admin
-- Platform). Baris yang belum aktif/masih hidden tidak ikut ter-expose.
create policy achievement_definitions_select_authenticated
  on achievement_definitions
  for select
  to authenticated
  using (is_active = true and is_hidden = false);

-- business_achievements — data pelanggan. Hanya bisa dibaca oleh pemilik
-- business_profile terkait (pola yang sama seperti RLS business_profiles
-- yang sudah ada: scoped ke auth.uid() lewat kepemilikan). TIDAK ada
-- insert/update/delete lewat client — achievement adalah keputusan sistem
-- (evaluateAchievements(), lewat service_role), bukan sesuatu yang bisa
-- diklaim sendiri oleh pengguna.
create policy business_achievements_select_own
  on business_achievements
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy untuk INSERT/UPDATE/DELETE ke role anon/authenticated
-- pada kedua tabel — di bawah RLS, tanpa policy berarti default DENY,
-- yang memang perilaku yang diinginkan (hanya service_role yang menulis).
