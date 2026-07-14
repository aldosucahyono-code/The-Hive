// services/admin/getCustomerDetail.ts
//
// Business logic untuk action "adminGetCustomerDetail" di router
// /api/workspace. Dipanggil halaman admin saat admin klik satu pelanggan
// dari daftar (listCustomers.ts) -- mengumpulkan SEMUA jejak pelanggan itu
// di platform dalam satu response: profil (+ status online/offline, lokasi
// kasar, perangkat terakhir), tiap bisnis yang mereka buat (+ langganan/
// pembayaran + hasil wizard/analisa + aktivitas workspace + catatan manual
// admin), draft wizard yang belum/tidak pernah login, pesan kontak yang
// mereka kirim, dan ESTIMASI kasar biaya API yang mereka pakai (lihat
// catatan konstanta biaya di bawah -- ini perkiraan, BUKAN pencatatan
// token/biaya asli per panggilan, karena itu belum diinstrumentasi di
// seluruh titik panggilan AI).
//
// Baca-saja. Otorisasi lewat sesi admin TERPISAH dari Supabase Auth (lihat
// services/admin/auth/requireAdminSession.ts).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";
import { parseDevice } from "./parseDevice.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

// Perkiraan biaya rata-rata per panggilan AI, dalam Rupiah -- ANGKA KASAR
// (belum ada pencatatan token/biaya asli per panggilan di platform ini).
// Dasar perkiraan: chat Beemo & keputusan (proposeDecision) rata-rata
// panggilan Claude ukuran sedang; analisa/baseline report jauh lebih berat
// (prompt + output lebih panjang). Sesuaikan angka ini kapan saja kalau
// mau lebih akurat -- tidak mempengaruhi data lain di platform.
const ASSUMED_COST_PER_CHAT_MESSAGE_IDR = 150;
const ASSUMED_COST_PER_DECISION_IDR = 300;
const ASSUMED_COST_PER_ANALYSIS_IDR = 1000;
// Referensi Pelanggan Baru (Juli 2026) — Claude + web_search per klik
// "Cari Referensi Baru", lebih berat dari chat biasa (sampai 8x panggilan
// web search per batch) tapi lebih ringan dari analisa baseline penuh.
// Dihitung PER BATCH (bukan per baris lead) — lihat catatan batch_id di
// migrations/2026-07-15g_lead_referrals.sql soal kenapa.
const ASSUMED_COST_PER_LEAD_BATCH_IDR = 600;

export async function adminGetCustomerDetail(adminToken: string | undefined, payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }

  const customerId = payload.customerId;
  if (!customerId || typeof customerId !== "string") {
    return { status: 400, body: { error: "customerId wajib diisi" } };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, created_at, role, last_seen_at, last_ip, last_user_agent, last_geo_city, last_geo_country")
    .eq("id", customerId)
    .maybeSingle();

  if (profileError || !profile) {
    return { status: 404, body: { error: "Pelanggan tidak ditemukan." } };
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("business_profiles")
    .select("id, business_name, industry, business_stage, business_type, phone_number, active, created_at")
    .eq("user_id", customerId)
    .order("created_at", { ascending: false });

  if (businessesError) {
    console.error("adminGetCustomerDetail businesses error:", businessesError);
    return { status: 500, body: { error: "Gagal memuat data bisnis pelanggan." } };
  }

  const businessIds = (businesses || []).map((b) => b.id);
  const emailKey = (profile.email || "").trim();

  const [
    { data: subs, error: subsError },
    { data: payments, error: paymentsError },
    { data: analyses, error: analysesError },
    { data: updates, error: updatesError },
    { data: drafts, error: draftsError },
    { data: contactMessages, error: contactError },
    { data: notes, error: notesError },
    { data: leads, error: leadsError },
  ] = await Promise.all([
    businessIds.length
      ? supabase
          .from("subscriptions")
          .select("business_profile_id, tier, status, started_at, expires_at, chat_message_count, decision_count")
          .in("business_profile_id", businessIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? supabase
          .from("payments")
          .select("business_profile_id, tier, status, created_at")
          .in("business_profile_id", businessIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? supabase
          .from("analyses")
          .select("id, business_profile_id, raw_input, ai_output, is_baseline, created_at")
          .in("business_profile_id", businessIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    businessIds.length
      ? supabase
          .from("business_updates")
          .select(
            "id, business_profile_id, content, pencapaian, tantangan, kondisi_penjualan, omset_value, pelanggan_baru, target_depan, category, severity, created_at"
          )
          .in("business_profile_id", businessIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
    // Filter kecocokan email dilakukan di JS (bukan lewat operator jsonb
    // path ->> di query) supaya tidak bergantung pada sintaks PostgREST yang
    // belum pernah dipakai/diuji di codebase ini untuk kolom JSONB --
    // wizard_drafts belum besar di tahap ini, jadi ambil batch terbaru lalu
    // saring di JS (sama seperti pendekatan cocokkan email di
    // promoteDraft.ts) lebih aman daripada menebak sintaks query.
    emailKey
      ? supabase
          .from("wizard_drafts")
          .select("id, wizard_data, status, created_at, promoted_at")
          .order("created_at", { ascending: false })
          .limit(300)
      : Promise.resolve({ data: [], error: null }),
    emailKey
      ? supabase
          .from("contact_messages")
          .select("id, name, email, message, status, created_at")
          .ilike("email", emailKey)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    // Catatan manual admin (migrations/2026-07-15e_admin_business_notes.sql)
    // -- "kalau tidak relevan, saya bisa screenshot pelanggan, lalu paste
    // disini agar kita bisa menyelesaikannya secara manual".
    businessIds.length
      ? supabase
          .from("admin_business_notes")
          .select("id, business_profile_id, note, image_data_url, created_by_email, created_at")
          .in("business_profile_id", businessIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    // Referensi Pelanggan Baru (Juli 2026) — "referensi pelanggan pun harus
    // masuk dan terkorelasi di halaman super admin ya" (permintaan pemilik
    // produk). Baca-saja, sama seperti seluruh endpoint ini.
    businessIds.length
      ? supabase
          .from("business_lead_recommendations")
          .select("id, business_profile_id, batch_id, lead_type, name, description, address, source_url, generated_at")
          .in("business_profile_id", businessIds)
          .order("generated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (subsError || paymentsError || analysesError || updatesError || draftsError || contactError || notesError || leadsError) {
    console.error(
      "adminGetCustomerDetail error:",
      subsError || paymentsError || analysesError || updatesError || draftsError || contactError || notesError || leadsError
    );
    return { status: 500, body: { error: "Gagal memuat detail pelanggan." } };
  }

  const businessesWithData = (businesses || []).map((b) => ({
    ...b,
    // Kolom sebenarnya di business_profiles adalah "active" (bukan
    // "is_archived") -- dibalik di sini supaya bentuk response untuk
    // AdminPage.tsx tetap sama (is_archived: true kalau bisnis ini
    // di-nonaktifkan/archive oleh pemiliknya).
    is_archived: b.active === false,
    subscriptions: (subs || []).filter((s) => s.business_profile_id === b.id),
    payments: (payments || []).filter((p) => p.business_profile_id === b.id),
    analyses: (analyses || []).filter((a) => a.business_profile_id === b.id),
    updates: (updates || []).filter((u) => u.business_profile_id === b.id),
    notes: (notes || []).filter((n) => n.business_profile_id === b.id),
    leadReferrals: (leads || []).filter((l) => l.business_profile_id === b.id),
  }));

  const normalizedEmail = emailKey.toLowerCase();
  const matchingDrafts = (drafts || [])
    .filter((d) => {
      const wizardData = d.wizard_data as Record<string, unknown> | null;
      const draftEmail = typeof wizardData?.email === "string" ? wizardData.email.trim().toLowerCase() : "";
      return draftEmail && draftEmail === normalizedEmail;
    })
    .slice(0, 20);

  // Estimasi kasar biaya API (lihat catatan konstanta di atas file ini).
  const totalChatMessages = (subs || []).reduce((sum, s) => sum + (s.chat_message_count || 0), 0);
  const totalDecisions = (subs || []).reduce((sum, s) => sum + (s.decision_count || 0), 0);
  const totalAnalyses = (analyses || []).length;
  // Dihitung per BATCH (satu klik "Cari Referensi Baru" = satu batch_id),
  // bukan per baris lead -- satu batch bisa berisi beberapa lead dari satu
  // panggilan Claude+web_search yang sama.
  const totalLeadBatches = new Set((leads || []).map((l) => l.batch_id)).size;
  const estimatedApiCostIdr =
    totalChatMessages * ASSUMED_COST_PER_CHAT_MESSAGE_IDR +
    totalDecisions * ASSUMED_COST_PER_DECISION_IDR +
    totalAnalyses * ASSUMED_COST_PER_ANALYSIS_IDR +
    totalLeadBatches * ASSUMED_COST_PER_LEAD_BATCH_IDR;

  const isOnline = !!profile.last_seen_at && Date.now() - new Date(profile.last_seen_at).getTime() < ONLINE_THRESHOLD_MS;

  return {
    status: 200,
    body: {
      role: session.role,
      profile: {
        ...profile,
        isOnline,
        lastLocation: [profile.last_geo_city, profile.last_geo_country].filter(Boolean).join(", ") || null,
        lastDevice: parseDevice(profile.last_user_agent),
      },
      businesses: businessesWithData,
      wizardDrafts: matchingDrafts,
      contactMessages: contactMessages || [],
      usageEstimate: {
        totalChatMessages,
        totalDecisions,
        totalAnalyses,
        totalLeadBatches,
        estimatedApiCostIdr,
        isEstimate: true,
      },
    },
  };
}
