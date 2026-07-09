import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

declare global {
  interface Window {
    snap: any;
  }
}

type PlanId = "pro" | "platinum";

type UpgradeModalProps = {
  businessProfileId: string;
  businessName: string;
  onClose: () => void;
  onUpgraded: () => void;
};

const PLAN_INFO: Record<PlanId, { label: string; price: string; priceLabel: string; accent: string }> = {
  pro: { label: "PRO", price: "99000", priceLabel: "Rp99.000", accent: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  platinum: { label: "PLATINUM", price: "299000", priceLabel: "Rp299.000", accent: "border-purple-500/40 bg-purple-500/10 text-purple-300" },
};

function UpgradeModal({ businessProfileId, businessName, onClose, onUpgraded }: UpgradeModalProps) {
  const { t } = useLanguage();
  const { session, user } = useAuth();
  const [processingPlan, setProcessingPlan] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectPlan(plan: PlanId) {
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
    <div onClick={handleOverlayClick} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-black/95 p-6 backdrop-blur-md sm:p-8">
        {!processingPlan && (
          <button onClick={onClose} className="absolute right-4 top-4 text-neutral-400 hover:text-white">
            ✕
          </button>
        )}

        <h2 className="mb-1 text-xl font-extrabold text-white">{t.workspace.upgradeModalTitle}</h2>
        <p className="mb-6 text-sm text-neutral-400">{businessName}</p>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="space-y-3">
          {(["pro", "platinum"] as PlanId[]).map((plan) => (
            <button
              key={plan}
              onClick={() => handleSelectPlan(plan)}
              disabled={!!processingPlan}
              className={`w-full rounded-xl border p-4 text-left transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${PLAN_INFO[plan].accent}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{PLAN_INFO[plan].label}</span>
                <span className="font-bold">{PLAN_INFO[plan].priceLabel}</span>
              </div>
              {processingPlan === plan && (
                <p className="mt-1 text-xs text-neutral-400">{t.workspace.upgradeProcessing}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default UpgradeModal;
