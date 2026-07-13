// services/socialMedia/getSocialMediaAnalysis.ts
//
// Task 14b (Juli 2026): Medsos KOMPETITOR — "bagaimana kehadiran media
// sosial kompetitor di sekitar bisnismu?" Ditampilkan sebagai bagian dari
// tab Kompetitor di Workspace (bukan tab terpisah — datanya memang tentang
// kompetitor yang sama).
//
// Task 49 (Juli 2026): data ASLI via Apify ditambahkan di sini sebagai
// PATH KEDUA yang dicoba lebih dulu — path mock TIDAK diubah sama sekali
// (fallback jujur kalau live gagal/token belum diset). Live path:
//   1. Baca cache (social_media_snapshots, TTL 1 minggu) — hemat biaya.
//   2. Kalau cache kosong: ambil daftar nama kompetitor dari Competitor
//      Engine yang SUDAH ADA (runCompetitorEngine, cache sendiri) — supaya
//      Medsos Kompetitor membicarakan kompetitor YANG SAMA dengan yang
//      tampil di atasnya di tab Kompetitor, bukan daftar kedua yang beda.
//   3. Cari username Instagram + follower count tiap kompetitor lewat
//      Apify (services/socialMedia/instagramProvider.ts), dibatasi top 3.
//   4. Susun ringkasan AI tone-safe (services/socialMedia/summaryGenerator.ts).
//   5. Simpan ke cache, kembalikan dataSource "live_api".
// APAPUN yang gagal di langkah 1-4 (token belum diset, Apify error/timeout,
// tidak ada kompetitor dengan lokasi lengkap, dst) -> jatuh ke path mock
// yang sudah ada, TIDAK PERNAH membuat request gagal total.
//
// DATA HONESTY: dataSource mencerminkan sumber SEBENARNYA ("mock" atau
// "live_api") — UI WAJIB menampilkan label ini jujur ke pengguna, sama
// seperti Competitor Engine menandai data contoh.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { getActiveMembership } from "../membership/getActiveMembership.js";
import type { SocialMediaCompetitorRecord, SocialMediaSnapshot, SocialPlatform } from "./types.js";
import { getCachedSocialSnapshot, saveSocialSnapshot } from "./cache.js";
import { fetchInstagramLiveRecords, fetchInstagramLiveRecordsByCategory } from "./instagramProvider.js";
import { generateLiveSummary } from "./summaryGenerator.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type { SocialPlatform, SocialMediaCompetitorRecord, SocialMediaInsight, SocialMediaLiveRecord, SocialMediaSnapshot } from "./types.js";

const ALL_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "facebook"];

// Anggaran waktu untuk SELURUH fase live (search+profile Apify, sequential)
// — sisa waktu dari batas keras 60 detik (vercel.json maxDuration) dipakai
// untuk Competitor Engine (biasanya cache-hit, cepat), ringkasan AI, dan
// overhead request lain. Lihat instagramProvider.ts untuk detail timeout
// per panggilan Apify.
const SOCIAL_LIVE_BUDGET_MS = 30000;

/** Data CONTOH (bukan data pasar nyata) — nama disusun dari industri bisnis
 * supaya terasa relevan ke pengguna, sama pola dengan
 * services/competitor/provider/MockProvider.ts. Angka follower/engagement
 * sengaja bervariasi (satu tinggi follower tapi rendah engagement, satu
 * sebaliknya) supaya insight yang dihasilkan punya sesuatu yang jujur untuk
 * dibandingkan, bukan angka rata seragam yang tidak berguna. */
function buildMockRecords(industry: string): SocialMediaCompetitorRecord[] {
  const base = industry || "Usaha";
  return [
    { competitorName: `${base} Sejahtera`, platform: "instagram", followers: 8400, postsPerMonth: 12, engagementRatePct: 1.4 },
    { competitorName: `${base} Makmur Jaya`, platform: "instagram", followers: 2100, postsPerMonth: 20, engagementRatePct: 4.8 },
    { competitorName: `${base} Berkah`, platform: "facebook", followers: 5200, postsPerMonth: 4, engagementRatePct: 0.6 },
  ];
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function summarize(records: SocialMediaCompetitorRecord[]) {
  const followerCounts = records.map((r) => r.followers);
  const engagementRates = records.map((r) => r.engagementRatePct);

  const platformTotals = new Map<SocialPlatform, number>();
  for (const r of records) {
    platformTotals.set(r.platform, (platformTotals.get(r.platform) ?? 0) + r.postsPerMonth);
  }
  let mostActivePlatform: SocialPlatform | null = null;
  let maxPosts = -1;
  for (const [platform, posts] of platformTotals) {
    if (posts > maxPosts) {
      maxPosts = posts;
      mostActivePlatform = platform;
    }
  }

  const foundPlatforms = new Set(records.map((r) => r.platform));
  const platformsNotFound = ALL_PLATFORMS.filter((p) => !foundPlatforms.has(p));

  return {
    totalProfilesFound: records.length,
    averageFollowers: average(followerCounts),
    averageEngagementRatePct: average(engagementRates),
    mostActivePlatform,
    platformsNotFound,
  };
}

const PLATFORM_LABEL: Record<SocialPlatform, { id: string; en: string }> = {
  instagram: { id: "Instagram", en: "Instagram" },
  tiktok: { id: "TikTok", en: "TikTok" },
  facebook: { id: "Facebook", en: "Facebook" },
};

/** Membangun kalimat siap-tampil LANGSUNG dalam bahasa yang diminta (bukan
 * lewat formatter terpisah yang gampang lupa menerjemahkan setengah jalan —
 * lihat temuan audit Task 14a soal Competitor Engine yang reason-nya selalu
 * Bahasa Indonesia walau lang="en"). Setiap insight tetap merujuk angka
 * nyata dari records/summary, tidak ada klaim baru. */
function buildInsights(
  records: SocialMediaCompetitorRecord[],
  summary: ReturnType<typeof summarize>,
  lang: "id" | "en"
) {
  const insights: SocialMediaSnapshot["insights"] = [];
  const id = lang === "id";

  if (summary.totalProfilesFound === 0) return insights;

  insights.push({
    id: "sm-summary",
    category: "summary",
    headline: id
      ? `Ditemukan ${summary.totalProfilesFound} akun medsos kompetitor di sekitar bisnismu, rata-rata ${summary.averageFollowers ?? 0} follower dan engagement rate ${summary.averageEngagementRatePct ?? 0}%.`
      : `Found ${summary.totalProfilesFound} competitor social accounts nearby, averaging ${summary.averageFollowers ?? 0} followers and ${summary.averageEngagementRatePct ?? 0}% engagement rate.`,
    evidenceSummary: records.map((r) => `${r.competitorName} (${PLATFORM_LABEL[r.platform][lang]}, ${r.followers} follower, ${r.engagementRatePct}% engagement)`).join(", "),
  });

  const highEngagement = records.filter((r) => r.engagementRatePct >= 3);
  if (highEngagement.length > 0) {
    const top = highEngagement[0];
    insights.push({
      id: "sm-strength-engagement",
      category: "strength",
      headline: id
        ? `${top.competitorName} punya engagement rate tinggi (${top.engagementRatePct}%) walau followernya tidak paling banyak — kontennya kemungkinan lebih personal/interaktif. Ini standar yang bisa kamu pelajari.`
        : `${top.competitorName} has a high engagement rate (${top.engagementRatePct}%) despite not having the most followers — their content is likely more personal/interactive. Worth learning from.`,
      evidenceSummary: `${top.competitorName}: ${top.followers} follower, ${top.engagementRatePct}% engagement, ${top.postsPerMonth} post/bulan.`,
    });
  }

  const lowEngagementHighFollower = records.filter((r) => r.followers >= 5000 && r.engagementRatePct < 1.5);
  if (lowEngagementHighFollower.length > 0) {
    const weak = lowEngagementHighFollower[0];
    insights.push({
      id: "sm-weakness-engagement",
      category: "weakness",
      headline: id
        ? `${weak.competitorName} punya follower banyak (${weak.followers}) tapi engagement rendah (${weak.engagementRatePct}%) — tandanya follower itu tidak benar-benar aktif berinteraksi. Peluang untuk kamu merebut perhatian dengan konten yang lebih dekat ke pelanggan.`
        : `${weak.competitorName} has many followers (${weak.followers}) but low engagement (${weak.engagementRatePct}%) — a sign those followers aren't really engaged. An opportunity for you to win attention with more relatable content.`,
      evidenceSummary: `${weak.competitorName}: ${weak.followers} follower, ${weak.engagementRatePct}% engagement.`,
    });
  }

  if (summary.platformsNotFound.length > 0) {
    const platformNames = summary.platformsNotFound.map((p) => PLATFORM_LABEL[p][lang]).join(", ");
    insights.push({
      id: "sm-opportunity-platform-gap",
      category: "opportunity",
      headline: id
        ? `Belum ada kompetitor yang terlihat aktif di ${platformNames} — peluang jadi yang pertama hadir di sana sebelum ramai.`
        : `No competitors appear active on ${platformNames} yet — an opportunity to be first there before it gets crowded.`,
      evidenceSummary: id
        ? `Dari ${summary.totalProfilesFound} akun kompetitor yang ditemukan, tidak ada yang di ${platformNames}.`
        : `Of ${summary.totalProfilesFound} competitor accounts found, none are on ${platformNames}.`,
    });
  }

  return insights;
}

function buildMockSnapshot(industry: string, lang: "id" | "en", tierIsFree: boolean): SocialMediaSnapshot {
  const records = buildMockRecords(industry || "Usaha");
  const summary = summarize(records);
  // Free: teaser 1 profil saja, tanpa insight (sama pola dengan Competitor
  // Panel — bukti kualitas data sebelum bayar, bukan dikunci total).
  const visibleRecords = tierIsFree ? records.slice(0, 1) : records;
  const insights = tierIsFree ? [] : buildInsights(records, summary, lang);

  return {
    dataSource: "mock",
    records: visibleRecords,
    liveRecords: [],
    summary,
    insights,
    aiSummary: null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Mencoba jalur data ASLI (Apify). Mengembalikan null kalau tidak bisa
 * dicoba sama sekali (token belum diset) atau kalau terjadi error tak
 * terduga di sepanjang jalan — caller SELALU jatuh ke buildMockSnapshot()
 * saat null, tidak pernah membiarkan pengguna melihat error mentah. */
async function tryLiveSnapshot(
  businessProfileId: string,
  business: { business_name: string; industry: string | null },
  lang: "id" | "en",
  tierIsFree: boolean
): Promise<SocialMediaSnapshot | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  try {
    const cached = await getCachedSocialSnapshot(businessProfileId);
    if (cached) return cached;

    // Nama kompetitor dari Competitor Engine yang SUDAH ADA (cache sendiri,
    // TIDAK query ulang provider di sini) — supaya Medsos Kompetitor
    // membicarakan kompetitor yang sama persis dengan yang tampil di atas
    // section ini pada tab Kompetitor yang sama. HANYA gagal total (return
    // null -> mock) kalau Engine-nya sendiri ERROR — kalau cuma 0
    // kompetitor DITEMUKAN (bukan error, cakupan OpenStreetMap memang tipis
    // di kota kecil), tetap lanjut ke jalur 2 (by category) di bawah,
    // BUKAN langsung menyerah ke mock (instruksi PO Juli 2026).
    const { runCompetitorEngine } = await import("../competitor/engine/index.js");
    const engineResult = await runCompetitorEngine(businessProfileId);
    if ("error" in engineResult) return null;

    const { data: analysisRows } = await supabase
      .from("analyses")
      .select("raw_input")
      .eq("business_profile_id", businessProfileId)
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = analysisRows || [];
    const rowWithProduk = rows.find((r) => (r.raw_input as Record<string, unknown> | null)?.produkJasa);
    const produkJasa = ((rowWithProduk?.raw_input as Record<string, unknown> | undefined)?.produkJasa as string) || "";
    const rowWithLocation = rows.find((r) => (r.raw_input as Record<string, unknown> | null)?.lokasi);
    const location = ((rowWithLocation?.raw_input as Record<string, unknown> | undefined)?.lokasi as string) || "";

    const searchContext = { industry: business.industry || "", produkJasa, location };
    const competitorNames = engineResult.competitors.map((c) => c.name);
    // Jalur 1 (by name) kalau Competitor Engine punya nama; jalur 2 (by
    // category, langsung {industri}+{lokasi}) kalau tidak — lihat komentar
    // panjang di instagramProvider.ts soal alasan dua jalur ini.
    const liveRecords =
      competitorNames.length > 0
        ? await fetchInstagramLiveRecords(competitorNames, searchContext, token, SOCIAL_LIVE_BUDGET_MS)
        : await fetchInstagramLiveRecordsByCategory(searchContext, token, SOCIAL_LIVE_BUDGET_MS);

    // Tetap dikembalikan sebagai live_api walau liveRecords kosong — "belum
    // ketemu akun medsos kompetitor" itu sendiri adalah hasil yang jujur,
    // BUKAN alasan diam-diam menukar ke data contoh (yang bisa disalah
    // artikan sebagai data nyata).
    const aiSummary = await generateLiveSummary(liveRecords, business.business_name, lang);

    const followerCounts = liveRecords.map((r) => r.followers);
    const snapshot: SocialMediaSnapshot = {
      dataSource: "live_api",
      records: [],
      liveRecords: tierIsFree ? liveRecords.slice(0, 1) : liveRecords,
      summary: {
        totalProfilesFound: liveRecords.length,
        averageFollowers: average(followerCounts),
        averageEngagementRatePct: null, // tidak dihitung dari data asli — lihat catatan ToS di instagramProvider.ts
        mostActivePlatform: liveRecords.length > 0 ? "instagram" : null,
        platformsNotFound: liveRecords.length > 0 ? ["tiktok", "facebook"] : ALL_PLATFORMS,
      },
      insights: [],
      aiSummary: tierIsFree ? null : aiSummary,
      fetchedAt: new Date().toISOString(),
    };

    await saveSocialSnapshot(businessProfileId, "apify", snapshot);
    return snapshot;
  } catch (err) {
    console.error("[socialMedia] jalur data asli (Apify) gagal, jatuh ke mock:", err);
    return null;
  }
}

/** Entry point dipanggil dari api/workspace.ts action "getSocialMediaAnalysis".
 * Sama pola tier gating dengan getCompetitorAnalysis: Free tetap dapat
 * teaser (1 profil), Pro/Platinum dapat semuanya. Ownership check business
 * profile dilakukan di sini (bukan di router), konsisten dengan services/
 * lain di workspace. */
export async function getSocialMediaAnalysis(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id, business_name, industry")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const membership = await getActiveMembership(businessProfileId);
  const tierIsFree = membership.tier === "free";

  const liveSnapshot = await tryLiveSnapshot(businessProfileId, business, lang, tierIsFree);
  const snapshot = liveSnapshot ?? buildMockSnapshot(business.industry || "Usaha", lang, tierIsFree);

  return { status: 200, body: { socialMedia: snapshot, tier: membership.tier } };
}
