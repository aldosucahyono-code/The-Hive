// services/socialMedia/types.ts
//
// Tipe bersama untuk Medsos Kompetitor (mock v1 + Apify v1, Task 49) —
// dipisah dari getSocialMediaAnalysis.ts supaya modul lain (cache.ts,
// instagramProvider.ts, summaryGenerator.ts) bisa mengimpornya tanpa
// circular import antar file — pola yang sama dengan
// services/competitor/types/index.ts.

export type SocialPlatform = "instagram" | "tiktok" | "facebook";

export type SocialMediaCompetitorRecord = {
  competitorName: string;
  platform: SocialPlatform;
  followers: number;
  postsPerMonth: number;
  engagementRatePct: number;
};

export type SocialMediaInsight = {
  id: string;
  category: "summary" | "strength" | "weakness" | "opportunity";
  headline: string; // sudah dalam bahasa yang diminta (id/en)
  evidenceSummary: string;
};

// Data ASLI (Apify, Task 49) — HANYA username + followers. TIDAK ada
// postsPerMonth/engagementRatePct: itu perlu scraping level-post yang lebih
// invasif, sengaja tidak dilakukan untuk meminimalkan risiko ToS. Lihat
// catatan lengkap di instagramProvider.ts.
export type SocialMediaLiveRecord = {
  competitorName: string;
  platform: "instagram"; // v1 baru Instagram — TikTok/Facebook tetap mock
  username: string;
  followers: number;
};

export type SocialMediaSnapshot = {
  // WAJIB ditampilkan jujur ke pengguna — lihat SocialMediaSection di
  // Workspace.tsx (badge "Data Contoh/Simulasi" vs badge data asli).
  dataSource: "mock" | "live_api";
  records: SocialMediaCompetitorRecord[]; // diisi HANYA saat dataSource "mock"
  liveRecords: SocialMediaLiveRecord[]; // diisi HANYA saat dataSource "live_api"
  summary: {
    totalProfilesFound: number;
    averageFollowers: number | null;
    averageEngagementRatePct: number | null; // null untuk live_api — tidak dihitung dari data asli
    mostActivePlatform: SocialPlatform | null;
    platformsNotFound: SocialPlatform[];
  };
  insights: SocialMediaInsight[]; // diisi HANYA saat dataSource "mock"
  aiSummary: string | null; // diisi HANYA saat dataSource "live_api" — ringkasan tone-safe, lihat summaryGenerator.ts
  fetchedAt: string;
};
