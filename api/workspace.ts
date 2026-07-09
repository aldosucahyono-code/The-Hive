// api/workspace.ts
//
// Router untuk domain "workspace". Sekarang menangani Business Update
// (Tahap 2.1). Kemampuan Workspace lain di Business Engine (Business
// Health, Progress, Achievement) akan ditambah sebagai action baru di
// sini, bukan endpoint terpisah.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { submitBusinessUpdate } from "../services/workspace/submitUpdate.js";
import { listBusinessUpdates } from "../services/workspace/listUpdates.js";
import { getBusinessHealth } from "../services/workspace/getBusinessHealth.js";
import { getProgress } from "../services/workspace/getProgress.js";
import { getHealthTrend } from "../services/workspace/getHealthTrend.js";
import { getLatestPayment } from "../services/workspace/getLatestPayment.js";
import { getMembership } from "../services/workspace/getMembership.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

  const { action, ...payload } = req.body || {};

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
    case "getLatestPayment":
      result = await getLatestPayment(userId, payload);
      break;
    case "getMembership":
      result = await getMembership(userId, payload);
      break;
    default:
      return res.status(400).json({ error: `action tidak dikenali: ${action}` });
  }

  return res.status(result.status).json(result.body);
}
