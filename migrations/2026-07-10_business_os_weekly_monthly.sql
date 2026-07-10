-- Migration: Business OS Engine — Weekly Review + Monthly Snapshot
-- (directive "CONTINUE — BUSINESS OS ENGINE")
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. CREATE TABLE IF NOT EXISTS baru saja, tidak ada
-- ALTER/DROP/RENAME terhadap tabel yang sudah ada.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan migrasi ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan):
--   drop policy if exists business_weekly_review_select_own on business_weekly_review;
--   drop table if exists business_weekly_review;
--   drop policy if exists business_monthly_snapshot_select_own on business_monthly_snapshot;
--   drop table if exists business_monthly_snapshot;

-- =============================================================================
-- 1. business_weekly_review — rekap 7-hari-berjalan (rolling, bukan kalender
--    Senin-Minggu, supaya selalu bisa dihitung kapan saja tanpa menunggu akhir
--    pekan kalender). SATU baris di-cache per bisnis per hari ("as_of_date" =
--    tanggal terakhir window). Semua angka DIHITUNG dari data yang SUDAH ADA
--    dan SUDAH nyata (bukan tebakan/AI):
--      - targets_completed   <- business_achievements.unlocked_at dalam window
--                               (pencapaian yang benar-benar terverifikasi
--                               Achievement Engine, proxy paling jujur untuk
--                               "target/langkah selesai" lintas START & GROW)
--      - decisions_made      <- business_decisions.created_at dalam window
--      - score_delta         <- selisih score today_snapshot.payload.score
--                               antara titik data TERLAMA vs TERBARU dalam
--                               window (null kalau titik data <2, JUJUR
--                               bukan 0 palsu)
--      - new_opportunities   <- jumlah signal peluang (today_snapshot.payload
--                               .opportunity.key) yang BERBEDA/baru muncul
--                               dalam window, dibanding hari sebelumnya
--      - new_risks           <- sama seperti di atas tapi untuk topRisk.key
--
--    Tidak ada logic baru di sini — murni membaca ulang & menghitung dari
--    today_snapshot (cache harian yang sudah ada) + business_achievements +
--    business_decisions. Lihat services/businessOS/weeklyReview.ts.
-- =============================================================================

create table if not exists business_weekly_review (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,

  week_start date not null,
  week_end date not null,

  targets_completed int not null default 0,
  decisions_made int not null default 0,
  score_delta int,
  new_opportunities int not null default 0,
  new_risks int not null default 0,

  computed_at timestamptz not null default now(),

  unique (business_profile_id, week_end)
);

create index if not exists idx_business_weekly_review_business_profile
  on business_weekly_review(business_profile_id);

-- =============================================================================
-- 2. business_monthly_snapshot — sama seperti Weekly Review tapi window
--    30-hari-berjalan, dan (sesuai instruksi PO) PERSIST-ONLY untuk saat ini
--    — belum ada requirement UI, disiapkan supaya PDF nanti tinggal MEMBACA
--    baris ini, tidak menghitung ulang apapun.
-- =============================================================================

create table if not exists business_monthly_snapshot (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,

  period_start date not null,
  period_end date not null,

  targets_completed int not null default 0,
  decisions_made int not null default 0,
  score_delta int,
  new_opportunities int not null default 0,
  new_risks int not null default 0,
  stage_detail_at_end text,

  computed_at timestamptz not null default now(),

  unique (business_profile_id, period_end)
);

create index if not exists idx_business_monthly_snapshot_business_profile
  on business_monthly_snapshot(business_profile_id);

-- =============================================================================
-- 3. Row Level Security — aktif sejak tabel dibuat (bukan ditambahkan
--    belakangan), konsisten dengan seluruh tabel baru sebelumnya.
-- =============================================================================

alter table business_weekly_review enable row level security;

drop policy if exists business_weekly_review_select_own on business_weekly_review;
create policy business_weekly_review_select_own
  on business_weekly_review
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

alter table business_monthly_snapshot enable row level security;

drop policy if exists business_monthly_snapshot_select_own on business_monthly_snapshot;
create policy business_monthly_snapshot_select_own
  on business_monthly_snapshot
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated pada kedua
-- tabel — hanya service_role (services/businessOS/weeklyReview.ts dan
-- services/businessOS/monthlySnapshot.ts) yang menulis.
