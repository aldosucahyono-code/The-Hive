-- Migration: Medsos Kompetitor — data asli via Apify (Task 49)
-- Domain: socialMedia
-- Date: 2026-07-12
--
-- ADDITIVE ONLY. Satu tabel baru, referensi biasa ke business_profiles.
-- Pola persis sama dengan migrations/2026-07-10_competitor_engine.sql
-- (competitor_snapshots) — TTL cache di atas hasil provider eksternal,
-- supaya:
-- 1. TIDAK memanggil Apify (berbayar per hasil) setiap kali halaman
--    Kompetitor dibuka — akun medsos kompetitor tidak berubah dalam
--    hitungan jam/hari.
-- 2. Kalau pencarian Apify gagal/timeout, request berikutnya masih bisa
--    baca snapshot lama (kalau ada & belum kadaluarsa) alih-alih gagal
--    total.
--
-- `provider` mencatat SUMBER data snapshot ini ('apify' | 'mock') —
-- Workspace WAJIB menampilkan sumber ini secara jujur (data honesty, sama
-- seperti Competitor Engine).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan): DROP TABLE social_media_snapshots;

create table if not exists social_media_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id),

  provider text not null check (provider in ('apify', 'mock')),

  -- Seluruh SocialMediaSnapshot (records username+followers, summary AI,
  -- dataSource) sebagai satu payload — lihat
  -- services/socialMedia/getSocialMediaAnalysis.ts untuk bentuk persisnya.
  -- Disimpan utuh, sama alasannya dengan competitor_snapshots.result.
  result jsonb not null,

  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_social_media_snapshots_business_profile
  on social_media_snapshots (business_profile_id, fetched_at desc);

alter table social_media_snapshots enable row level security;

drop policy if exists social_media_snapshots_select_own on social_media_snapshots;
create policy social_media_snapshots_select_own
  on social_media_snapshots
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy insert/update/delete untuk client — snapshot hanya
-- ditulis oleh service_role lewat services/socialMedia/cache.ts.
