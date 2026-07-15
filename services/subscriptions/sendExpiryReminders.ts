// services/subscriptions/sendExpiryReminders.ts
//
// Dipanggil dari cron (api/cron/generate-expiry-reports.ts, lewat query
// ?job=expiry-reminder -- menumpang di cron yang sudah ada, pola SAMA
// dengan ?job=nurture, lihat catatan panjang di header file itu soal kenapa
// tidak dibuat endpoint cron terpisah/Vercel Serverless Function baru).
//
// Permintaan pemilik produk (Juli 2026): "ketika waktu users tinggal
// sedikit (h-2) dari waktu habis, email aktif mengirimkan push bahwa waktu
// langganan akan habis... isi email segera lakukan perpanjangan... khususnya
// di pro dan platinum. jadi tidak sampai habis/kehabisan waktu sehingga
// users downgrade ke gratis, karena itu akan mempengaruhi flow pdf yang
// mereka kerjakan/generate."
//
// H-2 PERSIS (BUKAN jendela notifikasi in-app 7 hari yang sudah ada di
// services/notifications/getNotifications.ts -- itu mekanisme TERPISAH,
// tetap dipertahankan apa adanya): baris subscription yang expires_at jatuh
// dalam <=2x24 jam dari sekarang DAN belum pernah dikirimi reminder untuk
// SIKLUS INI (expiry_reminder_sent_at masih null -- kolom ini di-reset
// otomatis setiap kali ada baris subscription BARU dibuat lewat pembayaran,
// karena baris lama di-expire dan baris baru selalu mulai dengan kolom ini
// null, lihat api/notification-handler.ts).
//
// Sender: NURTURE_FROM_EMAIL (fallback RESEND_FROM_EMAIL) -- REUSE env var
// yang SUDAH diverifikasi pemilik produk untuk nurture email, BUKAN env var
// baru, supaya tidak mengganggu flow yang sudah berjalan ("yang penting
// tidak mengganggu flow kita" -- instruksi eksplisit soal pemilihan
// pengirim).
//
// Non-fatal per baris: satu pelanggan gagal (Resend error/dsb) TIDAK
// menghentikan batch.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const REMINDER_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // H-2
const UPGRADE_URL = "https://thehive-bisnis.com/?upgrade=1";

type ReminderRow = {
  id: string;
  business_profile_id: string;
  tier: string;
  expires_at: string;
};

function buildHtml(businessName: string, tier: string, expiresAt: string, lang: "id" | "en"): string {
  const L = lang === "id";
  const expiryLabel = new Date(expiresAt).toLocaleDateString(L ? "id-ID" : "en-US", { day: "numeric", month: "long", year: "numeric" });
  const tierLabel = tier === "platinum" ? "PLATINUM" : "PRO";
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#0b0b0f; color:#e5e5e5; padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#16161d;border-radius:16px;padding:32px;border:1px solid rgba(255,255,255,0.08);">
      <p style="font-size:13px;color:#a3a3a3;margin:0 0 4px;">THE HIVE</p>
      <h1 style="font-size:20px;margin:0 0 16px;color:#fff;">
        ${L ? `Langganan ${tierLabel} ${businessName} akan berakhir ${expiryLabel}` : `Your ${tierLabel} plan for ${businessName} ends ${expiryLabel}`}
      </h1>
      <p style="font-size:14px;line-height:1.6;color:#d4d4d4;">
        ${
          L
            ? `Tinggal 2 hari lagi sebelum akses ${tierLabel} kamu berakhir. Kalau tidak diperpanjang, akun otomatis turun ke paket Gratis -- termasuk akses ke laporan PDF yang jadi acuan langkah bisnismu berikutnya.`
            : `Only 2 days left before your ${tierLabel} access ends. If not renewed, your account automatically drops to the Free plan -- including access to the PDF reports that guide your next business steps.`
        }
      </p>
      <div style="margin:24px 0;text-align:center;">
        <a href="${UPGRADE_URL}" style="display:inline-block;background:#fbbf24;color:#0b0b0f;font-weight:800;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:14px;">
          ${L ? "Perpanjang Sekarang" : "Renew Now"}
        </a>
      </div>
      <p style="font-size:12px;color:#a3a3a3;">
        ${L ? "Atau buka thehive-bisnis.com dan masuk ke Workspace-mu seperti biasa." : "Or open thehive-bisnis.com and go to your Workspace as usual."}
      </p>
    </div>
  </body>
</html>`;
}

async function sendReminderEmail(toEmail: string, businessName: string, tier: string, expiresAt: string, lang: "id" | "en"): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.NURTURE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.error("sendExpiryReminders: RESEND_API_KEY/NURTURE_FROM_EMAIL (atau RESEND_FROM_EMAIL) belum diset.");
    return false;
  }
  if (!toEmail) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject:
          lang === "id"
            ? `[Segera Habis] Langganan ${tier === "platinum" ? "PLATINUM" : "PRO"} ${businessName} tinggal 2 hari lagi`
            : `[Expiring Soon] ${tier === "platinum" ? "PLATINUM" : "PRO"} plan for ${businessName} ends in 2 days`,
        html: buildHtml(businessName, tier, expiresAt, lang),
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("sendExpiryReminders: Resend gagal mengirim ke", toEmail, res.status, errText);
      return false;
    }
    return true;
  } catch (err) {
    console.error("sendExpiryReminders: error tak terduga ke", toEmail, err);
    return false;
  }
}

export async function sendExpiryReminders(): Promise<{ sent: number; skipped: number; errors: number; candidates: number }> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString();

  const { data: rows, error } = await supabase
    .from("subscriptions")
    .select("id, business_profile_id, tier, expires_at")
    .eq("status", "active")
    .in("tier", ["pro", "platinum"])
    .is("expiry_reminder_sent_at", null)
    .gte("expires_at", now.toISOString())
    .lte("expires_at", windowEnd);

  if (error) {
    console.error("sendExpiryReminders: gagal memuat subscriptions:", error);
    return { sent: 0, skipped: 0, errors: 1, candidates: 0 };
  }

  const candidates = (rows || []) as ReminderRow[];
  if (candidates.length === 0) return { sent: 0, skipped: 0, errors: 0, candidates: 0 };

  const businessIds = candidates.map((c) => c.business_profile_id);
  const { data: businessRows } = await supabase.from("business_profiles").select("id, business_name, user_id").in("id", businessIds);
  const businessById = new Map((businessRows || []).map((b) => [b.id, b]));
  const userIds = (businessRows || []).map((b) => b.user_id).filter(Boolean);
  const { data: profileRows } = userIds.length ? await supabase.from("profiles").select("id, email").in("id", userIds) : { data: [] as Array<{ id: string; email: string }> };
  const emailByUserId = new Map((profileRows || []).map((p) => [p.id, p.email]));

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const c of candidates) {
    const business = businessById.get(c.business_profile_id);
    const email = business?.user_id ? emailByUserId.get(business.user_id) : null;
    if (!business || !email) {
      skipped++;
      continue;
    }

    const ok = await sendReminderEmail(email, business.business_name, c.tier, c.expires_at, "id");
    if (!ok) {
      errors++;
      continue; // TIDAK menandai terkirim -- coba lagi di run cron berikutnya (masih dalam jendela H-2)
    }

    const { error: updateError } = await supabase.from("subscriptions").update({ expiry_reminder_sent_at: new Date().toISOString() }).eq("id", c.id);
    if (updateError) {
      console.error("sendExpiryReminders: gagal menandai expiry_reminder_sent_at untuk", c.id, updateError);
      errors++;
      continue;
    }
    sent++;
  }

  return { sent, skipped, errors, candidates: candidates.length };
}
