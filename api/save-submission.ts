// api/save-submission.ts
//
// Serverless function (Vercel) — dipanggil frontend setiap kali pelanggan
// menyelesaikan wizard (preview gratis). Menyimpan wizard_data + hasil
// preview ke tabel `analyses` di Supabase, supaya nanti bisa dikaitkan
// dengan pembayaran (payments.analysis_id) dan riwayat di Workspace.
//
// ENV VARIABLES yang perlu di-set di Vercel (Project Settings → Environment
// Variables), JANGAN PERNAH ditaruh di kode frontend:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (bukan anon key — ini kunci penuh, rahasia)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Kalau user sudah login (kirim header Authorization: Bearer <token>),
 * kaitkan analysis ini ke akun mereka. Kalau belum login (masih anonim,
 * baru coba preview gratis), user_id dibiarkan null — tetap boleh, karena
 * kolom ini nullable di skema `analyses`. */
async function getUserIdFromAuthHeader(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();
    const { wizardData, preview, lang } = body;

    if (!wizardData || typeof wizardData !== "object") {
      return new Response(JSON.stringify({ error: "wizardData wajib diisi" }), { status: 400 });
    }

    const required = ["email", "nama", "jenisAnalisis", "profesi", "namaBisnis", "jenisBisnis", "lokasi", "tantangan", "target"];
    for (const field of required) {
      if (!wizardData[field] || typeof wizardData[field] !== "string") {
        return new Response(JSON.stringify({ error: `Field ${field} wajib diisi` }), { status: 400 });
      }
    }

    const userId = await getUserIdFromAuthHeader(req);

    const { data, error } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        tier: "free",
        wizard_data: { ...wizardData, lang: lang || "id" },
        report_content: preview || null,
        status: "completed",
      })
      .select("id")
      .single();

    if (error) {
      console.error("save-submission insert error:", error);
      return new Response(JSON.stringify({ error: "Gagal menyimpan data" }), { status: 500 });
    }

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("save-submission error:", error);
    return new Response(JSON.stringify({ error: "Terjadi kesalahan server" }), { status: 500 });
  }
}
