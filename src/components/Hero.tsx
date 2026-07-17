import mascot from "../assets/mascot/beemo-laptop-v2.png";
import industryKuliner from "../assets/mascot/industry-kuliner-fnb.jpg";
import industryRetail from "../assets/mascot/industry-retail-fashion.jpg";
import industryJasa from "../assets/mascot/industry-jasa-konsultasi.jpg";
import industryKesehatan from "../assets/mascot/industry-kesehatan-kecantikan.jpg";
import industryOtomotif from "../assets/mascot/industry-otomotif.jpg";
import industryPendidikan from "../assets/mascot/industry-pendidikan.jpg";
import { useLanguage } from "../i18n/LanguageContext";

type HeroProps = {
  onStart: () => void;
  animate: boolean;
};

// Ikon per industri — urutan HARUS sejajar dengan t.hero.industries (lihat
// translations.ts, id & en). Redesign Juli 2026: emoji generik diganti
// gambar produk asli buatan user (dikompres dari ~2.5MB/gambar jadi
// ~20-30KB/gambar via resize+JPEG q82 supaya tetap ringan). Wadah jadi
// kartu rounded-square (bukan hexagon) supaya detail foto tidak terlalu
// dipepetkan ke bentuk hex yang sempit.
const INDUSTRY_IMAGES = [industryKuliner, industryRetail, industryJasa, industryKesehatan, industryOtomotif, industryPendidikan];

/** Hero landing page (redesign Juli 2026) — versi terang, dua kolom,
 * tanpa janji/klaim (bukan testimoni, bukan angka pertumbuhan fiktif).
 * Filosofi dari user: "landing page bukan membuat janji, tapi membuat
 * orang jadi tertarik untuk akses THE HIVE." CTA sekunder mengarah ke
 * section Contoh Laporan (bukan klaim baru, cuma preview nyata). */
function Hero({ onStart, animate }: HeroProps) {
  const { t } = useLanguage();

  const fade = (delay?: string) => {
    if (!animate) return "";
    return delay ? `animate-fade-up [animation-delay:${delay}]` : "animate-fade-up";
  };

  function scrollToReportPreview(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    document.getElementById("contoh-laporan")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-[1.15fr_1fr]">
          <div>
            <span className={"mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary " + fade()}>
              {t.hero.eyebrow}
            </span>

            {/* Round 4 audit (mobile/responsive pass, GPT + code audit, 17 Juli
                2026): whitespace-nowrap dulu dipasang di SEMUA breakpoint --
                di layar HP sempit (~375-390px) baris seperti "Reach Your
                First Rp100 Million." (EN) lebih lebar dari area kontennya,
                dan karena body punya overflow-x:hidden global, teksnya
                TERPOTONG DIAM-DIAM tanpa scrollbar/tanda apa pun -- pengguna
                gaptek tidak akan sadar ada teks yang hilang. Sekarang
                whitespace-nowrap cuma aktif dari sm: ke atas; di mobile,
                teks dibiarkan wrap alami ke baris kedua daripada terpotong. */}
            <h1 className={"text-3xl font-black leading-tight text-neutral-900 sm:text-4xl lg:text-[2.65rem] xl:text-5xl " + fade()}>
              <span className="block sm:whitespace-nowrap">{t.hero.titleLine1}</span>
              <span className="block sm:whitespace-nowrap">{t.hero.titleLine2}</span>
              <span className="block text-primary sm:whitespace-nowrap">{t.hero.titleLine3}</span>
            </h1>

            <p className={"mt-5 max-w-lg text-base leading-relaxed text-neutral-600 " + fade("100ms")}>
              {t.hero.subtitle}
            </p>

            <div className={"mt-6 flex flex-wrap items-center gap-3 " + fade("200ms")}>
              <button
                onClick={onStart}
                className="group relative overflow-hidden rounded-xl bg-primary px-7 py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5"
              >
                <span className="relative z-10">{t.hero.ctaPrimary}</span>
                <span className="absolute inset-y-0 left-[-75%] w-1/2 -skew-x-12 bg-white/40 transition-[left] duration-500 group-hover:left-[125%]"></span>
              </button>
              <a
                href="#contoh-laporan"
                onClick={scrollToReportPreview}
                className="rounded-xl border border-neutral-300 px-7 py-4 text-base font-bold text-neutral-800 transition-colors hover:border-neutral-400"
              >
                {t.hero.ctaSecondary}
              </a>
            </div>
          </div>

          <div className="relative flex items-center justify-center overflow-hidden">
            <div className="absolute h-[26rem] w-[34rem] rounded-full bg-primary/10 blur-3xl"></div>
            <img
              src={mascot}
              alt="Beemo AI"
              className={"relative w-full max-w-2xl drop-shadow-[0_10px_40px_rgba(255,152,0,0.25)] " + (animate ? "animate-float-y" : "")}
            />
          </div>
        </div>

        {/* Daftar industri — full-width, grid kartu foto produk (bukan pil
            teks biasa) mengikuti gaya baris "trust logo" di mockup, tapi
            isinya tetap kategori industri generik (BUKAN nama bisnis fiktif
            — keputusan sebelumnya: "Ganti jadi daftar industri yang
            didukung"). Sempat pakai badge hexagon + emoji, diganti kartu
            rounded-square + foto produk asli (Juli 2026, lihat
            INDUSTRY_IMAGES di atas). */}
        <div className={"mt-14 border-t border-neutral-100 pt-10 text-center sm:mt-16 sm:pt-12 " + fade("250ms")}>
          <p className="mb-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {t.hero.industriesLabel}
          </p>
          <div className="mx-auto grid max-w-4xl grid-cols-3 gap-x-6 gap-y-10 sm:grid-cols-6">
            {t.hero.industries.map((industry, i) => (
              <div key={industry} className="flex flex-col items-center gap-3">
                <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm sm:h-24 sm:w-24">
                  <img
                    src={INDUSTRY_IMAGES[i]}
                    alt={industry}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="text-sm font-medium leading-tight text-neutral-600">{industry}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
