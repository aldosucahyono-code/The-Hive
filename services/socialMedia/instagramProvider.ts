// services/socialMedia/instagramProvider.ts
//
// Orkestrasi pencarian akun Instagram kompetitor + pengambilan follower
// count via Apify — DIBATASI KETAT sesuai instruksi pemilik produk (dikutip
// lengkap di services/socialMedia/summaryGenerator.ts):
// 1. HANYA Instagram di v1 (TikTok/Facebook tetap mock — lihat
//    getSocialMediaAnalysis.ts).
// 2. HANYA username + followers yang diambil/ditampilkan/disimpan — TIDAK
//    postsPerMonth, TIDAK engagementRatePct, TIDAK bio/foto/post individual.
//    Makin sedikit yang diambil, makin kecil jejak risiko ToS-nya.
// 3. Dibatasi TOP 3 kompetitor per request (biaya Apify + waktu Vercel
//    maxDuration 60 detik untuk SELURUH request api/workspace.ts, bukan
//    cuma bagian ini) — lihat SOCIAL_LIVE_BUDGET_MS di getSocialMediaAnalysis.ts.
//
// PENCARIAN username (jalur 1, "by name"): query dibangun dari {nama
// kompetitor} + {industri bisnis pengguna} + {produk/jasa pengguna} +
// {lokasi} — bukan cuma nama kompetitor mentah, supaya hasil pencarian
// lebih presisi untuk nama umum (mis. "Warung Makmur" saja terlalu
// generik; ditambah "kuliner nasi goreng Jakarta Selatan" jauh lebih
// presisi). Field produkJasa memang ditambahkan ke wizard KHUSUS untuk
// kebutuhan ini (lihat src/components/ChatWizard.tsx, WizardData.produkJasa).
//
// PENCARIAN kategori+lokasi (jalur 2, "by category" — instruksi PO Juli
// 2026): dipakai sebagai FALLBACK saat Competitor Engine (OpenStreetMap/
// Google Places) tidak menemukan kompetitor bernama sama sekali (umum
// terjadi di kota kecil yang cakupan datanya tipis, mis. Probolinggo).
// Alih-alih menyerah ke mock, cari LANGSUNG di Apify pakai {kategori/jenis
// usaha} + {lokasi} sebagai satu query umum (mis. "Salon Day and Day Spa
// Probolinggo") dan ambil beberapa akun sekaligus dari SATU pencarian —
// sama seperti cara pemilik produk mendeskripsikannya: "jenis usaha salon
// and day spa, cari salon dan spa di Apify".

import { runApifyActor } from "./apifyClient.js";
import type { SocialMediaLiveRecord } from "./types.js";

const SEARCH_ACTOR_ID = process.env.APIFY_INSTAGRAM_SEARCH_ACTOR_ID || "apify/instagram-search-scraper";
const PROFILE_ACTOR_ID = process.env.APIFY_INSTAGRAM_PROFILE_ACTOR_ID || "apify/instagram-profile-scraper";

const MAX_COMPETITORS = 3;
// Audit Juli 2026 (laporan pemilik produk: "dari medsos juga tidak keluar"):
// SEBELUMNYA 8000ms -- terlalu pendek untuk run-sync-get-dataset-items pada
// actor pihak ketiga (cold start container + scraping sungguhan biasanya
// 10-30 detik), jadi AbortController hampir selalu memutus panggilan
// SEBELUM actor selesai -> selalu jatuh ke data contoh walau
// APIFY_API_TOKEN valid dan actor berjalan normal. maxDuration
// api/workspace.ts sebenarnya 180 detik (lihat vercel.json), jauh lebih
// longgar dari catatan lama "60 detik" di file ini -- 20 detik per
// panggilan masih realistis dan sisa waktu tetap banyak untuk request lain.
const SEARCH_TIMEOUT_MS = 20000;
const PROFILE_TIMEOUT_MS = 20000;

export type BusinessSearchContext = {
  industry: string;
  produkJasa: string;
  location: string;
};

type InstagramSearchItem = {
  username?: string;
  ownerUsername?: string;
  fullName?: string;
  url?: string;
};

type InstagramProfileItem = {
  username?: string;
  followersCount?: number;
  followersCount_normalized?: number;
};

function buildSearchQuery(competitorName: string, context: BusinessSearchContext): string {
  return [competitorName, context.industry, context.produkJasa, context.location].filter(Boolean).join(" ").trim();
}

/** Query jalur 2 (by category): {industri/jenis usaha} + {lokasi} saja —
 * TANPA nama kompetitor (karena memang belum ada nama yang ditemukan).
 * Sengaja tidak menyertakan produkJasa di sini supaya query tetap umum
 * ("Salon Day and Day Spa Probolinggo", bukan "Salon Day and Day Spa
 * facial treatment creambath Probolinggo") — searchType "user" di Apify
 * mencari AKUN, bukan post/hashtag, jadi query yang terlalu spesifik
 * malah mengurangi kemungkinan ketemu akun bisnis sejenis di sekitar. */
function buildCategoryQuery(context: BusinessSearchContext): string {
  return [context.industry, context.location].filter(Boolean).join(" ").trim();
}

/** Cari BEBERAPA akun Instagram sekaligus lewat SATU query kategori+lokasi
 * (bukan satu query per nama kompetitor seperti searchInstagramUsername).
 * Dipakai sebagai fallback saat Competitor Engine tidak menemukan nama
 * kompetitor sama sekali — lihat komentar jalur 2 di atas. */
async function searchInstagramByCategory(
  context: BusinessSearchContext,
  token: string,
  limit: number
): Promise<Array<{ username: string; label: string }>> {
  const query = buildCategoryQuery(context);
  if (!query) return [];

  try {
    const items = await runApifyActor<InstagramSearchItem>({
      actorId: SEARCH_ACTOR_ID,
      token,
      timeoutMs: SEARCH_TIMEOUT_MS,
      input: { search: query, searchType: "user", searchLimit: limit },
    });

    const seen = new Set<string>();
    const results: Array<{ username: string; label: string }> = [];
    for (const item of items) {
      const username = (item.username || item.ownerUsername || "").replace(/^@/, "");
      if (!username || seen.has(username)) continue;
      seen.add(username);
      results.push({ username, label: item.fullName || username });
      if (results.length >= limit) break;
    }
    return results;
  } catch (err) {
    console.error(`[socialMedia] pencarian kategori+lokasi gagal untuk "${query}":`, err);
    return [];
  }
}

/** Cari SATU username Instagram paling mungkin untuk satu kompetitor.
 * Mengembalikan null (bukan melempar) kalau tidak ketemu/actor gagal —
 * caller tetap lanjut ke kompetitor berikutnya; satu kegagalan tidak boleh
 * menggagalkan seluruh batch. */
async function searchInstagramUsername(competitorName: string, context: BusinessSearchContext, token: string): Promise<string | null> {
  try {
    const query = buildSearchQuery(competitorName, context);
    const items = await runApifyActor<InstagramSearchItem>({
      actorId: SEARCH_ACTOR_ID,
      token,
      timeoutMs: SEARCH_TIMEOUT_MS,
      input: { search: query, searchType: "user", searchLimit: 1 },
    });
    const first = items[0];
    const username = first?.username || first?.ownerUsername || null;
    return username ? username.replace(/^@/, "") : null;
  } catch (err) {
    console.error(`[socialMedia] pencarian username Instagram gagal untuk "${competitorName}":`, err);
    return null;
  }
}

/** Ambil follower count untuk satu username. Fail-soft sama seperti
 * searchInstagramUsername — null kalau gagal, bukan melempar. */
async function fetchFollowerCount(username: string, token: string): Promise<number | null> {
  try {
    const items = await runApifyActor<InstagramProfileItem>({
      actorId: PROFILE_ACTOR_ID,
      token,
      timeoutMs: PROFILE_TIMEOUT_MS,
      input: { usernames: [username] },
    });
    const first = items[0];
    const followers = first?.followersCount ?? first?.followersCount_normalized ?? null;
    return typeof followers === "number" ? followers : null;
  } catch (err) {
    console.error(`[socialMedia] pengambilan follower count gagal untuk "@${username}":`, err);
    return null;
  }
}

/** Entry point dipanggil getSocialMediaAnalysis.ts. Mengambil username lalu
 * follower count untuk tiap nama kompetitor SECARA BERURUTAN (bukan
 * Promise.all) supaya total waktu tetap bisa dihentikan lebih awal kalau
 * anggaran waktu (budgetMs) habis — lebih penting daripada kecepatan
 * maksimal untuk fitur yang berbagi batas keras 60 detik dengan sisa
 * request. Kompetitor yang gagal dicari/diambil dilewati saja (tidak
 * menggagalkan kompetitor lain). */
export async function fetchInstagramLiveRecords(
  competitorNames: string[],
  context: BusinessSearchContext,
  token: string,
  budgetMs: number
): Promise<SocialMediaLiveRecord[]> {
  const names = competitorNames.slice(0, MAX_COMPETITORS);
  const results: SocialMediaLiveRecord[] = [];
  const deadline = Date.now() + budgetMs;

  for (const name of names) {
    if (Date.now() >= deadline) break; // anggaran waktu habis — berhenti, jangan paksa lanjut

    const username = await searchInstagramUsername(name, context, token);
    if (!username) continue;

    if (Date.now() >= deadline) break;

    const followers = await fetchFollowerCount(username, token);
    if (followers === null) continue;

    results.push({ competitorName: name, platform: "instagram", username, followers });
  }

  return results;
}

/** Entry point jalur 2 (by category) — dipanggil getSocialMediaAnalysis.ts
 * HANYA saat Competitor Engine tidak menemukan nama kompetitor sama sekali
 * (mis. OpenStreetMap tidak punya data untuk kota tersebut). SATU pencarian
 * kategori+lokasi mengembalikan beberapa kandidat sekaligus, lalu follower
 * count tiap kandidat diambil satu-satu (sama pola budget/deadline dengan
 * fetchInstagramLiveRecords di atas — berhenti kalau waktu habis). */
export async function fetchInstagramLiveRecordsByCategory(
  context: BusinessSearchContext,
  token: string,
  budgetMs: number
): Promise<SocialMediaLiveRecord[]> {
  const deadline = Date.now() + budgetMs;
  const candidates = await searchInstagramByCategory(context, token, MAX_COMPETITORS);

  const results: SocialMediaLiveRecord[] = [];
  for (const candidate of candidates) {
    if (Date.now() >= deadline) break;

    const followers = await fetchFollowerCount(candidate.username, token);
    if (followers === null) continue;

    results.push({ competitorName: candidate.label, platform: "instagram", username: candidate.username, followers });
  }

  return results;
}
