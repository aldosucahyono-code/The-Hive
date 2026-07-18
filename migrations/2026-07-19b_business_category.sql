-- Migration: Business Category (The Hive Platinum Workspace — Fase 1)
-- Domain: business engine (kolom baru di tabel utama + 1 tabel baru)
-- Date: 2026-07-19
--
-- Konteks: hasil kolaborasi desain Claude+GPT (18-19 Jul 2026) soal "The Hive
-- Platinum Workspace" — user eksplisit minta sistem bisa "mengenali kategori
-- bisnis pengguna secara otomatis". Riset sebelum ini menemukan business_profiles
-- TIDAK punya taksonomi industri terstruktur sama sekali — kolom `industry`
-- yang ada murni teks bebas dari Chat Wizard ("Coffee Shop, Kontraktor,
-- Retail..."), tidak divalidasi, tidak dipakai logic apapun.
--
-- business_category diisi lewat klasifikasi AI (services/business/classifyCategory.ts,
-- baca businessName+industry+goals+mainChallenges via Business Memory) —
-- BUKAN pengguna mengisi manual saat onboarding (supaya tidak nambah friksi
-- di wizard yang sudah ada). Nullable + selalu ada jalur koreksi manual di
-- UI ("Ubah kategori") karena klasifikasi AI bisa saja meleset.
--
-- ADDITIVE ONLY. Satu kolom baru di business_profiles (nullable, tidak
-- mengubah baris yang sudah ada), satu tabel baru business_goal_packages.
-- TIDAK menyentuh struktur/kolom lain apapun.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback: alter table business_profiles drop column if exists business_category;
--           drop table if exists business_goal_packages;

alter table business_profiles add column if not exists business_category text check (
  business_category in (
    'kuliner',
    'retail',
    'jasa',
    'logistik',
    'manufaktur',
    'pertanian_perikanan',
    'pertambangan_energi',
    'kesehatan',
    'pendidikan',
    'properti',
    'teknologi',
    'pariwisata',
    'lainnya'
  )
);

-- Business Goal Packages: hasil "paket kerja" siap eksekusi dari lapisan
-- eksekusi Mission Today (diskusi Claude+GPT: strukturkan berdasarkan TUJUAN
-- bisnis, bukan jenis output — satu goal_key membuka satu paket berisi
-- beberapa materi sekaligus). Fase 1 baru satu goal_key: 'google_presence'
-- (deskripsi Google Business 750 karakter + 10 rekomendasi foto & angle +
-- checklist data), dibangun modular per saran GPT — goal_key lain menyusul
-- satu per satu, bukan sekaligus semua kombinasi kategori x tujuan.
--
-- Hasil DISIMPAN (bukan regenerate setiap buka) — pola sama dengan
-- business_action_plan_items: sekali digenerate, dibaca ulang dari sini,
-- supaya tidak ada biaya AI berulang tiap pengguna buka kartunya.
create table if not exists business_goal_packages (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  goal_key text not null,
  category text not null,
  content jsonb not null,
  generated_at timestamptz not null default now(),
  unique (business_profile_id, goal_key)
);

create index if not exists idx_business_goal_packages_business_profile on business_goal_packages (business_profile_id);
