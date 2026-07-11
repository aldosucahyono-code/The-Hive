import { useLanguage } from "../i18n/LanguageContext";
import beemoMascot from "../assets/mascot/beemo.png";
import beemoLaptop from "../assets/mascot/beemo-laptop.png";

type PricingProps = {
  onStart: () => void;
  animate: boolean;
};

// Ikon per baris checklist (audit desain Juli 2026 — samakan komposisi
// dengan mockup "Paket Bisnis" yang baru: tiap baris checklist punya ikon
// kecil di kanan, bukan cuma centang polos). Emoji dipakai konsisten
// dengan gaya `pricing.badges` yang sudah ada di bawah section ini —
// bukan dependency ikon baru.
const PRO_ICONS = ["📄", "🥧", "🎯", "📋", "📢", "💬"];
const PLATINUM_ICONS = ["🗂️", "🔍", "📈", "📝", "👥", "📄", "💬"];

function Pricing({ onStart, animate }: PricingProps) {
  const { t } = useLanguage();
  const fade = (delay: string) => (animate ? `animate-fade-up [animation-delay:${delay}]` : "");

  return (
    <section className="scroll-mt-[130px] py-16 md:scroll-mt-[96px]" id="paket">
      <div className="mx-auto max-w-5xl px-6">
        <div className={"mb-10 text-center " + fade("0ms")}>
          <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
            {t.pricing.earlyBirdBadge}
          </span>
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            {t.pricing.title}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-300">
            {t.pricing.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* PRO — tema amber/orange, sama dengan mockup baru. Mascot
              diposisikan absolute (bukan di dalam alur flex) supaya bisa
              "mengintip" di atas garis tepi kartu, sama seperti mockup —
              makanya wrapper kartu TIDAK overflow-hidden (kalau di-hidden,
              bagian mascot yang keluar dari tepi atas akan terpotong).
              Warna gradasi latar dipindah ke layer terpisah (inset-0,
              z-index di bawah) supaya sudut membulat kartu tetap rapi
              tanpa perlu overflow-hidden di wrapper utama. */}
          <div className={"relative rounded-2xl border border-amber-500/30 pt-12 " + fade("80ms")}>
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-amber-500/[0.07] to-surface" />
            <img
              src={beemoMascot}
              alt="Beemo"
              className="absolute -top-9 right-5 h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(245,158,11,0.35)] sm:-top-11 sm:right-6 sm:h-32 sm:w-32"
            />
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <span className="inline-block rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-black">PRO</span>

              <h3 className="mt-5 max-w-[65%] text-left text-lg font-extrabold leading-snug sm:max-w-[60%] sm:text-xl">
                {t.pricing.proTitlePrefix} <span className="text-amber-400">{t.pricing.proTitleHighlight}</span>
              </h3>
              <p className="mt-2.5 text-left text-sm text-neutral-400">{t.pricing.proDesc}</p>

              <div className="mt-7 border-t border-white/10 pt-6">
                <p className="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.pricing.priceOnlyLabel}</p>
                <p className="mt-1 text-left text-4xl font-black text-amber-400 sm:text-5xl">
                  {t.pricing.proPriceMonthly}
                  <span className="text-base font-normal text-neutral-500">{t.pricing.proPriceMonthlyUnit}</span>
                </p>
                <p className="mt-2 text-left text-xs font-semibold text-amber-300">{t.pricing.proPriceAnnual}</p>
                <p className="mt-0.5 text-left text-[11px] text-neutral-500">{t.pricing.proPriceAnnualNote}</p>
              </div>

              <p className="mt-8 text-left text-xs font-bold uppercase tracking-wide text-amber-400">{t.pricing.proWhatYouGetLabel}</p>
              <ul className="mt-4 space-y-3.5 text-left">
                {t.pricing.proChecklist.map((item, i) => (
                  <li key={item} className="flex items-center justify-between gap-3 text-sm text-neutral-200">
                    <span className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-amber-500 text-[10px] text-black">
                        ✓
                      </span>
                      {item}
                    </span>
                    <span aria-hidden="true" className="flex-none text-base opacity-80">
                      {PRO_ICONS[i] ?? "✨"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-amber-500 text-[11px] text-black">
                  ★
                </span>
                <p className="text-xs leading-relaxed text-amber-100/90">{t.pricing.proHighlightTagline}</p>
              </div>
            </div>
          </div>

          {/* PLATINUM — tema ungu, "raja lebah". Struktur sama dengan PRO
              di atas (mascot absolute mengintip di tepi atas). */}
          <div className={"relative rounded-2xl border border-purple-500/30 pt-12 " + fade("160ms")}>
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-purple-500/[0.08] to-surface" />
            <img
              src={beemoLaptop}
              alt="Beemo"
              className="absolute -top-9 right-5 h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(168,85,247,0.35)] sm:-top-11 sm:right-6 sm:h-32 sm:w-32"
            />
            <div className="px-6 pb-6 sm:px-8 sm:pb-8">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white">
                💎 PLATINUM
              </span>

              <h3 className="mt-5 max-w-[65%] text-left text-lg font-extrabold leading-snug sm:max-w-[60%] sm:text-xl">
                {t.pricing.platinumTitlePrefix} <span className="text-purple-400">{t.pricing.platinumTitleHighlight}</span>
              </h3>
              <p className="mt-2.5 text-left text-sm text-neutral-400">{t.pricing.platinumDesc}</p>

              <div className="mt-7 border-t border-white/10 pt-6">
                <p className="text-left text-[11px] font-bold uppercase tracking-wide text-neutral-500">{t.pricing.priceOnlyLabel}</p>
                <p className="mt-1 text-left text-4xl font-black text-purple-400 sm:text-5xl">
                  {t.pricing.platinumPriceMonthly}
                  <span className="text-base font-normal text-neutral-500">{t.pricing.platinumPriceMonthlyUnit}</span>
                </p>
                <p className="mt-2 text-left text-xs font-semibold text-purple-300">{t.pricing.platinumPriceAnnual}</p>
                <p className="mt-0.5 text-left text-[11px] text-neutral-500">{t.pricing.platinumPriceAnnualNote}</p>
              </div>

              <p className="mt-8 text-left text-xs font-bold uppercase tracking-wide text-purple-400">{t.pricing.platinumIncludesNote}</p>
              <ul className="mt-4 space-y-3.5 text-left">
                {t.pricing.platinumChecklist.map((item, i) => (
                  <li key={item} className="flex items-center justify-between gap-3 text-sm text-neutral-200">
                    <span className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">
                        ✓
                      </span>
                      {item}
                    </span>
                    <span aria-hidden="true" className="flex-none text-base opacity-80">
                      {PLATINUM_ICONS[i] ?? "✨"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex items-start gap-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-purple-500 text-[11px] text-white">
                  ★
                </span>
                <p className="text-xs leading-relaxed text-purple-100/90">{t.pricing.platinumHighlightTagline}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {t.pricing.badges.map((b, i) => (
            <div
              key={b.title}
              className={
                "group relative overflow-hidden rounded-xl border border-white/10 bg-surface p-4 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 " +
                fade(`${80 + i * 40}ms`)
              }
            >
              <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
              <div className="mb-1 text-xl">{b.icon}</div>
              <p className="text-xs font-bold text-neutral-200">{b.title}</p>
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className={"mt-10 text-center " + fade("400ms")}>
          <button
            onClick={onStart}
            className="group relative w-full overflow-hidden rounded-xl bg-primary py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5 sm:w-auto sm:px-10"
          >
            <span className="relative z-10">{t.pricing.ctaButton}</span>
            <span className="absolute inset-y-0 left-[-75%] w-1/2 -skew-x-12 bg-white/40 transition-[left] duration-500 group-hover:left-[125%]"></span>
          </button>
          <p className="mt-3 text-sm text-neutral-400">
            {t.pricing.ctaSubtext}
          </p>
        </div>
      </div>
    </section>
  );
}

export default Pricing;
