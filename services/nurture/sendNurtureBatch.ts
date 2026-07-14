// services/nurture/sendNurtureBatch.ts
//
// Dipanggil dari cron (api/cron/generate-expiry-reports.ts, lewat query
// ?job=nurture -- menumpang di cron yang sudah ada, lihat catatan di
// migrations/2026-07-15f_nurture_emails.sql soal kenapa tidak dibuat
// endpoint cron terpisah).
//
// Alur: ambil SEMUA email unik yang pernah mengisi wizard (wizard_drafts --
// sumber tunggal "email + tantangan + harapan", dipakai untuk SEMUA orang
// baik yang lanjut jadi akun maupun cuma coba preview gratis), saring yang
// belum lama dikirimi (minimal 15 hari sejak terakhir -- kira-kira 1-2x per
// bulan) dan belum berhenti langganan, lalu kirim maksimal MAX_PER_RUN email
// personal per pemanggilan cron (dijaga supaya biaya Claude+durasi function
// per hari tetap terkendali -- sisanya otomatis kebagian di hari-hari
// berikutnya, diprioritaskan yang PALING LAMA belum pernah/terakhir dikirimi).
//
// Non-fatal per baris: satu pelanggan gagal (Claude/Resend error) TIDAK
// menghentikan batch, cuma dihitung sebagai error dan lanjut ke berikutnya.

import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { buildNurtureMessage, type NurturePersona } from "./buildNurtureMessage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const MIN_GAP_DAYS = 15;
const MAX_PER_RUN = 20;
const WIZARD_SCAN_LIMIT = 1000;

type Candidate = {
  email: string;
  persona: NurturePersona;
};

function buildEmailHtml(bodyText: string, unsubscribeUrl: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<!DOCTYPE html>
<html>
  <body style="font-family: Georgia, 'Times New Roman', serif; background:#faf7f2; color:#2b2b2b; padding:32px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #eee;">
      <p style="font-size:12px;color:#a3a3a3;margin:0 0 16px;letter-spacing:0.05em;">THE HIVE</p>
      <div style="font-size:15px;line-height:1.7;color:#333;">${paragraphs}</div>
      <p style="margin-top:28px;font-size:11px;color:#bbb;">
        Kamu menerima email ini karena pernah mengisi wizard THE HIVE.
        <a href="${unsubscribeUrl}" style="color:#999;">Berhenti menerima email seperti ini</a>.
      </p>
    </div>
  </body>
</html>`;
}

export async function sendNurtureBatch(): Promise<{ sent: number; skipped: number; errors: number; candidates: number }> {
  const { data: drafts, error: draftsError } = await supabase
    .from("wizard_drafts")
    .select("wizard_data, created_at")
    .order("created_at", { ascending: false })
    .limit(WIZARD_SCAN_LIMIT);

  if (draftsError) {
    console.error("sendNurtureBatch: gagal memuat wizard_drafts:", draftsError);
    return { sent: 0, skipped: 0, errors: 1, candidates: 0 };
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const d of drafts || []) {
    const wd = d.wizard_data as Record<string, unknown> | null;
    const email = typeof wd?.email === "string" ? wd.email.trim().toLowerCase() : "";
    if (!email || seen.has(email)) continue;
    seen.add(email);
    candidates.push({
      email,
      persona: {
        nama: typeof wd?.nama === "string" ? wd.nama : "",
        namaBisnis: typeof wd?.namaBisnis === "string" ? wd.namaBisnis : "",
        jenisBisnis: typeof wd?.jenisBisnis === "string" ? wd.jenisBisnis : "",
        jenisAnalisis: typeof wd?.jenisAnalisis === "string" ? wd.jenisAnalisis : "",
        tantangan: typeof wd?.tantangan === "string" ? wd.tantangan : "",
        target: typeof wd?.target === "string" ? wd.target : "",
      },
    });
  }

  if (candidates.length === 0) return { sent: 0, skipped: 0, errors: 0, candidates: 0 };

  const emails = candidates.map((c) => c.email);
  const { data: sendRows, error: sendRowsError } = await supabase
    .from("nurture_email_sends")
    .select("email, last_sent_at, send_count, unsubscribed, unsubscribe_token")
    .in("email", emails);

  if (sendRowsError) {
    console.error("sendNurtureBatch: gagal memuat nurture_email_sends:", sendRowsError);
    return { sent: 0, skipped: 0, errors: 1, candidates: candidates.length };
  }

  const sendRowByEmail = new Map((sendRows || []).map((r) => [r.email, r]));
  const minGapMs = MIN_GAP_DAYS * 24 * 60 * 60 * 1000;

  const eligible = candidates.filter((c) => {
    const row = sendRowByEmail.get(c.email);
    if (!row) return true;
    if (row.unsubscribed) return false;
    if (!row.last_sent_at) return true;
    return Date.now() - new Date(row.last_sent_at as string).getTime() >= minGapMs;
  });

  // Prioritaskan yang PALING LAMA/tidak pernah dikirimi (rotasi adil antar
  // hari cron, bukan selalu email yang sama duluan tiap batch).
  eligible.sort((a, b) => {
    const ra = sendRowByEmail.get(a.email)?.last_sent_at;
    const rb = sendRowByEmail.get(b.email)?.last_sent_at;
    const ta = ra ? new Date(ra as string).getTime() : 0;
    const tb = rb ? new Date(rb as string).getTime() : 0;
    return ta - tb;
  });

  const batch = eligible.slice(0, MAX_PER_RUN);
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  let sent = 0;
  let errors = 0;

  for (const c of batch) {
    try {
      if (!apiKey || !fromEmail) {
        console.error("sendNurtureBatch: RESEND_API_KEY/RESEND_FROM_EMAIL belum diset.");
        errors++;
        continue;
      }

      const messageText = await buildNurtureMessage(c.persona);
      if (!messageText) {
        errors++;
        continue;
      }

      const existingRow = sendRowByEmail.get(c.email);
      const unsubscribeToken = (existingRow?.unsubscribe_token as string | undefined) || randomBytes(24).toString("hex");
      const unsubscribeUrl = `https://thehive-bisnis.com/?unsub=${unsubscribeToken}`;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromEmail,
          to: [c.email],
          subject: "Sedikit kabar dari THE HIVE untukmu",
          html: buildEmailHtml(messageText, unsubscribeUrl),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("sendNurtureBatch: Resend gagal mengirim ke", c.email, res.status, errText);
        errors++;
        continue;
      }

      await supabase.from("nurture_email_sends").upsert({
        email: c.email,
        last_sent_at: new Date().toISOString(),
        send_count: (existingRow?.send_count || 0) + 1,
        unsubscribed: false,
        unsubscribe_token: unsubscribeToken,
      });

      sent++;
    } catch (err) {
      console.error("sendNurtureBatch: gagal memproses", c.email, err);
      errors++;
    }
  }

  return { sent, skipped: eligible.length - batch.length, errors, candidates: candidates.length };
}
