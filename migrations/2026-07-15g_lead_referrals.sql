-- Migration: Referensi Calon Pelanggan Baru per Bisnis
-- Domain: workspace (fitur pelanggan, BUKAN halaman admin -- tapi hasilnya
-- tetap tersambung/terlihat di halaman admin, lihat services/admin/getCustomerDetail.ts)
-- Date: 2026-07-15
--
-- ADDITIVE ONLY: satu tabel baru.
--
-- Konteks: permintaan pemilik produk -- pelanggan bisa klik tombol di
-- Workspace untuk dapat referensi CALON PELANGGAN BARU (bisa perusahaan
-- atau individu) yang relevan dengan jenis usaha & produk/jasa yang mereka
-- input di wizard, lengkap dengan alamat kalau ditemukan -- dicari lewat
-- Claude web_search (BUKAN Apify -- keputusan produk Juli 2026: mulai dari
-- yang sudah terpasang dulu, tanpa akun/biaya baru). "Yang penting harus
-- sesuai dulu" -- akurasi diutamakan: services/workspace/leads/generateLeadReferrals.ts
-- diinstruksikan TIDAK mengarang nama/alamat, harus ada source_url dari
-- pencarian sungguhan, dan boleh mengembalikan LEBIH SEDIKIT dari kuota
-- tier kalau memang tidak cukup hasil yang benar-benar terverifikasi.
--
-- Individu (bukan perusahaan) SENGAJA tidak pernah diberi nama lengkap atau
-- alamat rumah presisi -- itu risiko privasi/legal yang nyata. Untuk
-- lead_type='individual', field name/description berisi PROFIL/SEGMEN
-- target (mis. "Ibu rumah tangga usia 30-45 di sekitar Kelapa Gading yang
-- aktif belanja online"), bukan orang sungguhan bernama.
--
-- batch_id mengelompokkan semua baris dari SATU kali klik "cari referensi"
-- -- dipakai halaman admin untuk menghitung berapa kali fitur ini dipanggil
-- per bisnis (estimasi biaya API), bukan menghitung jumlah baris lead.
--
-- Rollback:
--   drop table business_lead_recommendations;

create table if not exists business_lead_recommendations (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  batch_id uuid not null,
  lead_type text not null check (lead_type in ('company', 'individual')),
  name text not null,
  description text,
  address text,
  source_url text,
  generated_at timestamptz not null default now()
);

create index if not exists idx_business_lead_recommendations_business_profile_id on business_lead_recommendations (business_profile_id);
create index if not exists idx_business_lead_recommendations_batch_id on business_lead_recommendations (batch_id);

-- Sama seperti tabel data pelanggan lain (business_updates, analyses, dst):
-- RLS aktif TANPA policy apapun -- akses SELALU lewat backend
-- (service_role), baik dari sisi pelanggan (api/workspace.ts) maupun sisi
-- admin (services/admin/getCustomerDetail.ts), tidak pernah langsung dari
-- browser dengan anon/authenticated key.
alter table business_lead_recommendations enable row level security;
