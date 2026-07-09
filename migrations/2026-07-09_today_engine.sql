-- Migration: Today Engine + Business Stage Engine (Phase 1 — Business Command Center)
-- Domain: today / business_stage
-- Date: 2026-07-09
--
-- Ref: THE-HIVE-BUSINESS-COMMAND-CENTER-ARCHITECTURE.md §5, §8, §14 (Fase 1).
--
-- ADDITIVE ONLY. Tidak ada ALTER/DROP/RENAME pada tabel Business Engine yang
-- sudah ada (business_profiles, business_updates, business_health,
-- progress_snapshots, business_achievements, subscriptions). Dua tabel baru
-- di sini murni layer BACA-AN di atas Business Engine — tidak pernah ditulis
-- oleh Business Engine, dan tidak pernah menghitung ulang apa yang sudah
-- dihitung Business Engine.
--
-- Cakupan Fase 1 (sesuai roadmap §15): stage MASIH sederhana (dua nilai —
-- "preparation" / "running" — diturunkan dari business_profiles.business_stage
-- yang SUDAH ADA hari ini). 12-stage penuh (IDEA..EXIT) menyusul di fase
-- lanjutan sebagai perluasan additive terhadap tabel ini (kolom baru via
-- ALTER TABLE ADD COLUMN IF NOT EXISTS, tidak breaking).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan migrasi ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan):
--   drop policy if exists business_stage_state_select_own on business_stage_state;
--   drop policy if exists today_snapshot_select_own on today_snapshot;
--   drop table if exists today_snapshot;
--   drop table if exists business_stage_state;

-- =============================================================================
-- 1. business_stage_state — hasil Business Stage Engine, BUKAN pengganti
--    business_profiles.business_stage (kolom lama tetap ada, tidak disentuh).
--    Histori transisi disimpan sebagai baris baru (pola sama seperti
--    business_health — insert baris baru, tidak overwrite), supaya nanti
--    Journey/Timeline bisa menampilkan kapan bisnis naik fase.
-- =============================================================================

create table if not exists business_stage_state (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,

  stage_group text not null check (stage_group in ('preparation', 'running')),

  -- 'auto'  = diturunkan otomatis dari sinyal Business Engine (§5.2)
  -- 'manual_override' = pelanggan mengoreksi sendiri lewat Journey tab
  source text not null default 'auto' check (source in ('auto', 'manual_override')),

  created_at timestamptz not null default now()
);

create index if not exists idx_business_stage_state_business_profile
  on business_stage_state(business_profile_id, created_at desc);

-- =============================================================================
-- 2. today_snapshot — cache hasil Today Engine, 1 baris per bisnis per hari.
--    payload adalah bentuk TodaySnapshot (lihat §4.1 dokumen arsitektur) —
--    disimpan sebagai jsonb supaya bentuknya bisa berkembang tanpa migrasi
--    kolom baru tiap kali field baru ditambah.
-- =============================================================================

create table if not exists today_snapshot (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,

  snapshot_date date not null,
  payload jsonb not null,

  computed_at timestamptz not null default now(),

  unique (business_profile_id, snapshot_date)
);

create index if not exists idx_today_snapshot_business_profile
  on today_snapshot(business_profile_id, snapshot_date desc);

-- =============================================================================
-- 3. Row Level Security — aktif sejak awal dibuat (bukan ditambah belakangan
--    seperti temuan Final Audit Achievement Engine). service_role (dipakai
--    services/today/*, services/stage/*) selalu bypass RLS terlepas dari
--    policy ini.
-- =============================================================================

alter table business_stage_state enable row level security;
alter table today_snapshot enable row level security;

drop policy if exists business_stage_state_select_own on business_stage_state;
create policy business_stage_state_select_own
  on business_stage_state
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

drop policy if exists today_snapshot_select_own on today_snapshot;
create policy today_snapshot_select_own
  on today_snapshot
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated pada kedua
-- tabel — di bawah RLS, tanpa policy berarti default DENY. Hanya service_role
-- (backend, services/today/computeSnapshot.ts & services/stage/determineStage.ts)
-- yang menulis ke tabel ini.
