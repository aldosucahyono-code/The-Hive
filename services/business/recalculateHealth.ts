// services/business/recalculateHealth.ts
//
// BUSINESS ENGINE (Tahap 2.2) — Business Health Engine.
//
// PRINSIP KETAT: fungsi ini TIDAK BOLEH memanggil AI, TIDAK BOLEH menebak,
// TIDAK BOLEH random. Input yang sama harus selalu menghasilkan output yang
// sama. Semua reasoning/insight adalah tugas AI Engine di Tahap 3 — fungsi
// ini murni menghitung angka dari data yang sudah ada.
//
// Dipanggil otomatis setiap kali Business Update baru disimpan
// (lihat services/workspace/submitUpdate.ts).
//
// Dimensi (sesuai skema Tahap 1 — health_dimension_enum):
//   marketing, sales, operations, finance, customer, brand
//
// Business Update SAAT INI baru punya sinyal terukur untuk 3 dimensi:
//   - sales      <- kondisi_penjualan (naik/tetap/turun)
//   - finance    <- perubahan omset_value dibanding update sebelumnya
//   - customer   <- pelanggan_baru
// Marketing, Operations, Brand SENGAJA dibiarkan tetap (tidak fabrikasi
// angka tanpa data nyata) sampai ada sumber data untuk dimensi itu.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const DIMENSIONS = ["marketing", "sales", "operations", "finance", "customer", "brand"] as const;
type Dimension = (typeof DIMENSIONS)[number];

const DEFAULT_BASELINE_SCORE = 50;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/** Diekstrak dari recalculateBusinessHealth supaya bisa dipakai ulang oleh
 * nudgeBusinessHealthDimension (dipanggil checklistProgress.ts) — SATU
 * logika "ambil skor terkini per dimensi", bukan disalin ulang. */
async function getCurrentDimensionScores(businessProfileId: string): Promise<Record<Dimension, number>> {
  const { data: latestHealthRows } = await supabase
    .from("business_health")
    .select("dimension, score, evaluated_at")
    .eq("business_profile_id", businessProfileId)
    .order("evaluated_at", { ascending: false });

  const currentScores: Record<Dimension, number> = {
    marketing: DEFAULT_BASELINE_SCORE,
    sales: DEFAULT_BASELINE_SCORE,
    operations: DEFAULT_BASELINE_SCORE,
    finance: DEFAULT_BASELINE_SCORE,
    customer: DEFAULT_BASELINE_SCORE,
    brand: DEFAULT_BASELINE_SCORE,
  };

  const seenDimensions = new Set<string>();
  for (const row of latestHealthRows || []) {
    if (!seenDimensions.has(row.dimension)) {
      currentScores[row.dimension as Dimension] = row.score;
      seenDimensions.add(row.dimension);
    }
  }

  // Belum pernah dihitung sama sekali -> pakai businessHealthScore dari
  // analisa AI pertama (baseline) sebagai titik awal semua dimensi.
  if (seenDimensions.size === 0) {
    const { data: baselineAnalysis } = await supabase
      .from("analyses")
      .select("ai_output")
      .eq("business_profile_id", businessProfileId)
      .eq("is_baseline", true)
      .maybeSingle();

    const aiOutput = baselineAnalysis?.ai_output as { businessHealthScore?: number } | null;
    if (aiOutput?.businessHealthScore) {
      for (const dim of DIMENSIONS) {
        currentScores[dim] = aiOutput.businessHealthScore;
      }
    }
  }

  return currentScores;
}

/** Dipanggil checklistProgress.ts saat item checklist yang terpetakan ke
 * satu dimensi (lihat services/business/checklistDimensionMap.ts) BARU SAJA
 * diselesaikan — supaya marketing/operations/brand (dimensi yang sebelumnya
 * beku selamanya, tidak pernah dapat sinyal apapun) ikut bergerak dari aksi
 * nyata yang dilakukan user, bukan cuma dari Business Update. Hanya naik
 * (tidak turun saat item di-uncheck) supaya tidak bisa "dipompa" dengan
 * centang-hapus berulang, dan tidak menghukum user yang mengubah pikiran. */
export async function nudgeBusinessHealthDimension(businessProfileId: string, dimension: Dimension, delta: number): Promise<number> {
  const currentScores = await getCurrentDimensionScores(businessProfileId);
  const updatedScores: Record<Dimension, number> = {
    ...currentScores,
    [dimension]: clamp(currentScores[dimension] + delta),
  };
  const rowsToInsert = DIMENSIONS.map((dim) => ({
    business_profile_id: businessProfileId,
    dimension: dim,
    score: updatedScores[dim],
  }));
  const { error } = await supabase.from("business_health").insert(rowsToInsert);
  if (error) {
    console.error("services/business/recalculateHealth nudgeBusinessHealthDimension error:", error);
  }
  return Math.round(DIMENSIONS.reduce((sum, dim) => sum + updatedScores[dim], 0) / DIMENSIONS.length);
}

export async function recalculateBusinessHealth(businessProfileId: string): Promise<number> {
  // 1. Ambil skor terakhir per dimensi (kalau belum pernah ada, mulai dari
  //    businessHealthScore hasil analisa AI pertama sebagai titik awal —
  //    itu satu-satunya "input AI" yang dipakai, sebagai TITIK AWAL saja,
  //    bukan dihitung ulang oleh AI setiap saat).
  const currentScores = await getCurrentDimensionScores(businessProfileId);

  // 2. Ambil 2 Business Update terakhir untuk menghitung tren (sekarang vs
  //    sebelumnya).
  const { data: recentUpdates } = await supabase
    .from("business_updates")
    .select("kondisi_penjualan, omset_value, pelanggan_baru, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(2);

  const latest = recentUpdates?.[0];
  const previous = recentUpdates?.[1];

  if (!latest) {
    // Tidak ada data Business Update -> tidak ada yang dihitung ulang,
    // kembalikan rata-rata skor yang sudah ada (baseline) apa adanya.
    return Math.round(DIMENSIONS.reduce((sum, dim) => sum + currentScores[dim], 0) / DIMENSIONS.length);
  }

  // 3. Dimensi Sales <- kondisi_penjualan
  let salesDelta = 0;
  if (latest.kondisi_penjualan === "naik") salesDelta = 5;
  else if (latest.kondisi_penjualan === "turun") salesDelta = -5;

  // 4. Dimensi Finance <- perubahan omset_value (kalau ada data pembanding),
  //    fallback ke kondisi_penjualan kalau omset tidak diisi.
  let financeDelta = 0;
  if (latest.omset_value != null && previous?.omset_value != null) {
    if (latest.omset_value > previous.omset_value) financeDelta = 5;
    else if (latest.omset_value < previous.omset_value) financeDelta = -5;
  } else {
    financeDelta = salesDelta > 0 ? 3 : salesDelta < 0 ? -3 : 0;
  }

  // 5. Dimensi Customer <- pelanggan_baru
  let customerDelta = 0;
  if (latest.pelanggan_baru != null) {
    customerDelta = latest.pelanggan_baru > 0 ? 3 : -1;
  }

  const updatedScores: Record<Dimension, number> = {
    ...currentScores,
    sales: clamp(currentScores.sales + salesDelta),
    finance: clamp(currentScores.finance + financeDelta),
    customer: clamp(currentScores.customer + customerDelta),
  };

  // 6. Simpan baris BARU per dimensi (histori tetap tersimpan, bukan
  //    ditimpa) supaya Progress Engine (2.3) nanti bisa membaca perjalanan
  //    perubahan Business Health dari waktu ke waktu.
  const rowsToInsert = DIMENSIONS.map((dim) => ({
    business_profile_id: businessProfileId,
    dimension: dim,
    score: updatedScores[dim],
  }));

  await supabase.from("business_health").insert(rowsToInsert);

  const overall = Math.round(
    DIMENSIONS.reduce((sum, dim) => sum + updatedScores[dim], 0) / DIMENSIONS.length
  );
  return overall;
}
