-- Migration: Early Access (Beta Launch — Midtrans Production belum aktif)
-- Domain: growth (fitur baru, tidak menyentuh apapun yang sudah ada)
-- Date: 2026-07-19
--
-- ADDITIVE ONLY. Satu tabel baru. TIDAK menyentuh payments, subscriptions,
-- business_profiles, atau tabel apapun yang sudah ada.
--
-- Konteks: Midtrans Production belum diverifikasi, jadi tombol Upgrade
-- Pro/Platinum untuk sementara tidak diarahkan ke Midtrans Sandbox --
-- ditampilkan halaman "THE HIVE Beta" (lihat BetaEarlyAccessCard.tsx) yang
-- menampung minat pelanggan sambil menunggu Production aktif. Tabel ini
-- SENGAJA terpisah total dari `payments`/tier pelanggan supaya tidak ada
-- resiko apapun terhadap arsitektur subscription yang sudah berjalan --
-- kalau nanti fitur ini dimatikan (Midtrans Production sudah aktif),
-- tinggal berhenti insert ke sini, tabel ini boleh dibiarkan begitu saja
-- sebagai arsip minat early access.
--
-- Pola tabel meniru migrations/2026-07-15_contact_messages.sql (tabel
-- sederhana, tanpa RLS, ditulis lewat service_role dari services/*.ts).
--
-- business_profile_id sengaja nullable + tanpa foreign key keras (ON
-- DELETE) supaya baris early_access TIDAK PERNAH bisa menyebabkan/terkena
-- efek berantai ke business_profiles -- baris ini murni catatan minat,
-- bukan bagian dari data inti workspace pelanggan.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback: DROP TABLE early_access;

create table if not exists early_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  business_profile_id uuid,
  name text not null,
  email text not null,
  whatsapp text,
  package text not null check (package in ('pro', 'platinum')),
  -- Titik masuk mana yang memicu form ini -- berguna nanti untuk melihat
  -- apakah minat lebih banyak datang dari pengguna baru (baru selesai
  -- analisis pertama) atau pengguna existing yang sudah pakai Workspace
  -- gratis (usulan GPT, diskusi UI/UX 2026-07-18).
  source text not null check (source in ('wizard_preview', 'workspace_upgrade')),
  status text not null default 'new' check (status in ('new', 'contacted', 'converted')),
  created_at timestamptz not null default now()
);

create index if not exists idx_early_access_created_at on early_access (created_at desc);
