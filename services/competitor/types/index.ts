// services/competitor/types/index.ts
//
// Tipe bersama untuk seluruh pipeline Competitor Engine (Master Product
// Directive — Phase 2):
//
//   Provider (Google Places / OpenStreetMap / Mock)
//     -> Normalizer (normalizeCompetitors)
//     -> Competitor Engine (runCompetitorEngine)
//     -> MarketSignal[] (adapter, lihat opportunity/marketSignals.ts)
//     -> Opportunity Engine (generateOpportunities)
//     -> Recommendation Engine (generateRecommendations)
//
// PENTING (arahan Product Owner): Opportunity Engine dan Recommendation
// Engine TIDAK BOLEH bergantung langsung pada bentuk data Competitor
// Engine — keduanya hanya membaca MarketSignal[], sebuah bentuk generik
// yang bisa diisi oleh sumber data manapun (Competitor hari ini; Google
// Business Profile/media sosial/marketplace/sumber legal lain nanti) tanpa
// mengubah logika Opportunity/Recommendation Engine sama sekali. Jangan
// membuat Opportunity/Recommendation Engine mengimpor tipe Competitor
// secara langsung — hanya lewat MarketSignal.

// "claude_web_search" (Juli 2026): jalur fallback ketiga lewat Claude +
// web_search, dipakai HANYA saat Google Places/OpenStreetMap gagal total
// atau kembali 0 hasil — lihat provider/ClaudeWebSearchProvider.ts dan
// provider/index.ts untuk urutan keputusan lengkap. Tetap data NYATA
// (bukan karangan/mock), hanya sumbernya beda dari Google Maps langsung —
// UI tetap wajib menampilkan label jujur soal sumbernya.
export type DataSource = "google_places" | "openstreetmap" | "claude_web_search" | "mock";

// =============================================================================
// Provider layer — apa yang dikembalikan provider MENTAH, sebelum dirapikan
// Normalizer. Setiap provider (Google/OSM/Mock) mengembalikan bentuk ini,
// supaya Normalizer hanya perlu satu bentuk masuk, bukan beda-beda per
// provider.
// =============================================================================

export type ProviderQuery = {
  industry: string;
  location: string; // teks bebas dari Business Discovery (raw_input.lokasi) — provider yang bertanggung jawab menerjemahkan ke pencarian/geocoding masing-masing
  businessName: string; // dipakai untuk MENGECUALIKAN bisnis pengguna sendiri dari hasil pencarian
};

export type RawCompetitorPlace = {
  externalId: string; // place_id (Google) / osm id (OSM) / mock-id
  name: string;
  address: string | null;
  rating: number | null; // 0-5, null kalau provider tidak punya data ini
  reviewCount: number | null;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  priceLevel: number | null; // 0-4, null kalau tidak ada
  sourceUrl: string | null; // link sumber asli (dipakai ClaudeWebSearchProvider — Google/OSM null, sudah ada link Maps generik di UI)
  raw: Record<string, unknown>; // payload asli provider, buat debug/audit — TIDAK ditampilkan ke pengguna
};

export type ProviderResult = {
  source: DataSource;
  places: RawCompetitorPlace[];
  fetchedAt: string;
};

// =============================================================================
// Normalizer layer — bentuk yang SAMA terlepas dari provider mana asalnya.
// =============================================================================

export type CompetitorRecord = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  priceLevel: number | null;
  distanceLabel: string | null; // "berdekatan" dsb — TIDAK menghitung jarak presisi kalau tidak ada koordinat pasti, demi data honesty
  sourceUrl: string | null;
};

// =============================================================================
// Competitor Engine output — SATU-SATUNYA bentuk yang dibaca Workspace/
// Chat/PDF untuk urusan kompetitor. Setiap field WAJIB attributable ke
// evidence (competitorRecords) — tidak ada insight tanpa evidence (arahan
// directive).
// =============================================================================

export type MarketPosition = "leader" | "competitive" | "developing" | "unknown";

export type CompetitorEngineResult = {
  businessProfileId: string;
  dataSource: DataSource; // WAJIB ditampilkan jujur ke pengguna kalau 'mock'
  query: ProviderQuery;

  marketSummary: {
    totalCompetitorsFound: number;
    averageRating: number | null;
    averageReviewCount: number | null;
  };

  competitors: CompetitorRecord[]; // evidence — daftar kompetitor nyata yang jadi dasar seluruh insight di bawah
  marketPosition: MarketPosition;
  marketPositionReason: string; // penjelasan KENAPA posisi ini disimpulkan, merujuk ke marketSummary — Bahasa Indonesia (dipakai PDF/Business Memory yang selalu id)
  marketPositionReasonEn: string; // (audit Task 14a) versi Inggris — HANYA dipakai Insight Formatter saat lang="en", tidak menggantikan field di atas supaya konsumen lain (PDF, Business Memory) tidak perlu berubah

  competitorStrengths: Array<{ text: string; textEn: string; evidence: string }>; // hal yang kompetitor lakukan lebih baik (rata-rata rating/review lebih tinggi, dst)
  competitorWeaknesses: Array<{ text: string; textEn: string; evidence: string }>; // celah yang terlihat dari data (rating rendah, review sedikit, kategori kosong, dst)
  userStrengths: Array<{ text: string; textEn: string; evidence: string }>; // dibandingkan rata-rata kompetitor, pakai Business Health/Score yang SUDAH ada (bukan dikarang di sini)

  fetchedAt: string;
};

// =============================================================================
// MarketSignal — bentuk generik yang dikonsumsi Opportunity Engine. HANYA
// lewat sini Opportunity Engine "mengenal" dunia luar — tidak pernah lewat
// CompetitorEngineResult langsung.
// =============================================================================

export type MarketSignalSourceType =
  | "competitor"
  | "google_business_profile" // belum diimplementasi — placeholder arsitektur untuk sumber masa depan
  | "social_media" // belum diimplementasi
  | "marketplace" // belum diimplementasi
  | "legal_source"; // belum diimplementasi

export type MarketSignal = {
  sourceType: MarketSignalSourceType;
  sourceId: string; // mis. competitor_snapshots.id
  category: "market_gap" | "competitor_weakness" | "competitor_strength" | "customer_sentiment" | "pricing" | "other";
  evidence: string; // teks yang bisa ditunjukkan ke pengguna sebagai bukti
  data: Record<string, unknown>;
};

// =============================================================================
// Opportunity Engine output
// =============================================================================

export type OpportunityPriority = "critical" | "high" | "medium" | "low";

export type Opportunity = {
  id: string;
  title: string;
  titleEn: string; // (audit Task 14a) — dipakai Insight Formatter saat lang="en"
  businessValue: string; // kalimat jujur "kenapa ini penting buat bisnis", bukan angka dikarang
  businessValueEn: string;
  difficulty: "easy" | "medium" | "hard";
  impact: "small" | "medium" | "large";
  priority: OpportunityPriority;
  reason: string;
  reasonEn: string;
  action: string;
  actionEn: string;
  source: MarketSignalSourceType;
  evidence: string;
};

// =============================================================================
// Recommendation Engine output
// =============================================================================

export type RecommendationBucketKey = "today" | "this_week" | "this_month" | "next_90_days";

export type Recommendation = {
  id: string;
  bucket: RecommendationBucketKey;
  title: string;
  titleEn: string; // (audit Task 14a) — lihat catatan di recommendation/index.ts: sebagian reason bersumber dari teks AI baseline yang TIDAK bisa diterjemahkan otomatis di sini (butuh panggilan AI baru), jadi reasonEn bisa sama dengan reason untuk kasus itu — title/action tetap diterjemahkan penuh karena keduanya template tetap.
  reason: string;
  reasonEn: string;
  action: string;
  actionEn: string;
  source: string; // "business_score" | "journey" | "target" | "business_update" | "competitor" | "business_memory"
};
