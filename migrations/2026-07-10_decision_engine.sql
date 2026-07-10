-- Migration: Decision Engine (directive "CONTINUE — BUSINESS UPDATE ENGINE",
-- Decision Engine section: "AI Business Mentor, bukan AI Reporter")
-- Domain: decision
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. Tabel baru, referensi biasa ke business_profiles.
--
-- business_decisions menyimpan Decision History — setiap kali pemilik usaha
-- meminta bantuan Beemo untuk sebuah keputusan besar (mis. "saya ingin buka
-- cabang"), hasilnya (Goal/Risk/Opportunity/Supporting Data/Recommendation/
-- Conclusion) disimpan di sini. Ini yang nanti dibaca PDF Baseline/Monthly
-- Progress Report (belum dikerjakan) — generator PDF tinggal merangkai,
-- tidak perlu menghitung ulang.
--
-- `supporting_data` disimpan sebagai jsonb (array teks bukti, bukan kolom
-- tetap) karena bentuknya bisa terus berkembang tanpa migration baru setiap
-- kali sumber data baru ditambahkan — sama alasannya dengan
-- competitor_snapshots.result.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback: DROP TABLE business_decisions;

create table if not exists business_decisions (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id),

  question text not null,
  goal text,
  risk text,
  opportunity text,
  supporting_data jsonb,
  recommendation text,
  conclusion text,

  status text not null default 'open' check (status in ('open', 'decided', 'dismissed')),

  created_at timestamptz not null default now()
);

create index if not exists idx_business_decisions_business_profile
  on business_decisions (business_profile_id, created_at desc);

-- RLS ditambahkan langsung di migrasi yang sama (pelajaran dari Achievement
-- Engine — lihat catatan di migrations/2026-07-10_business_memory.sql).
alter table business_decisions enable row level security;

drop policy if exists business_decisions_select_own on business_decisions;
create policy business_decisions_select_own
  on business_decisions
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );

-- Tidak ada policy insert/update/delete untuk client — hanya service_role
-- lewat services/decision/proposeDecision.ts.
