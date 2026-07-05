type PricingProps = {
  onStart: () => void;
  animate: boolean;
};

const proChecklist = [
  "Analisis kondisi bisnis & skor kesehatan bisnis",
  "SWOT lengkap, analisis kompetitor & peluang pasar",
  "Strategi marketing & rekomendasi operasional",
  "Prioritas aksi 30-60-90 hari & roadmap bisnis",
  "Ringkas, mudah dipahami, langsung bisa diterapkan",
];

const platinumChecklist = [
  "Executive, Consumer, Competitive & Industry Intelligence",
  "Scenario Planning, Decision Matrix & Growth Strategy",
  "AI Executive Consultant & Business Dashboard Profesional",
  "Research Appendix & data pendukung terpercaya",
  "Insight lebih dalam untuk strategi jangka panjang",
];

const badges = [
  { icon: "📊", title: "Analisis Berbasis Data", desc: "Keputusan berdasarkan data, bukan asumsi." },
  { icon: "🧠", title: "AI + Business Intelligence", desc: "Teknologi AI dan BI untuk insight yang akurat." },
  { icon: "⚡", title: "Cepat & Praktis", desc: "Siap dalam hitungan menit, langsung bisa digunakan." },
  { icon: "🎯", title: "Strategi yang Dapat Diterapkan", desc: "Fokus pada rekomendasi yang realistis dan relevan." },
  { icon: "🛡️", title: "Terpercaya & Profesional", desc: "Sumber data valid, analisis mendalam, kualitas terjamin." },
  { icon: "👥", title: "Untuk Semua Pelaku Usaha", desc: "Dari UMKM hingga perusahaan besar di seluruh Indonesia." },
];

function Pricing({ onStart, animate }: PricingProps) {
  const fade = (delay: string) => (animate ? `animate-fade-up [animation-delay:${delay}]` : "");

  return (
    <section className="py-16" id="paket">
      <div className="mx-auto max-w-5xl px-6">
        <div className={"mb-10 text-center " + fade("0ms")}>
          <span className="mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary">
            🔥 Harga Beta Terbatas
          </span>
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            Pilih Laporan yang Tepat untuk Bisnis Anda
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-neutral-300">
            Dua pilihan laporan yang dirancang untuk menjawab kebutuhan bisnis Anda, dari
            analisis praktis hingga strategi tingkat eksekutif.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* PRO */}
          <div className={"rounded-2xl border border-blue-500/30 bg-surface p-8 text-center " + fade("80ms")}>
            <span className="inline-block rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white">
              PRO
            </span>
            <h3 className="mt-4 text-lg font-extrabold">Laporan Praktis untuk Aksi Nyata</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Cocok untuk UMKM, toko, kuliner, jasa, online shop, freelancer, dan bisnis mikro.
            </p>
            <p className="mt-4 text-3xl font-black text-blue-400">Rp99.000</p>
            <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left">
              {proChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-200">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* PLATINUM */}
          <div className={"rounded-2xl border border-purple-500/30 bg-surface p-8 text-center " + fade("160ms")}>
            <span className="inline-block rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white">
              PLATINUM
            </span>
            <h3 className="mt-4 text-lg font-extrabold">Analisis Mendalam untuk Keputusan Strategis</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Cocok untuk perusahaan, startup, investor, pemilik bisnis besar, dan pengambil keputusan.
            </p>
            <p className="mt-4 text-3xl font-black text-purple-400">Rp299.000</p>
            <p className="mt-6 text-left text-xs font-bold uppercase tracking-wide text-purple-300">
              Semua di PRO, ditambah:
            </p>
            <ul className="mx-auto mt-3 max-w-sm space-y-2.5 text-left">
              {platinumChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-200">
                  <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-purple-500 text-[10px] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {badges.map((b, i) => (
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
            <span className="relative z-10">🚀 Mulai Analisis Bisnis Sekarang</span>
            <span className="absolute inset-y-0 left-[-75%] w-1/2 -skew-x-12 bg-white/40 transition-[left] duration-500 group-hover:left-[125%]"></span>
          </button>
          <p className="mt-3 text-sm text-neutral-400">
            Pilih paket yang sesuai dengan kebutuhan Anda. Investasi kecil untuk keputusan besar.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Pricing;
