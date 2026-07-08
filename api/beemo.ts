// api/beemo.ts
//
// Router untuk domain "beemo". Sama seperti /api/business — hanya
// verifikasi auth lalu arahkan ke service berdasarkan `action`.
// Sekarang baru ada action "chat". Kemampuan Beemo berikutnya (review,
// roadmap, mission, insight, evaluate_phase, recommendation — bagian dari
// Tahap 2/3 Business & AI Engine) akan ditambah sebagai action baru di
// sini, BUKAN endpoint terpisah lagi.

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { chatWithBeemo } from "../services/beemo/chat.js";

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
    case "chat":
      result = await chatWithBeemo(userId, payload);
      break;
    default:
      return res.status(400).json({ error: `action tidak dikenali: ${action}` });
  }

  return res.status(result.status).json(result.body);
}
