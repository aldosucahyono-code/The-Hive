import { useLanguage } from "../i18n/LanguageContext";
import Reveal from "./Reveal";

const delays = ["0ms", "90ms", "180ms", "270ms"];

/** Section "Apa yang Ditemukan THE HIVE" — landing page terang, Juli 2026
 * (round 4 audit, keputusan bareng GPT). Pengganti PERMANEN untuk rencana
 * "testimoni pelanggan" yang tidak pernah diimplementasikan karena THE HIVE
 * belum punya pelanggan asli untuk dikutip (lihat komentar
 * t.reportPreview.exampleLabel & t.insightAgregat di translations.ts).
 *
 * Ini BUKAN testimoni bernama dan BUKAN statistik yang dikarang — murni
 * pola kualitatif yang jujur mencerminkan apa yang benar-benar dilakukan
 * Beemo (analisis profil bisnis, kompetitor, legalitas, rencana aksi).
 * Diposisikan setelah Preview Laporan & sebelum FAQ, sesuai rekomendasi
 * GPT: pengunjung sudah lihat CONTOH laporan, lalu di sini melihat BUKTI
 * kompetensi analitis platform, baru masuk FAQ untuk keraguan terakhir. */
function InsightAgregat({ animate }: { animate: boolean }) {
  const { t } = useLanguage();
  const fade = (delay: string) => (animate ? `animate-fade-up [animation-delay:${delay}]` : "");

  return (
    <section className="scroll-mt-[130px] bg-white py-16 md:scroll-mt-[96px]" id="insight-agregat">
      <Reveal className="mx-auto max-w-6xl px-6">
        <div className={"mx-auto mb-10 max-w-2xl text-center " + fade("0ms")}>
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-primary
            before:h-px before:w-5 before:bg-gradient-to-r before:from-transparent before:to-primary before:content-['']
            after:h-px after:w-5 after:bg-gradient-to-r after:from-primary after:to-transparent after:content-['']">
            {t.insightAgregat.eyebrow}
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-neutral-900">{t.insightAgregat.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-neutral-500">{t.insightAgregat.desc}</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {t.insightAgregat.insights.map((insight, i) => (
            <div
              key={insight.title}
              className={"rounded-2xl border border-neutral-200 bg-neutral-50 p-6 " + fade(delays[i] || "0ms")}
            >
              <h3 className="mb-2 font-bold text-neutral-900">{insight.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{insight.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default InsightAgregat;
