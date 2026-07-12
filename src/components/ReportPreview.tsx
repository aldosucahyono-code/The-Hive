import { useLanguage } from "../i18n/LanguageContext";

type ReportPreviewProps = {
  onStart: () => void;
  animate: boolean;
};

/** Section "Contoh Laporan" — landing page terang, Juli 2026.
 *
 * PENTING: exampleLabel ("Contoh Ilustrasi") ditampilkan MENONJOL di atas
 * kartu SWOT, karena data di kartu ini adalah ilustrasi format laporan,
 * BUKAN data pelanggan asli (THE HIVE belum punya pelanggan asli). Ini
 * murni menunjukkan JENIS insight yang benar-benar dihasilkan platform,
 * konsisten dengan keputusan user untuk tidak menampilkan testimoni palsu. */
function ReportPreview({ onStart, animate }: ReportPreviewProps) {
  const { t, lang } = useLanguage();
  const fade = (delay?: string) => (animate ? `animate-fade-up${delay ? ` [animation-delay:${delay}]` : ""}` : "");

  const swotGroups = [
    { key: "S", title: lang === "id" ? "Kekuatan" : "Strengths", items: t.reportPreview.swotStrengths, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { key: "W", title: lang === "id" ? "Kelemahan" : "Weaknesses", items: t.reportPreview.swotWeaknesses, color: "text-amber-600 bg-amber-50 border-amber-200" },
    { key: "O", title: lang === "id" ? "Peluang" : "Opportunities", items: t.reportPreview.swotOpportunities, color: "text-sky-600 bg-sky-50 border-sky-200" },
    { key: "T", title: lang === "id" ? "Ancaman" : "Threats", items: t.reportPreview.swotThreats, color: "text-rose-600 bg-rose-50 border-rose-200" },
  ];

  return (
    <section className="scroll-mt-[130px] py-16 md:scroll-mt-[96px]" id="contoh-laporan">
      <div className="mx-auto max-w-6xl px-6">
        <div className={"mx-auto mb-10 max-w-xl text-center " + fade()}>
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-primary
            before:h-px before:w-5 before:bg-gradient-to-r before:from-transparent before:to-primary before:content-['']
            after:h-px after:w-5 after:bg-gradient-to-r after:from-primary after:to-transparent after:content-['']">
            {t.reportPreview.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-neutral-900">{t.reportPreview.title}</h2>
          <p className="mt-3 text-neutral-600">{t.reportPreview.desc}</p>
        </div>

        <div className={"mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 " + fade("100ms")}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-5">
            <div>
              <span className="inline-block rounded-full bg-neutral-900 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                {t.reportPreview.exampleLabel}
              </span>
              <h3 className="mt-2 text-lg font-bold text-neutral-900">{t.reportPreview.sampleBusinessName}</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {swotGroups.map((group) => (
              <div key={group.key} className={"rounded-xl border p-4 " + group.color}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide">{group.title}</p>
                <ul className="space-y-1 text-sm leading-relaxed">
                  {group.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-neutral-100 pt-6">
            {t.reportPreview.checklist.map((item) => (
              <span
                key={item}
                className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600"
              >
                ✓ {item}
              </span>
            ))}
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onStart}
              className="rounded-xl bg-primary px-7 py-3.5 text-sm font-bold text-black transition-transform hover:-translate-y-0.5"
            >
              {t.reportPreview.ctaButton}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReportPreview;
