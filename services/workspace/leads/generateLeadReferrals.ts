// services/workspace/leads/generateLeadReferrals.ts
//
// Business logic untuk action "generateLeadReferrals" -- pelanggan klik
// tombol di Workspace, sistem mencari CALON PELANGGAN BARU yang relevan
// dengan jenis usaha & produk/jasa mereka (dari data wizard), lewat Claude
// web_search (BUKAN Apify -- keputusan produk Juli 2026: mulai dari yang
// sudah terpasang, tanpa akun/biaya baru).
//
// KUOTA PER TIER (permintaan pemilik produk persis): gratis 1, pro 2,
// platinum 5 -- diambil dari getActiveMembership(), SATU-SATUNYA sumber
// kebenaran tier (lihat services/membership/getActiveMembership.ts).
//
// AKURASI DIUTAMAKAN ("yang penting harus sesuai dulu"): system prompt di
// bawah secara eksplisit melarang Claude mengarang nama/alamat -- setiap
// lead tipe "company" wajib hasil pencarian web sungguhan dengan
// source_url, dan kalau hasil terverifikasi lebih sedikit dari kuota,
// itu TIDAK APA-APA (lebih sedikit tapi benar, bukan penuh tapi karangan).
//
// PRIVASI individu: lead_type "individual" BUKAN orang sungguhan bernama
// -- itu profil/segmen target pelanggan (usia, area, kebiasaan), tanpa
// nama asli atau alamat rumah presisi. Company diprioritaskan.
//
// Rate limit per bisnis (bukan per akun) -- satu pemanggilan Claude+web
// search per klik, biaya nyata, jangan sampai bisa dispam.

import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import type { ServiceResult } from "../../business/create.js";
import { getActiveMembership } from "../../membership/getActiveMembership.js";
import { checkRateLimit } from "../../rateLimit/checkRateLimit.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TIER_LEAD_COUNT: Record<string, number> = { free: 1, pro: 2, platinum: 5 };
const RATE_LIMIT_PER_DAY = 10;

type LeadItem = { type?: string; name?: string; description?: string; address?: string | null; sourceUrl?: string | null };

function parseLeadJson(raw: string): LeadItem[] {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed?.leads)) return parsed.leads;
  } catch {
    // lanjut ke percobaan berikutnya
  }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Respons tidak mengandung objek JSON.");
  const parsed = JSON.parse(jsonMatch[0]);
  return Array.isArray(parsed?.leads) ? parsed.leads : [];
}

const SYSTEM_PROMPT = `Kamu membantu UMKM Indonesia menemukan CALON PELANGGAN BARU yang relevan lewat pencarian web sungguhan.

ATURAN AKURASI (PALING PENTING): JANGAN PERNAH mengarang nama bisnis, alamat, atau sumber. Setiap lead tipe "company" WAJIB hasil pencarian web sungguhan dengan source_url yang valid dan bisa dibuka. Kalau tidak cukup menemukan hasil yang benar-benar terverifikasi, kembalikan LEBIH SEDIKIT lead daripada kuota yang diminta -- JANGAN mengisi kekurangan dengan karangan.

Aturan lead_type:
- "company": bisnis/perusahaan/instansi SUNGGUHAN yang masuk akal jadi calon pembeli produk/jasa ini. WAJIB address (kalau ditemukan lewat pencarian) dan source_url dari hasil pencarian web sungguhan.
- "individual": BUKAN orang sungguhan bernama -- ini PROFIL/SEGMEN target pelanggan perorangan (usia, area/kota, kebiasaan/kebutuhan) yang relevan, TANPA nama asli atau alamat rumah presisi siapapun. source_url boleh kosong untuk tipe ini.

Prioritaskan lead tipe "company" -- "individual" hanya pelengkap kalau relevan, dan jumlahnya dibatasi (maksimal separuh dari total kuota).

Keluarkan HANYA JSON valid, tanpa teks lain, dengan bentuk PERSIS:
{"leads": [{"type": "company", "name": "...", "description": "...", "address": "...", "sourceUrl": "https://..."}]}`;

function buildUserPrompt(businessName: string, industry: string, produkJasa: string, lokasi: string, stage: string, leadCount: number): string {
  return `Nama usaha: ${businessName}
Jenis usaha/industri: ${industry || "-"}
Produk/jasa yang dijual: ${produkJasa || "-"}
Lokasi usaha: ${lokasi || "-"}
Tahap usaha: ${stage}

Cari maksimal ${leadCount} calon pelanggan baru yang relevan (WAJIB nyata & terverifikasi lewat pencarian web untuk tipe company).`;
}

export async function generateLeadReferrals(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id, business_name, industry, business_stage")
    .eq("id", businessProfileId)
    .maybeSingle();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const rl = await checkRateLimit(`lead-referrals:${businessProfileId}`, RATE_LIMIT_PER_DAY, 86400);
  if (!rl.allowed) {
    return { status: 429, body: { error: "Sudah mencapai batas pencarian referensi hari ini. Coba lagi besok." } };
  }

  const membership = await getActiveMembership(businessProfileId);
  const leadCount = TIER_LEAD_COUNT[membership.tier] ?? 1;

  // Konteks produk/jasa & lokasi diambil dari analisa (wizard) TERBARU --
  // sumber yang sama dipakai fitur admin (getCustomerDetail.ts) untuk
  // menampilkan tantangan/harapan pelanggan.
  const { data: analysis } = await supabase
    .from("analyses")
    .select("raw_input")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rawInput = (analysis?.raw_input || {}) as Record<string, unknown>;
  const produkJasa = typeof rawInput.produkJasa === "string" ? rawInput.produkJasa : "";
  const lokasi = typeof rawInput.lokasi === "string" ? rawInput.lokasi : "";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { status: 500, body: { error: "Konfigurasi AI belum lengkap." } };
  }

  let leads: LeadItem[] = [];
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(business.business_name, business.industry || "", produkJasa, lokasi, business.business_stage, leadCount),
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK
      // terpasang lebih tua dari tipe web search tool, sama seperti catatan
      // di services/beemo/chat.ts dan services/reports/generateFinalReport.ts.
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }] as any,
    });
    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => ("text" in b ? b.text : ""))
      .join("");
    leads = parseLeadJson(rawText).slice(0, leadCount);
  } catch (err) {
    console.error("generateLeadReferrals: gagal memanggil Claude:", err);
    return { status: 500, body: { error: "Gagal mencari referensi pelanggan. Coba lagi." } };
  }

  if (leads.length === 0) {
    return { status: 200, body: { leads: [], tier: membership.tier, leadQuota: leadCount } };
  }

  const batchId = randomUUID();
  const rows = leads.map((l) => ({
    business_profile_id: businessProfileId,
    batch_id: batchId,
    lead_type: l.type === "individual" ? "individual" : "company",
    name: String(l.name || "Calon pelanggan").slice(0, 300),
    description: l.description ? String(l.description).slice(0, 1000) : null,
    address: l.address ? String(l.address).slice(0, 500) : null,
    source_url: l.sourceUrl ? String(l.sourceUrl).slice(0, 500) : null,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("business_lead_recommendations")
    .insert(rows)
    .select("id, batch_id, lead_type, name, description, address, source_url, generated_at");

  if (insertError) {
    console.error("generateLeadReferrals insert error:", insertError);
    return { status: 500, body: { error: "Gagal menyimpan referensi." } };
  }

  return { status: 200, body: { leads: inserted || [], tier: membership.tier, leadQuota: leadCount } };
}
