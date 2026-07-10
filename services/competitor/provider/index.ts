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
//   3. Kalau provider utama gagal total (network error / rate limit),
//      fetchCompetitorsWithFallback() jatuh ke MockProvider SEBAGAI
//      FALLBACK TERAKHIR SAJA, dan hasilnya WAJIB ditandai dataSource:
//      "mock" di lapisan Engine supaya tidak pernah tampil sebagai data
//      pasar nyata.

import { GooglePlacesProvider } from "./GooglePlacesProvider.js";
import { OpenStreetMapProvider } from "./OpenStreetMapProvider.js";
import { MockProvider } from "./MockProvider.js";
import type { CompetitorDataProvider } from "./types.js";
import type { ProviderQuery, ProviderResult } from "../types/index.js";

export function getActiveProvider(): CompetitorDataProvider {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    return GooglePlacesProvider;
  }
  return OpenStreetMapProvider;
}

export async function fetchCompetitorsWithFallback(query: ProviderQuery): Promise<ProviderResult> {
  const primary = getActiveProvider();
  try {
    const result = await primary.fetchCompetitors(query);
    return result;
  } catch (err) {
    console.error(`[competitor] provider ${primary.source} gagal, fallback ke mock:`, err);
    return MockProvider.fetchCompetitors(query);
  }
}

export type { CompetitorDataProvider } from "./types.js";
