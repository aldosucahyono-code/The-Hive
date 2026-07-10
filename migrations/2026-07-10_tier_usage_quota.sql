-- Migration: Tier Usage Quota (directive PO: "batasannya, data yang diolah,
-- data yang diterima, dan users benar benar merasa perbedaanya" antara PRO
-- dan PLATINUM)
-- Domain: membership / usage tracking
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. Menambah kolom counter ke tabel `subscriptions` yang sudah
-- ada (bukan tabel baru) — counter ini SENGAJA melekat ke baris subscription
-- (bukan business_profile), supaya otomatis "reset" tiap kali pelanggan
-- membeli paket baru (notification-handler.ts selalu insert baris
-- subscriptions baru per pembelian, baris lama di-expire) — tidak perlu job
-- terjadwal terpisah untuk reset kuota bulanan.
--
-- chat_message_count : jumlah pesan Chat Beemo yang sudah dipakai pada
--                       periode akses aktif ini.
-- decision_count      : jumlah keputusan yang sudah diajukan ke Decision
--                       Journal pada periode akses aktif ini.
--
-- Dibaca/ditulis lewat services/membership/getActiveMembership.ts,
-- services/beemo/chat.ts, dan services/decision/proposeDecision.ts —
-- JANGAN increment counter ini dari tempat lain (sama prinsipnya dengan
-- larangan query tabel subscriptions langsung di luar getActiveMembership).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback:
--   alter table subscriptions drop column if exists chat_message_count;
--   alter table subscriptions drop column if exists decision_count;

alter table subscriptions
  add column if not exists chat_message_count integer not null default 0;

alter table subscriptions
  add column if not exists decision_count integer not null default 0;
