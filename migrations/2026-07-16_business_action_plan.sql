-- Migration: Rencana Aksi Beemo (multi-day action plan) per Bisnis
-- Domain: workspace (dashboard pelanggan)
-- Date: 2026-07-16
--
-- ADDITIVE ONLY: satu tabel baru. Tidak mengubah tabel/kolom yang sudah ada.
--
-- Konteks (directive PO Phase 3, "Evaluasi Flow & UX THE HIVE": "yang
-- penting ketika user buka workspace, users tau apa saja yang harus users
-- lakukan hari ini, besok, lusa dst untuk bisnisnya... jadi kita benar2
-- menjadi mentor untuk users"): sebelumnya Mission Today (services/today/
-- computeSnapshot.ts) hanya rule-engine murni untuk HARI INI saja, tidak ada
-- rencana ke depan bertanggal di mana pun (dicek: "Rencana Aksi 30 Hari" di
-- laporan berbayar ternyata cuma dipakai sekali untuk render PDF lalu
-- datanya dibuang, tidak pernah disimpan terstruktur). Tabel ini menyimpan
-- rencana aksi multi-hari yang BENAR-BENAR dipikirkan Beemo AI (bukan
-- template) berdasarkan Business Memory (services/memory/getBusinessMemory.ts)
-- yang sama dipakai Chat/Decision Engine -- lihat
-- services/workspace/actionPlan/generateActionPlan.ts.
--
-- day_offset: 0 = hari ini, 1 = besok, dst, sampai maksimal 6 (horizon 7
-- hari) -- lihat check constraint di bawah.
--
-- batch_id mengelompokkan semua item dari SATU kali generate (pola sama
-- dengan business_lead_recommendations.batch_id) -- dipakai untuk
-- membedakan rencana lama vs rencana yang baru saja disusun ulang. Batch
-- LAMA SENGAJA TIDAK dihapus saat regenerate (pola sama dengan lead
-- referrals) -- pelanggan tidak pernah kehilangan data begitu saja; UI
-- (listActionPlan.ts) hanya menampilkan batch dengan generated_at terbaru.
--
-- completed/completed_at: dicentang manual oleh pelanggan di Workspace,
-- MURNI presentasi progres -- tidak memengaruhi Business Health Score
-- (beda dari business_checklist_progress yang memang dirancang mendorong
-- skor dimensi -- lihat services/business/checklistDimensionMap.ts).
--
-- Rollback:
--   drop table business_action_plan_items;

create table if not exists business_action_plan_items (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  batch_id uuid not null,
  day_offset int not null check (day_offset >= 0 and day_offset <= 6),
  title text not null,
  description text,
  completed boolean not null default false,
  completed_at timestamptz,
  generated_at timestamptz not null default now()
);

create index if not exists idx_business_action_plan_items_business_profile_id on business_action_plan_items (business_profile_id);
create index if not exists idx_business_action_plan_items_batch_id on business_action_plan_items (batch_id);

-- Sama seperti tabel data pelanggan lain (business_updates, analyses,
-- business_lead_recommendations, dst): RLS aktif TANPA policy apapun --
-- akses SELALU lewat backend (service_role) lewat api/workspace.ts, tidak
-- pernah langsung dari browser dengan anon/authenticated key.
alter table business_action_plan_items enable row level security;
