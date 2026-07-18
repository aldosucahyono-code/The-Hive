import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { PlanId } from "./PricingCards";

// Beta Launch (Midtrans Production belum diverifikasi/aktif): kartu ini
// menggantikan checkout Midtrans di DUA titik masuk upgrade saat
// src/lib/paymentFlag.ts PAYMENT_ENABLED=false — PaymentPage.tsx (dirender
// full-page, konteks "wizard_preview") dan UpgradeModal.tsx (dirender di
// dalam modal yang sudah ada, konteks "workspace_upgrade"). SENGAJA hanya
// SATU komponen isi (bukan dua versi UI terpisah) — pembungkusnya beda
// (halaman vs modal), isinya sama. Lihat diskusi UI/UX Claude+GPT
// 18 Jul 2026 untuk alasan desain ini.
//
// Submit lewat action "submitEarlyAccess" di api/workspace.ts (pola action
// dispatch yang sudah ada) -> services/workspace/submitEarlyAccess.ts ->
// tabel early_access baru (migrations/2026-07-19_early_access.sql). TIDAK
// menyentuh /api/create-transaction atau tabel payments/subscriptions sama
// sekali.

type BetaEarlyAccessCardProps = {
  plan: PlanId;
  businessProfileId: string | null;
  defaultName?: string;
  defaultEmail?: string;
  source: "wizard_preview" | "workspace_upgrade";
  theme?: "light" | "dark";
  onDone: () => void;
  doneLabel?: string;
};

function BetaEarlyAccessCard({
  plan,
  businessProfileId,
  defaultName = "",
  defaultEmail = "",
  source,
  theme = "light",
  onDone,
  doneLabel,
}: BetaEarlyAccessCardProps) {
  const { t } = useLanguage();
  const { session } = useAuth();
  const isLight = theme === "light";

  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>(plan);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accent = selectedPlan === "platinum" ? "purple" : "amber";
  const accentBg = accent === "purple" ? "bg-purple-500" : "bg-amber-500";
  const bodyText = isLight ? "text-neutral-600" : "text-neutral-400";
  const labelText = isLight ? "text-neutral-700" : "text-neutral-300";
  const inputBase = isLight
    ? "border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400"
    : "border-white/10 bg-white/5 text-white placeholder:text-neutral-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !session?.access_token) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "submitEarlyAccess",
          name: name.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || undefined,
          package: selectedPlan,
          source,
          businessProfileId: businessProfileId || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t.betaAccess.submitErrorGeneric);
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setSubmitting(false);
    } catch (err) {
      console.error("BetaEarlyAccessCard submit error:", err);
      setError(t.betaAccess.submitErrorNetwork);
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <div className="mb-3 text-3xl">🎉</div>
        <h3 className={"text-lg font-extrabold " + (isLight ? "text-neutral-900" : "text-white")}>{t.betaAccess.successTitle}</h3>
        <p className={"mt-2 text-sm leading-relaxed " + bodyText}>{t.betaAccess.successBody}</p>
        <button
          onClick={onDone}
          className={`mt-6 w-full rounded-xl ${accentBg} py-3 text-sm font-bold text-white transition hover:opacity-90`}
        >
          {doneLabel || t.betaAccess.gotoWorkspaceButton}
        </button>
      </div>
    );
  }

  return (
    <div>
      <span className={`inline-block rounded-full ${accentBg} px-3 py-1 text-xs font-bold text-white`}>{t.betaAccess.badge}</span>
      <h3 className={"mt-4 text-lg font-extrabold " + (isLight ? "text-neutral-900" : "text-white")}>{t.betaAccess.title}</h3>
      <p className={"mt-1 text-sm " + bodyText}>{source === "wizard_preview" ? t.betaAccess.subtitleWizard : t.betaAccess.subtitleWorkspace}</p>
      <p className={"mt-3 text-sm leading-relaxed " + bodyText}>{source === "wizard_preview" ? t.betaAccess.bodyWizard : t.betaAccess.bodyWorkspace}</p>

      <div className={"mt-4 rounded-xl border p-4 text-xs leading-relaxed " + (isLight ? "border-primary/20 bg-primary/5 text-neutral-700" : "border-primary/30 bg-primary/10 text-neutral-300")}>
        {t.betaAccess.explainerNote}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <div>
          <label className={"mb-1 block text-xs font-semibold " + labelText}>{t.betaAccess.nameLabel}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.betaAccess.namePlaceholder}
            required
            className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-primary ${inputBase}`}
          />
        </div>
        <div>
          <label className={"mb-1 block text-xs font-semibold " + labelText}>{t.betaAccess.emailLabel}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.betaAccess.emailPlaceholder}
            required
            className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-primary ${inputBase}`}
          />
        </div>
        <div>
          <label className={"mb-1 block text-xs font-semibold " + labelText}>{t.betaAccess.whatsappLabel}</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder={t.betaAccess.whatsappPlaceholder}
            className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-primary ${inputBase}`}
          />
        </div>
        <div>
          <label className={"mb-1.5 block text-xs font-semibold " + labelText}>{t.betaAccess.packageLabel}</label>
          <div className="flex gap-2">
            {(["pro", "platinum"] as PlanId[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelectedPlan(p)}
                className={
                  "flex-1 rounded-lg border py-2 text-sm font-bold transition " +
                  (selectedPlan === p
                    ? p === "platinum"
                      ? "border-purple-500 bg-purple-500 text-white"
                      : "border-amber-500 bg-amber-500 text-black"
                    : isLight
                    ? "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    : "border-white/10 text-neutral-400 hover:border-white/20")
                }
              >
                {p === "platinum" ? t.betaAccess.packagePlatinum : t.betaAccess.packagePro}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim() || !email.trim()}
          className={`mt-2 w-full rounded-xl ${accentBg} py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {submitting ? t.betaAccess.submittingButton : t.betaAccess.submitButton}
        </button>
      </form>
    </div>
  );
}

export default BetaEarlyAccessCard;
