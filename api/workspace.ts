// api/workspace.ts
//
// Router untuk domain "workspace". Sekarang menangani Business Update
// (Tahap 2.1). Kemampuan Workspace lain di Business Engine (Business
// Health, Progress, Achievement) akan ditambah sebagai action baru di
// sini, bukan endpoint terpisah.
//
// Audit Juli 2026 ("pisahkan halaman super admin ini dari users, atau
// hackers"): action admin* (alur login 3 langkah + 4 aksi baca/tulis data)
// menumpang di router ini (bukan endpoint terpisah -- batas 12 Serverless
// Function Vercel Hobby sudah tercapai, lihat catatan di api/business.ts)
// TAPI otentikasinya SENGAJA TIDAK lewat gerbang "Bearer <token Supabase>"
// di bawah -- action admin* dicek lebih dulu, dan pakai sesinya sendiri
// (header x-admin-token, admin_sessions, lihat
// services/admin/auth/requireAdminSession.ts) yang tidak ada hubungannya
// sama sekali dengan sesi login pelanggan. Kalau sesi pelanggan bocor,
// tidak ada jalan ke admin; kalau sesi admin bocor, tidak ada jalan ke
// akun pelanggan manapun.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { getClientIp } from "../services/rateLimit/checkRateLimit.js";
import { submitBusinessUpdate } from "../services/workspace/submitUpdate.js";
import { listBusinessUpdates } from "../services/workspace/listUpdates.js";
import { getBusinessHealth } from "../services/workspace/getBusinessHealth.js";
import { getProgress } from "../services/workspace/getProgress.js";
import { getHealthTrend } from "../services/workspace/getHealthTrend.js";
import { getAchievements } from "../services/workspace/getAchievements.js";
import { getLatestPayment } from "../services/workspace/getLatestPayment.js";
import { getMembership } from "../services/workspace/getMembership.js";
import { getTodaySnapshot } from "../services/today/computeSnapshot.js";
import { getPendingMemoryFacts } from "../services/memory/getPendingMemoryFacts.js";
import { reviewMemoryFact } from "../services/memory/reviewMemoryFact.js";
import { getCompetitorAnalysis } from "../services/competitor/getCompetitorAnalysis.js";
import { proposeDecision } from "../services/decision/proposeDecision.js";
import { listDecisions } from "../services/decision/listDecisions.js";
import { getChecklistProgress, toggleChecklistItem } from "../services/workspace/checklistProgress.js";
import { getBusinessOS } from "../services/businessOS/getBusinessOS.js";
import { getWeeklyReview } from "../services/businessOS/weeklyReview.js";
import { generateBaselineReportAction } from "../services/reports/generateFinalReport.js";
import { listReports } from "../services/reports/listReports.js";
import { promoteDraft } from "../services/business/promoteDraft.js";
import { getSocialMediaAnalysis } from "../services/socialMedia/getSocialMediaAnalysis.js";
import { getMacroSnapshot } from "../services/macro/getMacroSnapshot.js";
import { getNotifications } from "../services/notifications/getNotifications.js";
import { markNotificationsSeen } from "../services/notifications/markNotificationsSeen.js";
import { recordPresence } from "../services/admin/recordPresence.js";
import { adminRequestChallenge } from "../services/admin/auth/requestChallenge.js";
import { adminVerifyEmailToken } from "../services/admin/auth/verifyEmailToken.js";
import { adminVerifyPin } from "../services/admin/auth/verifyPin.js";
import { adminLogout } from "../services/admin/auth/logout.js";
import { adminListCustomers } from "../services/admin/listCustomers.js";
import { adminGetCustomerDetail } from "../services/admin/getCustomerDetail.js";
import { adminListContactMessages } from "../services/admin/listContactMessages.js";
import { adminUpdateContactMessageStatus } from "../services/admin/updateContactMessageStatus.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const ADMIN_FLOW_ACTIONS = new Set([
  "adminRequestChallenge",
  "adminVerifyEmailToken",
  "adminVerifyPin",
  "adminLogout",
  "adminListCustomers",
  "adminGetCustomerDetail",
  "adminListContactMessages",
  "adminUpdateContactMessageStatus",
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, ...payload } = req.body || {};

  // --- Jalur admin: sesi TERPISAH TOTAL dari Supabase Auth, lihat catatan
  // di atas file ini. Ditangani SEBELUM gerbang "Bearer <token>" di bawah,
  // karena admin belum tentu (dan tidak perlu) punya sesi login pelanggan
  // sama sekali. ---
  if (ADMIN_FLOW_ACTIONS.has(action)) {
    const ip = getClientIp(req);
    const userAgent = (req.headers["user-agent"] as string) || "";
    const adminToken = req.headers["x-admin-token"] as string | undefined;

    let adminResult;
    switch (action) {
      case "adminRequestChallenge":
        adminResult = await adminRequestChallenge(payload, ip, userAgent);
        break;
      case "adminVerifyEmailToken":
        adminResult = await adminVerifyEmailToken(payload);
        break;
      case "adminVerifyPin":
        adminResult = await adminVerifyPin(payload, ip, userAgent);
        break;
      case "adminLogout":
        adminResult = await adminLogout(adminToken);
        break;
      case "adminListCustomers":
        adminResult = await adminListCustomers(adminToken, payload);
        break;
      case "adminGetCustomerDetail":
        adminResult = await adminGetCustomerDetail(adminToken, payload);
        break;
      case "adminListContactMessages":
        adminResult = await adminListContactMessages(adminToken, payload);
        break;
      case "adminUpdateContactMessageStatus":
        adminResult = await adminUpdateContactMessageStatus(adminToken, payload);
        break;
    }

    return res.status(adminResult!.status).json(adminResult!.body);
  }

  // --- Jalur pelanggan biasa: seperti sebelumnya, WAJIB sesi Supabase Auth. ---
  const authHeader = req.headers.authorization as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Silakan login terlebih dahulu." });
  }
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return res.status(401).json({ error: "Sesi login tidak valid. Silakan login ulang." });
  }
  const userId = userData.user.id;
  const userEmail = userData.user.email ?? null;

  // Audit Juli 2026 ("online-offline, lokasi, perangkat"): direkam untuk
  // SEMUA action pelanggan di bawah (bukan endpoint terpisah) supaya
  // memanfaatkan traffic yang sudah ada -- lihat services/admin/recordPresence.ts
  // untuk throttle-nya (maksimal sekali/menit per pelanggan) dan kenapa ini
  // tidak pernah menggagalkan permintaan aslinya.
  await recordPresence(userId, getClientIp(req), (req.headers["user-agent"] as string) || "");

  let result;
  switch (action) {
    case "submitUpdate":
      result = await submitBusinessUpdate(userId, payload);
      break;
    case "listUpdates":
      result = await listBusinessUpdates(userId, payload);
      break;
    case "getBusinessHealth":
      result = await getBusinessHealth(userId, payload);
      break;
    case "getProgress":
      result = await getProgress(userId, payload);
      break;
    case "getHealthTrend":
      result = await getHealthTrend(userId, payload);
      break;
    case "getAchievements":
      result = await getAchievements(userId, payload);
      break;
    case "getLatestPayment":
      result = await getLatestPayment(userId, payload);
      break;
    case "getMembership":
      result = await getMembership(userId, payload);
      break;
    case "getTodaySnapshot":
      result = await getTodaySnapshot(userId, payload);
      break;
    case "getPendingMemoryFacts":
      result = await getPendingMemoryFacts(userId, payload);
      break;
    case "reviewMemoryFact":
      result = await reviewMemoryFact(userId, payload);
      break;
    case "getCompetitorAnalysis":
      result = await getCompetitorAnalysis(userId, payload);
      break;
    case "proposeDecision":
      result = await proposeDecision(userId, payload);
      break;
    case "listDecisions":
      result = await listDecisions(userId, payload);
      break;
    case "getChecklistProgress":
      result = await getChecklistProgress(userId, payload);
      break;
    case "toggleChecklistItem":
      result = await toggleChecklistItem(userId, payload);
      break;
    case "getBusinessOS":
      result = await getBusinessOS(userId, payload);
      break;
    case "getWeeklyReview":
      result = await getWeeklyReview(userId, payload);
      break;
    case "generateBaselineReport":
      result = await generateBaselineReportAction(userId, payload);
      break;
    case "listReports":
      result = await listReports(userId, payload);
      break;
    case "promoteDraft":
      result = await promoteDraft(userId, userEmail, payload);
      break;
    case "getSocialMediaAnalysis":
      result = await getSocialMediaAnalysis(userId, payload);
      break;
    case "getMacroSnapshot":
      result = await getMacroSnapshot(userId, payload);
      break;
    case "getNotifications":
      result = await getNotifications(userId, payload);
      break;
    case "markNotificationsSeen":
      result = await markNotificationsSeen(userId, payload);
      break;
    default:
      return res.status(400).json({ error: `action tidak dikenali: ${action}` });
  }

  return res.status(result.status).json(result.body);
}
