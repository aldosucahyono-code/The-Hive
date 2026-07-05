// api/save-submission.ts
//
// Serverless function (Vercel) — dipanggil frontend setiap kali pelanggan
// menyelesaikan wizard. Menyimpan data ke Supabase.
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

    // Validasi dasar — pastikan field wajib memang ada, jangan percaya
    // begitu saja data dari luar (walau sudah divalidasi di frontend,
    // validasi frontend selalu bisa dilewati orang yang jago teknis).
    const required = ["email", "nama", "jenisAnalisis", "profesi", "namaBisnis", "jenisBisnis", "lokasi", "tantangan", "target"];
    for (const field of required) {
      if (!body[field] || typeof body[field] !== "string") {
        return new Response(JSON.stringify({ error: `Field ${field} wajib diisi` }), { status: 400 });
      }
    }

    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        email: body.email,
        nama: body.nama,
        jenis_analisis: body.jenisAnalisis,
        profesi: body.profesi,
        nama_bisnis: body.namaBisnis,
        jenis_bisnis: body.jenisBisnis,
        lokasi: body.lokasi,
        sejak_kapan: body.sejakKapan || null,
        omset_bulanan: body.omsetBulanan || null,
        target_pelanggan: body.targetPelanggan || null,
        tantangan: body.tantangan,
        target: body.target,
        hasil_analisis_gratis: body.hasilAnalisisGratis || null,
        status_pembayaran: "belum_bayar",
        alamat_ip: ip,
        user_agent: userAgent,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(JSON.stringify({ error: "Gagal menyimpan data" }), { status: 500 });
    }

    return new Response(JSON.stringify({ id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("save-submission error:", err);
    return new Response(JSON.stringify({ error: "Terjadi kesalahan server" }), { status: 500 });
  }
}
