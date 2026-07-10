// services/workspace/submitUpdate.ts
//
// Business logic untuk action "submitUpdate" di router /api/workspace.
// Ini Tahap 2.1 — fondasi seluruh Business Engine. Murni penyimpanan data,
// TIDAK ADA reasoning/AI/scoring di sini. Business Health Engine (2.2) dan
// Progress Engine (2.3) yang nanti MEMBACA data ini untuk dihitung.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { recalculateBusinessHealth } from "../business/recalculateHealth.js";
import { recalculateProgress } from "../business/recalculateProgress.js";
import { evaluateAchievements, type NewlyUnlocked } from "../business/evaluateAchievements.js";
import { classifyUpdate } from "../updateEngine/classify.js";

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

  // Business Update Engine (directive "CONTINUE — BUSINESS UPDATE ENGINE"):
  // ambil omset_value update TERAKHIR (sebelum yang baru ini) supaya
  // classifyUpdate bisa menghitung tren nyata (naik/turun berapa persen)
  // — bukan menebak. Kalau ini update pertama, previousOmsetValue null,
  // classifyUpdate menangani itu secara jujur (tidak memaksakan angka).
  const { data: lastUpdate } = await supabase
    .from("business_updates")
    .select("omset_value")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const insight = classifyUpdate({
    kondisiPenjualan: kondisiPenjualan as "naik" | "tetap" | "turun",
    omsetValue,
    previousOmsetValue: (lastUpdate?.omset_value as number | null) ?? null,
    tantangan: tantangan.trim(),
  });

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
      category: insight.category,
      severity: insight.severity,
      insight_headline_key: insight.headlineKey,
      insight_headline_params: insight.headlineParams,
      insight_action_key: insight.actionKey,
    })
    .select("id, created_at")
    .single();

  if (insertError || !update) {
    console.error("services/workspace/submitUpdate error:", insertError);
    return { status: 500, body: { error: "Gagal menyimpan update bisnis" } };
  }

  // Business Engine: hitung ulang Business Health, lalu Progress
  // (Journey/Period), lalu Achievement — urutan ini TIDAK BOLEH dibalik
  // (lihat ACHIEVEMENT-ENGINE-PROPOSAL.md §3: Business Update -> Business
  // Health -> Progress Engine -> Achievement Engine). Kegagalan di sini
  // TIDAK membatalkan penyimpanan update — cukup dicatat di log server.
  let newlyUnlocked: NewlyUnlocked[] = [];
  try {
    const overallScore = await recalculateBusinessHealth(businessProfileId);
    await recalculateProgress(businessProfileId, overallScore);
    const achievementResult = await evaluateAchievements(businessProfileId, "submitBusinessUpdate");
    newlyUnlocked = achievementResult.newlyUnlocked;
  } catch (err) {
    console.error("Business Engine recalculation error:", err);
  }

  // Living Business Loop (Event Pipeline): Business Update adalah EVENT —
  // begitu Business Health/Progress/Achievement selesai dihitung ulang,
  // picu Today Snapshot forceRecompute supaya Stage/Mission/Pulse ikut
  // berubah SAAT ITU JUGA (bukan menunggu snapshot besok). Ini wiring yang
  // sudah diantisipasi sejak catatan di services/today/computeSnapshot.ts —
  // kegagalan di sini TIDAK membatalkan penyimpanan update, cukup dicatat.
  try {
    const { getTodaySnapshot } = await import("../today/computeSnapshot.js");
    await getTodaySnapshot(userId, { businessProfileId, forceRecompute: true });
  } catch (err) {
    console.error("submitBusinessUpdate: forceRecompute Today Snapshot gagal:", err);
  }

  // Business OS Engine: pastikan Monthly Snapshot hari ini sudah tersimpan
  // (persist-only, cache 1x/hari — lihat services/businessOS/monthlySnapshot.ts).
  // Non-fatal, tidak boleh membatalkan penyimpanan Business Update.
  try {
    const { ensureMonthlySnapshot } = await import("../businessOS/monthlySnapshot.js");
    await ensureMonthlySnapshot(businessProfileId);
  } catch (err) {
    console.error("submitBusinessUpdate: ensureMonthlySnapshot gagal:", err);
  }

  return {
    status: 200,
    body: {
      updateId: update.id,
      createdAt: update.created_at,
      newlyUnlocked,
      // Business Update Engine: Beemo "berpikir" langsung saat itu juga,
      // bukan cuma menyimpan — ditampilkan di Workspace segera setelah
      // update tersimpan (lihat BusinessUpdateModal/handleUpdateSaved).
      insight: {
        category: insight.category,
        severity: insight.severity,
        headlineKey: insight.headlineKey,
        headlineParams: insight.headlineParams,
        actionKey: insight.actionKey,
      },
    },
  };
}
