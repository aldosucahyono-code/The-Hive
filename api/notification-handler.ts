import crypto from 'crypto';

const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;

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

    if (transaction_status === 'settlement' || transaction_status === 'capture') {
      // TODO: generate PDF + kirim email
    } else if (transaction_status === 'pending') {
      // menunggu pembayaran
    } else if (
      transaction_status === 'deny' ||
      transaction_status === 'cancel' ||
      transaction_status === 'expire'
    ) {
      // gagal/batal/kadaluarsa
    }

    return res.status(200).json({ message: 'OK' });
  } catch (error) {
    console.error('notification-handler error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}