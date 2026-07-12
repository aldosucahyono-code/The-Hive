import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

/** Section FAQ — landing page terang, Juli 2026. Menggantikan posisi nav
 * "Tentang Kami" (rute #tentang-kami lama TETAP ada, cuma tidak lagi
 * ditaut dari nav homepage) — isinya konten seputar "tentang kami"
 * dibungkus format tanya-jawab per instruksi user. Accordion sederhana,
 * satu item terbuka pada satu waktu. */
function FAQSection({ animate }: { animate: boolean }) {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const fade = animate ? "animate-fade-up" : "";

  return (
    <section className="scroll-mt-[130px] bg-neutral-50 py-16 md:scroll-mt-[96px]" id="faq">
      <div className="mx-auto max-w-3xl px-6">
        <div className={"mx-auto mb-10 max-w-xl text-center " + fade}>
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-primary
            before:h-px before:w-5 before:bg-gradient-to-r before:from-transparent before:to-primary before:content-['']
            after:h-px after:w-5 after:bg-gradient-to-r after:from-primary after:to-transparent after:content-['']">
            {t.faq.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-neutral-900">{t.faq.title}</h2>
        </div>

        <div className={"space-y-3 " + fade}>
          {t.faq.items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={item.q} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-semibold text-neutral-900">{item.q}</span>
                  <span className={"flex-shrink-0 text-neutral-400 transition-transform " + (isOpen ? "rotate-45" : "")}>+</span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm leading-relaxed text-neutral-600">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FAQSection;
