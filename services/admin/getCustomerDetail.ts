// services/admin/getCustomerDetail.ts
//
// Business logic untuk action "adminGetCustomerDetail" di router
// /api/workspace. Dipanggil halaman #admin saat admin klik satu pelanggan
// dari daftar (listCustomers.ts) -- mengumpulkan SEMUA jejak pelanggan itu
// di platform dalam satu response: profil, tiap bisnis yang mereka buat
// (+ langganan/pembayaran + hasil wizard/analisa + aktivitas workspace),
// draft wizard yang belum/tidak pernah login, dan pesan kontak yang mereka
// kirim.
//
// Baca-saja. Semua role admin ('admin' & 'super_admin') boleh panggil ini.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminRole } from "./requireAdminRole.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function adminGetCustomerDetail(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const role = await requireAdminRole(userId);
  if (!role) {
    return { status: 403, body: { error: "Kamu tidak punya akses ke halaman ini." } };
  }

  const customerId = payload.customerId;
  if (!customerId || typeof customerId !== "string") {
    return { status: 400, body: { error: "customerId wajib diisi" } };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, created_at, role")
    .eq("id", customerId)
    .maybeSingle();

  if (profileError || !profile) {
    return { status: 404, body: { error: "Pelanggan tidak ditemukan." } };
  }

  const { data: businesses, error: businessesError } = await supabase
    .from("business_profiles")
    .select("id, business_name, industry, business_stage, business_type, phone_number, is_archived, created_at")
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
  ]);

  if (subsError || paymentsError || analysesError || updatesError || draftsError || contactError) {
    console.error(
      "adminGetCustomerDetail error:",
      subsError || paymentsError || analysesError || updatesError || draftsError || contactError
    );
    return { status: 500, body: { error: "Gagal memuat detail pelanggan." } };
  }

  const businessesWithData = (businesses || []).map((b) => ({
    ...b,
    subscriptions: (subs || []).filter((s) => s.business_profile_id === b.id),
    payments: (payments || []).filter((p) => p.business_profile_id === b.id),
    analyses: (analyses || []).filter((a) => a.business_profile_id === b.id),
    updates: (updates || []).filter((u) => u.business_profile_id === b.id),
  }));

  const normalizedEmail = emailKey.toLowerCase();
  const matchingDrafts = (drafts || [])
    .filter((d) => {
      const wizardData = d.wizard_data as Record<string, unknown> | null;
      const draftEmail = typeof wizardData?.email === "string" ? wizardData.email.trim().toLowerCase() : "";
      return draftEmail && draftEmail === normalizedEmail;
    })
    .slice(0, 20);

  return {
    status: 200,
    body: {
      role,
      profile,
      businesses: businessesWithData,
      wizardDrafts: matchingDrafts,
      contactMessages: contactMessages || [],
    },
  };
}
