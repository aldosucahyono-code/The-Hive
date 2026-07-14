// services/admin/listContactMessages.ts
//
// Business logic untuk action "adminListContactMessages" di router
// /api/workspace. Menampilkan SEMUA pesan dari form kontak publik (#kontak,
// lihat migrations/2026-07-15_contact_messages.sql) di halaman #admin,
// terbaru dulu -- supaya pemilik produk tidak perlu buka Supabase Table
// Editor untuk memantau pesan masuk.
//
// Baca-saja. Semua role admin ('admin' & 'super_admin') boleh panggil ini.

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { requireAdminRole } from "./requireAdminRole.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function adminListContactMessages(userId: string, _payload: Record<string, unknown>): Promise<ServiceResult> {
  const role = await requireAdminRole(userId);
  if (!role) {
    return { status: 403, body: { error: "Kamu tidak punya akses ke halaman ini." } };
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

  return { status: 200, body: { role, messages: messages || [] } };
}
