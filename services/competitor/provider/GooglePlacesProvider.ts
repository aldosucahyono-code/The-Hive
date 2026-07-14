// services/competitor/provider/GooglePlacesProvider.ts
//
// Provider masa depan — aktif otomatis begitu GOOGLE_PLACES_API_KEY
// tersedia di environment (lihat provider/index.ts). Sampai saat itu,
// file ini tetap ada sebagai bagian arsitektur (interface sudah
// terpasang) tapi tidak dipanggil. Tidak perlu mengubah apapun di
// Workspace/Chat/PDF ketika provider ini diaktifkan — hanya ganti provider
// aktif di factory.

import type { CompetitorDataProvider } from "./types.js";
import type { ProviderQuery, ProviderResult, RawCompetitorPlace } from "../types/index.js";

const TEXT_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/textsearch/json";

export const GooglePlacesProvider: CompetitorDataProvider = {
  source: "google_places",
  async fetchCompetitors(query: ProviderQuery): Promise<ProviderResult> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY belum dikonfigurasi.");
    }

    const searchText = `${query.industry} di ${query.location}`;
    const url = `${TEXT_SEARCH_URL}?query=${encodeURIComponent(searchText)}&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Places gagal: ${res.status}`);
    const json = (await res.json()) as {
      status: string;
      results: Array<{
        place_id: string;
        name: string;
        formatted_address?: string;
        rating?: number;
        user_ratings_total?: number;
        types?: string[];
        geometry?: { location?: { lat: number; lng: number } };
        price_level?: number;
      }>;
    };

    if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
      throw new Error(`Google Places status: ${json.status}`);
    }

    const businessNameLower = query.businessName.trim().toLowerCase();

    const places: RawCompetitorPlace[] = (json.results || [])
      .filter((r) => r.name.trim().toLowerCase() !== businessNameLower)
      .map((r) => ({
        externalId: r.place_id,
        name: r.name,
        address: r.formatted_address ?? null,
        rating: r.rating ?? null,
        reviewCount: r.user_ratings_total ?? null,
        category: r.types?.[0] ?? null,
        latitude: r.geometry?.location?.lat ?? null,
        longitude: r.geometry?.location?.lng ?? null,
        priceLevel: r.price_level ?? null,
        sourceUrl: null,
        raw: r,
      }));

    return { source: "google_places", places, fetchedAt: new Date().toISOString() };
  },
};
