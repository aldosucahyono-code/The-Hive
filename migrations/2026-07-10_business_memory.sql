-- Migration: Business Memory (Master Product Directive — Phase 1)
-- Domain: memory
-- Date: 2026-07-10
--
-- ADDITIVE ONLY. Tidak ada ALTER, DROP, RENAME, atau perubahan tipe/constraint
-- pada tabel yang sudah ada. Hanya membuat SATU tabel baru yang berelasi ke
-- business_profiles (sudah ada) lewat foreign key biasa.
--
-- Business Memory BUKAN sumber data baru yang menduplikasi apa yang sudah ada
-- (business_profiles, analyses, business_updates, business_achievements,
-- membership tetap satu-satunya sumber kebenaran masing-masing — dibaca lewat
-- services/memory/getBusinessMemory.ts, bukan disalin ke sini). Tabel ini
-- HANYA untuk satu hal yang belum punya rumah: fakta penting yang disebut
-- pelanggan lewat Chat Beemo (atau sumber lain di masa depan) yang tidak
-- masuk ke field terstruktur manapun yang sudah ada, dan perlu persetujuan
-- pelanggan sebelum dianggap benar (supaya Business Memory tidak pernah berisi
-- sesuatu yang "didengar" AI tapi belum dikonfirmasi pemiliknya — data honesty).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor (atau CLI
-- migration Supabase-mu sendiri). Claude tidak menjalankan ini secara
-- langsung terhadap database — sesuai kesepakatan soal kredensial/koneksi.
--
-- Rollback (kalau perlu dibatalkan): DROP TABLE business_memory_facts;

create table if not exists business_memory_facts (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id),

  -- Kunci bebas tapi terkontrol secara konvensi di layer service (mis.
  -- "target_market_shift", "legal_status_update", "competitor_note") —
  -- sengaja text bebas (bukan enum) supaya Chat Beemo/mekanisme lain bisa
  -- menambah kategori baru tanpa migration baru, TAPI service layer wajib
  -- menjaga konsistensi penamaan (lihat services/memory/proposeMemoryFact.ts).
  fact_key text not null,
  fact_value jsonb not null,

  source text not null check (source in ('chat', 'business_update', 'discovery', 'manual')),
  status text not null default 'pending_approval' check (status in (
    'pending_approval', 'approved', 'rejected', 'superseded'
  )),

  -- Versioning sederhana: fakta baru yang menggantikan fakta lama tidak
  -- meng-UPDATE baris lama (jejak audit tetap ada), tapi menandai lama
  -- sebagai 'superseded' dan menunjuk ke baris baru.
  superseded_by uuid references business_memory_facts(id),

  proposed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid, -- auth.users.id pemilik bisnis yang menyetujui

  raw_context text, -- potongan percakapan/sumber asli, buat audit "kenapa AI mengusulkan ini"

  created_at timestamptz not null default now()
);

create index if not exists idx_business_memory_facts_business_profile
  on business_memory_facts (business_profile_id);

create index if not exists idx_business_memory_facts_status
  on business_memory_facts (business_profile_id, status)
  where status = 'pending_approval';

-- =============================================================================
-- RLS — ditambahkan LANGSUNG di migrasi yang sama (bukan file terpisah
-- belakangan) karena Achievement Engine sempat kelupaan RLS di migrasi
-- pertamanya dan harus ditambal lewat migrasi RLS terpisah. Pelajaran itu
-- diterapkan di sini dari awal.
--
-- service_role (dipakai backend di services/memory/*.ts) selalu bypass RLS
-- di Supabase terlepas dari policy apapun di bawah — jadi tidak ada fungsi
-- backend yang akan berhenti bekerja karena RLS ini.
-- =============================================================================

alter table business_memory_facts enable row level security;

-- Pemilik business_profile boleh membaca fakta miliknya sendiri (termasuk
-- yang masih pending_approval — supaya frontend bisa menampilkan kartu
-- approval). TIDAK ada insert/update/delete lewat client: mengusulkan fakta
-- (proposeMemoryFact) dan menyetujui/menolak (approveMemoryFact/
-- rejectMemoryFact) HARUS lewat service_role di backend, supaya alur
-- approval (siapa yang mengusulkan, kapan, dari konteks apa) tidak bisa
-- dipalsukan langsung lewat REST API publik Supabase.
drop policy if exists business_memory_facts_select_own on business_memory_facts;
create policy business_memory_facts_select_own
  on business_memory_facts
  for select
  to authenticated
  using (
    business_profile_id in (
      select id from business_profiles where user_id = auth.uid()
    )
  );
