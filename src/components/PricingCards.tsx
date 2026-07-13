import type { CSSProperties } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import beemoPro from "../assets/mascot/beemo-pro.png";
import beemoPlatinum from "../assets/mascot/beemo-platinum.png";

// Kartu harga PRO/PLATINUM — SATU-SATUNYA tempat yang menggambar kartu ini
// (audit Juli 2026: sebelumnya diduplikasi penuh di PreviewReport.tsx, lalu
// UpgradeModal.tsx dan layar "batas bisnis tercapai" di ChatWizard butuh
// tampilan yang SAMA PERSIS — daripada duplikasi 3x, ditarik jadi satu
// komponen dipakai ketiganya). Isi teks tetap dari t.pricing.* (sudah
// tier-agnostic, tidak spesifik ke satu halaman manapun).
const mascotMaskStyle: CSSProperties = {
  WebkitMaskImage: "radial-gradient(circle at 50% 42%, black 58%, transparent 78%)",
  maskImage: "radial-gradient(circle at 50% 42%, black 58%, transparent 78%)",
};
// Rombak Juli 2026 ("PDF eksklusif PLATINUM"): item pertama proChecklist
// tidak lagi soal PDF (diganti akses Workspace & Dashboard) — ikon pertama
// disesuaikan dari 📄 (dokumen) jadi 🖥️ (dashboard) supaya tetap cocok
// dengan teksnya. Urutan ikon lain tidak berubah.
const PRO_ICONS = ["🖥️", "🥧", "🎯", "📋", "📢", "💬"];
const PLATINUM_ICONS = ["🗂️", "🔍", "📈", "📝", "👥", "📄", "💬"];

export type PlanId = "pro" | "platinum";

type PricingCardsProps = {
  // Tier mana yang ditampilkan — dipakai untuk menyembunyikan PRO begitu
  // bisnis sudah PRO (cuma tawarkan upgrade ke PLATINUM, bukan turun/ulang
  // ke PRO lagi).
  visiblePlans?: PlanId[];
  recommendedTier?: PlanId | null;
  onSelect: (plan: PlanId) => void;
  loadingPlan: PlanId | null;
  ctaLabel: { pro: string; platinum: string; preparing: string };
  disabled?: boolean;
  // Redesign Juli 2026 — komponen ini dipakai di 3 tempat: UpgradeModal
  // (Workspace, TETAP gelap) serta PreviewReport & WizardCapBlocked (kini
  // terang). Default "dark" supaya pemakaian di Workspace tidak berubah
  // sama sekali; pemanggil di halaman terang eksplisit set variant="light".
  variant?: "dark" | "light";
};

function PricingCards({
  visiblePlans = ["pro", "platinum"],
  recommendedTier = null,
  onSelect,
  loadingPlan,
  ctaLabel,
  disabled = false,
  variant = "dark",
}: PricingCardsProps) {
  const { t } = useLanguage();
  const showPro = visiblePlans.includes("pro");
  const showPlatinum = visiblePlans.includes("platinum");
  const isLight = variant === "light";
  const cardBgEnd = isLight ? "to-white" : "to-surface";
  const dividerBorder = isLight ? "border-neutral-200" : "border-white/10";
  const descText = isLight ? "text-neutral-600" : "text-neutral-400";
  const labelMuted = isLight ? "text-neutral-500" : "text-neutral-500";
  const checklistText = isLight ? "text-neutral-800" : "text-neutral-200";

  return (
    <div className={"grid grid-cols-1 gap-5 " + (showPro && showPlatinum ? "sm:grid-cols-2" : "sm:mx-auto sm:max-w-md")}>
      {showPro && (
        <div
          className={
            "relative rounded-2xl border pt-12 " +
            (recommendedTier === "pro" ? "border-primary/60 ring-1 ring-primary/40" : "border-amber-500/30")
          }
        >
          <div className={`absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-amber-500/[0.07] ${cardBgEnd}`} />
          <img
            src={beemoPro}
            alt="Beemo"
            style={mascotMaskStyle}
            className="absolute -top-8 right-4 h-28 w-28 object-cover drop-shadow-[0_8px_24px_rgba(245,158,11,0.35)] sm:-top-10 sm:right-5 sm:h-32 sm:w-32"
          />
          {recommendedTier === "pro" && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-black">
              🐝 {t.previewReport.recommendedBadge}
            </span>
          )}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            <span className="inline-block rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black">PRO</span>

            <h3 className="mt-5 max-w-[65%] text-left text-lg font-extrabold leading-snug sm:max-w-[60%] sm:text-xl">
              {t.pricing.proTitlePrefix} <span className="text-amber-400">{t.pricing.proTitleHighlight}</span>
            </h3>
            <p className={`mt-2.5 text-left text-sm ${descText}`}>{t.pricing.proDesc}</p>

            <div className={`mt-6 border-t ${dividerBorder} pt-5`}>
              <p className={`text-left text-[11px] font-bold uppercase tracking-wide ${labelMuted}`}>{t.pricing.priceOnlyLabel}</p>
              <p className="mt-1 text-left text-3xl font-black text-amber-400 sm:text-4xl">
                {t.pricing.proPriceMonthly}
                <span className={`text-base font-normal ${labelMuted}`}>{t.pricing.proPriceMonthlyUnit}</span>
              </p>
            </div>

            <p className="mt-6 text-left text-xs font-bold uppercase tracking-wide text-amber-400">{t.pricing.proWhatYouGetLabel}</p>
            <ul className="mt-4 space-y-3 text-left">
              {t.pricing.proChecklist.map((item, i) => (
                <li key={item} className={`flex items-start justify-between gap-3 text-sm ${checklistText}`}>
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-amber-500 text-[10px] text-black">
                      ✓
                    </span>
                    {item}
                  </span>
                  <span aria-hidden="true" className="mt-0.5 flex-none text-base opacity-80">
                    {PRO_ICONS[i] ?? "✨"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-500 text-[11px] text-black">
                ★
              </span>
              <p className={"text-xs leading-relaxed " + (isLight ? "text-amber-900" : "text-amber-100/90")}>{t.pricing.proHighlightTagline}</p>
            </div>

            <button
              onClick={() => onSelect("pro")}
              disabled={disabled || loadingPlan !== null}
              className="mt-6 w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPlan === "pro" ? ctaLabel.preparing : ctaLabel.pro}
            </button>
          </div>
        </div>
      )}

      {showPlatinum && (
        <div
          className={
            "relative rounded-2xl border pt-12 " +
            (recommendedTier === "platinum" ? "border-primary/60 ring-1 ring-primary/40" : "border-purple-500/30")
          }
        >
          <div className={`absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-purple-500/[0.08] ${cardBgEnd}`} />
          <img
            src={beemoPlatinum}
            alt="Beemo"
            style={mascotMaskStyle}
            className="absolute -top-8 right-4 h-28 w-28 object-cover drop-shadow-[0_8px_24px_rgba(168,85,247,0.35)] sm:-top-10 sm:right-5 sm:h-32 sm:w-32"
          />
          {recommendedTier === "platinum" && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-black">
              🐝 {t.previewReport.recommendedBadge}
            </span>
          )}
          <div className="px-6 pb-6 sm:px-8 sm:pb-8">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white">
              💎 PLATINUM
            </span>

            <h3 className="mt-5 max-w-[65%] text-left text-lg font-extrabold leading-snug sm:max-w-[60%] sm:text-xl">
              {t.pricing.platinumTitlePrefix} <span className="text-purple-400">{t.pricing.platinumTitleHighlight}</span>
            </h3>
            <p className={`mt-2.5 text-left text-sm ${descText}`}>{t.pricing.platinumDesc}</p>

            <div className={`mt-6 border-t ${dividerBorder} pt-5`}>
              <p className={`text-left text-[11px] font-bold uppercase tracking-wide ${labelMuted}`}>{t.pricing.priceOnlyLabel}</p>
              <p className="mt-1 text-left text-3xl font-black text-purple-400 sm:text-4xl">
                {t.pricing.platinumPriceMonthly}
                <span className={`text-base font-normal ${labelMuted}`}>{t.pricing.platinumPriceMonthlyUnit}</span>
              </p>
            </div>

            <p className="mt-6 text-left text-xs font-bold uppercase tracking-wide text-purple-400">{t.pricing.platinumIncludesNote}</p>
            <ul className="mt-4 space-y-3 text-left">
              {t.pricing.platinumChecklist.map((item, i) => (
                <li key={item} className={`flex items-start justify-between gap-3 text-sm ${checklistText}`}>
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">
                      ✓
                    </span>
                    {item}
                  </span>
                  <span aria-hidden="true" className="mt-0.5 flex-none text-base opacity-80">
                    {PLATINUM_ICONS[i] ?? "✨"}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-purple-500 text-[11px] text-white">
                ★
              </span>
              <p className={"text-xs leading-relaxed " + (isLight ? "text-purple-900" : "text-purple-100/90")}>{t.pricing.platinumHighlightTagline}</p>
            </div>

            <button
              onClick={() => onSelect("platinum")}
              disabled={disabled || loadingPlan !== null}
              className="mt-6 w-full rounded-xl bg-purple-500 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPlan === "platinum" ? ctaLabel.preparing : ctaLabel.platinum}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PricingCards;
