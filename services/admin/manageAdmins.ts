// services/admin/manageAdmins.ts
//
// Business logic untuk action "adminListAdmins" dan "adminSetRole" --
// mengelola siapa saja yang punya akses ke halaman admin, LANGSUNG dari UI
// (sebelumnya harus lewat SQL editor Supabase manual). Audit Juli 2026
// ("saya juga bisa menambahkan siapa saja yang bisa lihat disana... untuk
// user admin nanti yang akan saya buat, hanya view saja").
//
// SENGAJA dibatasi keras, konsisten dengan directive "khusus saya yang bisa
// tau dan akses":
//   1. HANYA super_admin yang boleh memanggil aksi ini sama sekali.
//   2. Role yang boleh DIBERIKAN lewat UI ini HANYA 'admin' (view-only) atau
//      dicabut kembali ke 'user'. Membuat/menurunkan 'super_admin' TIDAK
//      bisa lewat UI sama sekali -- tetap harus manual lewat SQL editor
//      (lihat migrations/2026-07-15b_admin_roles.sql) -- supaya level akses
//      tertinggi tidak pernah bisa diberikan/dicabut hanya dengan satu klik
//      di browser (butuh akses langsung ke database Supabase juga).
//   3. Tidak boleh mengubah role akun sendiri lewat sini sama sekali --
//      mencegah kunci-diri-sendiri tidak sengaja (salah klik menurunkan diri
//      sendiri ke 'user' dan kehilangan akses tanpa jalan lain).
// Semua perubahan dicatat ke admin_audit_log.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ASSIGNABLE_ROLES = ["admin", "user"];

export async function adminListAdmins(adminToken: string | undefined, _payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }
  if (session.role !== "super_admin") {
    return { status: 403, body: { error: "Hanya super admin yang boleh melihat daftar admin." } };
  }

  const { data: admins, error } = await supabase
    .from("profiles")
    .select("id, email, role, created_at, last_seen_at")
    .in("role", ["admin", "super_admin"])
    .order("role", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("adminListAdmins error:", error);
    return { status: 500, body: { error: "Gagal memuat daftar admin." } };
  }

  return { status: 200, body: { role: session.role, admins: admins || [] } };
}

export async function adminSetRole(
  adminToken: string | undefined,
  payload: Record<string, unknown>,
  ip: string,
  userAgent: string
): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }
  if (session.role !== "super_admin") {
    return { status: 403, body: { error: "Hanya super admin yang boleh mengubah akses admin." } };
  }

  const targetEmail = typeof payload.email === "string" ? payload.email.trim() : "";
  const newRole = typeof payload.role === "string" ? payload.role : "";
  if (!targetEmail || !ASSIGNABLE_ROLES.includes(newRole)) {
    return { status: 400, body: { error: "Email dan role (admin/user) wajib diisi." } };
  }

  if (targetEmail.toLowerCase() === session.email.toLowerCase()) {
    return { status: 400, body: { error: "Tidak bisa mengubah akses akun sendiri lewat sini." } };
  }

  const { data: targetProfile, error: findError } = await supabase
    .from("profiles")
    .select("id, email, role")
    .ilike("email", targetEmail)
    .maybeSingle();

  if (findError || !targetProfile) {
    return { status: 404, body: { error: "Akun dengan email itu belum terdaftar di THE HIVE." } };
  }

  if (targetProfile.role === "super_admin") {
    return { status: 403, body: { error: "Akses super admin tidak bisa diubah lewat halaman ini." } };
  }

  const { error: updateError } = await supabase.from("profiles").update({ role: newRole }).eq("id", targetProfile.id);
  if (updateError) {
    console.error("adminSetRole error:", updateError);
    return { status: 500, body: { error: "Gagal mengubah akses admin." } };
  }

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: "adminSetRole",
    target: targetProfile.email as string,
    detail: { fromRole: targetProfile.role, toRole: newRole },
    ip,
    userAgent,
  });

  return { status: 200, body: { ok: true } };
}
