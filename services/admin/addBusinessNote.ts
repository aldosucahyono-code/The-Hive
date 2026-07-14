// services/admin/addBusinessNote.ts
//
// Business logic untuk action "adminAddBusinessNote" -- catatan manual
// admin per bisnis (migrations/2026-07-15e_admin_business_notes.sql),
// termasuk paste screenshot percakapan pelanggan. SENGAJA dibatasi
// super_admin saja (sama seperti updateContactMessageStatus.ts/manageAdmins.ts)
// -- ini satu-satunya aksi TULIS baru di halaman admin, admin view-only
// tidak boleh menambah catatan.
//
// Otorisasi lewat sesi admin TERPISAH dari Supabase Auth. Setiap catatan
// baru dicatat juga ke admin_audit_log.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Batas ukuran data URI gambar -- dijaga di kode (bukan constraint DB)
// supaya pesan errornya ramah. ~2.7 juta karakter base64 setara sekitar 2MB
// gambar asli -- cukup untuk screenshot percakapan biasa, tanpa membuat
// baris database jadi terlalu besar (halaman admin tetap harus "ringan").
const MAX_IMAGE_DATA_URL_LENGTH = 2_700_000;

export async function adminAddBusinessNote(
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
    return { status: 403, body: { error: "Hanya super admin yang boleh menambah catatan." } };
  }

  const businessProfileId = payload.businessProfileId;
  const note = typeof payload.note === "string" ? payload.note.trim() : "";
  const imageDataUrl = typeof payload.imageDataUrl === "string" ? payload.imageDataUrl.trim() : "";

  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  if (!note && !imageDataUrl) {
    return { status: 400, body: { error: "Isi catatan atau tempel screenshot dulu." } };
  }
  if (imageDataUrl && !imageDataUrl.startsWith("data:image/")) {
    return { status: 400, body: { error: "Format gambar tidak dikenali." } };
  }
  if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return { status: 400, body: { error: "Ukuran gambar terlalu besar (maksimal sekitar 2MB)." } };
  }

  const { data: business, error: businessError } = await supabase
    .from("business_profiles")
    .select("id, business_name")
    .eq("id", businessProfileId)
    .maybeSingle();
  if (businessError || !business) {
    return { status: 404, body: { error: "Bisnis tidak ditemukan." } };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("admin_business_notes")
    .insert({
      business_profile_id: businessProfileId,
      note: note || null,
      image_data_url: imageDataUrl || null,
      created_by_email: session.email,
    })
    .select("id, note, image_data_url, created_by_email, created_at")
    .single();

  if (insertError || !inserted) {
    console.error("adminAddBusinessNote error:", insertError);
    return { status: 500, body: { error: "Gagal menyimpan catatan." } };
  }

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: "adminAddBusinessNote",
    target: business.business_name as string,
    detail: { businessProfileId, hasImage: !!imageDataUrl },
    ip,
    userAgent,
  });

  return { status: 200, body: { note: inserted } };
}
