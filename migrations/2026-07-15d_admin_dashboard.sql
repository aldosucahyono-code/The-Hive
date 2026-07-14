-- Migration: Log Audit Admin (jejak setiap aksi admin di halaman super admin)
-- Domain: admin
-- Date: 2026-07-15
--
-- ADDITIVE ONLY: satu tabel baru, tidak mengubah tabel manapun yang sudah ada.
--
-- Konteks: permintaan pemilik produk "audit semua proses dari awal, temukan
-- celahnya lalu perbaiki" -- salah satu temuan audit adalah TIDAK ADA jejak
-- siapa mengakses/mengubah apa di halaman admin. Kalau nanti ada admin
-- view-only ditambahkan (profiles.role = 'admin'), atau kalau super_admin
-- ingin tahu riwayat login/perubahan datanya sendiri, tabel ini yang
-- dibaca -- lihat services/admin/auditLog.ts (penulis) dan
-- services/admin/listAuditLog.ts (pembaca, super_admin only).
--
-- Ditulis best-effort (dibungkus try/catch di kode) -- kegagalan menulis
-- baris audit TIDAK PERNAH boleh menggagalkan aksi admin yang sebenarnya.
--
-- Rollback:
--   drop table admin_audit_log;

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target text,
  detail jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at on admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_log_actor_email on admin_audit_log (actor_email);

-- Sama seperti admin_login_challenges/admin_sessions/ip_geo_cache
-- (migrations/2026-07-15c_admin_security.sql): RLS aktif TANPA policy
-- apapun -- hanya service_role (backend) yang bisa akses, anon &
-- authenticated otomatis tertolak total.
alter table admin_audit_log enable row level security;
