// services/admin/deleteBusiness.ts
//
// Business logic untuk action "adminDeleteBusinessPermanently" -- audit
// pra-soft-launch (19 Jul 2026), jawaban user: mode "Keduanya" (arsipkan
// reversible di archiveBusiness.ts, DAN hapus permanen di sini untuk kasus
// yang benar-benar perlu dihapus total). TIDAK BISA DIBATALKAN -- ini
// SATU-SATUNYA aksi hard-delete di seluruh halaman admin.
//
// Kenapa perlu daftar tabel manual di bawah (bukan cukup DELETE FROM
// business_profiles dan mengandalkan cascade): riset lewat migrations/*.sql
// menemukan TIDAK SEMUA tabel yang punya business_profile_id memakai
// `on delete cascade` (mis. business_achievements, business_memory_facts,
// competitor_snapshots, business_decisions, business_reports,
// social_media_snapshots, notification_reads) -- kalau baris ini masih ada,
// DELETE FROM business_profiles akan GAGAL dengan foreign key violation
// (gagal aman, bukan korupsi data, tapi tetap gagal). Tabel INTI
// (subscriptions/payments/analyses/business_updates) dibuat SEBELUM folder
// migrations/ ini ada (tidak ada file DDL-nya di repo sama sekali) --
// dibersihkan manual juga di sini sebagai jaga-jaga karena constraint
// cascade-nya tidak bisa dipastikan dari kode.
//
// Tabel yang SUDAH `on delete cascade` (today_engine, business_os_weekly_
// monthly, living_business_loop, admin_business_notes,
// business_lead_recommendations, chat_starters, business_action_plan,
// mission_action_log, business_goal_packages, cost_tracking [on delete SET
// NULL]) TIDAK perlu dibersihkan manual -- otomatis ikut terhapus/ternull-
// kan begitu baris business_profiles-nya hilang.
//
// Urutan penghapusan di bawah TIDAK PENTING (semua tabel di sini adalah
// tabel "daun" yang tidak saling mereferensi satu sama lain, hanya ke
// business_profiles) -- dilakukan berurutan (bukan Promise.all) supaya
// kalau salah satu gagal, jelas tabel mana yang bermasalah dari pesan error.
//
// SENGAJA dibatasi super_admin saja + WAJIB payload.confirmBusinessName
// cocok PERSIS dengan nama bisnis saat ini (pola "ketik nama untuk
// konfirmasi", umum dipakai untuk aksi destruktif) supaya tidak mungkin
// terhapus karena salah klik.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { logAdminAction } from "./auditLog.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Tabel TANPA on delete cascade yang ditemukan lewat migrations/*.sql --
// harus dibersihkan manual sebelum baris business_profiles bisa dihapus.
const NON_CASCADE_CHILD_TABLES = [
  "business_achievements",
  "business_memory_facts",
  "competitor_snapshots",
  "business_decisions",
  "business_reports",
  "social_media_snapshots",
  "notification_reads",
];

// Tabel INTI (dibuat sebelum migrations/ ada, DDL-nya tidak ada di repo) --
// dibersihkan manual sebagai jaga-jaga, cascade-nya tidak bisa dipastikan
// dari kode.
const CORE_CHILD_TABLES = ["subscriptions", "payments", "analyses", "business_updates"];

export async function adminDeleteBusinessPermanently(
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
    return { status: 403, body: { error: "Hanya super admin yang boleh menghapus bisnis secara permanen." } };
  }

  const businessProfileId = payload.businessProfileId;
  const confirmBusinessName = typeof payload.confirmBusinessName === "string" ? payload.confirmBusinessName.trim() : "";
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: existing, error: findError } = await supabase
    .from("business_profiles")
    .select("id, business_name, user_id")
    .eq("id", businessProfileId)
    .maybeSingle();
  if (findError || !existing) {
    return { status: 404, body: { error: "Bisnis tidak ditemukan." } };
  }

  if (!confirmBusinessName || confirmBusinessName !== existing.business_name) {
    return { status: 400, body: { error: "Ketik ulang nama bisnis persis untuk konfirmasi penghapusan." } };
  }

  for (const table of [...NON_CASCADE_CHILD_TABLES, ...CORE_CHILD_TABLES]) {
    const { error } = await supabase.from(table).delete().eq("business_profile_id", businessProfileId);
    if (error) {
      console.error(`adminDeleteBusinessPermanently: gagal membersihkan ${table}:`, error);
      return {
        status: 500,
        body: { error: `Gagal menghapus data terkait (${table}). Bisnis belum dihapus, tidak ada data yang hilang. Coba lagi.` },
      };
    }
  }

  const { error: deleteError } = await supabase.from("business_profiles").delete().eq("id", businessProfileId);
  if (deleteError) {
    console.error("adminDeleteBusinessPermanently: gagal menghapus business_profiles:", deleteError);
    return {
      status: 500,
      body: {
        error:
          "Data terkait sudah dibersihkan, tapi bisnis itu sendiri gagal dihapus (kemungkinan masih ada tabel lain yang mereferensikannya). Hubungi developer.",
      },
    };
  }

  await logAdminAction({
    actorEmail: session.email,
    actorRole: session.role,
    action: "adminDeleteBusinessPermanently",
    target: existing.business_name as string,
    detail: { businessProfileId, ownerUserId: existing.user_id },
    ip,
    userAgent,
  });

  return { status: 200, body: { ok: true } };
}
