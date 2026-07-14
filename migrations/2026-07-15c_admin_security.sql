-- Migration: Keamanan Akses Admin (email + PIN, terpisah total dari login pelanggan)
-- Domain: admin (fitur baru + audit keamanan tabel lama)
-- Date: 2026-07-15
--
-- ADDITIVE ONLY untuk skema (tabel baru + kolom baru). SATU perubahan
-- non-additive yang disengaja: mengaktifkan Row Level Security (tanpa
-- policy apapun -- lihat "TEMUAN AUDIT" di bawah) di beberapa tabel LAMA
-- yang sebelumnya lolos tanpa RLS.
--
-- Konteks: sebelumnya halaman #admin cuma dilindungi "harus sudah login
-- Supabase Auth + profiles.role admin/super_admin" -- satu faktor saja,
-- dan URL-nya ("#admin") gampang ditebak. Permintaan pemilik produk: buat
-- gerbang 3 faktor sebelum bisa akses data pelanggan:
--   1. Tahu URL rahasia (path acak panjang, TIDAK ada di mana pun secara
--      publik -- lihat App.tsx, hanya diberi tahu langsung oleh Claude di
--      chat, bukan didokumentasikan di sini).
--   2. Punya akses ke inbox email yang terdaftar sebagai admin/super_admin
--      (link verifikasi sekali pakai, 10 menit).
--   3. Tahu PIN 6 digit (disimpan di Vercel env var ADMIN_PIN, BUKAN di
--      kode -- supaya tidak ikut kebaca kalau repo ini bocor/dibagi, dan
--      supaya bisa diganti kapan saja tanpa deploy ulang).
--
-- Sesi admin yang dihasilkan (admin_sessions) SENGAJA TERPISAH TOTAL dari
-- sesi login pelanggan (auth.users / Supabase Auth) -- tidak memakai JWT
-- Supabase sama sekali. Ini directive eksplisit pemilik produk: "pisahkan
-- halaman super admin ini dari users, atau hackers" -- kalau sesi pelanggan
-- biasa bocor/diserang, itu TIDAK memberi jalan apapun ke sesi admin, dan
-- sebaliknya.
--
-- TEMUAN AUDIT (Juli 2026, saat mengerjakan permintaan ini): beberapa
-- tabel lama dibuat TANPA mengaktifkan Row Level Security --
-- login_relay, contact_messages, wizard_drafts. Default Supabase untuk
-- project baru memberi grant akses penuh ke role `anon`/`authenticated`
-- pada tabel baru di schema public -- kalau RLS tidak diaktifkan, tabel
-- itu SECARA DEFAULT bisa dibaca/ditulis siapapun yang punya anon key
-- (anon key ada di frontend, publik). Komentar di migration login_relay
-- sebelumnya ("tidak ada akses anon/RLS langsung ke tabel ini") ternyata
-- keliru -- RLS-nya memang belum pernah diaktifkan. Diperbaiki di sini:
-- RLS diaktifkan TANPA policy apapun (artinya HANYA service_role -- dipakai
-- backend lewat SUPABASE_SERVICE_ROLE_KEY -- yang bisa akses; anon &
-- authenticated otomatis tertolak total). Tidak ada perubahan perilaku
-- aplikasi karena semua akses ke tabel-tabel ini SUDAH SELALU lewat
-- service_role di backend (api/*.ts), tidak pernah langsung dari browser.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback:
--   drop table admin_login_challenges;
--   drop table admin_sessions;
--   drop table ip_geo_cache;
--   alter table profiles drop column last_seen_at, drop column last_ip,
--     drop column last_user_agent, drop column last_geo_city,
--     drop column last_geo_country;
--   alter table login_relay disable row level security;
--   alter table contact_messages disable row level security;
--   alter table wizard_drafts disable row level security;

-- === Tahap 1: alur verifikasi email + PIN ===

create table if not exists admin_login_challenges (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  status text not null default 'pending_email' check (status in ('pending_email', 'pending_pin', 'failed')),
  pin_attempts int not null default 0,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

create index if not exists idx_admin_login_challenges_token on admin_login_challenges (token);
create index if not exists idx_admin_login_challenges_expires_at on admin_login_challenges (expires_at);

alter table admin_login_challenges enable row level security;

-- === Tahap 2: sesi admin (TERPISAH dari auth.users / sesi pelanggan) ===

create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role text not null check (role in ('admin', 'super_admin')),
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create index if not exists idx_admin_sessions_expires_at on admin_sessions (expires_at);

alter table admin_sessions enable row level security;

-- === Tahap 3: presence/perangkat/lokasi kasar pelanggan (untuk halaman admin) ===

alter table profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_ip text,
  add column if not exists last_user_agent text,
  add column if not exists last_geo_city text,
  add column if not exists last_geo_country text;

-- Cache hasil lookup geolokasi per IP, supaya tidak memanggil layanan
-- eksternal berulang-ulang untuk IP yang sama (lihat
-- services/admin/recordPresence.ts) -- akurasi level kota/negara saja,
-- BUKAN alamat presisi (itu memang batas teknis IP address).
create table if not exists ip_geo_cache (
  ip text primary key,
  city text,
  country text,
  resolved_at timestamptz not null default now()
);

alter table ip_geo_cache enable row level security;

-- === Tahap 4: perbaikan RLS tabel lama (lihat "TEMUAN AUDIT" di atas) ===

alter table login_relay enable row level security;
alter table contact_messages enable row level security;
alter table wizard_drafts enable row level security;
