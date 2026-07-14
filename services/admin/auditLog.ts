// services/admin/auditLog.ts
//
// Penulis jejak audit untuk halaman admin (migrations/2026-07-15d_admin_dashboard.sql).
// Dipanggil dari titik-titik yang dianggap "aksi admin yang perlu dicatat"
// -- login berhasil, PIN salah, ubah status pesan kontak, ubah role admin
// lain. Dibungkus try/catch dan TIDAK PERNAH melempar error ke pemanggil --
// kegagalan menulis baris audit tidak boleh menggagalkan aksi admin yang
// sebenarnya sedang dikerjakan.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type AdminAuditEntry = {
  actorEmail: string;
  actorRole: string;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
};

export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    await supabase.from("admin_audit_log").insert({
      actor_email: entry.actorEmail,
      actor_role: entry.actorRole,
      action: entry.action,
      target: entry.target ?? null,
      detail: entry.detail ?? null,
      ip: entry.ip ?? null,
      user_agent: entry.userAgent ?? null,
    });
  } catch (err) {
    console.error("services/admin/auditLog write failed (non-fatal):", err);
  }
}
