// services/workspace/getLatestPayment.ts
//
// Membaca status transaksi Midtrans PALING BARU untuk sebuah business_profile.
// Dipakai Workspace setelah user mencoba upgrade, supaya kalau transaksinya
// KADALUARSA (bukan sekadar "belum selesai"), user dikasih tahu jelas alasannya
// alih-alih dibiarkan diam melihat "Paket Gratis" tanpa penjelasan.
//
// Baca-saja — tidak pernah mengubah data pembayaran.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function getLatestPayment(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const { data: payment, error } = await supabase
    .from("payments")
    .select("tier, status, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("services/workspace/getLatestPayment error:", error);
    return { status: 500, body: { error: "Gagal memuat status transaksi" } };
  }

  return {
    status: 200,
    body: {
      payment: payment ? { tier: payment.tier, status: payment.status, createdAt: payment.created_at } : null,
    },
  };
}
