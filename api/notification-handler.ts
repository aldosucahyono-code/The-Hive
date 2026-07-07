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
    // tahu siapa user_id-nya, analysis_id, dan tier apa yang dibeli.
    const { data: payment, error: paymentFetchError } = await supabase
      .from('payments')
      .select('id, user_id, analysis_id, tier')
      .eq('midtrans_order_id', order_id)
      .single();

    if (paymentFetchError || !payment) {
      console.error('Payment not found for order:', order_id, paymentFetchError);
      // Tetap balas 200 ke Midtrans supaya tidak retry terus — tapi ini
      // situasi ganjil yang perlu dicek manual (order_id tidak dikenal).
      return res.status(200).json({ message: 'OK (payment not found, logged)' });
    }

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      await supabase.from('payments').update({ status: 'settlement' }).eq('id', payment.id);

      const durationDays = ACCESS_DURATION_DAYS[payment.tier] ?? 7;
      const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

      const { error: grantError } = await supabase.from('access_grants').insert({
        user_id: payment.user_id,
        analysis_id: payment.analysis_id,
        tier: payment.tier,
        expires_at: expiresAt,
        is_active: true,
      });

      if (grantError) {
        console.error('access_grants insert error:', grantError);
      }

      // Selaraskan tier di analyses (kalau ada analysis_id terkait), supaya
      // riwayat di Workspace langsung mencerminkan tier yang sudah dibayar.
      if (payment.analysis_id) {
        await supabase
          .from('analyses')
          .update({ tier: payment.tier })
          .eq('id', payment.analysis_id);
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
