// services/admin/listCustomers.ts
//
// Business logic untuk action "adminListCustomers" di router /api/workspace
// (lihat requireAdminRole.ts untuk kenapa file admin/* menumpang di router
// ini alih-alih endpoint terpisah -- batas 12 Serverless Function Vercel
// Hobby sudah tercapai).
//
// Menampilkan SEMUA pelanggan dalam satu daftar ringkas: email, kapan
// daftar, berapa bisnis yang mereka buat, tier tertinggi yang pernah aktif,
// dan berapa pesan kontak yang mereka kirim -- untuk halaman #admin
// (Ringkasan pelanggan). Detail penuh satu pelanggan ada di
// getCustomerDetail.ts, dipanggil terpisah saat admin klik satu baris.
//
// Baca-saja. Semua role admin ('admin' & 'super_admin') boleh panggil ini.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminRole } from "./requireAdminRole.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, platinum: 2 };

export async function adminListCustomers(userId: string, _payload: Record<string, unknown>): Promise<ServiceResult> {
  const role = await requireAdminRole(userId);
  if (!role) {
    return { status: 403, body: { error: "Kamu tidak punya akses ke halaman ini." } };
  }

  const [{ data: profiles, error: profilesError }, { data: businesses, error: businessesError }, { data: activeSubs, error: subsError }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, email, created_at, role").order("created_at", { ascending: false }).limit(500),
      supabase
        .from("business_profiles")
        .select("id, user_id, business_name, business_stage, is_archived, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("business_profile_id, tier, expires_at").eq("status", "active"),
      supabase.from("contact_messages").select("email"),
    ]);

  if (profilesError || businessesError || subsError || messagesError) {
    console.error("adminListCustomers error:", profilesError || businessesError || subsError || messagesError);
    return { status: 500, body: { error: "Gagal memuat daftar pelanggan." } };
  }

  const businessesByUser = new Map<string, typeof businesses>();
  for (const b of businesses || []) {
    const list = businessesByUser.get(b.user_id) || [];
    list.push(b);
    businessesByUser.set(b.user_id, list);
  }

  const activeTierByBusinessId = new Map<string, string>();
  for (const s of activeSubs || []) {
    // Kalau expires_at ada dan sudah lewat, jangan dianggap aktif (mirror
    // logika getActiveMembership.ts) -- daftar ini cuma ringkasan, jadi
    // cukup cek expiry sederhana di sini, bukan panggil getActiveMembership
    // per business (akan jadi N+1 query untuk daftar besar).
    if (s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) continue;
    activeTierByBusinessId.set(s.business_profile_id, s.tier);
  }

  const contactCountByEmail = new Map<string, number>();
  for (const m of messages || []) {
    const key = (m.email || "").trim().toLowerCase();
    if (!key) continue;
    contactCountByEmail.set(key, (contactCountByEmail.get(key) || 0) + 1);
  }

  const customers = (profiles || []).map((p) => {
    const own = businessesByUser.get(p.id) || [];
    let highestTier = "free";
    for (const b of own) {
      const tier = activeTierByBusinessId.get(b.id) || "free";
      if ((TIER_RANK[tier] ?? 0) > (TIER_RANK[highestTier] ?? 0)) highestTier = tier;
    }
    const emailKey = (p.email || "").trim().toLowerCase();

    return {
      id: p.id,
      email: p.email,
      createdAt: p.created_at,
      role: p.role,
      businessCount: own.length,
      latestBusinessName: own[0]?.business_name ?? null,
      highestTier,
      contactMessageCount: contactCountByEmail.get(emailKey) || 0,
    };
  });

  return { status: 200, body: { role, customers } };
}
