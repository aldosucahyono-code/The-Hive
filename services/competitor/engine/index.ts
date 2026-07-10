// services/competitor/engine/index.ts
//
// Competitor Engine — orkestrator utama pipeline:
//   business_profiles + analyses (lokasi, industri, skor sendiri)
//     -> provider (Google/OSM/Mock via factory)
//     -> normalizer
//     -> runCompetitorEngine() [file ini]: Market Summary, Market Position,
//        Competitor Strength/Weakness, User Strength — SEMUA dengan evidence
//     -> cache/competitorCache.ts (simpan hasil, TTL)
//
// "Tidak boleh ada insight tanpa evidence" (arahan directive) — setiap
// klaim di bawah merujuk balik ke angka nyata di marketSummary/competitors,
// tidak ada angka yang dikarang.

import { createClient } from "@supabase/supabase-js";
import { fetchCompetitorsWithFallback } from "../provider/index.js";
import { normalizeCompetitors } from "../normalizer/index.js";
import { getCachedSnapshot, saveSnapshot } from "../cache/competitorCache.js";
import type { CompetitorEngineResult, CompetitorRecord, MarketPosition } from "../types/index.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function average(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function deriveMarketPosition(
  ownScore: number | null,
  avgRating: number | null
): { position: MarketPosition; reason: string } {
  if (ownScore == null || avgRating == null) {
    return {
      position: "unknown",
      reason:
        "Belum cukup data (skor bisnis atau rating kompetitor belum tersedia) untuk menentukan posisi pasar secara jujur.",
    };
  }
  // ownScore berskala 0-100 (Business Health Score yang sudah ada),
  // avgRating berskala 0-5 (Google/rating publik) — disamakan ke skala 0-5
  // sebelum dibandingkan supaya perbandingannya adil, bukan asal dibagi.
  const ownScoreOn5 = (ownScore / 100) * 5;
  const diff = ownScoreOn5 - avgRating;
  if (diff >= 0.5) {
    return {
      position: "leader",
      reason: `Skor kesehatan bisnis Anda (${ownScore}/100, setara ${ownScoreOn5.toFixed(1)}/5) di atas rata-rata rating kompetitor sekitar (${avgRating}/5).`,
    };
  }
  if (diff <= -0.5) {
    return {
      position: "developing",
      reason: `Skor kesehatan bisnis Anda (${ownScore}/100, setara ${ownScoreOn5.toFixed(1)}/5) masih di bawah rata-rata rating kompetitor sekitar (${avgRating}/5).`,
    };
  }
  return {
    position: "competitive",
    reason: `Skor kesehatan bisnis Anda (${ownScore}/100, setara ${ownScoreOn5.toFixed(1)}/5) sejajar dengan rata-rata rating kompetitor sekitar (${avgRating}/5).`,
  };
}

function deriveStrengthsWeaknesses(competitors: CompetitorRecord[]) {
  const withRating = competitors.filter((c) => c.rating != null);
  const lowRated = withRating.filter((c) => (c.rating as number) < 3.8);
  const fewReviews = competitors.filter((c) => c.reviewCount != null && (c.reviewCount as number) < 10);
  const highRated = withRating.filter((c) => (c.rating as number) >= 4.3);

  const competitorStrengths: Array<{ text: string; evidence: string }> = [];
  const competitorWeaknesses: Array<{ text: string; evidence: string }> = [];

  if (highRated.length > 0) {
    competitorStrengths.push({
      text: `${highRated.length} kompetitor punya rating tinggi (≥4.3) di sekitar lokasi Anda.`,
      evidence: highRated.map((c) => `${c.name} (${c.rating}★, ${c.reviewCount ?? 0} ulasan)`).join(", "),
    });
  }
  if (lowRated.length > 0) {
    competitorWeaknesses.push({
      text: `${lowRated.length} kompetitor punya rating di bawah 3.8 — celah untuk pelanggan yang tidak puas mencari alternatif.`,
      evidence: lowRated.map((c) => `${c.name} (${c.rating}★)`).join(", "),
    });
  }
  if (fewReviews.length > 0) {
    competitorWeaknesses.push({
      text: `${fewReviews.length} kompetitor punya jumlah ulasan sangat sedikit (<10) — kemungkinan belum dikenal luas atau baru buka.`,
      evidence: fewReviews.map((c) => `${c.name} (${c.reviewCount ?? 0} ulasan)`).join(", "),
    });
  }

  return { competitorStrengths, competitorWeaknesses };
}

export async function runCompetitorEngine(
  businessProfileId: string,
  opts?: { forceRefresh?: boolean }
): Promise<CompetitorEngineResult | { error: string }> {
  if (!opts?.forceRefresh) {
    const cached = await getCachedSnapshot(businessProfileId);
    if (cached) return cached;
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, business_name, industry")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business) {
    return { error: "Business profile tidak ditemukan." };
  }

  const { data: analysisRows } = await supabase
    .from("analyses")
    .select("raw_input, ai_output, created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(20);

  const rows = analysisRows || [];
  const withLocation = rows.find((r) => (r.raw_input as Record<string, unknown> | null)?.lokasi);
  const location = (withLocation?.raw_input as Record<string, unknown> | undefined)?.lokasi as string | undefined;

  if (!location || !business.industry) {
    // Jujur: tanpa lokasi/industri kita tidak bisa mencari kompetitor nyata,
    // dan kita tidak akan mengarang lokasi. Kembalikan error yang jelas
    // supaya Workspace menampilkan Empty State yang tepat, bukan data palsu.
    return { error: "Lokasi atau industri bisnis belum lengkap untuk analisis kompetitor." };
  }

  const ownScore = (rows[0]?.ai_output as Record<string, unknown> | undefined)?.businessHealthScore as
    | number
    | undefined;

  const providerResult = await fetchCompetitorsWithFallback({
    industry: business.industry,
    location,
    businessName: business.business_name,
  });

  const competitors = normalizeCompetitors(providerResult);

  const ratings = competitors.map((c) => c.rating).filter((r): r is number => r != null);
  const reviewCounts = competitors.map((c) => c.reviewCount).filter((r): r is number => r != null);
  const averageRating = average(ratings);
  const averageReviewCount = average(reviewCounts);

  const { position, reason } = deriveMarketPosition(ownScore ?? null, averageRating);
  const { competitorStrengths, competitorWeaknesses } = deriveStrengthsWeaknesses(competitors);

  const userStrengths: Array<{ text: string; evidence: string }> = [];
  if (ownScore != null && averageRating != null) {
    const ownScoreOn5 = (ownScore / 100) * 5;
    if (ownScoreOn5 - averageRating >= 0.3) {
      userStrengths.push({
        text: "Skor kesehatan bisnis Anda lebih tinggi dari rata-rata rating kompetitor sekitar.",
        evidence: `Skor Anda: ${ownScore}/100 (${ownScoreOn5.toFixed(1)}/5) vs rata-rata kompetitor: ${averageRating}/5.`,
      });
    }
  }

  const result: CompetitorEngineResult = {
    businessProfileId,
    dataSource: providerResult.source,
    query: { industry: business.industry, location, businessName: business.business_name },
    marketSummary: {
      totalCompetitorsFound: competitors.length,
      averageRating,
      averageReviewCount,
    },
    competitors,
    marketPosition: position,
    marketPositionReason: reason,
    competitorStrengths,
    competitorWeaknesses,
    userStrengths,
    fetchedAt: new Date().toISOString(),
  };

  await saveSnapshot(businessProfileId, providerResult.source, business.industry, location, result);

  return result;
}
