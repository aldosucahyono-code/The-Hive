// services/updateEngine/classify.ts
//
// Business Update Engine (directive "CONTINUE — BUSINESS UPDATE ENGINE"):
// Business Update TIDAK BOLEH hanya disimpan diam-diam seperti laporan —
// begitu pelanggan mengisi update, Beemo harus langsung "berpikir": kategori
// apa, seberapa mendesak, dan apa yang sebaiknya dilakukan.
//
// SENGAJA rule-based (deterministic), BUKAN panggilan AI — konsisten dengan
// prinsip Today Engine ("Opportunity tidak harus AI, bisa dari Business
// Engine") dan larangan directive "Jangan membuat AI menghitung skor/opini".
// Setiap kategori/severity di sini bisa ditelusuri balik ke field yang
// PELANGGAN SENDIRI isi (kondisi_penjualan, omset_value, tantangan) — tidak
// ada yang dikarang.
//
// Kategori SENGAJA memakai 6 dimensi yang SAMA dengan Business Health
// (marketing/sales/finance/customer/operations/brand — lihat
// DIMENSION_OPPORTUNITY_KEY di services/today/computeSnapshot.ts) supaya
// tidak ada taksonomi kedua yang harus dijaga terpisah.

export type UpdateCategory = "sales" | "marketing" | "finance" | "customer" | "operations" | "brand";
export type UpdateSeverity = "low" | "medium" | "high";

export type ClassifyUpdateInput = {
  kondisiPenjualan: "naik" | "tetap" | "turun";
  omsetValue: number | null;
  previousOmsetValue: number | null;
  tantangan: string;
};

export type UpdateInsight = {
  category: UpdateCategory;
  severity: UpdateSeverity;
  // Kunci i18n + params — TIDAK menyimpan kalimat jadi (frozen language),
  // supaya toggle bahasa ID/EN tetap ikut berubah, konsisten dengan pola
  // TodaySnapshotPayload (priorities/topRisk/opportunity).
  headlineKey: string;
  headlineParams: Record<string, string | number>;
  actionKey: string;
  omsetDeltaPct: number | null;
};

const CATEGORY_KEYWORDS: Record<Exclude<UpdateCategory, "sales">, string[]> = {
  finance: ["modal", "biaya", "utang", "pinjaman", "kas", "cash flow", "keuangan"],
  operations: ["supplier", "stok", "karyawan", "produksi", "operasional", "pengiriman", "distribusi"],
  customer: ["pelanggan", "komplain", "keluhan", "ulasan", "review", "retensi"],
  marketing: ["iklan", "promosi", "media sosial", "instagram", "endorse", "marketing", "pemasaran"],
  brand: ["brand", "logo", "reputasi", "nama usaha", "citra"],
};

// Urutan prioritas kalau beberapa kategori sama-sama match (finance dianggap
// paling mendesak ditangani duluan, brand paling tidak mendesak).
const CATEGORY_PRIORITY: Array<Exclude<UpdateCategory, "sales">> = ["finance", "operations", "customer", "marketing", "brand"];

function detectCategory(tantangan: string): UpdateCategory {
  const text = tantangan.toLowerCase();
  const scores = CATEGORY_PRIORITY.map((cat) => ({
    cat,
    score: CATEGORY_KEYWORDS[cat].filter((kw) => text.includes(kw)).length,
  })).filter((s) => s.score > 0);

  if (scores.length === 0) return "sales"; // default — kondisi_penjualan selalu ada di setiap update

  scores.sort((a, b) => b.score - a.score);
  return scores[0].cat;
}

function detectSeverity(kondisiPenjualan: "naik" | "tetap" | "turun", omsetDeltaPct: number | null): UpdateSeverity {
  if (kondisiPenjualan !== "turun") return "low"; // naik/tetap tidak butuh perhatian mendesak
  if (omsetDeltaPct === null) return "medium"; // turun tapi tidak ada angka pembanding — tetap dicatat, tidak diabaikan
  if (omsetDeltaPct <= -30) return "high";
  if (omsetDeltaPct <= -10) return "medium";
  return "low";
}

const ACTION_KEY_BY_CATEGORY: Record<UpdateCategory, string> = {
  sales: "updateActionSales",
  marketing: "updateActionMarketing",
  finance: "updateActionFinance",
  customer: "updateActionCustomer",
  operations: "updateActionOperations",
  brand: "updateActionBrand",
};

export function classifyUpdate(input: ClassifyUpdateInput): UpdateInsight {
  const omsetDeltaPct =
    input.omsetValue != null && input.previousOmsetValue != null && input.previousOmsetValue > 0
      ? Math.round(((input.omsetValue - input.previousOmsetValue) / input.previousOmsetValue) * 1000) / 10
      : null;

  const category = detectCategory(input.tantangan);
  const severity = detectSeverity(input.kondisiPenjualan, omsetDeltaPct);

  const headlineKey =
    omsetDeltaPct !== null
      ? `updateInsightHeadline_${input.kondisiPenjualan}_withDelta`
      : `updateInsightHeadline_${input.kondisiPenjualan}_noDelta`;

  return {
    category,
    severity,
    headlineKey,
    headlineParams: omsetDeltaPct !== null ? { deltaPct: Math.abs(omsetDeltaPct) } : {},
    actionKey: ACTION_KEY_BY_CATEGORY[category],
    omsetDeltaPct,
  };
}
