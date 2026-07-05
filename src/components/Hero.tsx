import mascot from "../assets/mascot/beemo.png";

type HeroProps = {
  onStart: () => void;
  animate: boolean;
};

function Hero({ onStart, animate }: HeroProps) {
  const fade = (delay?: string) => {
    if (!animate) return "";
    return delay ? `animate-fade-up [animation-delay:${delay}]` : "animate-fade-up";
  };

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">

        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">

          <div>
            <span className={"mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary " + fade()}>
              🔥 Harga Beta Terbatas
            </span>

            <h1 className={"text-4xl font-black leading-tight sm:text-5xl " + fade()}>
              Dapatkan Laporan Analisis Bisnis Profesional dalam Hitungan Menit
            </h1>

            <p className={"mt-5 max-w-lg text-base leading-relaxed text-neutral-300 " + fade("100ms")}>
              Masukkan informasi bisnis Anda. Beemo akan menganalisis kondisi bisnis,
              membandingkan kompetitor, menemukan peluang pasar, lalu menyusun laporan
              profesional yang siap digunakan dalam beberapa menit.
            </p>

            <button
              onClick={onStart}
              className={"group relative mt-6 overflow-hidden rounded-xl bg-primary px-7 py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5 " + fade("200ms")}
            >
              <span className="relative z-10">🚀 Mulai Analisis Bisnis Gratis!!</span>
              <span className="absolute inset-y-0 left-[-75%] w-1/2 -skew-x-12 bg-white/40 transition-[left] duration-500 group-hover:left-[125%]"></span>
            </button>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className={"max-w-xs rounded-2xl border border-primary/30 bg-surface p-5 " + fade("150ms")}>
              <h3 className="mb-2 font-semibold text-primary">Halo, saya Beemo.</h3>
              <p className="text-sm leading-relaxed text-neutral-300">
                Ceritakan bisnis Anda. Saya akan membantu menganalisis kondisi bisnis,
                menemukan peluang pasar, mempelajari kompetitor, dan menyusun
                rekomendasi yang dapat langsung digunakan.
              </p>
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute h-64 w-64 rounded-full bg-primary/20 blur-3xl"></div>
              <img
                src={mascot}
                alt="Beemo AI"
                className={"relative w-64 drop-shadow-[0_0_40px_rgba(255,152,0,0.4)] " + (animate ? "animate-float-y" : "")}
              />
            </div>
          </div>

        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className={"group relative overflow-hidden rounded-xl border border-white/10 bg-surface p-4 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 " + fade("250ms")}>
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
            <div className="mb-1 text-2xl">📄</div>
            <p className="text-sm text-neutral-300">Laporan Profesional</p>
          </div>
          <div className={"group relative overflow-hidden rounded-xl border border-white/10 bg-surface p-4 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 " + fade("300ms")}>
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
            <div className="mb-1 text-2xl">🔒</div>
            <p className="text-sm text-neutral-300">Data Bisnis Aman</p>
          </div>
          <div className={"group relative overflow-hidden rounded-xl border border-white/10 bg-surface p-4 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 " + fade("350ms")}>
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
            <div className="mb-1 text-2xl">⚡</div>
            <p className="text-sm text-neutral-300">Hasil dalam Beberapa Menit</p>
          </div>
          <div className={"group relative overflow-hidden rounded-xl border border-white/10 bg-surface p-4 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 " + fade("400ms")}>
            <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
            <div className="mb-1 text-2xl">🏢</div>
            <p className="text-sm text-neutral-300">Untuk UMKM, Startup & Perusahaan</p>
          </div>
        </div>

      </div>
    </section>
  );
}

export default Hero;