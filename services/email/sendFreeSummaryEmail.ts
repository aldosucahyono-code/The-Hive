// services/email/sendFreeSummaryEmail.ts
//
// Penyelarasan visi funnel lengkap: "ketika users mendapatkan email untuk
// masuk ke workspace: Gratis (ringkasannya bisnisnya, apa tantanganya dan
// apa harapannya)... harapannya dari data yang dianalisa secara gratis,
// user benar-benar yakin untuk memilih ke Pro atau Platinum".
//
// Dipanggil dari api/generate-preview.ts SETELAH preview gratis berhasil
// dibuat — best-effort, TIDAK PERNAH menggagalkan preview kalau email gagal
// terkirim atau provider belum dikonfigurasi (lihat catatan RESEND_API_KEY
// di bawah).
//
// SENGAJA memakai Resend REST API langsung lewat fetch (bukan SDK resend)
// supaya tidak menambah dependency baru hanya untuk satu panggilan HTTP
// sederhana. Kalau nanti mau ganti provider (SendGrid/Postmark/dll), cukup
// ganti isi fungsi ini — pemanggilnya (generate-preview.ts) tidak perlu
// berubah.
//
// PENTING (kredensial pihak ketiga — TIDAK bisa diaktifkan oleh Claude):
// - Butuh akun di https://resend.com (atau provider email lain), lalu buat
//   API key, lalu set di Vercel:
//     RESEND_API_KEY=re_xxxxxxxx
//     RESEND_FROM_EMAIL="THE HIVE <beemo@yourdomain.com>"  (domain pengirim
//     harus sudah diverifikasi di Resend, kalau belum ada domain sendiri
//     Resend menyediakan domain sandbox untuk testing awal).
// - Selama RESEND_API_KEY belum diset, fungsi ini TIDAK error — cukup log
//   peringatan sekali dan return tanpa mengirim apa pun, supaya wizard tetap
//   berjalan normal tanpa fitur email ini.

type FreeSummaryEmailInput = {
  toEmail: string;
  toName: string;
  businessName: string;
  tantangan: string;
  target: string;
  summary: string;
  businessHealthScore: number;
  statusLabel: string;
  lang: "id" | "en";
};

function buildHtml(input: FreeSummaryEmailInput): string {
  const L = input.lang === "id";
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#0b0b0f; color:#e5e5e5; padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#16161d;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
      <p style="font-size:13px;color:#a3a3a3;margin:0 0 4px;">THE HIVE — Beemo AI</p>
      <h1 style="font-size:20px;margin:0 0 16px;color:#fff;">
        ${L ? `Halo ${input.toName}, ini ringkasan gratis untuk ${input.businessName}` : `Hi ${input.toName}, here's your free summary for ${input.businessName}`}
      </h1>
      <p style="font-size:14px;line-height:1.6;color:#d4d4d4;">${input.summary}</p>
      <div style="margin:20px 0;padding:16px;background:rgba(255,255,255,0.04);border-radius:12px;">
        <p style="margin:0 0 6px;font-size:12px;color:#a3a3a3;text-transform:uppercase;">${L ? "Business Score" : "Business Score"}</p>
        <p style="margin:0;font-size:24px;font-weight:800;color:#fff;">${input.businessHealthScore}/100 — ${input.statusLabel}</p>
      </div>
      <p style="font-size:13px;color:#a3a3a3;margin:0 0 4px;">${L ? "Tantangan yang kamu ceritakan:" : "The challenge you shared:"}</p>
      <p style="font-size:14px;color:#d4d4d4;margin:0 0 16px;">${input.tantangan}</p>
      <p style="font-size:13px;color:#a3a3a3;margin:0 0 4px;">${L ? "Harapanmu:" : "Your goal:"}</p>
      <p style="font-size:14px;color:#d4d4d4;margin:0 0 24px;">${input.target}</p>
      <p style="font-size:13px;line-height:1.6;color:#a3a3a3;">
        ${
          L
            ? "Ini baru ringkasan gratis. Beemo bisa mendampingi lebih jauh — analisa kompetitor, langkah prioritas, dan rencana konkret — lewat paket PRO atau PLATINUM."
            : "This is just the free summary. Beemo can go further — competitor analysis, priority steps, and a concrete plan — with the PRO or PLATINUM plan."
        }
      </p>
    </div>
  </body>
</html>`;
}

/** Best-effort, non-fatal: kegagalan di sini TIDAK PERNAH melempar ke
 * pemanggil — cukup log, supaya alur preview gratis tetap jalan normal
 * kalau email provider belum dikonfigurasi/sedang bermasalah. */
export async function sendFreeSummaryEmail(input: FreeSummaryEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.warn(
      "sendFreeSummaryEmail: RESEND_API_KEY/RESEND_FROM_EMAIL belum diset di Vercel — email ringkasan gratis dilewati (tidak fatal)."
    );
    return;
  }

  if (!input.toEmail) {
    console.warn("sendFreeSummaryEmail: toEmail kosong, email dilewati.");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [input.toEmail],
        subject:
          input.lang === "id"
            ? `Ringkasan gratis bisnis ${input.businessName} dari Beemo`
            : `Your free business summary for ${input.businessName} from Beemo`,
        html: buildHtml(input),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("sendFreeSummaryEmail: Resend gagal mengirim:", response.status, errText);
    }
  } catch (err) {
    console.error("sendFreeSummaryEmail: error tak terduga:", err);
  }
}
