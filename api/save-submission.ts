// api/save-submission.ts
//
// Serverless function (Vercel) — dipanggil frontend setiap kali pelanggan
// menyelesaikan wizard (preview gratis). Menyimpan wizard_data + hasil
// preview ke tabel `wizard_drafts` — TIDAK ke `analyses` lagi.
//
// PERUBAHAN PENTING (Tahap 1.5):
// wizard_drafts sengaja berada DI LUAR Domain Model bisnis (business_profiles
// / analyses). Preview gratis harus bisa dicoba tanpa login sama sekali,
// sedangkan analyses & business_profiles di skema baru WAJIB terikat ke
// business_profile_id yang tidak boleh null. Draft ini baru "naik level"
// jadi business_profile + analysis lewat /api/promote-draft, setelah user
// benar-benar login (Aktifkan Workspace).
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

    // Sengaja TIDAK cek token/login di sini. wizard_drafts murni anonim —
    // siapapun (login atau tidak) boleh membuat draft, karena RLS tabel ini
    // menutup akses browser sama sekali (hanya service_role/backend yang
    // boleh insert/select). Keterkaitan ke akun baru dibuat nanti di
    // /api/promote-draft, setelah user login.
    const { data, error } = await supabase
      .from("wizard_drafts")
      .insert({
        wizard_data: { ...wizardData, lang: lang || "id" },
        preview_content: preview || null,
        lang: lang || "id",
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
