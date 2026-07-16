// api/business.ts
//
// Router untuk domain "business". Endpoint ini HANYA bertugas:
//   1. Verifikasi metode HTTP & autentikasi (Bearer token)
//   2. Membaca `action` dari body, mengarahkan ke service yang sesuai
//   3. Mengembalikan hasil dari service tersebut
//
// TIDAK ADA business logic di sini — semua logic ada di services/business/*.
// Ini sengaja menggabungkan 5 endpoint lama (create-business,
// deactivate-business, restore-business, permanently-delete-business,
// save-business-analysis) jadi 1 file, supaya tetap di bawah batas 12
// Serverless Function di Vercel Hobby plan — TANPA menggabungkan logikanya
// (logic tetap terpisah rapi per file di services/business/).

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { createBusiness } from "../services/business/create.js";
import { archiveBusiness } from "../services/business/archive.js";
import { restoreBusiness } from "../services/business/restore.js";
import { deleteBusinessPermanently } from "../services/business/delete.js";
import { saveBusinessAnalysis } from "../services/business/saveAnalysis.js";
import { getCapDetails } from "../services/business/checkBusinessCap.js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Audit Juli 2026 ("cari celah, dan perbaiki"): dibungkus try/catch supaya
  // exception tak terduga dari service manapun di bawah (mis. createBusiness)
  // pulang sebagai JSON 500 bersih, bukan lolos mentah ke runtime Vercel.
  try {
    return await handleBusinessRequest(req, res);
  } catch (error) {
    console.error("api/business: unhandled error:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server. Coba lagi." });
  }
}

async function handleBusinessRequest(req: VercelRequest, res: VercelResponse) {
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
    case "create":
      result = await createBusiness(userId, payload);
      break;
    case "archive":
      result = await archiveBusiness(userId, payload);
      break;
    case "restore":
      result = await restoreBusiness(userId, payload);
      break;
    case "delete":
      result = await deleteBusinessPermanently(userId, payload);
      break;
    case "saveAnalysis":
      result = await saveBusinessAnalysis(userId, payload);
      break;
    case "getCap":
      result = { status: 200, body: await getCapDetails(userId) };
      break;
    default:
      return res.status(400).json({ error: `action tidak dikenali: ${action}` });
  }

  return res.status(result.status).json(result.body);
}
