// services/competitor/normalizer/index.ts
//
// Merapikan ProviderResult (bentuk mentah, beda-beda per provider) jadi
// CompetitorRecord[] yang seragam. Engine di lapisan atas HANYA bicara
// dengan bentuk ini — tidak peduli datanya asalnya dari Google, OSM, atau
// Mock.

import type { ProviderResult, CompetitorRecord } from "../types/index.js";

export function normalizeCompetitors(result: ProviderResult): CompetitorRecord[] {
  return result.places
    .filter((p) => p.name && p.name.trim().length > 0)
    .map((p) => ({
      id: p.externalId,
      name: p.name.trim(),
      address: p.address,
      rating: typeof p.rating === "number" && !Number.isNaN(p.rating) ? p.rating : null,
      reviewCount: typeof p.reviewCount === "number" && !Number.isNaN(p.reviewCount) ? p.reviewCount : null,
      category: p.category,
      priceLevel: typeof p.priceLevel === "number" ? p.priceLevel : null,
      // Kita tidak menghitung jarak presisi (butuh koordinat user yang akurat,
      // yang tidak selalu ada) — daripada mengarang angka jarak, kita jujur
      // hanya menandai "di sekitar lokasi yang sama" secara kualitatif.
      distanceLabel: p.latitude != null && p.longitude != null ? "sekitar lokasi yang sama" : null,
    }))
    // Buang duplikat berdasar nama (beberapa POI provider kadang dobel)
    .filter((c, idx, arr) => arr.findIndex((x) => x.name.toLowerCase() === c.name.toLowerCase()) === idx);
}
