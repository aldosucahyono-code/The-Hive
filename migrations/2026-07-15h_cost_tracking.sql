-- Migration: Pencatatan Biaya AI Sungguhan (per panggilan Claude/Apify) + Pengingat Perpanjangan
-- Domain: admin (Biaya & Kuota) + subscriptions (pengingat H-2)
-- Date: 2026-07-15
--
-- ADDITIVE ONLY: dua tabel baru + satu kolom baru di subscriptions.
--
-- Konteks: permintaan pemilik produk ("tidak boleh ada data palsu... saya
-- ingin ada detail perhitungan rupiah per account users") -- SEBELUMNYA
-- estimasi biaya di getCustomerDetail.ts memakai konstanta ASSUMED_COST_*
-- (angka kira-kira, BUKAN biaya sungguhan). Sekarang setiap panggilan
-- Claude/Apify mencatat token/event ASLI dari respons API-nya sendiri, lalu
-- dihitung biaya USD sungguhan lewat services/costTracking/pricing.ts
-- (harga resmi Anthropic/Apify, BUKAN ditebak).
--
-- business_profile_id NULLABLE + email tersedia terpisah: sejumlah
-- panggilan Claude terjadi SEBELUM akun ada sama sekali (preview gratis di
-- landing page, validasi jawaban wizard) -- baris ini tetap dicatat (biaya
-- itu nyata dikeluarkan) tapi tidak terikat ke business_profile_id, hanya
-- ke email kalau ada (preview) atau benar-benar anonim (validasi per-field).
--
-- Rollback:
--   drop table ai_usage_log;
--   drop table exchange_rate_cache;
--   alter table subscriptions drop column expiry_reminder_sent_at;

create table if not exists ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_profiles(id) on delete set null,
  email text,
  service text not null check (service in ('claude', 'apify')),
  action text not null,
  model text,
  input_tokens int,
  output_tokens int,
  web_searches int not null default 0,
  apify_events int,
  cost_usd numeric(12, 6) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_usage_log_business_profile_id on ai_usage_log (business_profile_id);
create index if not exists idx_ai_usage_log_created_at on ai_usage_log (created_at desc);
create index if not exists idx_ai_usage_log_service on ai_usage_log (service);

alter table ai_usage_log enable row level security;

-- Kurs USD->IDR sungguhan (bukan dikarang) -- di-cache supaya tidak
-- memanggil API kurs eksternal di setiap render halaman admin, lihat
-- services/exchangeRate/getUsdIdrRate.ts. Satu baris saja (id tetap =
-- 'usd_idr'), di-upsert tiap kali cache kadaluarsa.
create table if not exists exchange_rate_cache (
  id text primary key default 'usd_idr',
  rate numeric(12, 4) not null,
  fetched_at timestamptz not null default now()
);

alter table exchange_rate_cache enable row level security;

-- Pengingat H-2 (permintaan pemilik produk: "ketika waktu users tinggal
-- sedikit (h-2)... email aktif mengirimkan push") -- kolom ini mencegah
-- kirim dobel untuk siklus langganan yang sama (satu subscription row =
-- satu siklus 30 hari, lihat api/notification-handler.ts).
alter table subscriptions add column if not exists expiry_reminder_sent_at timestamptz;
