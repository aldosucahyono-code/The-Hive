// services/socialMedia/getSocialMediaAnalysis.ts
//
// Task 14b (Juli 2026): Medsos KOMPETITOR — "bagaimana kehadiran media
// sosial kompetitor di sekitar bisnismu?" Ditampilkan sebagai bagian dari
// tab Kompetitor di Workspace (bukan tab terpisah — datanya memang tentang
// kompetitor yang sama).
//
// SATU FILE (bukan pipeline provider/normalizer/engine/adapter terpisah
// seperti services/competitor/*) — keputusan sadar supaya v1 ini bisa
// selesai dan jujur, bukan arsitektur besar untuk fitur yang belum ada
// data nyatanya. Kalau nanti ada provider sungguhan (API resmi Instagram/
// TikTok, atau scraping yang legal), pecah file ini mengikuti pola
// services/competitor/* — struktur fungsi di bawah SUDAH dipisah per
// tanggung jawab (buildMockRecords -> summarize -> buildInsights) supaya
// pemisahan itu tidak perlu nulis ulang logika, cuma pindah folder.
//
// DATA HONESTY: dataSource SELALU "mock" untuk sekarang (belum ada provider
// data medsos sungguhan) — UI WAJIB menampilkan label jujur, sama seperti
// Competitor Engine menandai data contoh.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { getActiveMembership } from "../membership/getActiveMembership.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type SocialPlatform = "instagram" | "tiktok" | "facebook";

export type SocialMediaCompetitorRecord = {
  competitorName: string;
  platform: SocialPlatform;
  followers: number;
  postsPerMonth: number;
  engagementRatePct: number; // (rata-rata like+komentar per post / followers) x 100
};

export type SocialMediaInsight = {
  id: string;
  category: "summary" | "strength" | "weakness" | "opportunity";
  headline: string; // sudah dalam bahasa yang diminta (id/en) — dibangun langsung bilingual, TIDAK seperti bug lama di Competitor Engine (lihat catatan audit Task 14a)
  evidenceSummary: string;
};

export type SocialMediaSnapshot = {
  dataSource: "mock";
  records: SocialMediaCompetitorRecord[];
  summary: {
    totalProfilesFound: number;
    averageFollowers: number | null;
    averageEngagementRatePct: number | null;
    mostActivePlatform: SocialPlatform | null;
    platformsNotFound: SocialPlatform[]; // platform yang TIDAK ada satupun kompetitor aktif di sana -> sinyal peluang
  };
  insights: SocialMediaInsight[];
  fetchedAt: string;
};

const ALL_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "facebook"];

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
): SocialMediaInsight[] {
  const insights: SocialMediaInsight[] = [];
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
    .select("id, user_id, industry")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const membership = await getActiveMembership(businessProfileId);
  const records = buildMockRecords(business.industry || "Usaha");
  const summary = summarize(records);

  // Free: teaser 1 profil saja, tanpa insight (sama pola dengan Competitor
  // Panel — bukti kualitas data sebelum bayar, bukan dikunci total).
  const visibleRecords = membership.tier === "free" ? records.slice(0, 1) : records;
  const insights = membership.tier === "free" ? [] : buildInsights(records, summary, lang);

  const snapshot: SocialMediaSnapshot = {
    dataSource: "mock",
    records: visibleRecords,
    summary,
    insights,
    fetchedAt: new Date().toISOString(),
  };

  return { status: 200, body: { socialMedia: snapshot, tier: membership.tier } };
}
