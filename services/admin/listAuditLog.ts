// services/admin/listAuditLog.ts
//
// Business logic untuk action "adminListAuditLog" -- membaca jejak semua
// aksi admin (lihat services/admin/auditLog.ts, migrations/2026-07-15d_admin_dashboard.sql).
// SENGAJA dibatasi super_admin saja (sama seperti adminListAdmins/adminSetRole)
// -- riwayat login/percobaan PIN gagal dan siapa mengubah apa adalah data
// paling sensitif di halaman ini, admin view-only tidak perlu melihatnya.
//
// Baca-saja. Otorisasi lewat sesi admin TERPISAH dari Supabase Auth.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function adminListAuditLog(adminToken: string | undefined, _payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }
  if (session.role !== "super_admin") {
    return { status: 403, body: { error: "Hanya super admin yang boleh melihat log aktivitas." } };
  }

  const { data: rows, error } = await supabase
    .from("admin_audit_log")
    .select("id, actor_email, actor_role, action, target, detail, ip, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("adminListAuditLog error:", error);
    return { status: 500, body: { error: "Gagal memuat log aktivitas." } };
  }

  return { status: 200, body: { role: session.role, logs: rows || [] } };
}
