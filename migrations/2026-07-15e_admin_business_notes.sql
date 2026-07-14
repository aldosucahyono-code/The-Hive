-- Migration: Catatan Manual Admin per Bisnis (+ paste screenshot)
-- Domain: admin
-- Date: 2026-07-15
--
-- ADDITIVE ONLY: satu tabel baru.
--
-- Konteks: permintaan pemilik produk ("saya ingin tau betul, kira2 relevan
-- tidak pertanyaan pelanggan dengan jawaban atau solusi darimu.. kalau
-- tidak relevan, saya bisa rubah jawaban kita, atau minimal saya bisa
-- screenshot pelanggan, lalu paste disini agar kita bisa menyelesaikannya
-- secara manual"). Catatan ini TIDAK mengubah data pelanggan/AI manapun --
-- murni tempat mencatat kesimpulan manual (mis. "AI kurang relevan di sini,
-- sudah saya follow-up manual lewat WhatsApp") supaya ada jejaknya, terikat
-- ke satu business_profile tertentu.
--
-- image_data_url: data URI base64 (mis. "data:image/png;base64,...") kalau
-- admin paste screenshot -- disimpan langsung sebagai text (BUKAN file
-- storage terpisah, supaya tidak perlu setup bucket baru) dengan batas
-- ukuran ditegakkan di kode (services/admin/addBusinessNote.ts), bukan di
-- database, supaya pesan error lebih ramah.
--
-- Rollback:
--   drop table admin_business_notes;

create table if not exists admin_business_notes (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_profiles(id) on delete cascade,
  note text,
  image_data_url text,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_business_notes_business_profile_id on admin_business_notes (business_profile_id);
create index if not exists idx_admin_business_notes_created_at on admin_business_notes (created_at desc);

-- Sama seperti tabel admin_* lainnya: RLS aktif TANPA policy apapun --
-- hanya service_role (backend) yang bisa akses.
alter table admin_business_notes enable row level security;
