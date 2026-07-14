// services/competitor/provider/OpenStreetMapProvider.ts
//
// Provider data REAL default (aktif) — dipilih karena TIDAK butuh API key
// atau billing, sehingga Competitor Engine bisa berjalan dengan data
// sungguhan HARI INI tanpa menunggu kredensial Google (arahan directive:
// "Jangan menunggu. Bangun seluruh arsitektur terlebih dahulu.").
//
// Alur:
//   1. Nominatim (geocoding) — ubah teks lokasi bebas (raw_input.lokasi)
//      jadi koordinat lat/lon.
//   2. Overpass API — cari POI (point of interest) di sekitar koordinat
//      itu yang match kategori/industri bisnis pengguna.
//
// Catatan jujur: Nominatim/Overpass tidak punya data rating/review
// (beda dengan Google Places) — field rating/reviewCount akan null.
// Ini BUKAN kekurangan yang disembunyikan; Normalizer & Engine di
// lapisan atas harus menangani null ini secara jujur (tidak mengarang
// angka), dan UI harus menampilkan apa adanya kalau data itu tidak ada.

import type { CompetitorDataProvider } from "./types.js";
import type { ProviderQuery, ProviderResult, RawCompetitorPlace } from "../types/index.js";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "TheHiveApp/1.0 (business analysis feature; contact: support@thehive.id)";

// Peta kata kunci industri (Bahasa Indonesia, dari Business Discovery)
// -> tag OSM yang relevan. Daftar terbatas dan jujur — kalau industri
// tidak dikenali, kita jatuh ke pencarian generik "shop" di sekitar lokasi
// daripada mengarang kategori.
const INDUSTRY_TAG_MAP: Record<string, string[]> = {
  kuliner: ["amenity=restaurant", "amenity=cafe", "amenity=fast_food"],
  makanan: ["amenity=restaurant", "amenity=cafe", "amenity=fast_food"],
  restoran: ["amenity=restaurant"],
  kafe: ["amenity=cafe"],
  retail: ["shop=convenience", "shop=supermarket", "shop=clothes"],
  fashion: ["shop=clothes", "shop=boutique"],
  kecantikan: ["shop=beauty", "shop=hairdresser"],
  laundry: ["shop=laundry"],
  otomotif: ["shop=car_repair", "shop=car"],
  bengkel: ["shop=car_repair"],
  kesehatan: ["amenity=pharmacy", "amenity=clinic"],
  pendidikan: ["amenity=school", "office=educational_institution"],
};

function resolveTags(industry: string): string[] {
  const key = industry.trim().toLowerCase();
  for (const [k, tags] of Object.entries(INDUSTRY_TAG_MAP)) {
    if (key.includes(k)) return tags;
  }
  return ["shop"]; // fallback generik — bukan dikarang, hanya pencarian luas "toko/usaha" di sekitar lokasi
}

async function geocodeLocation(location: string): Promise<{ lat: number; lon: number } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(location)}&format=json&limit=1&countrycodes=id`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim gagal: ${res.status}`);
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function searchNearbyPlaces(
  lat: number,
  lon: number,
  tags: string[],
  radiusMeters = 1500
): Promise<RawCompetitorPlace[]> {
  const tagFilters = tags
    .map((tag) => {
      const [key, value] = tag.split("=");
      return `node["${key}"="${value}"](around:${radiusMeters},${lat},${lon});`;
    })
    .join("\n");

  const query = `[out:json][timeout:20];(${tagFilters});out body 40;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) throw new Error(`Overpass gagal: ${res.status}`);
  const json = (await res.json()) as { elements: Array<Record<string, any>> };

  return (json.elements || [])
    .filter((el) => el.tags?.name)
    .map((el) => ({
      externalId: `osm-${el.type}-${el.id}`,
      name: el.tags.name as string,
      address:
        [el.tags["addr:street"], el.tags["addr:housenumber"], el.tags["addr:city"]]
          .filter(Boolean)
          .join(" ") || null,
      rating: null, // OSM tidak menyediakan rating — jujur ditinggalkan null
      reviewCount: null,
      category: el.tags.amenity || el.tags.shop || null,
      latitude: el.lat ?? null,
      longitude: el.lon ?? null,
      priceLevel: null,
      sourceUrl: null,
      raw: el,
    }));
}

export const OpenStreetMapProvider: CompetitorDataProvider = {
  source: "openstreetmap",
  async fetchCompetitors(query: ProviderQuery): Promise<ProviderResult> {
    const coords = await geocodeLocation(query.location);
    if (!coords) {
      // Lokasi tidak bisa di-geocode — jangan mengarang, kembalikan kosong
      // (caller/factory yang memutuskan apakah fallback ke provider lain).
      return { source: "openstreetmap", places: [], fetchedAt: new Date().toISOString() };
    }

    const tags = resolveTags(query.industry || "");
    const places = await searchNearbyPlaces(coords.lat, coords.lon, tags);

    const businessNameLower = query.businessName.trim().toLowerCase();
    const filtered = places.filter((p) => p.name.trim().toLowerCase() !== businessNameLower);

    return { source: "openstreetmap", places: filtered, fetchedAt: new Date().toISOString() };
  },
};
