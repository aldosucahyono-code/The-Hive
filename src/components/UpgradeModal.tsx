import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import PricingCards, { type PlanId } from "./PricingCards";
import BetaEarlyAccessCard from "./BetaEarlyAccessCard";
import { PAYMENT_ENABLED } from "../lib/paymentFlag";

declare global {
  interface Window {
    snap: any;
  }
}

type UpgradeModalProps = {
  businessProfileId: string;
  businessName: string;
  // Audit Juli 2026 (QA: "ketika users sudah pro, maka maks hanya
  // tampilkan opsi platinum saja") — dipakai untuk menyembunyikan kartu PRO
  // begitu bisnis ini sudah PRO aktif, supaya tidak ditawari "upgrade" ke
  // paket yang sudah dimilikinya.
  currentTier: "free" | "pro" | "platinum";
  onClose: () => void;
  onUpgraded: () => void;
  // Bugfix produk Juli 2026 ("PDF eksklusif PLATINUM"): beberapa fitur (mis.
  // Final Reports/PDF) HANYA terbuka di PLATINUM, jadi PRO bukan pilihan yang
  // relevan begitu modal dibuka dari sana — menampilkan kartu PRO di situ
  // menyesatkan (seolah upgrade ke PRO saja cukup). Kalau true, sembunyikan
  // kartu PRO sama sekali walau currentTier masih "free", supaya satu-satunya
  // pilihan yang ditampilkan adalah PLATINUM.
  platinumOnly?: boolean;
};

function UpgradeModal({ businessProfileId, businessName, currentTier, onClose, onUpgraded, platinumOnly = false }: UpgradeModalProps) {
  const { t } = useLanguage();
  const { session, user } = useAuth();
  const [processingPlan, setProcessingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Beta Launch (Midtrans Production belum aktif) — lihat
  // src/lib/paymentFlag.ts. Kalau flag mati, klik paket tidak memanggil
  // create-transaction sama sekali, cukup ganti isi modal ini jadi form
  // Early Access untuk paket yang diklik.
  const [earlyAccessPlan, setEarlyAccessPlan] = useState<PlanId | null>(null);
  const visiblePlans: PlanId[] =
    currentTier === "platinum" ? [] : currentTier === "pro" || platinumOnly ? ["platinum"] : ["pro", "platinum"];

  async function handleSelectPlan(plan: PlanId) {
    if (!PAYMENT_ENABLED) {
      setEarlyAccessPlan(plan);
      return;
    }
    if (!session?.access_token || !user?.email) return;
    setProcessingPlan(plan);
    setError(null);

    try {
      const response = await fetch("/api/create-transaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tier: plan,
          customerName: user.email.split("@")[0],
          customerEmail: user.email,
          businessProfileId,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t.workspace.upgradeErrorGeneric);
        setProcessingPlan(null);
        return;
      }

      window.snap.pay(data.token, {
        onSuccess: function () {
          onUpgraded();
        },
        onPending: function () {
          onUpgraded();
        },
        onError: function () {
          setError(t.workspace.upgradeErrorGeneric);
          setProcessingPlan(null);
        },
        onClose: function () {
          setProcessingPlan(null);
        },
      });
    } catch (err) {
      console.error("UpgradeModal error:", err);
      setError(t.workspace.upgradeErrorNetwork);
      setProcessingPlan(null);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !processingPlan) onClose();
  }

  return (
    <div onClick={handleOverlayClick} className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-black/95 p-6 backdrop-blur-md sm:p-8">
        {/* Round 4 audit (mobile pass, 17 Juli 2026): area sentuh diperbesar
            (p-2.5) supaya tidak cuma sebesar glyph "✕" -- lihat catatan
            sama di BusinessUpdateModal.tsx. */}
        {!processingPlan && (
          <button onClick={onClose} className="absolute right-2.5 top-2.5 p-2.5 text-neutral-400 hover:text-white">
            ✕
          </button>
        )}

        <div className="mb-6 text-center">
          <h2 className="text-xl font-extrabold text-white sm:text-2xl">{t.workspace.upgradeModalTitle}</h2>
          <p className="mt-1 text-sm text-neutral-400">{businessName}</p>
        </div>

        {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

        {earlyAccessPlan ? (
          <BetaEarlyAccessCard
            plan={earlyAccessPlan}
            businessProfileId={businessProfileId}
            defaultName={user?.email ? user.email.split("@")[0] : undefined}
            defaultEmail={user?.email || undefined}
            source="workspace_upgrade"
            theme="dark"
            onDone={onClose}
            doneLabel={t.betaAccess.closeButton}
          />
        ) : visiblePlans.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-400">{t.addBusinessModal.capBlockedDescPlatinum}</p>
        ) : (
          <PricingCards
            visiblePlans={visiblePlans}
            onSelect={handleSelectPlan}
            loadingPlan={processingPlan}
            ctaLabel={{
              pro: PAYMENT_ENABLED ? t.previewReport.proButton : t.betaAccess.viewEarlyAccessButton,
              platinum: PAYMENT_ENABLED ? t.previewReport.platinumButton : t.betaAccess.viewEarlyAccessButton,
              preparing: t.workspace.upgradeProcessing,
            }}
          />
        )}
      </div>
    </div>
  );
}

export default UpgradeModal;
