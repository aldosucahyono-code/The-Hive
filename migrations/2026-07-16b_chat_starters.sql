-- Migration: Starter Pertanyaan Chat Beemo (personalisasi AI)
-- Domain: workspace (Chat Beemo empty state)
-- Date: 2026-07-16
--
-- ADDITIVE ONLY: satu tabel baru.
--
-- Konteks (Phase 5, "Chat Beemo Experience": empty state, prompt
-- suggestions, conversation starters -- lalu directive PO tambahan:
-- "personalisasi penuh via AI... reuse pola yang sama dengan Rencana
-- Aksi"): sebelumnya 3 starter pertanyaan di Chat Beemo (t.workspace.
-- chatSuggestion1/2/3, chatSuggestion1Start/2Start/3Start) STATIS -- sama
-- persis untuk semua bisnis, cuma dibedakan baru/berjalan. Tabel ini
-- menyimpan 3 starter yang BENAR-BENAR dipikirkan Beemo AI per bisnis
-- (nama/tantangan/target/produk dari Business Memory yang sama dipakai
-- Chat/Decision Engine/Rencana Aksi) -- lihat
-- services/workspace/chat/getChatStarters.ts.
--
-- SATU baris per bisnis (business_profile_id UNIQUE) -- beda dari
-- business_lead_recommendations/business_action_plan_items yang menyimpan
-- riwayat batch, karena starter ini murni pelengkap UI (tidak ada nilai
-- menyimpan versi lama), jadi di-upsert (overwrite) tiap kali disusun ulang
-- -- lihat kolom generated_at untuk staleness check (di-generate ulang
-- otomatis kalau sudah > 14 hari, TANPA tombol manual seperti Rencana Aksi,
-- karena stakesnya jauh lebih kecil).
--
-- Rollback:
--   drop table business_chat_starters;

create table if not exists business_chat_starters (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null unique references business_profiles(id) on delete cascade,
  starters jsonb not null,
  generated_at timestamptz not null default now()
);

create index if not exists idx_business_chat_starters_business_profile_id on business_chat_starters (business_profile_id);

-- Sama seperti tabel data pelanggan lain: RLS aktif TANPA policy apapun --
-- akses SELALU lewat backend (service_role) lewat api/workspace.ts.
alter table business_chat_starters enable row level security;
