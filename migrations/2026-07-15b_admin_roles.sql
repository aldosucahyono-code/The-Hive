-- Migration: Peran Super Admin (halaman #admin internal)
-- Domain: admin (fitur baru, tidak menyentuh apapun yang sudah ada)
-- Date: 2026-07-15
--
-- ADDITIVE ONLY. Satu kolom baru di profiles.
--
-- Konteks: butuh satu halaman internal (#admin, TIDAK ditautkan di mana pun
-- di UI publik -- sama seperti pola #ulasan-internal) supaya pemilik produk
-- bisa melihat (dan untuk super_admin, mengubah) semua data pelanggan dalam
-- satu tempat: profil, langganan/pembayaran, hasil wizard/analisa, aktivitas
-- workspace, dan pesan kontak -- tanpa harus buka Supabase Table Editor
-- tabel per tabel.
--
-- Dua level:
--   'admin'       -> boleh LIHAT semua data (view-only). Untuk tim yang
--                    ditambahkan pemilik produk nanti.
--   'super_admin' -> boleh lihat + edit (mis. ubah status pesan kontak).
--                    HANYA untuk pemilik produk sendiri.
--   'user'        -> default untuk semua akun biasa, tidak ada akses ke
--                    halaman admin sama sekali.
--
-- Otorisasi selalu dicek di backend (services/admin/requireAdminRole.ts),
-- BUKAN cuma disembunyikan di frontend -- endpoint admin menolak permintaan
-- dari akun yang role-nya bukan admin/super_admin.
--
-- Cara pakai: jalankan file ini SENDIRI lewat Supabase SQL editor. Claude
-- tidak menjalankan ini secara langsung terhadap database.
--
-- Untuk menambahkan admin baru nanti (view-only), jalankan manual:
--   update profiles set role = 'admin' where email ilike 'email-tim@domain.com';
--
-- Rollback: alter table profiles drop column role;

alter table profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin', 'super_admin'));

update profiles
set role = 'super_admin'
where email ilike 'aldosucahyono@gmail.com';
