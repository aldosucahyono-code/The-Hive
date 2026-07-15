// services/costTracking/pricing.ts
//
// SATU-SATUNYA tempat harga resmi Claude/Apify boleh ditulis -- supaya
// biaya yang dicatat ai_usage_log SELALU dari sumber harga yang sama,
// bukan angka kira-kira yang berbeda-beda di tiap file pemanggil.
//
// Sumber: harga resmi Anthropic per Juli 2026 (platform.claude.com/docs/en/about-claude/pricing) --
// Claude Sonnet 5 harga PERKENALAN $2.00/1M token input, $10.00/1M token
// output berlaku sampai 31 Agustus 2026, SETELAH itu naik ke harga Sonnet
// standar $3.00/1M input, $15.00/1M output. INGATKAN PEMILIK PRODUK untuk
// update SONNET_5_PRICING_AFTER_INTRO di bawah setelah tanggal itu supaya
// biaya yang tercatat tetap akurat (bukan diam-diam salah).
//
// Web search tool: $10 per 1.000 pencarian ($0.01/pencarian) di LUAR biaya
// token normal -- hasil pencarian sendiri tetap dihitung sebagai token
// input seperti biasa (sudah otomatis masuk lewat input_tokens).
//
// Apify (apify/instagram-search-scraper): model harga "Pay per event" --
// dikonfirmasi LANGSUNG dari console.apify.com/billing pemilik produk
// (Juli 2026): $0.0027 per event (1 event = 1 hasil/profil ditemukan).

export const WEB_SEARCH_COST_PER_SEARCH_USD = 0.01;

export const APIFY_INSTAGRAM_SEARCH_COST_PER_EVENT_USD = 0.0027;

export type ModelPricing = { inputPerMTokUsd: number; outputPerMTokUsd: number; validUntil?: string };

export const CLAUDE_MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-sonnet-5": {
    inputPerMTokUsd: 2.0,
    outputPerMTokUsd: 10.0,
    // Setelah tanggal ini, harga resmi naik ke $3.00/$15.00 -- lihat
    // catatan di atas. Belum diotomatisasi (butuh cek tanggal berjalan
    // setiap panggilan, overkill untuk kebutuhan sekarang) -- cukup
    // pengingat manual di sini dulu.
    validUntil: "2026-08-31",
  },
};

/** Menghitung biaya USD SUNGGUHAN satu panggilan Claude dari token asli di
 * response.usage -- TIDAK PERNAH menebak/membulatkan ke angka tetap. */
export function calcClaudeCostUsd(model: string, inputTokens: number, outputTokens: number, webSearches = 0): number | null {
  const pricing = CLAUDE_MODEL_PRICING[model];
  if (!pricing) return null; // model tidak dikenal -- jangan mengarang harga
  const tokenCost = (inputTokens / 1_000_000) * pricing.inputPerMTokUsd + (outputTokens / 1_000_000) * pricing.outputPerMTokUsd;
  const searchCost = webSearches * WEB_SEARCH_COST_PER_SEARCH_USD;
  return tokenCost + searchCost;
}

/** Menghitung biaya USD SUNGGUHAN satu panggilan Apify (Instagram Search
 * Scraper, model "pay per event") dari jumlah event/hasil ASLI yang
 * dikembalikan actor -- bukan estimasi flat per panggilan. */
export function calcApifyCostUsd(events: number): number {
  return events * APIFY_INSTAGRAM_SEARCH_COST_PER_EVENT_USD;
}
