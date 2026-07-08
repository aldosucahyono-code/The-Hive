// services/workspace/submitUpdate.ts
//
// Business logic untuk action "submitUpdate" di router /api/workspace.
// Ini Tahap 2.1 — fondasi seluruh Business Engine. Murni penyimpanan data,
// TIDAK ADA reasoning/AI/scoring di sini. Business Health Engine (2.2) dan
// Progress Engine (2.3) yang nanti MEMBACA data ini untuk dihitung.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const VALID_KONDISI = ["naik", "tetap", "turun"];

export async function submitBusinessUpdate(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const perkembangan = payload.perkembangan;
  const pencapaian = payload.pencapaian;
  const tantangan = payload.tantangan;
  const kondisiPenjualan = payload.kondisiPenjualan;
  const targetDepan = payload.targetDepan;

  if (!perkembangan || typeof perkembangan !== "string" || !perkembangan.trim()) {
    return { status: 400, body: { error: "Ceritakan dulu perkembangan bisnismu minggu ini." } };
  }
  if (!pencapaian || typeof pencapaian !== "string" || !pencapaian.trim()) {
    return { status: 400, body: { error: "Ceritakan pencapaian terbaikmu minggu ini." } };
  }
  if (!tantangan || typeof tantangan !== "string" || !tantangan.trim()) {
    return { status: 400, body: { error: "Ceritakan tantangan terbesarmu minggu ini." } };
  }
  if (!VALID_KONDISI.includes(kondisiPenjualan as string)) {
    return { status: 400, body: { error: "Pilih kondisi penjualan minggu ini." } };
  }
  if (!targetDepan || typeof targetDepan !== "string" || !targetDepan.trim()) {
    return { status: 400, body: { error: "Ceritakan targetmu untuk minggu depan." } };
  }

  const omsetValue =
    typeof payload.omsetValue === "number"
      ? payload.omsetValue
      : typeof payload.omsetValue === "string" && payload.omsetValue.trim()
        ? Number(payload.omsetValue.replace(/[^0-9]/g, ""))
        : null;

  const pelangganBaru =
    typeof payload.pelangganBaru === "number"
      ? payload.pelangganBaru
      : typeof payload.pelangganBaru === "string" && payload.pelangganBaru.trim()
        ? Number(payload.pelangganBaru.replace(/[^0-9]/g, ""))
        : null;

  const { data: update, error: insertError } = await supabase
    .from("business_updates")
    .insert({
      business_profile_id: businessProfileId,
      content: perkembangan.trim(),
      period_type: "week",
      pencapaian: pencapaian.trim(),
      tantangan: tantangan.trim(),
      kondisi_penjualan: kondisiPenjualan,
      omset_value: omsetValue,
      pelanggan_baru: pelangganBaru,
      target_depan: targetDepan.trim(),
    })
    .select("id, created_at")
    .single();

  if (insertError || !update) {
    console.error("services/workspace/submitUpdate error:", insertError);
    return { status: 500, body: { error: "Gagal menyimpan update bisnis" } };
  }

  return { status: 200, body: { updateId: update.id, createdAt: update.created_at } };
}
