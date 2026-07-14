// services/admin/listPayments.ts
//
// Business logic untuk action "adminListPayments" -- daftar transaksi
// LINTAS SEMUA pelanggan dalam satu tabel (bukan cuma per-pelanggan seperti
// getCustomerDetail.ts). Audit Juli 2026: dibuat supaya pemilik produk bisa
// langsung lihat transaksi "pending"/"failed" yang butuh perhatian tanpa
// harus buka satu-satu profil pelanggan.
//
// Baca-saja. Otorisasi lewat sesi admin TERPISAH dari Supabase Auth.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VALID_STATUS_FILTERS = ["all", "pending", "settlement", "failed", "expired"];

export async function adminListPayments(adminToken: string | undefined, payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }

  const statusFilter = typeof payload.status === "string" && VALID_STATUS_FILTERS.includes(payload.status) ? payload.status : "all";

  let query = supabase
    .from("payments")
    .select("id, business_profile_id, midtrans_order_id, tier, amount, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: payments, error: paymentsError } = await query;
  if (paymentsError) {
    console.error("adminListPayments payments error:", paymentsError);
    return { status: 500, body: { error: "Gagal memuat daftar pembayaran." } };
  }

  const businessIds = Array.from(new Set((payments || []).map((p) => p.business_profile_id).filter(Boolean)));

  const { data: businesses, error: businessesError } = businessIds.length
    ? await supabase.from("business_profiles").select("id, user_id, business_name").in("id", businessIds)
    : { data: [], error: null };
  if (businessesError) {
    console.error("adminListPayments businesses error:", businessesError);
    return { status: 500, body: { error: "Gagal memuat data bisnis untuk pembayaran." } };
  }

  const businessById = new Map((businesses || []).map((b) => [b.id, b]));
  const userIds = Array.from(new Set((businesses || []).map((b) => b.user_id).filter(Boolean)));

  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from("profiles").select("id, email").in("id", userIds)
    : { data: [], error: null };
  if (profilesError) {
    console.error("adminListPayments profiles error:", profilesError);
    return { status: 500, body: { error: "Gagal memuat data pelanggan untuk pembayaran." } };
  }

  const emailByUserId = new Map((profiles || []).map((p) => [p.id, p.email]));

  const rows = (payments || []).map((p) => {
    const business = businessById.get(p.business_profile_id);
    return {
      id: p.id,
      businessProfileId: p.business_profile_id,
      businessName: business?.business_name ?? null,
      customerEmail: business ? emailByUserId.get(business.user_id) ?? null : null,
      orderId: p.midtrans_order_id,
      tier: p.tier,
      amountIdr: p.amount,
      status: p.status,
      createdAt: p.created_at,
    };
  });

  return { status: 200, body: { role: session.role, payments: rows } };
}
