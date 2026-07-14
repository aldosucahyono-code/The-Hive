-- Migration: Contact Messages (channel support publik "Hubungi Kami")
-- Domain: support (fitur baru, tidak menyentuh apapun yang sudah ada)
-- Date: 2026-07-15
--
-- ADDITIVE ONLY. Satu tabel baru.
--
-- Konteks: sebelum ini, satu-satunya jalur "komplain/masukan" adalah
-- halaman #ulasan-internal (FeedbackPage.tsx) yang SENGAJA disembunyikan
-- (tidak ada link publik ke sana sama sekali) dan cuma memakai mailto —
-- bergantung pada aplikasi email default di perangkat pengguna. Untuk
-- pengguna publik yang BUKAN kenalan pribadi pemilik produk, tidak ada
-- jalur apapun untuk menghubungi kalau ada kendala/pertanyaan (temuan QA
-- Juli 2026: teman-teman yang jadi user awal complain langsung secara
-- pribadi ke pemilik produk, bukan lewat produk itu sendiri -- begitu
-- diakses publik luas, ini tidak akan terjadi, orang asing yang
-- mengalami masalah cuma akan diam/churn/chargeback tanpa sempat dibantu).
--
-- Tabel ini menyimpan pesan dari form kontak PUBLIK baru (#kontak,
-- ContactPage.tsx via api/contact.ts) -- BEDA dari #ulasan-internal:
-- ini tertaut dari Footer semua halaman, dan disimpan ke database
-- (bukan mailto) supaya tidak bergantung pada aplikasi email pengguna
-- dan supaya pemilik produk bisa memantau semua pesan masuk lewat
-- Supabase Table Editor kapan saja tanpa ketinggalan.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback: DROP TABLE contact_messages;

create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now()
);

-- Dipakai untuk urutkan "pesan terbaru dulu" di Supabase Table Editor /
-- dashboard internal nanti.
create index if not exists idx_contact_messages_created_at on contact_messages (created_at desc);
