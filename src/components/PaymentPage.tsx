import { useEffect, useState } from "react";
import { hardNavigate } from "../utils/navigate";

export type PlanId = "pro" | "platinum";

export type PendingOrder = {
  namaBisnis: string;
  nama: string;
  email: string;
};

const PLAN_INFO: Record<PlanId, { label: string; price: string; accent: string; accentText: string; accentBg: string }> = {
  pro: {
    label: "PRO",
    price: "Rp99.000",
    accent: "border-blue-500/40",
    accentText: "text-blue-400",
    accentBg: "bg-blue-500",
  },
  platinum: {
    label: "PLATINUM",
    price: "Rp299.000",
    accent: "border-purple-500/40",
    accentText: "text-purple-400",
    accentBg: "bg-purple-500",
  },
};

/** Reads the order the user was reviewing right before being sent here
 * (saved by PreviewReport via localStorage, since hardNavigate does a
 * full reload and would otherwise lose the wizard's in-memory state). */
function usePendingOrder(): PendingOrder | null {
  const [order, setOrder] = useState<PendingOrder | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hive_pending_order");
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      setOrder(null);
    }
  }, []);
  return order;
}

function PaymentPage({ plan }: { plan: PlanId }) {
  const info = PLAN_INFO[plan];
  const order = usePendingOrder();

  return (
    <section className="mx-auto max-w-lg px-6 py-20">
      <button
        onClick={() => hardNavigate("")}
        className="mb-8 text-sm text-neutral-400 hover:text-white"
      >
        ← Kembali ke Beranda
      </button>

      <div className={`rounded-2xl border ${info.accent} bg-surface p-8`}>
        <span className={`inline-block rounded-full ${info.accentBg} px-3 py-1 text-xs font-bold text-white`}>
          {info.label}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">Unlock Laporan {info.label}</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Laporan lengkap akan dikirim dalam format PDF ke email Anda setelah pembayaran berhasil.
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Bisnis</span>
            <span className="font-semibold">{order?.namaBisnis || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Nama</span>
            <span className="font-semibold">{order?.nama || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Email tujuan laporan</span>
            <span className="font-semibold">{order?.email || "—"}</span>
          </div>
          <div className="my-2 border-t border-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">Total</span>
            <span className={`text-2xl font-black ${info.accentText}`}>{info.price}</span>
          </div>
        </div>

        {!order && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            Data bisnis tidak ditemukan. Sebaiknya mulai dari analisis gratis dulu supaya laporan
            yang kami kirim sesuai dengan bisnis Anda.
          </p>
        )}

        {/* TODO(backend): ganti tombol ini dengan integrasi Midtrans Snap.
            Setelah pembayaran sukses, backend memicu report-engine dengan
            tier={plan} dan mengirim PDF hasilnya ke `order.email`. */}
        <button
          disabled
          className={`mt-6 w-full cursor-not-allowed rounded-xl ${info.accentBg} py-4 text-base font-bold text-white opacity-60`}
        >
          🔒 Pembayaran Segera Aktif
        </button>
        <p className="mt-3 text-center text-xs text-neutral-500">
          Integrasi pembayaran sedang kami siapkan. Laporan Anda akan otomatis dikirim ke email
          begitu pembayaran aktif.
        </p>
      </div>
    </section>
  );
}

export default PaymentPage;
