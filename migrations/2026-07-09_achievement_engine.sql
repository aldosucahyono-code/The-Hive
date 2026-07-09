-- Migration: Achievement Engine (Tahap 2.4)
-- Domain: achievement
-- Date: 2026-07-09
--
-- ADDITIVE ONLY. Tidak ada ALTER, DROP, RENAME, atau perubahan tipe/constraint
-- pada tabel yang sudah ada. Hanya membuat dua tabel baru yang berelasi ke
-- business_profiles (sudah ada) lewat foreign key biasa.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor (atau CLI
-- migration Supabase-mu sendiri). Claude tidak menjalankan ini secara
-- langsung terhadap database — sesuai kesepakatan soal kredensial/koneksi.
--
-- Rollback (kalau perlu dibatalkan): DROP TABLE business_achievements;
-- DROP TABLE achievement_definitions; (urutan ini, karena FK).

-- =============================================================================
-- 1. achievement_definitions — katalog/master data, bukan data pelanggan
-- =============================================================================

create table if not exists achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,

  category text not null check (category in (
    'business_growth',
    'business_consistency',
    'business_health',
    'sales',
    'finance',
    'customer',
    'marketing',
    'brand',
    'operations',
    'milestone',
    'future'
  )),

  difficulty text not null default 'bronze' check (difficulty in (
    'bronze', 'silver', 'gold', 'platinum'
  )),

  title_id text not null,
  title_en text not null,
  short_description_id text not null,
  short_description_en text not null,
  long_description_id text,
  long_description_en text,

  -- Metadata siap-AI (Tahap AI Engine, belum dipakai sekarang) — teks data
  -- yang sudah ditulis, bukan sesuatu yang di-generate AI secara live.
  celebration_message_id text,
  celebration_message_en text,
  coach_message_id text,
  coach_message_en text,
  recommendation_key text,

  condition_type text not null check (condition_type in (
    'business_updates_count',
    'business_updates_streak_weeks',
    'business_health_score',
    'sales_score',
    'finance_score',
    'customer_score',
    'marketing_score',
    'operations_score',
    'brand_score',
    'journey_growth',
    'period_growth',
    'member_since_days',
    'target_completion',
    'manual',
    'future'
  )),
  condition_config jsonb not null default '{}'::jsonb,

  sort_order int not null default 0,
  is_active boolean not null default true,
  is_hidden boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- 2. business_achievements — data pelanggan: siapa membuka apa, kapan, karena apa
-- =============================================================================

create table if not exists business_achievements (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id),
  achievement_definition_id uuid not null references achievement_definitions(id),

  unlocked_at timestamptz not null default now(),
  unlocked_by text not null default 'system' check (unlocked_by in ('system', 'manual')),
  progress_value numeric,
  trigger_source text,
  notes text,

  unique (business_profile_id, achievement_definition_id)
);

create index if not exists idx_business_achievements_business_profile
  on business_achievements (business_profile_id);

-- =============================================================================
-- 3. Seed — katalog achievement awal (lihat ACHIEVEMENT-ENGINE-PROPOSAL.md §4)
-- =============================================================================

insert into achievement_definitions
  (code, category, difficulty, title_id, title_en, short_description_id, short_description_en,
   condition_type, condition_config, sort_order, is_active, is_hidden)
values
  ('first_update', 'business_growth', 'bronze',
   'Business Update Pertama', 'First Business Update',
   'Kamu berhasil mengirim Business Update pertamamu.', 'You submitted your first Business Update.',
   'business_updates_count', '{"threshold": 1}'::jsonb, 10, true, false),

  ('consistent_4_weeks', 'business_consistency', 'silver',
   'Konsisten 4 Minggu Berturut-turut', '4 Weeks in a Row',
   'Kamu mengisi Business Update 4 minggu berturut-turut.', 'You submitted a Business Update 4 weeks in a row.',
   'business_updates_streak_weeks', '{"threshold": 4}'::jsonb, 20, true, false),

  ('journey_growth_20', 'business_growth', 'gold',
   'Journey Meningkat 20%', 'Journey Up 20%',
   'Business Score-mu naik 20% sejak Business Update pertama.', 'Your Business Score grew 20% since your first Business Update.',
   'journey_growth', '{"thresholdPercent": 20}'::jsonb, 30, true, false),

  ('period_growth_10', 'business_growth', 'silver',
   'Momentum Mingguan', 'Weekly Momentum',
   'Business Score-mu naik 10% dibanding minggu lalu.', 'Your Business Score grew 10% compared to last week.',
   'period_growth', '{"thresholdPercent": 10}'::jsonb, 40, true, false),

  ('health_above_80', 'business_health', 'gold',
   'Business Health di Atas 80', 'Business Health Above 80',
   'Skor Business Health keseluruhanmu tembus 80.', 'Your overall Business Health score passed 80.',
   'business_health_score', '{"threshold": 80}'::jsonb, 50, true, false),

  ('sales_above_80', 'sales', 'silver',
   'Sales Bertumbuh', 'Sales Growing',
   'Skor dimensi Sales-mu tembus 80.', 'Your Sales dimension score passed 80.',
   'sales_score', '{"threshold": 80}'::jsonb, 60, true, false),

  ('finance_above_80', 'finance', 'silver',
   'Finance Sehat', 'Healthy Finances',
   'Skor dimensi Finance-mu tembus 80.', 'Your Finance dimension score passed 80.',
   'finance_score', '{"threshold": 80}'::jsonb, 70, true, false),

  ('customer_above_80', 'customer', 'silver',
   'Pelanggan Bertambah', 'Growing Customer Base',
   'Skor dimensi Customer-mu tembus 80.', 'Your Customer dimension score passed 80.',
   'customer_score', '{"threshold": 80}'::jsonb, 80, true, false),

  ('member_30_days', 'milestone', 'bronze',
   '30 Hari Bersama THE HIVE', '30 Days with THE HIVE',
   'Kamu sudah bergabung dengan THE HIVE selama 30 hari.', 'You have been with THE HIVE for 30 days.',
   'member_since_days', '{"threshold": 30}'::jsonb, 90, true, false),

  -- Planned, belum aktif dievaluasi — menunggu modul Structured Goal (Lampiran A).
  ('target_omzet_tercapai', 'milestone', 'platinum',
   'Target Omzet Tercapai', 'Revenue Target Reached',
   'Kamu mencapai target omzet yang kamu tetapkan.', 'You reached the revenue target you set.',
   'target_completion', '{}'::jsonb, 100, false, true)

on conflict (code) do nothing;
