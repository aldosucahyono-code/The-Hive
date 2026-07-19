// services/admin/archiveBusiness.ts
//
// Business logic untuk action "adminSetBusinessArchived" -- audit
// pra-soft-launch (19 Jul 2026), jawaban user untuk mode "hapus bisnis":
// "Keduanya" (arsipkan yang reversible + hapus permanen terpisah, lihat
// deleteBusiness.ts). Ini jalur AMAN/reversible -- pakai kolom `active`
// yang SUDAH ADA di business_profiles (sama kolom yang dipakai pemilik
// bisnis sendiri untuk mengarsipkan bisnisnya, lihat is_archived di
// getCustomerDetail.ts), jadi tidak ada kolom/konsep baru dan datanya tetap
// utuh -- bisa dipulihkan kapan saja dengan memanggil aksi ini lagi.
//
// SENGAJA dibatasi super_admin saja, konsisten dengan aksi tulis admin
// lainnya.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function adminSetBusinessArchived(
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
    return { status: 403, body: { error: "Hanya super admin yang boleh mengarsipkan/memulihkan bisnis." } };
  }

  const businessProfileId = payload.businessProfileId;
  const archived = payload.archived;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (typeof archived !== "boolean") {
    return { status: 400, body: { error: "archived (true/false) wajib diisi" } };
  }

  const { data: existing, error: findError } = await supabase
    .from("business_profiles")
    .select("id, business_name, active")
    .eq("id", businessProfileId)
    .maybeSingle();
  if (findError || !existing) {
    return { status: 404, body: { error: "Bisnis tidak ditemukan." } };
  }

  const { error: updateError } = await supabase
    .from("business_profiles")
    .update({ active: !archived })
    .eq("id", businessProfileId);

  if (updateError) {
    console.error("adminSetBusinessArchived error:", updateError);
    return { status: 500, body: { error: "Gagal mengubah status arsip bisnis." } };
  }

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: archived ? "adminArchiveBusiness" : "adminUnarchiveBusiness",
    target: existing.business_name as string,
    detail: { businessProfileId },
    ip,
    userAgent,
  });

  return { status: 200, body: { ok: true, archived } };
}
