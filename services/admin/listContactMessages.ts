// services/admin/listContactMessages.ts
//
// Business logic untuk action "adminListContactMessages" di router
// /api/workspace. Menampilkan SEMUA pesan dari form kontak publik (#kontak,
// lihat migrations/2026-07-15_contact_messages.sql) di halaman admin,
// terbaru dulu -- supaya pemilik produk tidak perlu buka Supabase Table
// Editor untuk memantau pesan masuk.
//
// Baca-saja. Otorisasi lewat sesi admin TERPISAH dari Supabase Auth (lihat
// services/admin/auth/requireAdminSession.ts).

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminSession } from "./auth/requireAdminSession.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function adminListContactMessages(adminToken: string | undefined, _payload: Record<string, unknown>): Promise<ServiceResult> {
  const session = await requireAdminSession(adminToken);
  if (!session) {
    return { status: 403, body: { error: "Sesi admin tidak valid atau sudah kedaluwarsa. Silakan login ulang." } };
  }

  const { data: messages, error } = await supabase
    .from("contact_messages")
    .select("id, name, email, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("adminListContactMessages error:", error);
    return { status: 500, body: { error: "Gagal memuat pesan kontak." } };
  }

  return { status: 200, body: { role: session.role, messages: messages || [] } };
}
