-- Migration: Living Business Loop (directive "CONTINUE — LIVING BUSINESS LOOP")
-- Domain: stage / checklist / decision follow-up
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. Semua perubahan di sini adalah ALTER TABLE ADD COLUMN IF NOT
-- EXISTS pada tabel yang SUDAH ADA, atau CREATE TABLE IF NOT EXISTS baru —
-- tidak ada DROP/RENAME, tidak ada kolom lama yang ditimpa maknanya.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan migrasi ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan):
--   alter table business_stage_state drop column if exists stage_detail;
--   alter table business_decisions drop column if exists follow_up_prompted_at;
--   drop policy if exists business_checklist_progress_select_own on business_checklist_progress;
--   drop table if exists business_checklist_progress;

-- =============================================================================
-- 1. business_stage_state.stage_detail — perluasan additive yang SUDAH
--    diantisipasi di komentar migrations/2026-07-09_today_engine.sql ("12-stage
--    penuh menyusul di fase lanjutan sebagai perluasan additive terhadap
--    tabel ini"). stage_group ("preparation"/"running") TETAP ADA dan TETAP
--    dipakai Today Pulse — stage_detail HANYA menambah rincian di dalam
--    stage_group itu, tidak menggantikannya.
--
--    Nilai stage_detail untuk business_type='start' (11 langkah):
--      idea, validasi, persiapan, supplier, legalitas, branding, marketing,
--      soft_opening, grand_opening, operasional, growth
--    Nilai stage_detail untuk business_type='grow' (6 langkah):
--      stabil, bertumbuh, optimasi, ekspansi, scale, systemize
--
--    Nullable & tanpa CHECK constraint ketat supaya baris lama (sebelum
--    migrasi ini) tidak invalid, dan supaya daftar stage bisa direvisi tanpa
--    migrasi baru setiap kali (validasi nilai dilakukan di kode
--    services/stage/determineStage.ts, bukan di database).
-- =============================================================================

alter table business_stage_state add column if not exists stage_detail text;

-- =============================================================================
-- 2. business_checklist_progress — Mission Today checklist SEBELUMNYA hanya
--    hidup sebagai React state (hilang setiap reload/logout). Ini membuatnya
--    jadi EVENT nyata yang bisa dibaca Stage Engine (checklist selesai =
--    sinyal kemajuan bisnis START yang objektif, bukan ditebak).
--
--    Satu baris per item checklist yang SUDAH ditandai selesai (bukan
--    menyimpan status belum-selesai — tidak ada baris berarti belum selesai).
-- =============================================================================

create table if not exists business_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,

  item_key text not null,
  completed_at timestamptz not null default now(),

  unique (business_profile_id, item_key)
);

create index if not exists idx_business_checklist_progress_business_profile
  on business_checklist_progress(business_profile_id);

-- =============================================================================
-- 3. business_decisions.follow_up_prompted_at — Decision Follow Up ("Kalau
--    user membuat keputusan... seminggu kemudian Workspace bertanya
--    bagaimana perkembangannya"). Kolom ini menandai kapan follow-up SUDAH
--    ditampilkan ke pengguna, supaya tidak muncul berulang setiap hari untuk
--    keputusan yang sama.
-- =============================================================================

alter table business_decisions add column if not exists follow_up_prompted_at timestamptz;

-- =============================================================================
-- 4. Row Level Security — aktif sejak awal dibuat, konsisten dengan seluruh
--    tabel baru sebelumnya (business_decisions, competitor_snapshots, dst).
-- =============================================================================

alter table business_checklist_progress enable row level security;

drop policy if exists business_checklist_progress_select_own on business_checklist_progress;
create policy business_checklist_progress_select_own
  on business_checklist_progress
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated — hanya
-- service_role (services/workspace/checklistProgress.ts) yang menulis.
