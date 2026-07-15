// services/admin/getCostDashboard.ts
//
// Business logic untuk action "adminGetCostDashboard" -- tab baru "Biaya &
// Kuota" di halaman super-admin (permintaan pemilik produk, Juli 2026):
// "saya ingin ada detail perhitungan rupiah per account users, dari berapa
// yang mereka pakai... serta apa saja yang sudah menjadi langganan kita
// (api, hosting, vercel, claude, dll) serta tinggal berapa kuotanya...
// termasuk nilai kurs juga, saya ingin memantau di superadmin."
//
// SATU ATURAN MUTLAK yang mengikat SELURUH file ini: "tidak ada data
// palsu" -- setiap angka biaya di sini berasal dari:
// - ai_usage_log: dicatat per PANGGILAN NYATA Claude/Apify dari token/event
//   ASLI response API (lihat services/costTracking/logUsage.ts + SEMUA
//   titik panggilan yang di-instrument, bukan estimasi flat).
// - services/exchangeRate/getUsdIdrRate.ts: kurs live USD/IDR sungguhan
//   (open.er-api.com, di-cache di database).
// - services/vercelUsage/getVercelUsage.ts: tagihan Vercel SUNGGUHAN lewat
//   Management API resmi (FOCUS v1.3).
// - services/supabaseUsage/getSupabaseUsage.ts: ukuran database SUNGGUHAN
//   lewat Supabase Management API resmi (pg_database_size).
//
// Kalau salah satu sumber (Vercel/Supabase API) belum dikonfigurasi
// (env var belum diset pemilik produk) atau gagal dihubungi, field terkait
// dikembalikan dengan available:false + alasan jujur -- TIDAK PERNAH diganti
// angka karangan supaya dashboard "terlihat lengkap".
//
// Baca-saja. Otorisasi lewat sesi admin TERPISAH dari Supabase Auth (lihat
// services/admin/auth/requireAdminSession.ts) -- pola sama persis dengan
// getDashboardSummary.ts.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { getUsdIdrRate } from "../exchangeRate/getUsdIdrRate.js";
import { getVercelUsage } from "../vercelUsage/getVercelUsage.js";
import { getSupabaseUsage } from "../supabaseUsage/getSupabaseUsage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TOP_CUSTOMERS_LIMIT = 20;
const USAGE_LOG_SCAN_LIMIT = 20000; // cukup untuk histori beberapa bulan tanpa membebani query tunggal

export async function adminGetCostDashboard(adminToken: string | undefined, payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }

  const periodDays = typeof payload.periodDays === "number" && payload.periodDays > 0 ? Math.min(payload.periodDays, 90) : 30;
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();

  const [usageRows, exchangeRate, vercelUsage, supabaseUsage] = await Promise.all([
    supabase
      .from("ai_usage_log")
      .select("business_profile_id, email, service, action, cost_usd, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(USAGE_LOG_SCAN_LIMIT),
    getUsdIdrRate(),
    getVercelUsage(periodDays),
    getSupabaseUsage(),
  ]);

  if (usageRows.error) {
    console.error("adminGetCostDashboard: gagal memuat ai_usage_log:", usageRows.error);
    return { status: 500, body: { error: "Gagal memuat data biaya AI." } };
  }
  const rows = usageRows.data || [];

  // Ringkasan per service (claude vs apify) -- total biaya USD periode ini.
  let claudeCostUsd = 0;
  let apifyCostUsd = 0;
  const byActionUsd = new Map<string, number>();
  const byCustomerUsd = new Map<string, number>(); // key: business_profile_id, "" untuk anonim
  const byCustomerEmail = new Map<string, string>(); // fallback identitas kalau business_profile_id null (preview/wizard anonim)

  for (const r of rows) {
    const cost = Number(r.cost_usd) || 0;
    if (r.service === "claude") claudeCostUsd += cost;
    else if (r.service === "apify") apifyCostUsd += cost;

    byActionUsd.set(r.action, (byActionUsd.get(r.action) || 0) + cost);

    const custKey = r.business_profile_id || "";
    byCustomerUsd.set(custKey, (byCustomerUsd.get(custKey) || 0) + cost);
    if (!custKey && r.email && !byCustomerEmail.has(custKey)) {
      // tidak dipakai untuk key (banyak baris anonim berbeda email bisa
      // saling menimpa) -- baris anonim digabung jadi SATU baris "Pra-akun
      // (preview/wizard)" di bawah, bukan per-email, supaya daftar top
      // customer tetap fokus ke akun SUNGGUHAN.
    }
  }

  const totalCostUsd = claudeCostUsd + apifyCostUsd;

  // Top customer by cost -- ambil nama bisnis dari business_profiles untuk
  // baris yang punya business_profile_id (bukan anonim).
  const customerIds = Array.from(byCustomerUsd.keys()).filter(Boolean);
  const { data: businessRows } = customerIds.length
    ? await supabase.from("business_profiles").select("id, business_name, user_id").in("id", customerIds)
    : { data: [] as Array<{ id: string; business_name: string; user_id: string }> };
  const userIds = (businessRows || []).map((b) => b.user_id).filter(Boolean);
  const { data: profileRows } = userIds.length ? await supabase.from("profiles").select("id, email").in("id", userIds) : { data: [] as Array<{ id: string; email: string }> };
  const emailByUserId = new Map((profileRows || []).map((p) => [p.id, p.email]));
  const businessById = new Map((businessRows || []).map((b) => [b.id, b]));

  const anonymousCostUsd = byCustomerUsd.get("") || 0;
  const topCustomers = Array.from(byCustomerUsd.entries())
    .filter(([id]) => id) // baris anonim ditampilkan terpisah, bukan di daftar per-customer
    .map(([businessProfileId, costUsd]) => {
      const b = businessById.get(businessProfileId);
      return {
        businessProfileId,
        businessName: b?.business_name || "(bisnis tidak ditemukan)",
        email: b?.user_id ? emailByUserId.get(b.user_id) || null : null,
        costUsd,
        costIdr: Math.round(costUsd * exchangeRate.rate),
      };
    })
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, TOP_CUSTOMERS_LIMIT);

  const byAction = Array.from(byActionUsd.entries())
    .map(([action, costUsd]) => ({ action, costUsd, costIdr: Math.round(costUsd * exchangeRate.rate) }))
    .sort((a, b) => b.costUsd - a.costUsd);

  return {
    status: 200,
    body: {
      role: session.role,
      periodDays,
      exchangeRate: { rate: exchangeRate.rate, source: exchangeRate.source, fetchedAt: exchangeRate.fetchedAt },
      aiUsage: {
        totalCostUsd,
        totalCostIdr: Math.round(totalCostUsd * exchangeRate.rate),
        claudeCostUsd,
        claudeCostIdr: Math.round(claudeCostUsd * exchangeRate.rate),
        apifyCostUsd,
        apifyCostIdr: Math.round(apifyCostUsd * exchangeRate.rate),
        anonymousCostUsd,
        anonymousCostIdr: Math.round(anonymousCostUsd * exchangeRate.rate),
        byAction,
        topCustomers,
        rowsScanned: rows.length,
        scanLimitReached: rows.length >= USAGE_LOG_SCAN_LIMIT,
      },
      vercel: vercelUsage,
      supabase: supabaseUsage,
    },
  };
}
