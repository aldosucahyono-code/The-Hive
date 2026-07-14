-- Migration: Login Relay (verifikasi magic link lintas perangkat)
-- Domain: auth (lintas fitur — dipakai sebelum user punya sesi sama sekali)
-- Date: 2026-07-14
--
-- ADDITIVE ONLY. Satu tabel baru, tidak menyentuh apapun yang sudah ada.
--
-- Konteks: sebelumnya login pakai magic link Supabase dengan flowType
-- 'pkce' — SECARA DESAIN cuma bisa ditukar jadi sesi di perangkat/browser
-- yang SAMA dengan yang dipakai untuk minta link (code verifier PKCE
-- tersimpan di local storage perangkat asal, tidak ikut terkirim ke email).
-- Kalau pengguna minta link di Laptop tapi buka emailnya di HP, penukaran
-- kode gagal diam-diam dan pengguna cuma mendarat di layar "belum login"
-- tanpa penjelasan apapun (lihat audit Juli 2026 di AuthContext.tsx).
--
-- Perilaku yang diinginkan sekarang: link verifikasi BOLEH diklik dari
-- perangkat manapun (flowType diganti ke 'implicit', lihat
-- src/lib/supabaseClient.ts) — begitu diklik/diverifikasi di perangkat
-- manapun, PERANGKAT YANG SEDANG MEMBUKA THE HIVE (tempat awal user minta
-- link) yang otomatis diarahkan masuk ke Workspace, tanpa perlu diklik
-- manual di perangkat itu. Tabel ini adalah "kotak pos" sementara supaya
-- kedua perangkat bisa saling memberi tahu tanpa keduanya perlu unduh app
-- native / WebSocket kompleks — cukup polling ringan tiap ~2.5 detik dari
-- perangkat yang menunggu (lihat AuthContext.tsx/AuthModal.tsx).
--
-- Alur singkat:
--   1. Device A (menunggu) minta rid baru lewat action "createLoginRelay"
--      (api/check-email.ts) -> baris baru status='pending' dibuat di sini.
--   2. Device A kirim magic link Supabase dengan emailRedirectTo yang
--      menyisipkan rid di QUERY STRING (bukan hash -- supaya tidak
--      bentrok dengan token implicit flow yang ditempel Supabase sendiri
--      di hash oleh GoTrue).
--   3. Device B (mengklik link, perangkat manapun) berhasil menukar token
--      implicit dari hash URL, lalu POST access_token+refresh_token ke
--      action "confirmLoginRelay" lewat rid yang sama (dibaca dari query
--      string) -> baris diupdate status='confirmed' + token diisi.
--   4. Device A yang sedang polling action "checkLoginRelay" melihat
--      status='confirmed', ambil token itu, panggil
--      supabase.auth.setSession(...) sendiri, lalu baris ini LANGSUNG
--      dihapus (single-use — token sesi tidak disimpan lebih lama dari
--      yang benar-benar perlu).
--
-- Keamanan:
-- - rid adalah UUID acak yang dibuat SERVER (bukan dipercaya dari client)
--   -- bertindak sebagai rahasia sekali pakai, persis seperti kode magic
--   link Supabase sendiri. Tidak pernah ditampilkan di UI/log.
-- - access_token/refresh_token di kolom ini adalah kredensial sesi penuh
--   -- karena itu TTL pendek (expires_at, dicek di kode saat checkLoginRelay
--   dan createLoginRelay, baris kedaluwarsa dianggap tidak ada) dan baris
--   dihapus SEGERA setelah Device A berhasil mengambilnya (lihat langkah 4).
-- - Hanya diakses lewat service role key di api/check-email.ts (tidak ada
--   akses anon/RLS langsung ke tabel ini dari client).
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Rollback: DROP TABLE login_relay;

create table if not exists login_relay (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed')),
  access_token text,
  refresh_token text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

-- Dipakai checkLoginRelay/createLoginRelay untuk buang baris basi tanpa
-- perlu cron terpisah (pola sama dengan rate_limits — lihat
-- 2026-07-13b_rate_limits.sql, function-nya sendiri sesekali beres-beres).
create index if not exists idx_login_relay_expires_at on login_relay (expires_at);
