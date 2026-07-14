// services/admin/requireAdminRole.ts
//
// SATU-SATUNYA tempat yang boleh memutuskan "apakah akun ini boleh akses
// halaman #admin". Semua service admin/* WAJIB panggil ini dulu -- jangan
// pernah cek role di tempat lain, supaya definisi otorisasi admin tidak
// didefinisikan dua kali secara berbeda.
//
// role disimpan di profiles.role (lihat migrations/2026-07-15b_admin_roles.sql):
//   'user'        -> tidak ada akses sama sekali (default semua akun biasa)
//   'admin'       -> lihat semua data (view-only)
//   'super_admin' -> lihat + edit (mis. ubah status pesan kontak)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type AdminRole = "admin" | "super_admin";

export async function requireAdminRole(userId: string): Promise<AdminRole | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.role === "admin" || data.role === "super_admin") {
    return data.role;
  }
  return null;
}
