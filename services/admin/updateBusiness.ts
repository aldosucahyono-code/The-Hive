// services/admin/updateBusiness.ts
//
// Business logic untuk action "adminUpdateBusiness" -- audit pra-soft-launch
// (19 Jul 2026): "saya bisa menghapus/edit usaha/jenis users dari
// pelanggan" + follow-up jawab "Semuanya" untuk field yang boleh diedit
// admin: kategori usaha, nama & data bisnis. Sebelumnya AdminPage TIDAK
// punya jalur edit apapun untuk data bisnis pelanggan -- satu-satunya
// "tulis" yang ada adalah catatan manual (addBusinessNote.ts).
//
// SENGAJA dibatasi super_admin saja, sama seperti addBusinessNote.ts/
// manageAdmins.ts -- ini mengubah data pelanggan langsung, admin view-only
// tidak boleh menyentuhnya. Field yang boleh diubah dibatasi eksplisit
// (whitelist) supaya tidak bisa diam-diam mengubah kolom lain (mis. user_id,
// active -- archive/unarchive punya aksi terpisah, lihat archiveBusiness.ts).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";
import { isValidBusinessCategory } from "../business/businessCategories.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const EDITABLE_STAGES = ["idea", "starting", "running"];

export async function adminUpdateBusiness(
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
    return { status: 403, body: { error: "Hanya super admin yang boleh mengubah data bisnis." } };
  }

  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: existing, error: findError } = await supabase
    .from("business_profiles")
    .select("id, business_name, industry, business_category, business_stage, phone_number")
    .eq("id", businessProfileId)
    .maybeSingle();
  if (findError || !existing) {
    return { status: 404, body: { error: "Bisnis tidak ditemukan." } };
  }

  // Whitelist ketat -- hanya field ini yang boleh diubah lewat aksi ini.
  const updates: Record<string, unknown> = {};

  if (typeof payload.businessName === "string") {
    const trimmed = payload.businessName.trim();
    if (!trimmed) return { status: 400, body: { error: "Nama bisnis tidak boleh kosong." } };
    updates.business_name = trimmed;
  }
  if (typeof payload.industry === "string") {
    updates.industry = payload.industry.trim() || null;
  }
  if (payload.businessCategory !== undefined) {
    if (payload.businessCategory !== null && !isValidBusinessCategory(payload.businessCategory)) {
      return { status: 400, body: { error: "Kategori usaha tidak valid." } };
    }
    updates.business_category = payload.businessCategory;
  }
  if (typeof payload.businessStage === "string") {
    if (!EDITABLE_STAGES.includes(payload.businessStage)) {
      return { status: 400, body: { error: "Tahap usaha tidak valid." } };
    }
    updates.business_stage = payload.businessStage;
  }
  if (typeof payload.phoneNumber === "string") {
    updates.phone_number = payload.phoneNumber.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return { status: 400, body: { error: "Tidak ada perubahan yang dikirim." } };
  }

  const { data: updated, error: updateError } = await supabase
    .from("business_profiles")
    .update(updates)
    .eq("id", businessProfileId)
    .select("id, business_name, industry, business_category, business_stage, phone_number")
    .single();

  if (updateError || !updated) {
    console.error("adminUpdateBusiness error:", updateError);
    return { status: 500, body: { error: "Gagal menyimpan perubahan bisnis." } };
  }

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: "adminUpdateBusiness",
    target: existing.business_name as string,
    detail: { businessProfileId, before: existing, after: updated },
    ip,
    userAgent,
  });

  return { status: 200, body: { business: updated } };
}
