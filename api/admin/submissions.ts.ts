// api/admin/submissions.ts
//
// Endpoint KHUSUS ADMIN untuk melihat seluruh riwayat pelanggan.
// Dilindungi kunci rahasia — TIDAK ADA orang lain yang bisa akses tanpa
// tahu kunci ini, termasuk pelanggan sendiri.
//
// ENV VARIABLE tambahan yang perlu di-set di Vercel:
//   ADMIN_SECRET_KEY   (buat sendiri, contoh: string acak panjang)
//
// Cara akses (cuma kamu yang tahu formatnya):
//   https://domainkamu.com/api/admin/submissions?key=KUNCI_RAHASIA_KAMU

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");

  // Cek kunci rahasia — kalau salah/tidak ada, TOLAK MENTAH-MENTAH.
  // Tidak ada celah "hampir benar", harus sama persis.
  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return new Response(JSON.stringify({ error: "Akses ditolak" }), { status: 401 });
  }

  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: "Gagal mengambil data" }), { status: 500 });
  }

  return new Response(JSON.stringify({ submissions: data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
