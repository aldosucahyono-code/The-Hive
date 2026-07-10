-- Migration: Competitor Engine (Master Product Directive — Phase 2)
-- Domain: competitor
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. Satu tabel baru, referensi biasa ke business_profiles.
--
-- competitor_snapshots menyimpan HASIL Competitor Engine (bukan data mentah
-- provider) per business_profile, dengan TTL (expires_at) supaya:
-- 1. Tidak memanggil provider eksternal (Google Places / OpenStreetMap)
--    setiap kali Workspace/Chat/PDF butuh data kompetitor — landscape
--    kompetitor tidak berubah dalam hitungan jam.
-- 2. getBusinessMemory() bisa membaca ringkasan kompetitor terakhir tanpa
--    memanggil provider sama sekali (murni baca snapshot tersimpan).
--
-- `provider` mencatat SUMBER data snapshot ini berasal dari mana
-- ('google_places' | 'openstreetmap' | 'mock') — Workspace/Chat/PDF WAJIB
-- menampilkan sumber ini secara jujur (badge "Contoh/Simulasi" kalau
-- 'mock') supaya tidak pernah terlihat seperti data pasar nyata padahal
-- bukan (data honesty).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan): DROP TABLE competitor_snapshots;

create table if not exists competitor_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id),

  provider text not null check (provider in ('google_places', 'openstreetmap', 'mock')),
  query_industry text,
  query_location text,

  -- Seluruh CompetitorEngineResult (market summary, competitor list,
  -- position, strength/weakness, opportunities, recommendations) sebagai
  -- satu payload — lihat services/competitor/types/index.ts untuk bentuk
  -- persisnya. Disimpan utuh (bukan dipecah ke banyak kolom) karena bentuk
  -- engine ini akan terus berkembang (sumber data baru ditambah ke depan)
  -- dan kita tidak ingin migration baru setiap field baru ditambah.
  result jsonb not null,

  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_competitor_snapshots_business_profile
  on competitor_snapshots (business_profile_id, fetched_at desc);

-- RLS ditambahkan langsung di migrasi yang sama (pelajaran dari Achievement
-- Engine — lihat catatan di migrations/2026-07-10_business_memory.sql).
alter table competitor_snapshots enable row level security;

drop policy if exists competitor_snapshots_select_own on competitor_snapshots;
create policy competitor_snapshots_select_own
  on competitor_snapshots
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy insert/update/delete untuk client — snapshot hanya
-- ditulis oleh service_role lewat services/competitor/cache/competitorCache.ts.
