import { useEffect, useState } from "react";
import { hardNavigate } from "../utils/navigate";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../context/AuthContext";
import AuthModal from "./AuthModal";

declare global {
  interface Window {
    snap: any;
  }
}

export type PlanId = "pro" | "platinum";

export type PendingOrder = {
  namaBisnis: string;
  nama: string;
  email: string;
  analysisId?: string | null;
};

type PlanInfo = {
  label: string;
  price: string;
  accent: string;
  accentText: string;
  accentBg: string;
};

const PLAN_INFO: Record<PlanId, PlanInfo> = {
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
  const { t } = useLanguage();
  const { user, session } = useAuth();
  const info = PLAN_INFO[plan];
  const order = usePendingOrder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  async function handleBayar() {
    if (!order || !session?.access_token) return;
    setIsProcessing(true);
    setPaymentError(null);

    try {
      const response = await fetch("/api/create-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tier: plan,
          customerName: order.nama,
          customerEmail: order.email,
          businessName: order.namaBisnis,
          analysisId: order.analysisId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPaymentError(data.error || "Gagal memulai pembayaran");
        setIsProcessing(false);
        return;
      }

      window.snap.pay(data.token, {
        onSuccess: function () {
          hardNavigate("workspace");
        },
        onPending: function () {
          hardNavigate("workspace");
        },
        onError: function () {
          setPaymentError(t.paymentPage.paymentErrorGeneric);
          setIsProcessing(false);
        },
        onClose: function () {
          setIsProcessing(false);
        },
      });
    } catch (err) {
      console.error("handleBayar error:", err);
      setPaymentError(t.paymentPage.paymentErrorNetwork);
      setIsProcessing(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-6 py-20">
      <button
        onClick={() => hardNavigate("")}
        className="mb-8 text-sm text-neutral-400 hover:text-white"
      >
        {t.paymentPage.backButton}
      </button>

      <div className={`rounded-2xl border ${info.accent} bg-surface p-8`}>
        <span
          className={`inline-block rounded-full ${info.accentBg} px-3 py-1 text-xs font-bold text-white`}
        >
          {info.label}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">{t.paymentPage.unlockTitle} {info.label}</h1>
        <p className="mt-2 text-sm text-neutral-400">
          {t.paymentPage.description}
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-white/10 bg-black/20 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">{t.paymentPage.bisnisLabel}</span>
            <span className="font-semibold">{order?.namaBisnis || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">{t.paymentPage.namaLabel}</span>
            <span className="font-semibold">{order?.nama || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">{t.paymentPage.emailLabel}</span>
            <span className="font-semibold">{order?.email || "—"}</span>
          </div>
          <div className="my-2 border-t border-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-neutral-300">{t.paymentPage.totalLabel}</span>
            <span className={`text-2xl font-black ${info.accentText}`}>{info.price}</span>
          </div>
        </div>

        {!order && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {t.paymentPage.missingDataWarning}
          </p>
        )}

        {!user ? (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
            <p className="mb-3 text-sm text-neutral-200">
              Aktifkan Workspace dulu (login lewat email) untuk melanjutkan pembayaran — ini
              supaya laporan dan akses PRO/PLATINUM kamu tersimpan di akunmu.
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-black hover:opacity-90"
            >
              Aktifkan Workspace
            </button>
          </div>
        ) : (
          <button
            onClick={handleBayar}
            disabled={isProcessing || !order}
            className={`mt-6 w-full rounded-xl ${info.accentBg} py-4 text-base font-bold text-white transition ${
              isProcessing || !order ? "cursor-not-allowed opacity-60" : "hover:opacity-90"
            }`}
          >
            {isProcessing ? t.paymentPage.payButtonLoading : `${t.paymentPage.payButton} ${info.price}`}
          </button>
        )}

        {paymentError && (
          <p className="mt-3 text-center text-xs text-red-400">{paymentError}</p>
        )}
        <p className="mt-3 text-center text-xs text-neutral-500">
          {t.paymentPage.footerNote}
        </p>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </section>
  );
}

export default PaymentPage;
