// services/competitor/provider/ClaudeWebSearchProvider.ts
//
// Fallback jalur KETIGA (Juli 2026, laporan pemilik produk: "kompetitor by
// gmaps tidak keluar apalagi dari medsos" — Google Places/OpenStreetMap
// gagal/kosong untuk sejumlah pengguna). Dipakai HANYA saat provider utama
// (Google Places kalau GOOGLE_PLACES_API_KEY ada, atau OpenStreetMap kalau
// tidak) gagal total ATAU kembali 0 hasil — lihat provider/index.ts untuk
// urutan keputusan lengkap. TIDAK PERNAH jadi provider utama (lebih mahal
// & lebih lambat dari Google/OSM, dan hasilnya tidak selalu ada koordinat
// presisi untuk fitur jarak).
//
// AKURASI DIUTAMAKAN — pola SAMA PERSIS dengan
// services/workspace/leads/generateLeadReferrals.ts: Claude diinstruksikan
// KERAS untuk tidak mengarang nama/alamat/rating, wajib source_url dari
// pencarian web sungguhan, dan boleh mengembalikan LEBIH SEDIKIT hasil
// daripada yang diminta kalau memang tidak cukup yang terverifikasi.
//
// query.location di sini adalah teks bebas yang pengguna ketik sendiri di
// Business Discovery (raw_input.lokasi) — bisa berupa alamat lengkap,
// kecamatan+kota, atau cuma nama kota, tergantung apa yang mereka isi.
// Provider ini TIDAK mem-parsing/memisahnya jadi kecamatan/kota/provinsi
// terstruktur (field itu tidak ada di skema wizard) — cukup diteruskan apa
// adanya sebagai bagian query pencarian, sama seperti provider lain di
// pipeline ini.
//
// Cache: hasil provider ini tetap masuk lewat cache/competitorCache.ts yang
// SAMA (TTL 7 hari) seperti Google/OSM — jadi panggilan Claude+web_search
// ini paling banter sekali per bisnis per minggu, bukan setiap kali tab
// Kompetitor dibuka.

import Anthropic from "@anthropic-ai/sdk";
import type { CompetitorDataProvider } from "./types.js";
import type { ProviderQuery, ProviderResult, RawCompetitorPlace } from "../types/index.js";
import { logClaudeUsage, extractUsage } from "../../costTracking/logUsage.js";

const MAX_RESULTS = 6;

type WebCompetitorItem = {
  name?: string;
  address?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  category?: string | null;
  sourceUrl?: string | null;
};

function parseJson(raw: string): WebCompetitorItem[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.competitors)) return parsed.competitors;
  } catch {
    // lanjut ke percobaan berikutnya
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed?.competitors) ? parsed.competitors : [];
  } catch {
    return [];
  }
}

const SYSTEM_PROMPT = `Kamu membantu mencari KOMPETITOR SUNGGUHAN (bisnis sejenis) di sekitar lokasi UMKM Indonesia, lewat pencarian web sungguhan.

ATURAN AKURASI (PALING PENTING): JANGAN PERNAH mengarang nama bisnis, alamat, rating, atau sumber. Setiap hasil WAJIB berasal dari pencarian web sungguhan dengan source_url yang valid dan bisa dibuka. rating/reviewCount HANYA diisi kalau benar-benar ditemukan (mis. dari Google Maps/Google Business Profile yang muncul di hasil pencarian) -- kalau tidak ketemu, biarkan null, JANGAN menebak angka. Kalau tidak cukup menemukan hasil yang benar-benar terverifikasi, kembalikan LEBIH SEDIKIT dari yang diminta -- JANGAN mengisi kekurangan dengan karangan.

Jangan sertakan bisnis milik pengguna sendiri (nama bisnisnya akan diberitahu di bawah) dalam hasil.

Keluarkan HANYA JSON valid, tanpa teks lain, dengan bentuk PERSIS:
{"competitors": [{"name": "...", "address": "...", "rating": 4.3, "reviewCount": 120, "category": "...", "sourceUrl": "https://..."}]}`;

function buildUserPrompt(query: ProviderQuery): string {
  return `Jenis usaha/industri: ${query.industry || "-"}
Lokasi: ${query.location || "-"}
Nama usaha pengguna (KECUALIKAN dari hasil): ${query.businessName || "-"}

Cari maksimal ${MAX_RESULTS} kompetitor (bisnis sejenis) di sekitar lokasi ini yang benar-benar nyata dan terverifikasi lewat pencarian web.`;
}

export const ClaudeWebSearchProvider: CompetitorDataProvider = {
  source: "claude_web_search",
  async fetchCompetitors(query: ProviderQuery): Promise<ProviderResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY belum dikonfigurasi.");
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(query) }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, sama seperti catatan
      // di services/workspace/leads/generateLeadReferrals.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }] as any,
    });

    // Biaya AI sungguhan (Juli 2026, "tidak boleh ada data palsu") — fire
    // and forget, tidak menunda respons ke pengguna kalau lambat/gagal.
    // businessProfileId null: query provider ini anonim, tidak ada id akun
    // di ProviderQuery (lihat catatan header file).
    const usage = extractUsage(response);
    void logClaudeUsage({ businessProfileId: null, action: "competitor_web_search", model: "claude-sonnet-5", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, webSearches: usage.webSearches });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    const items = parseJson(rawText).slice(0, MAX_RESULTS);

    const businessNameLower = query.businessName.trim().toLowerCase();
    const places: RawCompetitorPlace[] = items
      .filter((it) => it.name && it.name.trim().toLowerCase() !== businessNameLower)
      .map((it, idx) => ({
        externalId: `claude-web-${idx}-${Date.now()}`,
        name: String(it.name).trim(),
        address: it.address ? String(it.address).slice(0, 300) : null,
        rating: typeof it.rating === "number" && !Number.isNaN(it.rating) ? it.rating : null,
        reviewCount: typeof it.reviewCount === "number" && !Number.isNaN(it.reviewCount) ? it.reviewCount : null,
        category: it.category ? String(it.category).slice(0, 100) : query.industry || null,
        latitude: null,
        longitude: null,
        priceLevel: null,
        sourceUrl: it.sourceUrl ? String(it.sourceUrl).slice(0, 500) : null,
        raw: { claudeWebSearch: true },
      }));

    return { source: "claude_web_search", places, fetchedAt: new Date().toISOString() };
  },
};
