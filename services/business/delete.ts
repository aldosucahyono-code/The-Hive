// services/business/delete.ts
//
// Business logic untuk action "delete" — HARD DELETE sungguhan (cascade ke
// semua data terkait). Hanya boleh dijalankan kalau bisnis sudah non-aktif
// (active = false), mencegah penghapusan permanen bisnis yang masih dipakai.
//
// BUGFIX Juli 2026: sebagian tabel anak (business_achievements,
// business_decisions, business_memory_facts, competitor_snapshots,
// business_reports, social_media_snapshots, notification_reads, dan
// beberapa tabel lama seperti analyses/business_updates/business_health/
// progress_snapshots/business_metrics yang dibuat sebelum migrations/
// mulai dilacak) TIDAK punya "on delete cascade" di foreign key-nya.
// Akibatnya raw DELETE ke business_profiles ditolak Postgres dengan
// foreign-key violation begitu ada baris anak tersisa, muncul sebagai
// error generik "Gagal menghapus bisnis secara permanen" — dilaporkan
// user saat mencoba hapus "Ayam geprek asik" yang sudah lama dipakai
// (banyak baris anak di berbagai fitur). Solusi paling aman TANPA perlu
// migrasi skema (yang butuh koneksi DB langsung yang tidak dipegang di
// sini): hapus eksplisit semua baris anak lebih dulu, tabel per tabel,
// sebelum baris business_profiles-nya sendiri dihapus. Aman dijalankan
// juga untuk tabel yang SUDAH punya on delete cascade — tidak ada baris
// tersisa untuk dihapus di sana, jadi no-op.
//
// AUDIT LANJUTAN (20 Jul 2026): "business_metrics" DIHAPUS dari daftar ini
// -- tabel ini TIDAK punya kolom business_profile_id sama sekali (lihat
// services/business/recalculateProgress.ts), FK-nya ke
// progress_snapshots(id) lewat kolom snapshot_id. .eq("business_profile_id",
// ...) ke tabel ini SELALU gagal (kolom tidak ada), errornya cuma di-log
// lalu diabaikan (lihat loop di bawah) -- jadi baris business_metrics TIDAK
// PERNAH benar-benar terhapus lewat baris ini, dan kalau FK snapshot_id
// ternyata bukan on delete cascade, ini yang memblokir penghapusan
// progress_snapshots (lalu ujungnya business_profiles) untuk SETIAP bisnis
// yang pernah dihitung Business Progress-nya -- persis kelas bug yang sama
// dengan yang tertulis di komentar atas ("Ayam geprek asik"). Dibersihkan
// benar lewat deleteBusinessMetricsViaSnapshots() di bawah, SEBELUM
// progress_snapshots dihapus.
const CHILD_TABLES = [
  "analyses",
  "business_updates",
  "business_health",
  "progress_snapshots",
  "business_achievements",
  "business_decisions",
  "business_memory_facts",
  "competitor_snapshots",
  "business_reports",
  "social_media_snapshots",
  "notification_reads",
  "business_checklist_progress",
  "business_stage_state",
  "today_snapshot",
  "business_weekly_review",
  "business_monthly_snapshot",
] as const;

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "./create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/** Hapus baris business_metrics milik bisnis ini lewat progress_snapshots
 * (business_metrics.snapshot_id -> progress_snapshots.id) -- tabel ini TIDAK
 * punya kolom business_profile_id langsung (lihat catatan CHILD_TABLES di
 * atas). Dipanggil SEBELUM progress_snapshots dihapus di CHILD_TABLES. Gagal
 * di sini cuma di-log (konsisten dengan gaya "coba semua tabel, log kalau
 * gagal" di bawah), tidak menghentikan proses -- tetap ada guard akhir di
 * DELETE business_profiles kalau ternyata masih ada yang memblokir. */
async function deleteBusinessMetricsViaSnapshots(businessProfileId: string): Promise<void> {
  const { data: snapshots, error: findError } = await supabase
    .from("progress_snapshots")
    .select("id")
    .eq("business_profile_id", businessProfileId);
  if (findError) {
    console.error("services/business/delete: gagal mencari progress_snapshots untuk business_metrics:", findError);
    return;
  }
  const snapshotIds = (snapshots || []).map((s) => s.id as string);
  if (snapshotIds.length === 0) return;
  const { error: deleteError } = await supabase.from("business_metrics").delete().in("snapshot_id", snapshotIds);
  if (deleteError) {
    console.error("services/business/delete: gagal bersihkan business_metrics:", deleteError);
  }
}

export async function deleteBusinessPermanently(
  userId: string,
  payload: Record<string, unknown>
): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: businessProfile, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id, active")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !businessProfile || businessProfile.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  if (businessProfile.active) {
    return {
      status: 400,
      body: { error: "Bisnis ini masih aktif. Hapus (nonaktifkan) dulu sebelum menghapus permanen." },
    };
  }

  // business_metrics dulu (lihat deleteBusinessMetricsViaSnapshots di atas)
  // -- HARUS sebelum progress_snapshots dihapus di loop CHILD_TABLES,
  // karena business_metrics mereferensikan progress_snapshots(id).
  await deleteBusinessMetricsViaSnapshots(businessProfileId);

  // wizard_drafts.business_profile_id diisi promoteDraft.ts setelah draft
  // "naik level" jadi bisnis ini. Best-effort saja (lepas referensi, bukan
  // hapus baris drafnya) -- lihat catatan yang sama di
  // services/admin/deleteBusiness.ts.
  await supabase.from("wizard_drafts").update({ business_profile_id: null }).eq("business_profile_id", businessProfileId);

  // Bersihkan semua tabel anak dulu (lihat komentar CHILD_TABLES di atas).
  // Kalau salah satu gagal karena alasan lain (bukan sekadar "tidak ada
  // baris"), catat tapi tetap lanjut coba tabel lain — baru gagalkan
  // seluruh proses kalau DELETE business_profiles di bawah pada akhirnya
  // masih ditolak.
  for (const table of CHILD_TABLES) {
    const { error: childError } = await supabase.from(table).delete().eq("business_profile_id", businessProfileId);
    if (childError) {
      console.error(`services/business/delete: gagal bersihkan tabel anak "${table}":`, childError);
    }
  }

  const { error: deleteError } = await supabase.from("business_profiles").delete().eq("id", businessProfileId);

  if (deleteError) {
    console.error("services/business/delete error:", deleteError);
    return { status: 500, body: { error: "Gagal menghapus bisnis secara permanen" } };
  }

  return { status: 200, body: { success: true } };
}
