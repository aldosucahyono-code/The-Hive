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
const CHILD_TABLES = [
  "analyses",
  "business_updates",
  "business_health",
  "progress_snapshots",
  "business_metrics",
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
