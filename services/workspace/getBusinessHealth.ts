// services/workspace/getBusinessHealth.ts
//
// Membaca hasil perhitungan Business Health Engine (business_health) —
// murni baca data, tidak menghitung apapun di sini (perhitungan sudah
// dilakukan recalculateHealth.ts saat Business Update disimpan / checklist
// diselesaikan).
//
// Audit Juli 2026: sebelumnya Business Score cuma menampilkan angka +
// "Ringkasan Singkat"/"Insight Beemo" statis dari analisa AI hari pertama
// (sama persis tiap kali dibuka, tidak pernah berubah). Sekarang juga
// mengembalikan `dimensionSignals` — sinyal MENTAH (bukan kalimat AI) di
// balik tiap dimensi, supaya frontend bisa menyusun "kenapa segini, apa
// solusinya" dari data nyata (business_updates untuk sales/finance/customer,
// business_checklist_progress untuk marketing/operations/brand), lalu
// otomatis berubah begitu Business Update/checklist baru masuk.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { CHECKLIST_DIMENSION_MAP } from "../business/checklistDimensionMap.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DIMENSIONS = ["marketing", "sales", "operations", "finance", "customer", "brand"] as const;

export async function getBusinessHealth(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
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

  const { data: rows, error } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false });

  if (error) {
    console.error("services/workspace/getBusinessHealth error:", error);
    return { status: 500, body: { error: "Gagal memuat Business Health" } };
  }

  const latestByDimension: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows || []) {
    if (!seen.has(row.dimension)) {
      latestByDimension[row.dimension] = row.score;
      seen.add(row.dimension);
    }
  }

  if (seen.size === 0) {
    return { status: 200, body: { dimensions: null, overall: null, dimensionSignals: null } };
  }

  const scores = DIMENSIONS.map((d) => latestByDimension[d]).filter((s) => typeof s === "number");
  const overall = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);

  // Sinyal sales/finance/customer <- Business Update terakhir (2 terakhir
  // untuk tahu tren omset, sama seperti recalculateHealth.ts).
  const { data: recentUpdates } = await supabase
    .from("business_updates")
    .select("kondisi_penjualan, omset_value, pelanggan_baru, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(2);
  const latestUpdate = recentUpdates?.[0] ?? null;
  const previousUpdate = recentUpdates?.[1] ?? null;
  let omsetTrend: "up" | "down" | "flat" | null = null;
  if (latestUpdate?.omset_value != null && previousUpdate?.omset_value != null) {
    omsetTrend =
      latestUpdate.omset_value > previousUpdate.omset_value
        ? "up"
        : latestUpdate.omset_value < previousUpdate.omset_value
          ? "down"
          : "flat";
  }

  // Sinyal marketing/operations/brand <- checklist yang sudah diselesaikan
  // (business_checklist_progress), dihitung dari CHECKLIST_DIMENSION_MAP
  // supaya SATU sumber dengan yang benar-benar mendorong skor.
  const { data: checklistRows } = await supabase
    .from("business_checklist_progress")
    .select("item_key")
    .eq("business_profile_id", businessProfileId);
  const completedKeys = new Set((checklistRows || []).map((r) => r.item_key as string));

  const checklistCountByDimension: Record<string, { done: number; total: number }> = {};
  for (const [itemKey, dim] of Object.entries(CHECKLIST_DIMENSION_MAP)) {
    if (!checklistCountByDimension[dim]) checklistCountByDimension[dim] = { done: 0, total: 0 };
    checklistCountByDimension[dim].total += 1;
    if (completedKeys.has(itemKey)) checklistCountByDimension[dim].done += 1;
  }

  const hasAnyUpdate = !!latestUpdate;
  const dimensionSignals = {
    marketing: { type: "checklist" as const, ...checklistCountByDimension.marketing },
    sales: { type: "update" as const, hasUpdate: hasAnyUpdate, trend: (latestUpdate?.kondisi_penjualan as string) ?? null },
    operations: { type: "checklist" as const, ...checklistCountByDimension.operations },
    finance: { type: "update" as const, hasUpdate: hasAnyUpdate, omsetTrend },
    customer: {
      type: "update" as const,
      hasUpdate: hasAnyUpdate,
      pelangganBaru: latestUpdate?.pelanggan_baru ?? null,
    },
    brand: { type: "checklist" as const, ...checklistCountByDimension.brand },
  };

  return {
    status: 200,
    body: {
      dimensions: latestByDimension,
      overall,
      dimensionSignals,
    },
  };
}
