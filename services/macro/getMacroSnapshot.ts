// services/macro/getMacroSnapshot.ts
//
// Task 14c (Juli 2026): Halaman Ekonomi Makro — indikator makroekonomi
// Indonesia yang relevan buat pemilik UMKM (bukan analis makro): kurs
// Rupiah, inflasi tahunan, suku bunga acuan Bank Indonesia.
//
// Sumber data — DUA jalur, jujur ditandai per indikator (field `source`):
//   - Kurs USD/IDR: LIVE dari API publik tanpa API key (open.er-api.com,
//     data dari Bank Indonesia/central bank feed), karena berubah tiap hari
//     dan ada sumber gratis yang bisa dipanggil langsung — sama filosofi
//     dengan OpenStreetMapProvider di services/competitor/ (data nyata,
//     gratis, tanpa menunggu API key).
//   - Inflasi tahunan & suku bunga acuan BI: BPS/BI tidak punya API publik
//     gratis tanpa registrasi kunci, jadi untuk sekarang pakai angka
//     terkurasi manual (STATIC_INDICATORS di bawah) dengan tanggal "per
//     tanggal" yang jujur ditampilkan — BUKAN data karangan, diambil dari
//     rilis resmi BPS/BI terakhir. WAJIB diperbarui berkala (lihat komentar
//     di STATIC_INDICATORS). Kalau nanti BPS_API_KEY/BI API tersedia,
//     tinggal tambah provider baru di sini tanpa ubah bentuk MacroSnapshot.
//
// TIDAK butuh tabel database baru — dicache di memory modul (TTL 1 jam)
// karena datanya SAMA untuk semua pengguna (bukan per-bisnis), jadi tidak
// perlu cache per-bisnis seperti Competitor Engine.

import type { ServiceResult } from "../business/create.js";

export type MacroIndicatorSource = "live_api" | "static";

export type MacroIndicator = {
  key: "usd_idr" | "inflation_yoy" | "bi_rate";
  labelId: string;
  labelEn: string;
  valueDisplay: string; // sudah diformat, siap tampil ("Rp16.250", "3,34%", "5,75%")
  rawValue: number;
  source: MacroIndicatorSource;
  asOf: string; // ISO date — "data per tanggal ini"
};

export type MacroSnapshot = {
  indicators: MacroIndicator[];
  insights: Array<{ id: string; headline: string }>;
  fetchedAt: string;
};

// =============================================================================
// Data terkurasi manual — DIPERBARUI TERAKHIR: Juli 2026, dari rilis resmi
// BPS (inflasi, https://www.bps.go.id) dan Bank Indonesia (suku bunga acuan,
// https://www.bi.go.id/id/statistik/indikator/bi-7day-rr.aspx). Kalau lewat
// dari ~2 bulan sejak asOf, anggap kadaluarsa dan perbarui manual dari
// sumber resmi di atas sebelum dipakai lagi untuk klaim spesifik ke
// pengguna.
// =============================================================================
const STATIC_INDICATORS: Array<Omit<MacroIndicator, "valueDisplay"> & { valueDisplay?: string }> = [
  {
    key: "inflation_yoy",
    labelId: "Inflasi Tahunan (y-on-y)",
    labelEn: "Annual Inflation (y-on-y)",
    rawValue: 3.34,
    source: "static",
    asOf: "2026-06-30",
  },
  {
    key: "bi_rate",
    labelId: "Suku Bunga Acuan BI (7-Day Reverse Repo Rate)",
    labelEn: "BI Policy Rate (7-Day Reverse Repo Rate)",
    rawValue: 5.75,
    source: "static",
    asOf: "2026-06-18",
  },
];

const EXCHANGE_RATE_TTL_MS = 60 * 60 * 1000; // 1 jam
let cachedExchangeRate: { indicator: MacroIndicator; fetchedAtMs: number } | null = null;

/** Fallback jujur kalau live API gagal (network/rate-limit) — bukan
 * dikarang, angka terakhir yang diketahui per tanggal di atas, ditandai
 * source "static" supaya UI tetap jujur menampilkan bukan data live. */
const EXCHANGE_RATE_FALLBACK: MacroIndicator = {
  key: "usd_idr",
  labelId: "Kurs USD/IDR",
  labelEn: "USD/IDR Exchange Rate",
  valueDisplay: "Rp16.300 / USD",
  rawValue: 16300,
  source: "static",
  asOf: "2026-07-01",
};

async function fetchLiveExchangeRate(): Promise<MacroIndicator> {
  const now = Date.now();
  if (cachedExchangeRate && now - cachedExchangeRate.fetchedAtMs < EXCHANGE_RATE_TTL_MS) {
    return cachedExchangeRate.indicator;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`exchange rate API gagal: ${res.status}`);
    const json = (await res.json()) as { result: string; rates?: Record<string, number> };
    const idrRate = json.rates?.IDR;
    if (json.result !== "success" || typeof idrRate !== "number" || !Number.isFinite(idrRate)) {
      throw new Error("respons exchange rate API tidak valid");
    }

    const indicator: MacroIndicator = {
      key: "usd_idr",
      labelId: "Kurs USD/IDR",
      labelEn: "USD/IDR Exchange Rate",
      valueDisplay: `Rp${Math.round(idrRate).toLocaleString("id-ID")} / USD`,
      rawValue: idrRate,
      source: "live_api",
      asOf: new Date().toISOString().slice(0, 10),
    };
    cachedExchangeRate = { indicator, fetchedAtMs: now };
    return indicator;
  } catch (err) {
    console.error("[macro] gagal ambil kurs live, pakai fallback statis:", err);
    return EXCHANGE_RATE_FALLBACK;
  }
}

function formatStaticIndicator(ind: (typeof STATIC_INDICATORS)[number]): MacroIndicator {
  return { ...ind, valueDisplay: `${ind.rawValue.toLocaleString("id-ID")}%` };
}

function buildInsights(indicators: MacroIndicator[], lang: "id" | "en"): Array<{ id: string; headline: string }> {
  const id = lang === "id";
  const insights: Array<{ id: string; headline: string }> = [];

  const inflation = indicators.find((i) => i.key === "inflation_yoy");
  if (inflation) {
    insights.push({
      id: "macro-inflation",
      headline: id
        ? `Inflasi tahunan saat ini ${inflation.valueDisplay} (per ${inflation.asOf}). Kalau harga jualmu belum disesuaikan dalam beberapa bulan terakhir, marginmu bisa tergerus tanpa disadari.`
        : `Annual inflation is currently ${inflation.valueDisplay} (as of ${inflation.asOf}). If your selling prices haven't been adjusted in the last few months, your margin may be quietly eroding.`,
    });
  }

  const biRate = indicators.find((i) => i.key === "bi_rate");
  if (biRate) {
    insights.push({
      id: "macro-bi-rate",
      headline: id
        ? `Suku bunga acuan BI ${biRate.valueDisplay} (per ${biRate.asOf}). Kalau kamu punya atau berencana ambil pinjaman usaha, ini jadi acuan kasar suku bunga kredit yang akan kamu hadapi.`
        : `BI's policy rate is ${biRate.valueDisplay} (as of ${biRate.asOf}). If you have or plan to take a business loan, this is a rough reference for the credit interest rate you'll face.`,
    });
  }

  const usdIdr = indicators.find((i) => i.key === "usd_idr");
  if (usdIdr) {
    insights.push({
      id: "macro-usd-idr",
      headline: id
        ? `Kurs saat ini ${usdIdr.valueDisplay} (per ${usdIdr.asOf}). Relevan kalau bahan baku/produkmu ada yang diimpor atau harganya mengikuti dolar — kurs naik berarti biayamu ikut naik.`
        : `Current exchange rate is ${usdIdr.valueDisplay} (as of ${usdIdr.asOf}). Relevant if any of your raw materials or products are imported or dollar-linked — a higher rate means higher costs for you.`,
    });
  }

  return insights;
}

/** Entry point dipanggil dari api/workspace.ts action "getMacroSnapshot".
 * Tidak tier-gated — ini konteks ekonomi umum (bukan analisis pribadi
 * bisnis pengguna), jadi tersedia untuk semua tier termasuk Gratis. Tetap
 * butuh login (konsisten dengan seluruh action lain di router workspace)
 * tapi tidak perlu ownership check business_profile karena datanya sama
 * untuk semua orang. */
export async function getMacroSnapshot(_userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

  const exchangeRate = await fetchLiveExchangeRate();
  const indicators: MacroIndicator[] = [exchangeRate, ...STATIC_INDICATORS.map(formatStaticIndicator)];

  const snapshot: MacroSnapshot = {
    indicators,
    insights: buildInsights(indicators, lang),
    fetchedAt: new Date().toISOString(),
  };

  return { status: 200, body: { macro: snapshot } };
}
