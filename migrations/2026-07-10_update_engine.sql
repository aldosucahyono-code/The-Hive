-- Migration: Business Update Engine (directive "CONTINUE — BUSINESS UPDATE ENGINE")
-- Domain: business_updates
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. Kolom baru di tabel yang sudah ada (business_updates).
-- RLS tabel ini sudah ada sebelumnya dan sudah mencakup kolom baru ini
-- secara otomatis.
--
-- Menyimpan hasil klasifikasi Business Update Engine (services/updateEngine/classify.ts)
-- SEKALI saat update disimpan (services/workspace/submitUpdate.ts) — bukan
-- kalimat jadi (frozen language), tapi kunci i18n + params, supaya bilingual
-- tetap ikut berubah kalau pelanggan toggle bahasa nanti (konsisten dengan
-- pola today_snapshot.payload).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback: ALTER TABLE business_updates DROP COLUMN category, DROP COLUMN severity,
--   DROP COLUMN insight_headline_key, DROP COLUMN insight_headline_params, DROP COLUMN insight_action_key;

alter table business_updates
  add column if not exists category text check (category in ('sales', 'marketing', 'finance', 'customer', 'operations', 'brand')),
  add column if not exists severity text check (severity in ('low', 'medium', 'high')),
  add column if not exists insight_headline_key text,
  add column if not exists insight_headline_params jsonb,
  add column if not exists insight_action_key text;
