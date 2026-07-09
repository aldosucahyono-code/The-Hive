-- Migration: Achievement Engine — Refinements (Tahap 2.4, Product Owner review v3)
-- Domain: achievement
-- Date: 2026-07-09
--
-- HARUS DIJALANKAN SETELAH migrations/2026-07-09_achievement_engine.sql
-- (migration ini menambah kolom ke achievement_definitions yang dibuat di
-- migration tersebut).
--
-- ADDITIVE ONLY terhadap achievement_definitions (tabel yang KITA buat
-- sendiri di migration sebelumnya, bukan tabel lama Business Engine) —
-- hanya menambah kolom baru yang nullable/berdefault, tidak mengubah
-- kolom yang sudah ada, tidak menyentuh tabel Business Engine lain sama
-- sekali. Tidak ada ALTER pada business_updates/business_health/
-- progress_snapshots/business_profiles.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor, setelah
-- migration achievement_engine yang pertama. Claude tidak menjalankan ini
-- secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan):
--   alter table achievement_definitions drop column if exists business_value_id;
--   alter table achievement_definitions drop column if exists business_value_en;
--   alter table achievement_definitions drop column if exists priority;
--   alter table achievement_definitions drop column if exists recommended_action_key;

-- =============================================================================
-- 1. Kolom baru di achievement_definitions
-- =============================================================================

-- business_value_* — alasan bisnis mengapa achievement ini penting (bukan
-- cuma judul/deskripsi). Belum ditampilkan di Workspace sekarang; disiapkan
-- supaya AI Engine nanti selalu punya sumber motivasi yang konsisten,
-- bukan mengarang-ngarang alasan sendiri.
alter table achievement_definitions add column if not exists business_value_id text;
alter table achievement_definitions add column if not exists business_value_en text;

-- priority — dipakai MULAI SEKARANG oleh evaluateAchievements() untuk memilih
-- "Next Milestone" (lihat §3 proposal v3): achievement dengan priority lebih
-- tinggi diutamakan dibanding sekadar achievement yang remaining ratio-nya
-- lebih kecil.
alter table achievement_definitions add column if not exists priority text
  not null default 'normal'
  check (priority in ('critical', 'important', 'normal', 'motivational'));

-- recommended_action_key — kunci referensi (bukan teks jadi) untuk AI Engine
-- nanti menghubungkan sebuah achievement ke langkah berikutnya yang disarankan.
-- Belum dipakai kode manapun sekarang, sama seperti recommendation_key.
alter table achievement_definitions add column if not exists recommended_action_key text;

-- =============================================================================
-- 2. Isi data untuk katalog achievement yang sudah ada
-- =============================================================================

update achievement_definitions set
  business_value_id = 'Anda telah memulai kebiasaan mengevaluasi bisnis secara rutin.',
  business_value_en = 'You have started the habit of evaluating your business regularly.',
  priority = 'critical',
  recommended_action_key = 'start_weekly_update_habit'
where code = 'first_update';

update achievement_definitions set
  business_value_id = 'Konsistensi Anda mencerminkan komitmen nyata dalam mengelola bisnis.',
  business_value_en = 'Your consistency reflects real commitment to managing your business.',
  priority = 'important',
  recommended_action_key = 'maintain_consistency'
where code = 'consistent_4_weeks';

update achievement_definitions set
  business_value_id = 'Bisnis Anda menunjukkan perkembangan nyata dibanding saat pertama bergabung.',
  business_value_en = 'Your business shows real growth compared to when you first joined.',
  priority = 'important',
  recommended_action_key = 'sustain_growth_momentum'
where code = 'journey_growth_20';

update achievement_definitions set
  business_value_id = 'Bisnis Anda menunjukkan momentum positif minggu ini.',
  business_value_en = 'Your business is showing positive momentum this week.',
  priority = 'normal',
  recommended_action_key = 'capitalize_weekly_momentum'
where code = 'period_growth_10';

update achievement_definitions set
  business_value_id = 'Bisnis Anda mulai memiliki fondasi operasional yang sehat.',
  business_value_en = 'Your business is building a healthy operational foundation.',
  priority = 'critical',
  recommended_action_key = 'focus_sales_customer_retention'
where code = 'health_above_80';

update achievement_definitions set
  business_value_id = 'Strategi penjualan Anda mulai membuahkan hasil.',
  business_value_en = 'Your sales strategy is starting to pay off.',
  priority = 'normal',
  recommended_action_key = 'expand_sales_channel'
where code = 'sales_above_80';

update achievement_definitions set
  business_value_id = 'Pengelolaan keuangan Anda semakin sehat dan terkendali.',
  business_value_en = 'Your financial management is getting healthier and more controlled.',
  priority = 'important',
  recommended_action_key = 'optimize_cash_flow'
where code = 'finance_above_80';

update achievement_definitions set
  business_value_id = 'Hubungan Anda dengan pelanggan semakin kuat.',
  business_value_en = 'Your relationship with your customers is getting stronger.',
  priority = 'normal',
  recommended_action_key = 'strengthen_customer_loyalty'
where code = 'customer_above_80';

update achievement_definitions set
  business_value_id = 'Anda telah menunjukkan komitmen jangka panjang bersama THE HIVE.',
  business_value_en = 'You have shown long-term commitment with THE HIVE.',
  priority = 'motivational',
  recommended_action_key = 'explore_advanced_features'
where code = 'member_30_days';

update achievement_definitions set
  business_value_id = 'Anda berhasil mewujudkan target yang Anda tetapkan sendiri.',
  business_value_en = 'You achieved the target you set for yourself.',
  priority = 'critical',
  recommended_action_key = 'set_next_target'
where code = 'target_omzet_tercapai';

-- =============================================================================
-- 3. Future Architecture — dicatat, TIDAK dibangun sekarang
-- =============================================================================

-- (a) Repeatable achievements (mis. "30/90/365 hari konsisten" berulang).
--     business_achievements TETAP satu baris per achievement (UNIQUE
--     business_profile_id + achievement_definition_id, tidak diubah).
--     Kalau suatu hari dibutuhkan achievement yang bisa diraih berkali-kali,
--     implementasinya lewat TABEL HISTORY TERPISAH, mis.:
--       business_achievement_unlocks_history (
--         id, business_profile_id, achievement_definition_id,
--         unlocked_at, cycle_number
--       )
--     Bukan mengubah business_achievements. Belum dibuat sekarang.
--
-- (b) Super Admin Platform (belum dibangun) akan mengelola
--     achievement_definitions langsung (aktif/nonaktif, urutan, teks,
--     business_value) lewat panel admin, bukan lewat migrasi baru per
--     perubahan konten. Tidak ada perubahan skema yang dibutuhkan untuk
--     ini — kolom yang relevan sudah ada.
--
-- (c) Analitik (belum dibangun dashboard-nya): jumlah & persentase pelanggan
--     yang meraih tiap achievement bisa dihitung langsung dari data yang
--     sudah ada, tanpa tabel baru, contoh pola query:
--       select achievement_definition_id, count(*) as unlock_count
--       from business_achievements
--       group by achievement_definition_id;
--     (persentase = unlock_count / total business_profiles aktif)
