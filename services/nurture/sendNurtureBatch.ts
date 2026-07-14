// services/nurture/sendNurtureBatch.ts
//
// Dipanggil dari cron (api/cron/generate-expiry-reports.ts, lewat query
// ?job=nurture -- menumpang di cron yang sudah ada, lihat catatan di
// migrations/2026-07-15f_nurture_emails.sql soal kenapa tidak dibuat
// endpoint cron terpisah).
//
// JADWAL (permintaan pemilik produk, persis): H+1 dari pertama kali mereka
// mengisi email di chat wizard, lalu setiap 30 hari sesudahnya (H+1, H+31,
// H+61, dst -- dihitung dari waktu wizard PERTAMA mereka, bukan dari
// pengiriman terakhir, supaya jadwalnya tetap konsisten meski satu batch
// cron pernah terlewat sehari). Isi pesan tetap dipersonalisasi dari
// wizard TERBARU mereka (tantangan/harapan bisa berubah kalau mereka isi
// ulang) -- jadi "anchor" (jadwal) dan "persona" (isi) sengaja diambil dari
// dua baris wizard_drafts yang bisa berbeda untuk email yang sama.
//
// Ambil SEMUA email unik yang pernah mengisi wizard (wizard_drafts --
// dipakai untuk SEMUA orang baik yang lanjut jadi akun maupun cuma coba
// preview gratis), saring yang sudah waktunya dikirimi & belum berhenti
// langganan, lalu kirim maksimal MAX_PER_RUN email personal per pemanggilan
// cron (jaga biaya Claude+durasi function per hari -- diprioritaskan yang
// PALING TERLAMBAT dari jadwalnya kalau ada lebih banyak yang jatuh tempo
// daripada MAX_PER_RUN dalam satu hari).
//
// Non-fatal per baris: satu pelanggan gagal (Claude/Resend error) TIDAK
// menghentikan batch, cuma dihitung sebagai error dan lanjut ke berikutnya.

import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { buildNurtureMessage, type NurturePersona } from "./buildNurtureMessage.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const FIRST_SEND_DAY = 1; // H+1
const REPEAT_EVERY_DAYS = 30;
const MAX_PER_RUN = 20;
const WIZARD_SCAN_LIMIT = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// Jaga-jaga kalau cron kebetulan terpicu dua kali di hari yang sama --
// jangan kirim dobel ke orang yang sama dalam satu hari.
const SAME_DAY_SAFETY_MS = 20 * 60 * 60 * 1000;

type Candidate = {
  email: string;
  persona: NurturePersona;
  anchorAt: number; // waktu wizard draft PERTAMA mereka (ms epoch)
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

  // drafts diurutkan TERBARU dulu -- kemunculan PERTAMA suatu email saat
  // iterasi berarti itu wizard TERBARU-nya (dipakai untuk isi pesan/persona).
  // anchorAt (jadwal H+1/30 hari) tetap harus PALING AWAL, jadi terus
  // diperbarui ke nilai terkecil selama iterasi lanjut menemukan baris lama.
  const personaByEmail = new Map<string, NurturePersona>();
  const anchorByEmail = new Map<string, number>();

  for (const d of drafts || []) {
    const wd = d.wizard_data as Record<string, unknown> | null;
    const email = typeof wd?.email === "string" ? wd.email.trim().toLowerCase() : "";
    if (!email) continue;

    if (!personaByEmail.has(email)) {
      personaByEmail.set(email, {
        nama: typeof wd?.nama === "string" ? wd.nama : "",
        namaBisnis: typeof wd?.namaBisnis === "string" ? wd.namaBisnis : "",
        jenisBisnis: typeof wd?.jenisBisnis === "string" ? wd.jenisBisnis : "",
        jenisAnalisis: typeof wd?.jenisAnalisis === "string" ? wd.jenisAnalisis : "",
        tantangan: typeof wd?.tantangan === "string" ? wd.tantangan : "",
        target: typeof wd?.target === "string" ? wd.target : "",
      });
    }

    const createdMs = new Date(d.created_at as string).getTime();
    const prevAnchor = anchorByEmail.get(email);
    if (prevAnchor === undefined || createdMs < prevAnchor) {
      anchorByEmail.set(email, createdMs);
    }
  }

  const candidates: Candidate[] = Array.from(personaByEmail.entries()).map(([email, persona]) => ({
    email,
    persona,
    anchorAt: anchorByEmail.get(email)!,
  }));

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

  // dueDay untuk pengiriman ke-N (N = send_count, 0-based): 1, 31, 61, 91...
  function dueDayFor(sendCount: number): number {
    return FIRST_SEND_DAY + REPEAT_EVERY_DAYS * sendCount;
  }

  const withOverdue = candidates
    .map((c) => {
      const row = sendRowByEmail.get(c.email);
      if (row?.unsubscribed) return null;
      if (row?.last_sent_at && Date.now() - new Date(row.last_sent_at as string).getTime() < SAME_DAY_SAFETY_MS) return null;

      const sendCount = row?.send_count || 0;
      const dueDay = dueDayFor(sendCount);
      const daysSinceAnchor = (Date.now() - c.anchorAt) / DAY_MS;
      const overdueDays = daysSinceAnchor - dueDay;
      if (overdueDays < 0) return null;

      return { candidate: c, overdueDays };
    })
    .filter((x): x is { candidate: Candidate; overdueDays: number } => x !== null);

  // Kalau yang jatuh tempo hari ini lebih banyak dari MAX_PER_RUN,
  // dahulukan yang PALING TERLAMBAT dari jadwalnya.
  withOverdue.sort((a, b) => b.overdueDays - a.overdueDays);

  const batch = withOverdue.slice(0, MAX_PER_RUN).map((x) => x.candidate);
  const apiKey = process.env.RESEND_API_KEY;
  // Audit Juli 2026 ("apakah noreply@... mengganggu login users?"): sengaja
  // TIDAK memakai RESEND_FROM_EMAIL yang sama dengan email verifikasi admin
  // -- dipisah lewat env var sendiri (NURTURE_FROM_EMAIL, mis.
  // "inspirasi@thehive-bisnis.com") supaya reputasi pengiriman email
  // marketing/dorongan ini TIDAK bercampur dengan email transaksional
  // penting (verifikasi admin, dst). Login pelanggan sendiri sama sekali
  // tidak lewat sini -- itu dikirim Supabase Auth lewat SMTP terpisah,
  // tidak tersentuh oleh perubahan ini. Fallback ke RESEND_FROM_EMAIL kalau
  // NURTURE_FROM_EMAIL belum sempat diset, supaya fitur ini tidak mati
  // total sebelum env var barunya ditambahkan.
  const fromEmail = process.env.NURTURE_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;

  let sent = 0;
  let errors = 0;

  for (const c of batch) {
    try {
      if (!apiKey || !fromEmail) {
        console.error("sendNurtureBatch: RESEND_API_KEY/NURTURE_FROM_EMAIL (atau RESEND_FROM_EMAIL) belum diset.");
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
          subject: "The Hive Business Wisdom",
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

  return { sent, skipped: withOverdue.length - batch.length, errors, candidates: candidates.length };
}
