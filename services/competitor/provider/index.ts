// services/competitor/provider/index.ts
//
// Factory — SATU-SATUNYA tempat yang memutuskan provider mana yang aktif.
// Workspace/Chat/PDF/Engine tidak pernah mengimpor provider spesifik,
// hanya memanggil getActiveProvider() dari sini. Ganti provider = ubah
// file ini saja.
//
// Urutan keputusan (jujur, tidak diam-diam gagal):
//   1. Kalau GOOGLE_PLACES_API_KEY ada di environment -> pakai Google.
//   2. Kalau tidak -> pakai OpenStreetMap (default aktif hari ini, gratis,
//      tanpa API key, data POI nyata).
//   3. (Juli 2026, laporan pemilik produk: "kompetitor by gmaps tidak
//      keluar") Kalau provider utama GAGAL TOTAL (network error/billing
//      belum aktif/rate limit) ATAU kembali 0 hasil (mis. Google Places
//      ZERO_RESULTS, atau OpenStreetMap tidak punya cakupan di kota kecil)
//      -> coba ClaudeWebSearchProvider (pencarian web sungguhan lewat
//      Claude, sama pola akurasi dengan Lead Referrals). Tetap data NYATA,
//      hanya sumbernya beda dari Google Maps langsung.
//   4. Kalau jalur 3 JUGA gagal/kosong (mis. ANTHROPIC_API_KEY belum ada,
//      atau memang benar-benar tidak ketemu apa-apa) -> MockProvider
//      SEBAGAI FALLBACK TERAKHIR SAJA, dan hasilnya WAJIB ditandai
//      dataSource: "mock" di lapisan Engine supaya tidak pernah tampil
//      sebagai data pasar nyata.

import { GooglePlacesProvider } from "./GooglePlacesProvider.js";
import { OpenStreetMapProvider } from "./OpenStreetMapProvider.js";
import { ClaudeWebSearchProvider } from "./ClaudeWebSearchProvider.js";
import { MockProvider } from "./MockProvider.js";
import type { CompetitorDataProvider } from "./types.js";
import type { ProviderQuery, ProviderResult } from "../types/index.js";

export function getActiveProvider(): CompetitorDataProvider {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    return GooglePlacesProvider;
  }
  return OpenStreetMapProvider;
}

async function tryWebSearchFallback(query: ProviderQuery): Promise<ProviderResult | null> {
  try {
    const result = await ClaudeWebSearchProvider.fetchCompetitors(query);
    return result.places.length > 0 ? result : null;
  } catch (err) {
    console.error("[competitor] fallback claude_web_search gagal:", err);
    return null;
  }
}

export async function fetchCompetitorsWithFallback(query: ProviderQuery): Promise<ProviderResult> {
  const primary = getActiveProvider();
  try {
    const result = await primary.fetchCompetitors(query);
    if (result.places.length > 0) return result;
    // 0 hasil bukan error (mis. ZERO_RESULTS Google, atau cakupan OSM tipis
    // di kota kecil) -- coba pencarian web AI sebagai pelengkap sebelum
    // menyerah, TAPI kalau itu juga kosong, tetap kembalikan hasil ASLI
    // provider utama (0 kompetitor itu sendiri jujur, bukan alasan pindah
    // ke mock).
    const webFallback = await tryWebSearchFallback(query);
    return webFallback ?? result;
  } catch (err) {
    console.error(`[competitor] provider ${primary.source} gagal:`, err);
    const webFallback = await tryWebSearchFallback(query);
    if (webFallback) return webFallback;
    console.error("[competitor] fallback claude_web_search juga gagal/kosong, jatuh ke mock.");
    return MockProvider.fetchCompetitors(query);
  }
}

export type { CompetitorDataProvider } from "./types.js";
