// services/admin/classifyBusinessCategory.ts
//
// Business logic untuk action "adminClassifyBusinessCategory" (satu bisnis,
// dari tombol "Klasifikasikan dengan AI" / "Klasifikasi Ulang" di kartu
// bisnis) dan "adminClassifyAllUncategorized" (tombol "Klasifikasikan Semua
// yang Belum Dikategorikan" di tab Pelanggan) -- audit pra-soft-launch
// (19 Jul 2026): "semua bisnis pasti ada kategorinya... gunakan ai untuk
// memetakan". Sebelumnya klasifikasi HANYA jalan lazy saat pemilik bisnis
// membuka Workspace Home mereka sendiri (lihat services/business/
// classifyCategory.ts) -- bisnis yang pemiliknya belum pernah buka Workspace
// Home (atau daftar sebelum fitur kategori ini ada) selamanya "Belum
// dikategorikan" sampai mereka login. Sekarang admin bisa memicu klasifikasi
// langsung, tanpa menunggu pelanggan login.
//
// Memakai INTI yang SAMA (classifyAndSaveBusinessCategory) dengan alur
// pelanggan -- SATU logika klasifikasi, cuma beda siapa yang memicu dan
// otorisasinya (sesi admin, bukan checkOwnership pelanggan).
//
// SENGAJA dibatasi super_admin saja, konsisten dengan aksi tulis admin
// lainnya.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";
import { classifyAndSaveBusinessCategory } from "../business/classifyCategory.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Batas per panggilan -- api/workspace.ts sudah diset maxDuration 480 detik
// (lihat vercel.json), cukup untuk puluhan panggilan Claude berurutan, tapi
// tetap dibatasi supaya satu klik tidak menunggu terlalu lama dan admin
// bisa lihat progres bertahap. Sisa yang belum diklasifikasi tinggal klik
// tombol lagi (dipandu jumlah sisa di response).
const BATCH_LIMIT = 25;

export async function adminClassifyBusinessCategory(
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
    return { status: 403, body: { error: "Hanya super admin yang boleh menjalankan klasifikasi AI." } };
  }

  const businessProfileId = payload.businessProfileId;
  const force = payload.force === true;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: findError } = await supabase
    .from("business_profiles")
    .select("id, business_name, business_category")
    .eq("id", businessProfileId)
    .maybeSingle();
  if (findError || !business) {
    return { status: 404, body: { error: "Bisnis tidak ditemukan." } };
  }

  try {
    const result = await classifyAndSaveBusinessCategory(businessProfileId, business.business_category, force);
    await logAdminAction({
      actorEmail: session.email,
      actorRole: session.role,
      action: "adminClassifyBusinessCategory",
      target: business.business_name as string,
      detail: { businessProfileId, fromCategory: business.business_category, toCategory: result.category, forced: force },
      ip,
      userAgent,
    });
    return { status: 200, body: result };
  } catch (err) {
    console.error("adminClassifyBusinessCategory error:", err);
    return { status: 500, body: { error: err instanceof Error ? err.message : "Gagal mengklasifikasi bisnis." } };
  }
}

export async function adminClassifyAllUncategorized(
  adminToken: string | undefined,
  _payload: Record<string, unknown>,
  ip: string,
  userAgent: string
): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }
  if (session.role !== "super_admin") {
    return { status: 403, body: { error: "Hanya super admin yang boleh menjalankan klasifikasi AI." } };
  }

  const { data: candidates, error: findError } = await supabase
    .from("business_profiles")
    .select("id, business_name")
    .is("business_category", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT);

  if (findError) {
    console.error("adminClassifyAllUncategorized: gagal memuat daftar:", findError);
    return { status: 500, body: { error: "Gagal memuat daftar bisnis yang belum dikategorikan." } };
  }

  const list = candidates || [];
  let classified = 0;
  const failures: string[] = [];

  // Berurutan (bukan Promise.all) -- sengaja tidak membanjiri Claude API
  // dengan puluhan panggilan bersamaan sekaligus, dan supaya kalau satu
  // gagal, sisanya tetap lanjut (bukan Promise.all yang batal semua kalau
  // satu reject).
  for (const b of list) {
    try {
      await classifyAndSaveBusinessCategory(b.id, null, false);
      classified++;
    } catch (err) {
      console.error(`adminClassifyAllUncategorized: gagal untuk ${b.id}:`, err);
      failures.push(b.business_name as string);
    }
  }

  const { count: remaining } = await supabase
    .from("business_profiles")
    .select("id", { count: "exact", head: true })
    .is("business_category", null);

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: "adminClassifyAllUncategorized",
    target: null,
    detail: { classified, failed: failures.length, failedNames: failures, remainingAfter: remaining ?? 0 },
    ip,
    userAgent,
  });

  return { status: 200, body: { classified, failed: failures.length, remaining: remaining ?? 0 } };
}
