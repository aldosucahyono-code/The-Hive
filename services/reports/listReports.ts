// services/reports/listReports.ts
//
// Task 13: dibaca dua tempat — panel "Final Reports" (baseline + expiry
// terbaru) dan arsip "Pengaturan" (semua PDF 12 bulan terakhir, bisa
// didownload sewaktu-waktu). Bucket "reports" PRIVATE (lihat
// migrations/2026-07-11_final_reports.sql) jadi setiap baris dikembalikan
// dengan signed URL sementara (1 jam), dibuat di sini — bukan public URL.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const REPORTS_BUCKET = "reports";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 jam — cukup untuk satu sesi download, tidak permanen.
const ARCHIVE_WINDOW_DAYS = 366; // "arsip PDF selama setahun" (Pengaturan).

export async function listReports(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const cutoff = new Date(Date.now() - ARCHIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("business_reports")
    .select("id, report_type, storage_path, period_start, period_end, created_at")
    .eq("business_profile_id", businessProfileId)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("services/reports/listReports error:", error);
    return { status: 500, body: { error: "Gagal memuat arsip laporan." } };
  }

  const reports = await Promise.all(
    (rows || []).map(async (r) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(REPORTS_BUCKET)
        .createSignedUrl(r.storage_path, SIGNED_URL_TTL_SECONDS);
      if (signError) {
        console.error("services/reports/listReports: gagal buat signed URL untuk", r.storage_path, signError);
      }
      return {
        id: r.id,
        reportType: r.report_type as "baseline" | "expiry",
        periodStart: r.period_start,
        periodEnd: r.period_end,
        createdAt: r.created_at,
        downloadUrl: signed?.signedUrl || null,
      };
    })
  );

  return { status: 200, body: { reports } };
}
