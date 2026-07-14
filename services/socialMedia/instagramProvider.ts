// services/socialMedia/instagramProvider.ts
//
// Orkestrasi pencarian akun Instagram kompetitor + follower count via
// Apify — DIBATASI KETAT sesuai instruksi pemilik produk (dikutip lengkap
// di services/socialMedia/summaryGenerator.ts):
// 1. HANYA Instagram di v1 (TikTok/Facebook tetap mock — lihat
//    getSocialMediaAnalysis.ts).
// 2. HANYA username + followers yang diambil/ditampilkan/disimpan — TIDAK
//    postsPerMonth, TIDAK engagementRatePct, TIDAK bio/foto/post individual.
//    Makin sedikit yang diambil, makin kecil jejak risiko ToS-nya.
// 3. Dibatasi TOP 3 kompetitor per request (biaya Apify + waktu Vercel
//    maxDuration 180 detik untuk SELURUH request api/workspace.ts, bukan
//    cuma bagian ini) — lihat SOCIAL_LIVE_BUDGET_MS di getSocialMediaAnalysis.ts.
//
// Audit Juli 2026 (laporan pemilik produk: "dari medsos juga tidak
// keluar"), TEMUAN PENTING lewat pengecekan langsung dataset hasil run
// nyata di console.apify.com: apify/instagram-search-scraper SUDAH
// mengembalikan "followersCount" LANGSUNG di setiap hasil pencariannya
// (searchType: "user") -- TIDAK PERLU panggilan actor kedua
// (apify/instagram-profile-scraper) sama sekali untuk ambil follower
// count. Kode SEBELUMNYA tidak membaca field itu dan malah memanggil
// actor profil terpisah per kandidat -- inilah kenapa
// instagram-profile-scraper TIDAK PERNAH punya satu run pun di akun
// Apify pemilik produk (waktu keburu habis di actor pencarian, ditambah
// timeout 8 detik yang jauh lebih pendek dari waktu nyata 27-38 detik).
// Menghapus panggilan kedua ini SEKALIGUS memperbaiki 3 hal: separuh
// biaya Apify per pencarian, separuh risiko timeout (cuma 1 panggilan
// sequential per kandidat, bukan 2), dan tidak ada lagi kemungkinan
// username ketemu tapi followers gagal diambil terpisah.
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

const MAX_COMPETITORS = 3;
// Dikonfirmasi lewat log Apify sungguhan (console.apify.com/actors/runs):
// 2 run Instagram Search Scraper terakhir masing-masing butuh 38 detik dan
// 27 detik untuk SUKSES (8/8 request berhasil) -- SEBELUMNYA timeout di
// sini cuma 8000ms, jadi AbortController KAMI SENDIRI selalu memutus
// koneksi sebelum Apify sempat menjawab, walau actor-nya jalan normal &
// sukses di sisi Apify (biaya tetap kepotong walau responsnya tidak
// pernah kami terima). Dinaikkan ke 45 detik (di atas rekor terlama 38
// detik dengan margin) -- maxDuration api/workspace.ts sebenarnya 180
// detik (vercel.json), jauh dari cukup.
const SEARCH_TIMEOUT_MS = 45000;

export type BusinessSearchContext = {
  industry: string;
  produkJasa: string;
  location: string;
};

// followersCount: field ASLI yang dikembalikan apify/instagram-search-scraper
// per hasil pencarian (dikonfirmasi lewat dataset run nyata) -- lihat
// catatan panjang di atas soal kenapa kita tidak lagi butuh actor kedua.
type InstagramSearchItem = {
  username?: string;
  ownerUsername?: string;
  fullName?: string;
  url?: string;
  followersCount?: number;
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

/** Cari BEBERAPA akun Instagram + follower count-nya sekaligus lewat SATU
 * query kategori+lokasi (bukan satu query per nama kompetitor seperti
 * searchInstagramProfile). Dipakai sebagai fallback saat Competitor Engine
 * tidak menemukan nama kompetitor sama sekali — lihat komentar jalur 2 di
 * atas. followersCount diambil LANGSUNG dari hasil pencarian ini, TIDAK
 * ada panggilan actor kedua. */
async function searchInstagramProfilesByCategory(
  context: BusinessSearchContext,
  token: string,
  limit: number
): Promise<SocialMediaLiveRecord[]> {
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
    const results: SocialMediaLiveRecord[] = [];
    for (const item of items) {
      const username = (item.username || item.ownerUsername || "").replace(/^@/, "");
      if (!username || seen.has(username)) continue;
      if (typeof item.followersCount !== "number") continue; // jujur: skip kalau followers tidak ketemu, jangan mengarang
      seen.add(username);
      results.push({ competitorName: item.fullName || username, platform: "instagram", username, followers: item.followersCount });
      if (results.length >= limit) break;
    }
    return results;
  } catch (err) {
    console.error(`[socialMedia] pencarian kategori+lokasi gagal untuk "${query}":`, err);
    return [];
  }
}

/** Cari SATU akun Instagram (username + followers) paling mungkin untuk
 * satu kompetitor bernama. Mengembalikan null (bukan melempar) kalau
 * tidak ketemu/actor gagal/followers tidak tersedia — caller tetap lanjut
 * ke kompetitor berikutnya; satu kegagalan tidak boleh menggagalkan
 * seluruh batch. */
async function searchInstagramProfile(
  competitorName: string,
  context: BusinessSearchContext,
  token: string
): Promise<{ username: string; followers: number } | null> {
  try {
    const query = buildSearchQuery(competitorName, context);
    const items = await runApifyActor<InstagramSearchItem>({
      actorId: SEARCH_ACTOR_ID,
      token,
      timeoutMs: SEARCH_TIMEOUT_MS,
      input: { search: query, searchType: "user", searchLimit: 1 },
    });
    const first = items[0];
    const username = (first?.username || first?.ownerUsername || "").replace(/^@/, "");
    if (!username || typeof first?.followersCount !== "number") return null; // jujur: tidak mengarang followers kalau tidak ada di hasil
    return { username, followers: first.followersCount };
  } catch (err) {
    console.error(`[socialMedia] pencarian profil Instagram gagal untuk "${competitorName}":`, err);
    return null;
  }
}

/** Entry point dipanggil getSocialMediaAnalysis.ts. SATU panggilan Apify
 * per nama kompetitor (bukan dua seperti sebelumnya — lihat catatan di
 * atas file ini), dijalankan SECARA BERURUTAN supaya total waktu tetap
 * bisa dihentikan lebih awal kalau anggaran waktu (budgetMs) habis.
 * Kompetitor yang gagal dicari dilewati saja (tidak menggagalkan
 * kompetitor lain). */
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

    const profile = await searchInstagramProfile(name, context, token);
    if (!profile) continue;

    results.push({ competitorName: name, platform: "instagram", username: profile.username, followers: profile.followers });
  }

  return results;
}

/** Entry point jalur 2 (by category) — dipanggil getSocialMediaAnalysis.ts
 * HANYA saat Competitor Engine tidak menemukan nama kompetitor sama sekali
 * (mis. OpenStreetMap tidak punya data untuk kota tersebut). SATU
 * pencarian kategori+lokasi mengembalikan beberapa kandidat SEKALIGUS
 * dengan follower count-nya masing-masing — tidak ada panggilan susulan. */
export async function fetchInstagramLiveRecordsByCategory(
  context: BusinessSearchContext,
  token: string,
  budgetMs: number
): Promise<SocialMediaLiveRecord[]> {
  // budgetMs tidak dipakai untuk memotong di tengah SATU panggilan (Apify
  // run-sync sudah punya timeout sendiri lewat SEARCH_TIMEOUT_MS) — cukup
  // dijaga di sini supaya sinyal deadline tetap konsisten dengan caller.
  if (budgetMs <= 0) return [];
  return searchInstagramProfilesByCategory(context, token, MAX_COMPETITORS);
}
