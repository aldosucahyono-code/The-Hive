-- Migration: Mission Action Log (Selesai/Nanti di Mission Today)
-- Domain: workspace (Today Engine / Mission Today)
-- Date: 2026-07-18
--
-- ADDITIVE ONLY: satu tabel baru.
--
-- Konteks (lanjutan audit UI/UX bersama Claude + GPT, "Mission Today
-- sebagai pusat pengalaman"): tombol "Tandai Selesai" dan "Nanti Saja" di
-- kartu Mission Today sebelumnya CUMA tersimpan di localStorage browser
-- (lihat MISSION_ACTION_STORAGE_PREFIX di src/components/Workspace.tsx) --
-- cukup untuk UI tetap konsisten sepanjang hari itu, tapi TIDAK bisa dibaca
-- lintas-device atau diagregasi untuk melihat pola pemakaian.
--
-- Tabel ini SENGAJA hanya pencatatan (event log), BUKAN sumber kebenaran
-- untuk ranking prioritas -- Rule Engine di services/today/computeSnapshot.ts
-- TIDAK membaca tabel ini sama sekali di migrasi ini. Ini murni menyiapkan
-- data supaya roadmap GPT Fase 3 ("mulai ukur efektivitas prioritas
-- berdasarkan pola penggunaan", "personalisasi bobot ranking") punya
-- data nyata untuk dianalisis nanti, alih-alih mengarang metrik tanpa dasar
-- sekarang -- prinsip yang dipegang sepanjang audit ini: "sintesis boleh,
-- mengarang tidak boleh".
--
-- Append-only (tidak ada UNIQUE constraint, tidak di-upsert): setiap klik
-- "Selesai"/"Nanti" jadi satu baris baru, supaya riwayat lengkap per hari
-- per bisnis bisa dianalisis nanti (bukan cuma status terakhir). "Undo"
-- (klik kedua untuk membatalkan) SENGAJA tidak dicatat di sini -- localStorage
-- di frontend sudah menangani itu untuk kebutuhan UI real-time; tabel ini
-- cuma perlu tahu "kapan user benar-benar menandai sesuatu", bukan setiap
-- klik bolak-balik.
--
-- Rollback:
--   drop table if exists mission_action_log;

create table if not exists mission_action_log (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,

  snapshot_date date not null,
  priority_key text not null,
  status text not null check (status in ('done', 'later')),

  created_at timestamptz not null default now()
);

create index if not exists idx_mission_action_log_business_profile
  on mission_action_log (business_profile_id, snapshot_date);

-- Sama seperti business_chat_starters: RLS aktif TANPA policy apapun --
-- akses SELALU lewat backend (service_role) lewat api/workspace.ts. Log ini
-- tidak pernah dibaca langsung oleh client (tidak ada endpoint getX untuk
-- ini di migrasi ini), jadi tidak perlu policy select-own.
alter table mission_action_log enable row level security;
