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
  draftId?: string | null;
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
    price: "Rp349.000",
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

// Setelah Snap bilang sukses/pending, JANGAN langsung pindah ke Workspace —
// webhook Midtrans (notification-handler) baru mengonfirmasi status async,
// bisa telat beberapa detik. Tahap ini menunggu konfirmasi itu sambil
// menampilkan pesan berjalan, supaya pelanggan merasa sistem sedang bekerja,
// bukan merasa halamannya macet. Lihat AUDIT-THE-HIVE-2026-07-09.md (T2).
type ConfirmStage = "polling" | "pendingTimeout" | "expired" | "failed";

function PaymentPage({ plan }: { plan: PlanId }) {
  const { t } = useLanguage();
  const { user, session, signOut } = useAuth();
  const info = PLAN_INFO[plan];
  const order = usePendingOrder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmStage | null>(null);
  const [confirmMsgIndex, setConfirmMsgIndex] = useState(0);

  // businessProfileId didapat dari /api/promote-draft, dipanggil otomatis
  // begitu user login DAN ada draftId dari wizard yang tersimpan. Sebelum
  // ini selesai, tombol bayar tidak boleh aktif — karena create-transaction
  // sekarang butuh businessProfileId, bukan lagi analysisId/draftId mentah.
  const [businessProfileId, setBusinessProfileId] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  // Fix bug "bisnis pelanggan masuk ke akun developer": kalau akun yang
  // sedang login BUKAN pemilik email yang diisi di wizard, promoteDraft.ts
  // menolak dengan emailMismatch=true alih-alih diam-diam menempelkan
  // bisnis ke akun yang salah. Simpan email yang seharusnya dipakai supaya
  // UI bisa memandu pengguna keluar & login ulang dengan email yang benar.
  const [mismatchedEmail, setMismatchedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !session?.access_token || !order?.draftId || businessProfileId) return;

    let cancelled = false;

    async function promoteDraft() {
      setIsPromoting(true);
      setPromoteError(null);
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session!.access_token}`,
          },
          body: JSON.stringify({ action: "promoteDraft", draftId: order!.draftId }),
        });
        const json = await response.json();
        if (cancelled) return;
        if (response.ok) {
          setBusinessProfileId(json.businessProfileId);
        } else if (json.emailMismatch) {
          setMismatchedEmail(json.draftEmail || order?.email || null);
        } else if (json.capExceeded) {
          // Fix bug: sebelumnya kondisi ini jatuh ke pesan generik "Gagal
          // menyiapkan data bisnismu" yang tidak menjelaskan APA yang salah
          // atau APA yang harus dilakukan pengguna -- backend sudah tahu
          // persis alasannya (lihat services/business/checkBusinessCap.ts)
          // tapi pesan spesifik itu sebelumnya cuma di-console.error, tidak
          // pernah sampai ke UI. Sekarang tampilkan pesan yang actionable.
          console.error("promote-draft gagal (cap exceeded):", json.error);
          setPromoteError(t.paymentPage.promoteErrorCapped);
        } else {
          console.error("promote-draft gagal:", json.error);
          setPromoteError(t.paymentPage.promoteErrorGeneric);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("promote-draft error:", err);
        setPromoteError(t.paymentPage.promoteErrorNetwork);
      } finally {
        if (!cancelled) setIsPromoting(false);
      }
    }

    promoteDraft();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session?.access_token, order?.draftId, businessProfileId]);

  async function handleSwitchAccount() {
    setMismatchedEmail(null);
    await signOut();
    setShowAuthModal(true);
  }

  // Menunggu webhook notification-handler benar-benar mengonfirmasi status
  // transaksi (settlement/expire/deny/cancel) sebelum pindah ke Workspace.
  // Pesan berputar tiap ~2.2 detik supaya terasa "sedang berjalan", polling
  // status tiap ~2.5 detik lewat action getLatestPayment (backend, sudah
  // dipakai juga oleh Workspace untuk kasus upgrade dari dalam Workspace).
  function beginConfirmation() {
    if (!businessProfileId || !session?.access_token) {
      // Tidak seharusnya terjadi (tombol bayar butuh keduanya), tapi kalau
      // sampai terjadi, jangan biarkan pelanggan macet — lanjut saja.
      hardNavigate("workspace");
      return;
    }

    setConfirming("polling");
    setConfirmMsgIndex(0);

    const msgInterval = setInterval(() => {
      setConfirmMsgIndex((i) => (i + 1) % 4);
    }, 2200);

    let attempts = 0;
    const maxAttempts = 6;
    const pollInterval = setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "getLatestPayment", businessProfileId }),
        });
        const json = await response.json();
        const status = json.payment?.status;

        if (status === "settlement") {
          clearInterval(pollInterval);
          clearInterval(msgInterval);
          hardNavigate("workspace");
          return;
        }
        if (status === "expired") {
          clearInterval(pollInterval);
          clearInterval(msgInterval);
          setConfirming("expired");
          return;
        }
        if (status === "failed") {
          clearInterval(pollInterval);
          clearInterval(msgInterval);
          setConfirming("failed");
          return;
        }
      } catch (err) {
        console.error("beginConfirmation poll error:", err);
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        clearInterval(msgInterval);
        setConfirming("pendingTimeout");
      }
    }, 2500);
  }

  async function handleBayar() {
    if (!order || !session?.access_token || !businessProfileId) return;
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
          businessProfileId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPaymentError(data.error || t.paymentPage.createTransactionErrorFallback);
        setIsProcessing(false);
        return;
      }

      window.snap.pay(data.token, {
        onSuccess: function () {
          beginConfirmation();
        },
        onPending: function () {
          beginConfirmation();
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

  if (confirming) {
    const confirmMessages = [
      t.paymentPage.confirmingMsg1,
      t.paymentPage.confirmingMsg2,
      t.paymentPage.confirmingMsg3,
      t.paymentPage.confirmingMsg4,
    ];

    return (
      <section className="mx-auto max-w-lg px-6 py-20">
        <div className={`rounded-2xl border ${info.accent} bg-white p-8 text-center`}>
          {confirming === "polling" && (
            <>
              <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm font-semibold text-neutral-800">{confirmMessages[confirmMsgIndex]}</p>
            </>
          )}

          {confirming === "pendingTimeout" && (
            <>
              <div className="mb-3 text-2xl">⏳</div>
              <h2 className="mb-2 text-lg font-extrabold text-neutral-900">{t.paymentPage.confirmingPendingTitle}</h2>
              <p className="mb-6 text-sm leading-relaxed text-neutral-700">{t.paymentPage.confirmingPendingDesc}</p>
              <button
                onClick={() => hardNavigate("workspace")}
                className={`w-full rounded-xl ${info.accentBg} py-3 text-sm font-bold text-white hover:opacity-90`}
              >
                {t.paymentPage.confirmingContinueButton}
              </button>
            </>
          )}

          {confirming === "expired" && (
            <>
              <div className="mb-3 text-2xl">⚠️</div>
              <h2 className="mb-2 text-lg font-extrabold text-neutral-900">{t.paymentPage.confirmingExpiredTitle}</h2>
              <p className="mb-6 text-sm leading-relaxed text-neutral-700">{t.paymentPage.confirmingExpiredDesc}</p>
              <button
                onClick={() => {
                  setConfirming(null);
                  setIsProcessing(false);
                }}
                className={`w-full rounded-xl ${info.accentBg} py-3 text-sm font-bold text-white hover:opacity-90`}
              >
                {t.paymentPage.confirmingRetryButton}
              </button>
            </>
          )}

          {confirming === "failed" && (
            <>
              <div className="mb-3 text-2xl">⚠️</div>
              <h2 className="mb-2 text-lg font-extrabold text-neutral-900">{t.paymentPage.confirmingFailedTitle}</h2>
              <p className="mb-6 text-sm leading-relaxed text-neutral-700">{t.paymentPage.confirmingFailedDesc}</p>
              <button
                onClick={() => {
                  setConfirming(null);
                  setIsProcessing(false);
                }}
                className={`w-full rounded-xl ${info.accentBg} py-3 text-sm font-bold text-white hover:opacity-90`}
              >
                {t.paymentPage.confirmingRetryButton}
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-lg px-6 py-20">
      <button
        onClick={() => hardNavigate("")}
        className="mb-8 text-sm text-neutral-600 hover:text-neutral-900"
      >
        {t.paymentPage.backButton}
      </button>

      <div className={`rounded-2xl border ${info.accent} bg-white p-8`}>
        <span
          className={`inline-block rounded-full ${info.accentBg} px-3 py-1 text-xs font-bold text-white`}
        >
          {info.label}
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">{t.paymentPage.unlockTitle} {info.label}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {t.paymentPage.description}
        </p>

        <div className="mt-6 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">{t.paymentPage.bisnisLabel}</span>
            <span className="font-semibold">{order?.namaBisnis || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">{t.paymentPage.namaLabel}</span>
            <span className="font-semibold">{order?.nama || "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-600">{t.paymentPage.emailLabel}</span>
            <span className="font-semibold">{order?.email || "—"}</span>
          </div>
          <div className="my-2 border-t border-neutral-200" />
          <div className="flex items-center justify-between">
            <span className="text-neutral-700">{t.paymentPage.totalLabel}</span>
            <span className={`text-2xl font-black ${info.accentText}`}>{info.price}</span>
          </div>
        </div>

        {!order && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800">
            {t.paymentPage.missingDataWarning}
          </p>
        )}

        {mismatchedEmail ? (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center">
            <p className="mb-1 text-sm font-bold text-amber-800">{t.paymentPage.emailMismatchTitle}</p>
            <p className="mb-3 text-sm text-neutral-800">
              {t.paymentPage.emailMismatchDescPrefix}
              <strong className="text-amber-700">{mismatchedEmail}</strong>
              {t.paymentPage.emailMismatchDescSuffix}
            </p>
            <button
              onClick={handleSwitchAccount}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-black hover:opacity-90"
            >
              {t.paymentPage.emailMismatchLogoutButton}
            </button>
          </div>
        ) : !user ? (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
            <p className="mb-3 text-sm text-neutral-800">
              {t.paymentPage.authPromptDesc}
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-black hover:opacity-90"
            >
              {t.paymentPage.authPromptButton}
            </button>
          </div>
        ) : (
          <button
            onClick={handleBayar}
            disabled={isProcessing || !order || isPromoting || !businessProfileId}
            className={`mt-6 w-full rounded-xl ${info.accentBg} py-4 text-base font-bold text-white transition ${
              isProcessing || !order || isPromoting || !businessProfileId
                ? "cursor-not-allowed opacity-60"
                : "hover:opacity-90"
            }`}
          >
            {isProcessing
              ? t.paymentPage.payButtonLoading
              : isPromoting
              ? t.paymentPage.preparingBusinessDataLabel
              : `${t.paymentPage.payButton} ${info.price}`}
          </button>
        )}

        {promoteError && (
          <p className="mt-3 text-center text-xs text-red-600">{promoteError}</p>
        )}
        {paymentError && (
          <p className="mt-3 text-center text-xs text-red-600">{paymentError}</p>
        )}
        <p className="mt-3 text-center text-xs text-neutral-500">
          {t.paymentPage.footerNote}
        </p>
      </div>

      {showAuthModal && (
        // onSuccess = tutup modal saja, JANGAN hardNavigate ke workspace
        // langsung (lihat catatan AuthModalProps.onSuccess di AuthModal.tsx)
        // -- pengguna HARUS tetap di halaman pembayaran ini setelah login,
        // supaya efek promoteDraft di atas jalan dan tombol "Bayar" bisa
        // aktif, bukan malah dibuang ke Workspace sebelum sempat checkout.
        <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => setShowAuthModal(false)} defaultEmail={order?.email} />
      )}
    </section>
  );
}

export default PaymentPage;
