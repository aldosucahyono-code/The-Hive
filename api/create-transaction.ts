const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY!;
const IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION === 'true';

const SNAP_API_URL = IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1/transactions'
  : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

const TIER_PRICES: Record<string, { amount: number; label: string }> = {
  pro: { amount: 99000, label: 'THE HIVE - Laporan PDF PRO' },
  platinum: { amount: 299000, label: 'THE HIVE - Laporan PDF PLATINUM' },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tier, customerName, customerEmail, businessName } = req.body;

    const tierConfig = TIER_PRICES[tier];
    if (!tierConfig) {
      return res.status(400).json({ error: 'Tier tidak valid' });
    }

    if (!customerEmail || !customerName) {
      return res.status(400).json({ error: 'Nama dan email wajib diisi' });
    }

    const orderId = `THEHIVE-${tier.toUpperCase()}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: tierConfig.amount,
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail,
      },
      item_details: [
        {
          id: tier,
          price: tierConfig.amount,
          quantity: 1,
          name: tierConfig.label,
        },
      ],
      custom_field1: businessName || '',
      custom_field2: tier,
    };

    const authString = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64');

    const midtransResponse = await fetch(SNAP_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${authString}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await midtransResponse.json() as any;

    if (!midtransResponse.ok) {
      console.error('Midtrans error:', data);
      return res.status(midtransResponse.status).json({
        error: 'Gagal membuat transaksi',
        detail: data,
      });
    }

    return res.status(200).json({
      token: data.token,
      redirect_url: data.redirect_url,
      order_id: orderId,
    });
  } catch (error) {
    console.error('create-transaction error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}