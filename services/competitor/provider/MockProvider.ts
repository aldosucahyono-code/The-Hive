// services/competitor/provider/MockProvider.ts
//
// Fallback TERAKHIR — hanya dipakai kalau OpenStreetMap gagal total
// (misalnya kena rate limit atau jaringan bermasalah) DAN Google Places
// belum dikonfigurasi. Data di sini adalah CONTOH, bukan data pasar
// nyata — dataSource dikembalikan sebagai "mock" supaya lapisan di
// atasnya (Competitor Engine, Workspace, Chat, PDF) WAJIB menampilkan
// label jujur ("Contoh/Simulasi") dan tidak pernah menyajikannya sebagai
// data pasar sungguhan (data honesty).

import type { CompetitorDataProvider } from "./types.js";
import type { ProviderQuery, ProviderResult, RawCompetitorPlace } from "../types/index.js";

function buildMockPlaces(query: ProviderQuery): RawCompetitorPlace[] {
  const base = query.industry || "Usaha";
  return [
    {
      externalId: "mock-1",
      name: `${base} Sejahtera`,
      address: null,
      rating: 4.2,
      reviewCount: 58,
      category: query.industry || null,
      latitude: null,
      longitude: null,
      priceLevel: null,
      raw: { mock: true },
    },
    {
      externalId: "mock-2",
      name: `${base} Makmur Jaya`,
      address: null,
      rating: 3.6,
      reviewCount: 21,
      category: query.industry || null,
      latitude: null,
      longitude: null,
      priceLevel: null,
      raw: { mock: true },
    },
    {
      externalId: "mock-3",
      name: `${base} Berkah`,
      address: null,
      rating: 4.5,
      reviewCount: 103,
      category: query.industry || null,
      latitude: null,
      longitude: null,
      priceLevel: null,
      raw: { mock: true },
    },
  ];
}

export const MockProvider: CompetitorDataProvider = {
  source: "mock",
  async fetchCompetitors(query: ProviderQuery): Promise<ProviderResult> {
    return {
      source: "mock",
      places: buildMockPlaces(query),
      fetchedAt: new Date().toISOString(),
    };
  },
};
