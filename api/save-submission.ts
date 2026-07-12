// api/save-submission.ts
//
// Serverless function (Vercel, Node.js runtime — konsisten dengan
// generate-preview.ts/generate-report.ts) — dipanggil frontend setiap kali
// pelanggan menyelesaikan wizard (preview gratis). Menyimpan wizard_data +
// hasil preview ke tabel `wizard_drafts` — TIDAK ke `analyses` lagi.
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

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp } from "../services/rateLimit/checkRateLimit.js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Audit red-team Juli 2026: endpoint anonim ini tidak memanggil Claude
  // (bukan risiko biaya API), tapi tetap tanpa batas bisa dipakai untuk
  // membanjiri tabel wizard_drafts dengan baris sampah (storage abuse).
  // 15x/10 menit per IP cukup longgar untuk pengguna sah (dipanggil sekali
  // di akhir wizard setiap kali preview selesai dibuat).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`save-submission:${ip}`, 15, 600);
  if (!rl.allowed) {
    return res.status(429).json({ error: "Terlalu banyak permintaan dari perangkat ini. Coba lagi beberapa saat lagi." });
  }

  try {
    const { wizardData, preview, lang } = req.body;

    if (!wizardData || typeof wizardData !== "object") {
      return res.status(400).json({ error: "wizardData wajib diisi" });
    }

    const required = ["email", "nama", "noHp", "jenisAnalisis", "profesi", "namaBisnis", "jenisBisnis", "produkJasa", "lokasi", "tantangan", "target"];
    for (const field of required) {
      if (!wizardData[field] || typeof wizardData[field] !== "string") {
        return res.status(400).json({ error: `Field ${field} wajib diisi` });
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
      return res.status(500).json({ error: "Gagal menyimpan data" });
    }

    return res.status(200).json({ id: data.id });
  } catch (error) {
    console.error("save-submission error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan server" });
  }
}
