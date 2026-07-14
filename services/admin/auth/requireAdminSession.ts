// services/admin/auth/requireAdminSession.ts
//
// SATU-SATUNYA tempat yang boleh memutuskan "apakah x-admin-token ini sah".
// Semua action admin* (SELAIN 3 langkah login itu sendiri -- requestChallenge/
// verifyEmailToken/verifyPin) WAJIB panggil ini dulu. TIDAK ADA hubungan
// apapun dengan Supabase Auth/JWT pelanggan -- sesi admin sepenuhnya berdiri
// sendiri (tabel admin_sessions), sesuai directive "pisahkan halaman super
// admin ini dari users, atau hackers".
//
// Role SENGAJA dibaca ULANG dari profiles setiap panggilan (bukan cuma
// dipercaya dari admin_sessions.role yang direkam saat login) -- supaya
// kalau role dicabut di tengah sesi yang masih berjalan (mis. pemilik
// produk menurunkan seorang admin jadi 'user'), efeknya LANGSUNG berlaku
// di panggilan berikutnya, bukan menunggu sesi 12 jam itu habis sendiri.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export type AdminSessionInfo = { email: string; role: "admin" | "super_admin" };

export async function requireAdminSession(adminToken: string | undefined): Promise<AdminSessionInfo | null> {
  if (!adminToken) return null;

  const { data: session, error } = await supabase
    .from("admin_sessions")
    .select("email, expires_at")
    .eq("id", adminToken)
    .maybeSingle();

  if (error || !session) return null;
  if (new Date(session.expires_at as string).getTime() < Date.now()) {
    // Kedaluwarsa -- buang sekalian, tidak perlu menunggu proses beres-beres
    // terpisah untuk sesi yang sudah pasti tidak akan dipakai lagi.
    await supabase.from("admin_sessions").delete().eq("id", adminToken);
    return null;
  }

  const { data: profile } = await supabase.from("profiles").select("role").ilike("email", session.email as string).maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return null;
  }

  return { email: session.email as string, role: profile.role };
}
