// services/exchangeRate/getUsdIdrRate.ts
//
// Kurs USD/IDR SUNGGUHAN untuk kebutuhan super-admin (Biaya & Kuota) --
// permintaan pemilik produk eksplisit: "termasuk nilai kurs juga, saya
// ingin memantau di superadmin". Sumber dan pendekatan SAMA dengan
// services/macro/getMacroSnapshot.ts (open.er-api.com, tanpa API key) --
// BUKAN modul baru yang independen soal sumber datanya, hanya beda cara
// cache: di sini di-persist ke tabel exchange_rate_cache (bukan cache
// in-memory modul) supaya konsisten LINTAS serverless invocation (Vercel
// bisa spin instance baru kapan saja, cache in-memory getMacroSnapshot.ts
// reset tiap kali itu terjadi -- untuk kebutuhan admin yang dipanggil
// jarang, cache di database lebih murah/konsisten daripada modul terpisah
// yang masing-masing punya cache in-memory sendiri-sendiri).
//
// TTL 1 jam -- sama seperti getMacroSnapshot.ts, kurs tidak perlu live-live
// untuk kebutuhan estimasi biaya admin.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const CACHE_ID = "usd_idr";
const TTL_MS = 60 * 60 * 1000; // 1 jam

// Fallback jujur kalau live API DAN cache database sama-sama tidak
// tersedia (mis. baris cache belum pernah terisi sama sekali) -- angka
// terakhir yang diketahui manual, BUKAN dikarang, sama filosofinya dengan
// EXCHANGE_RATE_FALLBACK di getMacroSnapshot.ts.
const STATIC_FALLBACK_RATE = 16300;

export type UsdIdrRate = {
  rate: number;
  source: "live_api" | "cache_db" | "static";
  fetchedAt: string;
};

async function fetchLiveRate(): Promise<number | null> {
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
    return idrRate;
  } catch (err) {
    console.error("[exchangeRate] gagal ambil kurs live:", err);
    return null;
  }
}

/** Entry point dipanggil dari getCostDashboard.ts (super-admin) untuk
 * konversi USD -> Rupiah. Cache-first (baca tabel exchange_rate_cache),
 * fetch live + upsert kalau kadaluarsa, fallback ke baris cache lama (kalau
 * ada) atau STATIC_FALLBACK_RATE (kalau baris belum pernah ada sama
 * sekali) supaya dashboard TIDAK PERNAH gagal total hanya karena API kurs
 * eksternal sedang down. */
export async function getUsdIdrRate(): Promise<UsdIdrRate> {
  const { data: cached } = await supabase.from("exchange_rate_cache").select("rate, fetched_at").eq("id", CACHE_ID).maybeSingle();

  const cachedFresh = cached && Date.now() - new Date(cached.fetched_at).getTime() < TTL_MS;
  if (cachedFresh) {
    return { rate: Number(cached.rate), source: "cache_db", fetchedAt: cached.fetched_at };
  }

  const liveRate = await fetchLiveRate();
  if (liveRate != null) {
    const fetchedAt = new Date().toISOString();
    const { error } = await supabase.from("exchange_rate_cache").upsert({ id: CACHE_ID, rate: liveRate, fetched_at: fetchedAt });
    if (error) console.error("[exchangeRate] gagal simpan cache kurs:", error);
    return { rate: liveRate, source: "live_api", fetchedAt };
  }

  // Live gagal -- pakai cache lama walau sudah lewat TTL (lebih baik dari
  // static kalau memang pernah berhasil sebelumnya), atau static kalau
  // baris cache memang belum pernah ada.
  if (cached) {
    return { rate: Number(cached.rate), source: "cache_db", fetchedAt: cached.fetched_at };
  }
  return { rate: STATIC_FALLBACK_RATE, source: "static", fetchedAt: new Date().toISOString() };
}
