import { useLanguage } from "../i18n/LanguageContext";
import Reveal from "./Reveal";

const delays = ["0ms", "120ms", "240ms"];

/** Section "Cara Kerja" — landing page terang, Juli 2026. 3 langkah
 * sederhana, tanpa klaim/janji hasil, cuma menjelaskan alur produk.
 * <Reveal> = transisi ringan saat section masuk viewport (lihat
 * Reveal.tsx), sama seperti transisi Tentang Kami. */
function HowItWorks({ animate }: { animate: boolean }) {
  const { t } = useLanguage();
  const fade = (delay: string) => (animate ? `animate-fade-up [animation-delay:${delay}]` : "");

  return (
    <section className="scroll-mt-[130px] bg-neutral-50 py-16 md:scroll-mt-[96px]" id="cara-kerja">
      <Reveal className="mx-auto max-w-6xl px-6">
        <div className={"mx-auto mb-10 max-w-xl text-center " + fade("0ms")}>
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-primary
            before:h-px before:w-5 before:bg-gradient-to-r before:from-transparent before:to-primary before:content-['']
            after:h-px after:w-5 after:bg-gradient-to-r after:from-primary after:to-transparent after:content-['']">
            {t.howItWorks.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-neutral-900">{t.howItWorks.title}</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {t.howItWorks.steps.map((step, i) => (
            <div
              key={step.title}
              className={"relative rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm " + fade(delays[i])}
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-black text-primary">
                {i + 1}
              </div>
              <h3 className="mb-2 font-bold text-neutral-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default HowItWorks;
