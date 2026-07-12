// services/notifications/getNotifications.ts
//
// Lonceng Notifikasi (Juli 2026) — dipanggil dari tombol lonceng yang
// sebelumnya cuma placeholder visual di Workspace.tsx (badge "1" statis,
// tanpa onClick). Daftar notifikasi di sini SENGAJA dihitung ON-THE-FLY
// dari tabel yang SUDAH ADA, bukan dibaca dari tabel "notifications"
// tersendiri — lihat migrations/2026-07-13_notification_reads.sql untuk
// alasan lengkapnya. Lima jenis kejadian yang dianggap layak jadi
// notifikasi:
//   1. Achievement baru ke-unlock (business_achievements)
//   2. Decision Journal baru tersimpan otomatis dari Chat Beemo
//      (business_decisions)
//   3. Laporan PDF baru selesai dibuat (business_reports)
//   4. Masa aktif Pro/Platinum tinggal <=7 hari (subscriptions)
//   5. Pengingat Update Bisnis kalau sudah >=7 hari sejak update terakhir
//      (business_updates, fallback ke business_profiles.created_at kalau
//      belum pernah update sama sekali)
//
// "Belum dibaca" ditentukan dengan membandingkan timestamp tiap notifikasi
// terhadap notification_reads.last_seen_at (lihat markNotificationsSeen.ts).
// Untuk jenis #4 dan #5 yang tidak punya event/timestamp asli, dipakai
// timestamp AMBANG BATAS yang stabil (mis. expiresAt - 7 hari) supaya
// perilaku "baru"/"sudah dibaca"-nya tetap konsisten, bukan berubah setiap
// request karena memakai now().

import { createClient } from "@supabase/supabase-js";
import type { ServiceResult } from "../business/create.js";
import { getActiveMembership } from "../membership/getActiveMembership.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const LOOKBACK_DAYS = 30; // achievement/decision/report lebih lama dari ini tidak relevan lagi sebagai "notifikasi baru"
const MAX_ITEMS = 20;
const SUBSCRIPTION_REMINDER_WINDOW_DAYS = 7;
const UPDATE_REMINDER_AFTER_DAYS = 7;

export type NotificationType = "achievement" | "decision" | "report" | "subscription_expiring" | "update_reminder";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string; // ISO — dipakai urutkan DAN bandingkan terhadap last_seen_at
  unread: boolean;
  // Petunjuk navigasi ringan untuk frontend (menu key di Workspace.tsx) —
  // opsional, null kalau notifikasi ini tidak mengarah ke halaman spesifik.
  menuKey: string | null;
};

function daysBetween(a: number, b: number): number {
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

export async function getNotifications(userId: string, payload: Record<string, unknown>): Promise<ServiceResult> {
  const businessProfileId = payload.businessProfileId;
  if (!businessProfileId || typeof businessProfileId !== "string") {
    return { status: 400, body: { error: "businessProfileId wajib diisi" } };
  }
  const lang: "id" | "en" = payload.lang === "en" ? "en" : "id";
  const id = lang === "id";

  const { data: business, error: bpError } = await supabase
    .from("business_profiles")
    .select("id, user_id, business_name, created_at")
    .eq("id", businessProfileId)
    .single();

  if (bpError || !business || business.user_id !== userId) {
    return { status: 403, body: { error: "Business profile tidak valid untuk akun ini." } };
  }

  const { data: readRow } = await supabase
    .from("notification_reads")
    .select("last_seen_at")
    .eq("business_profile_id", businessProfileId)
    .maybeSingle();

  // Belum pernah buka lonceng sama sekali -> anggap semua notifikasi dalam
  // jendela waktu di bawah ini "belum dibaca" (bukan diam-diam ditandai
  // sudah dibaca sebelum benar-benar dilihat).
  const lastSeenAt = readRow?.last_seen_at ? new Date(readRow.last_seen_at).getTime() : 0;
  const now = Date.now();
  const lookbackCutoff = new Date(now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const items: NotificationItem[] = [];

  // 1. Achievement baru
  type AchievementDefTitleJoin = { title_id: string; title_en: string };
  type AchievementUnlockedRow = {
    unlocked_at: string;
    achievement_definitions: AchievementDefTitleJoin | AchievementDefTitleJoin[] | null;
  };
  const { data: achievementRows } = await supabase
    .from("business_achievements")
    .select("unlocked_at, achievement_definitions(title_id, title_en)")
    .eq("business_profile_id", businessProfileId)
    .gte("unlocked_at", lookbackCutoff)
    .order("unlocked_at", { ascending: false })
    .limit(MAX_ITEMS);

  for (const row of (achievementRows as AchievementUnlockedRow[] | null) || []) {
    const def = Array.isArray(row.achievement_definitions) ? row.achievement_definitions[0] : row.achievement_definitions;
    const title = def ? (id ? def.title_id : def.title_en) : null;
    if (!title) continue;
    items.push({
      id: `achievement-${row.unlocked_at}`,
      type: "achievement",
      title: id ? "🏆 Achievement baru terbuka" : "🏆 New achievement unlocked",
      body: title,
      timestamp: row.unlocked_at,
      unread: new Date(row.unlocked_at).getTime() > lastSeenAt,
      // Achievement ditampilkan di halaman Target & Progres (menu key
      // "target" — lihat MenuKey di src/components/Workspace.tsx, TIDAK
      // ada menu "growth" tersendiri).
      menuKey: "target",
    });
  }

  // 2. Decision Journal baru
  const { data: decisionRows } = await supabase
    .from("business_decisions")
    .select("id, question, conclusion, recommendation, created_at")
    .eq("business_profile_id", businessProfileId)
    .gte("created_at", lookbackCutoff)
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);

  for (const row of decisionRows || []) {
    const summary = row.conclusion || row.recommendation || row.question;
    items.push({
      id: `decision-${row.id}`,
      type: "decision",
      title: id ? "🧭 Keputusan baru tersimpan" : "🧭 New decision saved",
      body: summary,
      timestamp: row.created_at,
      unread: new Date(row.created_at).getTime() > lastSeenAt,
      menuKey: "decisionJournal",
    });
  }

  // 3. Laporan PDF baru
  const { data: reportRows } = await supabase
    .from("business_reports")
    .select("id, report_type, created_at")
    .eq("business_profile_id", businessProfileId)
    .gte("created_at", lookbackCutoff)
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);

  for (const row of reportRows || []) {
    const typeLabel = row.report_type === "baseline" ? (id ? "Laporan Awal" : "Baseline Report") : (id ? "Laporan Berkala" : "Periodic Report");
    items.push({
      id: `report-${row.id}`,
      type: "report",
      title: id ? "📄 Laporan siap diunduh" : "📄 Report ready to download",
      body: typeLabel,
      timestamp: row.created_at,
      unread: new Date(row.created_at).getTime() > lastSeenAt,
      // Final Reports ditampilkan di menu key "history" (label tampilan
      // sudah "Final Reports" sejak Task 13, key internalnya tetap sama).
      menuKey: "history",
    });
  }

  // 4. Masa aktif Pro/Platinum mau habis
  const membership = await getActiveMembership(businessProfileId);
  if (membership.status === "active" && membership.expiresAt) {
    const expiresAtMs = new Date(membership.expiresAt).getTime();
    const daysLeft = daysBetween(expiresAtMs, now);
    if (daysLeft >= 0 && daysLeft <= SUBSCRIPTION_REMINDER_WINDOW_DAYS) {
      const reminderStartMs = expiresAtMs - SUBSCRIPTION_REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      const tierLabel = membership.tier === "platinum" ? "Platinum" : "Pro";
      items.push({
        id: `subscription-expiring-${membership.expiresAt}`,
        type: "subscription_expiring",
        title: id ? `⏳ Masa aktif ${tierLabel} tinggal ${daysLeft} hari` : `⏳ Your ${tierLabel} access ends in ${daysLeft} days`,
        body: id
          ? "Perpanjang supaya fitur premium Workspace-mu tidak terputus."
          : "Renew so your Workspace's premium features don't get interrupted.",
        timestamp: new Date(reminderStartMs).toISOString(),
        unread: reminderStartMs > lastSeenAt,
        menuKey: "settings",
      });
    }
  }

  // 5. Pengingat Update Bisnis
  const { data: latestUpdateRow } = await supabase
    .from("business_updates")
    .select("created_at")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastActivityMs = latestUpdateRow?.created_at
    ? new Date(latestUpdateRow.created_at).getTime()
    : new Date(business.created_at).getTime();
  const reminderAtMs = lastActivityMs + UPDATE_REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000;

  if (reminderAtMs <= now) {
    items.push({
      id: `update-reminder-${lastActivityMs}`,
      type: "update_reminder",
      title: id ? "✍️ Sudah lama tidak ada Update Bisnis" : "✍️ It's been a while since your last Business Update",
      body: id
        ? "Ceritakan kabar bisnismu minggu ini supaya Beemo bisa kasih insight yang lebih relevan."
        : "Tell Beemo how your business is doing this week so it can give you more relevant insights.",
      timestamp: new Date(reminderAtMs).toISOString(),
      unread: reminderAtMs > lastSeenAt,
      menuKey: null,
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const limited = items.slice(0, MAX_ITEMS);
  const unreadCount = limited.filter((i) => i.unread).length;

  return { status: 200, body: { notifications: limited, unreadCount } };
}
