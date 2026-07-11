-- Migration: business phone_number
-- Domain: business_profiles
-- Date: 2026-07-12
--
-- ADDITIVE ONLY. Satu kolom baru di tabel yang sudah ada (business_profiles),
-- RLS tabel ini sudah ada sebelumnya dan sudah mencakup kolom baru ini
-- secara otomatis (policy select-own tidak berbasis kolom tertentu).
--
-- Nomor HP sekarang dikumpulkan di chat wizard (src/components/ChatFlow.tsx,
-- field "noHp") untuk keperluan push notifikasi WhatsApp ke pelanggan
-- nanti — fitur itu SENDIRI belum aktif, kolom ini hanya menyimpan datanya
-- lebih dulu supaya siap dipakai begitu fitur WA diaktifkan.
--
-- Diisi oleh services/business/promoteDraft.ts (bukan hanya tersimpan di
-- wizard_drafts.wizard_data JSONB) supaya jadi kolom terstruktur yang bisa
-- di-query langsung (mis. "SELECT phone_number FROM business_profiles
-- WHERE ..." untuk job pengiriman WA nanti) — bukan terkubur di dalam blob
-- JSON.
--
-- Nullable dengan sengaja (backfill-safe) — pelanggan lama yang belum
-- pernah mengisi nomor HP (sebelum field ini ada di wizard) TIDAK ditebak
-- paksa di database.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback (kalau perlu dibatalkan): ALTER TABLE business_profiles DROP COLUMN phone_number;

alter table business_profiles
  add column if not exists phone_number text;
