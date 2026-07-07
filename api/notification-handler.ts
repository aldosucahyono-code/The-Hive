import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACCESS_DURATION_DAYS: Record<string, number> = {
  pro: 7,
  platinum: 30,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notification = req.body;
    const { order_id, status_code, gross_amount, signature_key, transaction_status } =
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

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // Hindari upgrade subscription dua kali kalau Midtrans mengirim
      // notifikasi settlement lebih dari sekali untuk order yang sama
      // (webhook Midtrans memang bisa retry).
      if (payment.status === 'settlement') {
        return res.status(200).json({ message: 'OK (already processed)' });
      }

      await supabase.from('payments').update({ status: 'settlement' }).eq('id', payment.id);

      const durationDays = ACCESS_DURATION_DAYS[payment.tier] ?? 7;
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
    } else if (transaction_status === 'pending') {
      await supabase.from('payments').update({ status: 'pending' }).eq('id', payment.id);
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
