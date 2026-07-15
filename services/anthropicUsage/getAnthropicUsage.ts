// services/anthropicUsage/getAnthropicUsage.ts
//
// Integrasi API RESMI Anthropic (Usage & Cost Admin API) -- permintaan
// pemilik produk (Juli 2026): "tambah data dan saldo [Claude], jadi
// keliatan mana yang tinggal sedikit" di halaman super-admin, tab
// "Biaya & Kuota". Pola SAMA PERSIS dengan services/vercelUsage/getVercelUsage.ts
// dan services/supabaseUsage/getSupabaseUsage.ts: fail-soft, HANYA data
// SUNGGUHAN dari API resmi, tidak pernah mengarang angka.
//
// PENTING -- keterbatasan JUJUR yang harus dipahami sebelum pakai fitur ini:
// Anthropic TIDAK punya API publik untuk "saldo kredit tersisa" (yang
// terlihat di platform.claude.com/settings/billing, mis. "Saldo kredit:
// US$19,69"). Endpoint semacam itu belum ada (dicek Juli 2026 -- ini bahkan
// masih jadi permintaan fitur terbuka di GitHub Anthropic). Yang TERSEDIA
// resmi hanyalah Cost Report API (/v1/organizations/cost_report) yang
// melaporkan BIAYA SUNGGUHAN yang sudah terpakai per hari -- bukan sisa
// saldo.
//
// Jadi "tinggal berapa" di sini dihitung TIDAK LANGSUNG: biaya bulan-berjalan
// SUNGGUHAN (dari Cost Report API) dibandingkan terhadap batas bulanan yang
// pemilik produk SENDIRI catat manual di env var ANTHROPIC_MONTHLY_BUDGET_USD
// (harus disamakan manual dengan "Batas pengeluaran bulanan" yang diset di
// platform.claude.com/settings/billing -- sama seperti FREE_TIER_LIMITS di
// getSupabaseUsage.ts yang juga dicatat manual karena tidak ada endpoint
// kuota resmi). Kalau env var ini belum diset, dashboard TETAP menampilkan
// biaya sungguhan tapi TANPA persentase "tinggal berapa" -- tidak pernah
// mengarang batasnya.
//
// Env var yang perlu diset SENDIRI oleh pemilik produk di Vercel Environment
// Variables (kredensial sensitif, tidak dibuat otomatis dari sini):
// - ANTHROPIC_ADMIN_API_KEY (WAJIB): Admin API key (format sk-ant-admin01-...),
//   BEDA dari API key biasa yang sudah dipakai untuk panggilan Claude di
//   seluruh app ini -- dibuat di platform.claude.com > Settings > Admin API
//   Keys (butuh role Admin/Primary Owner di organisasi).
// - ANTHROPIC_MONTHLY_BUDGET_USD (OPSIONAL): angka USD, harus sama dengan
//   "Batas pengeluaran bulanan" yang sudah diset pemilik produk di halaman
//   Billing Claude Console.

const API_BASE = "https://api.anthropic.com";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_PAGES = 5; // 1 hari/bucket, cukup untuk 31 hari dalam beberapa halaman pagination

export type AnthropicUsageResult =
  | {
      available: true;
      periodCostUsd: number;
      periodStart: string;
      periodEnd: string;
      monthToDateCostUsd: number;
      monthlyBudgetUsd: number | null;
      fetchedAt: string;
    }
  | { available: false; reason: string };

type CostReportItem = { amount: string; currency: string };
type CostReportBucket = { starting_at: string; ending_at: string; results: CostReportItem[] };
type CostReportResponse = { data: CostReportBucket[]; has_more: boolean; next_page: string | null };

async function fetchCostTotalUsd(apiKey: string, startingAt: Date, endingAt: Date): Promise<number> {
  let total = 0;
  let page: string | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({
      starting_at: startingAt.toISOString(),
      ending_at: endingAt.toISOString(),
    });
    if (page) params.set("page", page);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/v1/organizations/cost_report?${params.toString()}`, {
        headers: {
          "anthropic-version": ANTHROPIC_VERSION,
          "x-api-key": apiKey,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic Cost Report API mengembalikan status ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as CostReportResponse;
    for (const bucket of json.data || []) {
      for (const item of bucket.results || []) {
        // amount = string desimal dalam UNIT TERKECIL mata uang (sen), lihat
        // dokumentasi resmi: "123.45" + "USD" == $1.23 -- jadi dibagi 100.
        const cents = parseFloat(item.amount);
        if (!Number.isNaN(cents)) total += cents / 100;
      }
    }

    if (!json.has_more || !json.next_page) break;
    page = json.next_page;
  }
  return total;
}

/** Entry point dipanggil getCostDashboard.ts (super-admin). */
export async function getAnthropicUsage(periodDays = 30): Promise<AnthropicUsageResult> {
  const apiKey = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!apiKey) {
    return {
      available: false,
      reason: "ANTHROPIC_ADMIN_API_KEY belum diset di Vercel Environment Variables (beda dari API key Claude yang biasa dipakai -- buat di platform.claude.com > Settings > Admin API Keys).",
    };
  }

  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const budgetRaw = process.env.ANTHROPIC_MONTHLY_BUDGET_USD;
  const monthlyBudgetUsd = budgetRaw && !Number.isNaN(Number(budgetRaw)) ? Number(budgetRaw) : null;

  try {
    const [periodCostUsd, monthToDateCostUsd] = await Promise.all([
      fetchCostTotalUsd(apiKey, periodStart, now),
      // Kalau periode yang diminta kebetulan sudah dari awal bulan ini, tidak
      // perlu panggilan kedua -- tapi kasus itu jarang (periodDays biasanya
      // 30/7/dst, bukan selalu pas tanggal 1), jadi selalu hitung terpisah
      // supaya "tinggal berapa" SELALU cocok dengan siklus bulanan Anthropic
      // (reset tiap tanggal 1), bukan rolling N hari.
      fetchCostTotalUsd(apiKey, monthStart, now),
    ]);

    return {
      available: true,
      periodCostUsd,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      monthToDateCostUsd,
      monthlyBudgetUsd,
      fetchedAt: now.toISOString(),
    };
  } catch (err) {
    console.error("[anthropicUsage] exception:", err);
    return {
      available: false,
      reason: err instanceof Error ? err.message : "Gagal menghubungi Anthropic Cost Report API (jaringan/timeout).",
    };
  }
}
