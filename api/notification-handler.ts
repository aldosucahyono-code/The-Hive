import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { generateFinalReport } from '../services/reports/generateFinalReport.js';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Fix: Pro dipasarkan sebagai "Rp99.000/bulan" tapi sebelumnya cuma
// memberi akses 7 hari per pembayaran (Platinum sudah benar 30 hari) —
// pelanggan Pro jadi kehilangan akses jauh sebelum siklus bulanan
// berikutnya. Disamakan jadi 30 hari untuk kedua tier (konsisten dengan
// billing bulanan yang dijanjikan di halaman harga).
const ACCESS_DURATION_DAYS: Record<string, number> = {
  pro: 30,
  platinum: 30,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notification = req.body;
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } =
      notification;

    const expectedSignature = crypto
      .createHash('sha512')
      .update(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
      .digest('hex');

    if (signature_key !== expectedSignature) {
      console.error('Invalid signature for order:', order_id);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    console.log(`Notifikasi diterima: ${order_id} - status: ${transaction_status}`);

    // Ambil kembali baris payment yang tadi dibuat create-transaction, untuk
    // tahu business_profile_id dan tier apa yang dibeli.
    const { data: payment, error: paymentFetchError } = await supabase
      .from('payments')
      .select('id, business_profile_id, tier, status')
      .eq('midtrans_order_id', order_id)
      .single();

    if (paymentFetchError || !payment) {
      console.error('Payment not found for order:', order_id, paymentFetchError);
      // Tetap balas 200 ke Midtrans supaya tidak retry terus — tapi ini
      // situasi ganjil yang perlu dicek manual (order_id tidak dikenal).
      return res.status(200).json({ message: 'OK (payment not found, logged)' });
    }

    // Audit red-team Juli 2026: untuk transaction_status "capture" (jalur
    // kartu kredit/debit), Midtrans WAJIB dicek fraud_status-nya juga —
    // "capture" saja TIDAK berarti pembayaran aman, Fraud Detection System
    // Midtrans bisa menandainya "challenge" (butuh review manual, BUKAN
    // ditolak tapi juga belum boleh dianggap lunas) atau "deny". Sebelumnya
    // kode ini menganggap SEMUA "capture" sebagai lunas tanpa cek
    // fraud_status sama sekali — celah yang didokumentasikan Midtrans
    // sendiri sebagai kesalahan integrasi umum. "settlement" (jalur
    // non-kartu: transfer bank/e-wallet/QRIS) tidak membawa fraud_status,
    // jadi tidak perlu dicek.
    const isCaptureAccepted = transaction_status === 'capture' && fraud_status === 'accept';
    if (transaction_status === 'settlement' || isCaptureAccepted) {
      // Hindari upgrade subscription dua kali kalau Midtrans mengirim
      // notifikasi settlement lebih dari sekali untuk order yang sama
      // (webhook Midtrans memang bisa retry).
      if (payment.status === 'settlement') {
        return res.status(200).json({ message: 'OK (already processed)' });
      }

      await supabase.from('payments').update({ status: 'settlement' }).eq('id', payment.id);

      const durationDays = ACCESS_DURATION_DAYS[payment.tier] ?? 30;
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      // subscriptions hanya boleh punya SATU baris berstatus 'active' per
      // business_profile (constraint di DB) — jadi expire dulu yang lama
      // (termasuk 'free' bawaan sejak business_profile dibuat), baru insert
      // yang baru.
      const { error: expireError } = await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('business_profile_id', payment.business_profile_id)
        .eq('status', 'active');

      if (expireError) {
        console.error('subscriptions expire error:', expireError);
      }

      const { error: subError } = await supabase.from('subscriptions').insert({
        business_profile_id: payment.business_profile_id,
        tier: payment.tier,
        status: 'active',
        expires_at: expiresAt,
      });

      if (subError) {
        console.error('subscriptions insert error:', subError);
      }

      // Fitur baru Juli 2026 ("setelah pembayaran berhasil dan terverifikasi
      // baru THE HIVE bisa mengeluarkan PDF"): begitu subscription PLATINUM
      // aktif, langsung buat Laporan Awal (baseline) otomatis di sini —
      // pelanggan tidak perlu ingat untuk klik tombol manual di Workspace
      // lagi setelah bayar. Sengaja TIDAK untuk tier "pro" (PDF sekarang
      // eksklusif PLATINUM — lihat services/reports/generateFinalReport.ts).
      // Idempotent (generateFinalReport mengecek baris "baseline" yang sudah
      // ada dulu), jadi aman kalau notifikasi Midtrans ini terkirim ulang.
      // Dibungkus try/catch supaya kegagalan generate PDF (mis. Claude API
      // sesaat bermasalah) TIDAK menggagalkan respons ke Midtrans — request
      // yang sama (subscription sudah tercatat aktif) tidak boleh dianggap
      // gagal hanya karena PDF-nya belum jadi. Kalau auto-generate ini gagal,
      // pelanggan tetap punya jalan manual: tombol "Buat PDF Awal" di panel
      // Final Reports Workspace (generateFinalReport juga dipanggil dari
      // sana, aman dipanggil ulang).
      if (!subError && payment.tier === 'platinum') {
        try {
          const result = await generateFinalReport(payment.business_profile_id, 'baseline', 'id');
          if (!result.ok) {
            console.error(`notification-handler: gagal auto-generate baseline report untuk ${payment.business_profile_id}:`, result.error);
          }
        } catch (reportErr) {
          console.error(`notification-handler: exception saat auto-generate baseline report untuk ${payment.business_profile_id}:`, reportErr);
        }
      }
    } else if (transaction_status === 'pending') {
      await supabase.from('payments').update({ status: 'pending' }).eq('id', payment.id);
    } else if (transaction_status === 'capture' && fraud_status === 'challenge') {
      // Ditahan Fraud Detection System Midtrans untuk review manual — BUKAN
      // ditolak, tapi juga belum boleh dianggap lunas (lihat catatan di
      // atas). Ditandai 'pending' supaya tidak nyangkut sebagai transaksi
      // hilang begitu saja; kalau reviewer Midtrans meloloskannya nanti,
      // notifikasi susulan akan datang dengan status yang sudah final.
      await supabase.from('payments').update({ status: 'pending' }).eq('id', payment.id);
      console.log(`Transaksi ${order_id} ditahan Fraud Detection System (challenge) — menunggu review manual.`);
    } else if (
      transaction_status === 'deny' ||
      transaction_status === 'cancel' ||
      transaction_status === 'expire'
    ) {
      const statusMap: Record<string, string> = {
        deny: 'failed',
        cancel: 'failed',
        expire: 'expired',
      };
      await supabase
        .from('payments')
        .update({ status: statusMap[transaction_status] })
        .eq('id', payment.id);
    }

    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    console.error('notification-handler error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
