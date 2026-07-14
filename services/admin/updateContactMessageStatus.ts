// services/admin/updateContactMessageStatus.ts
//
// Business logic untuk action "adminUpdateContactMessageStatus" di router
// /api/workspace. SATU-SATUNYA aksi tulis (bukan baca-saja) di domain admin
// untuk sekarang -- sengaja dibatasi HANYA role 'super_admin' (lihat
// migrations/2026-07-15b_admin_roles.sql: 'admin' biasa cuma boleh lihat,
// sesuai permintaan pemilik produk).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminRole } from "./requireAdminRole.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VALID_STATUSES = ["new", "read", "resolved"];

export async function adminUpdateContactMessageStatus(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const role = await requireAdminRole(userId);
  if (!role) {
    return { status: 403, body: { error: "Kamu tidak punya akses ke halaman ini." } };
  }
  if (role !== "super_admin") {
    return { status: 403, body: { error: "Hanya super admin yang boleh mengubah data." } };
  }

  const id = payload.id;
  const status = payload.status;
  if (!id || typeof id !== "string") {
    return { status: 400, body: { error: "id wajib diisi" } };
  }
  if (!status || typeof status !== "string" || !VALID_STATUSES.includes(status)) {
    return { status: 400, body: { error: "status tidak valid" } };
  }

  const { error } = await supabase.from("contact_messages").update({ status }).eq("id", id);

  if (error) {
    console.error("adminUpdateContactMessageStatus error:", error);
    return { status: 500, body: { error: "Gagal mengubah status pesan." } };
  }

  return { status: 200, body: { ok: true } };
}
