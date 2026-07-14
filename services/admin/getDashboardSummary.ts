// services/admin/getDashboardSummary.ts
//
// Business logic untuk action "adminGetDashboardSummary" -- tab pertama
// yang dibuka halaman admin. Audit Juli 2026 ("halaman admin yang harus
// kita punya"): sebelumnya halaman admin cuma bisa "lihat satu pelanggan
// pada satu waktu" -- tidak ada gambaran kesehatan bisnis secara
// keseluruhan. Tab ini mengumpulkan angka ringkasan yang paling sering
// dicek pemilik produk dalam SATU panggilan (bukan N+1 -- semua query
// paralel), supaya halaman tetap ringan.
//
// Baca-saja. Otorisasi lewat sesi admin TERPISAH dari Supabase Auth (lihat
// services/admin/auth/requireAdminSession.ts).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const SIGNUP_TREND_DAYS = 14;

// Harga tier -- SUMBER KEBENARAN sebenarnya ada di api/create-transaction.ts
// (TIER_PRICES, dipakai saat benar-benar membuat transaksi Midtrans).
// Diduplikasi di sini (bukan diimpor) karena api/create-transaction.ts
// adalah default-export handler Vercel, bukan modul yang aman diimpor dari
// tempat lain. Kalau harga berubah, dua tempat ini perlu diperbarui
// bersamaan -- risikonya rendah (harga jarang berubah) dan MRR di sini
// cuma estimasi tampilan, bukan angka billing resmi.
const TIER_PRICE_IDR: Record<string, number> = { pro: 99000, platinum: 349000 };

export async function adminGetDashboardSummary(adminToken: string | undefined, _payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }

  const trendSince = new Date(Date.now() - SIGNUP_TREND_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalCustomers, error: profilesCountError },
    { data: recentProfiles, error: recentProfilesError },
    { data: activeSubs, error: activeSubsError },
    { count: totalWizardDrafts, error: draftsCountError },
    { count: promotedDrafts, error: promotedCountError },
    { data: pendingPayments, error: pendingPaymentsError },
    { data: failedPayments, error: failedPaymentsError },
    { count: newContactMessages, error: contactCountError },
    { data: onlineProfiles, error: onlineError },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("created_at").gte("created_at", trendSince),
    supabase.from("subscriptions").select("tier, expires_at").eq("status", "active"),
    supabase.from("wizard_drafts").select("id", { count: "exact", head: true }),
    supabase.from("wizard_drafts").select("id", { count: "exact", head: true }).eq("status", "promoted"),
    supabase.from("payments").select("id, amount, tier, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50),
    supabase.from("payments").select("id, amount, tier, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(50),
    supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
    supabase.from("profiles").select("id, last_seen_at").not("last_seen_at", "is", null),
  ]);

  const firstError =
    profilesCountError ||
    recentProfilesError ||
    activeSubsError ||
    draftsCountError ||
    promotedCountError ||
    pendingPaymentsError ||
    failedPaymentsError ||
    contactCountError ||
    onlineError;
  if (firstError) {
    console.error("adminGetDashboardSummary error:", firstError);
    return { status: 500, body: { error: "Gagal memuat ringkasan dashboard." } };
  }

  // MRR kasar: jumlah langganan aktif (belum lewat expires_at) dikali harga
  // tiernya. Bukan pencatatan billing resmi -- hanya estimasi tampilan
  // (lihat catatan TIER_PRICE_IDR di atas).
  let tierCounts: Record<string, number> = { free: 0, pro: 0, platinum: 0 };
  let mrrIdr = 0;
  for (const s of activeSubs || []) {
    if (s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) continue;
    const tier = s.tier || "free";
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    mrrIdr += TIER_PRICE_IDR[tier] || 0;
  }

  // Tren pendaftaran per hari, 14 hari terakhir -- diisi 0 untuk hari tanpa
  // pendaftaran supaya grafik di frontend tidak perlu mengisi celah sendiri.
  const trendByDay = new Map<string, number>();
  for (let i = 0; i < SIGNUP_TREND_DAYS; i++) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    trendByDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const p of recentProfiles || []) {
    const day = (p.created_at as string).slice(0, 10);
    if (trendByDay.has(day)) trendByDay.set(day, (trendByDay.get(day) || 0) + 1);
  }
  const signupTrend = Array.from(trendByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  const onlineNow = (onlineProfiles || []).filter(
    (p) => p.last_seen_at && Date.now() - new Date(p.last_seen_at as string).getTime() < ONLINE_THRESHOLD_MS
  ).length;

  const sumAmount = (rows: { amount: number | null }[] | null) => (rows || []).reduce((sum, r) => sum + (r.amount || 0), 0);

  return {
    status: 200,
    body: {
      role: session.role,
      totalCustomers: totalCustomers || 0,
      onlineNow,
      tierCounts,
      mrrIdr,
      signupTrend,
      wizardFunnel: {
        totalDrafts: totalWizardDrafts || 0,
        promoted: promotedDrafts || 0,
        conversionRate: totalWizardDrafts ? Math.round(((promotedDrafts || 0) / totalWizardDrafts) * 1000) / 10 : 0,
      },
      payments: {
        pendingCount: (pendingPayments || []).length,
        pendingAmountIdr: sumAmount(pendingPayments),
        failedCount: (failedPayments || []).length,
        failedAmountIdr: sumAmount(failedPayments),
      },
      newContactMessages: newContactMessages || 0,
    },
  };
}
