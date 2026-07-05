type Feature = {
  icon: string;
  title: string;
  desc: string;
};

type FeaturesProps = {
  animate: boolean;
};

const features: Feature[] = [
  {
    icon: "📊",
    title: "Memahami Kondisi Bisnis",
    desc: "Ketahui kekuatan, kelemahan, peluang, dan tantangan bisnis Anda dalam satu laporan.",
  },
  {
    icon: "🎯",
    title: "Mempelajari Kompetitor",
    desc: "Pahami keunggulan pesaing dan temukan cara agar bisnis Anda lebih unggul.",
  },
  {
    icon: "🧭",
    title: "Menemukan Peluang Pasar",
    desc: "Identifikasi peluang baru yang masih dapat dimanfaatkan untuk mengembangkan bisnis.",
  },
  {
    icon: "🗺️",
    title: "Menentukan Strategi",
    desc: "Dapatkan rekomendasi langkah yang dapat langsung diterapkan sesuai kondisi bisnis Anda.",
  },
];

const delays = ["0ms", "80ms", "160ms", "240ms"];

function Features({ animate }: FeaturesProps) {
  const fade = (delay: string) => (animate ? `animate-fade-up [animation-delay:${delay}]` : "");

  return (
    <section className="py-16" id="fitur">
      <div className="mx-auto max-w-6xl px-6">

        <div className={"mx-auto mb-10 max-w-xl text-center " + fade("0ms")}>
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-primary
            before:h-px before:w-5 before:bg-gradient-to-r before:from-transparent before:to-primary before:content-['']
            after:h-px after:w-5 after:bg-gradient-to-r after:from-primary after:to-transparent after:content-['']">
            Fitur AI
          </span>
          <h2 className="mt-2 text-3xl font-extrabold">Semua Analisis Bisnis yang Anda Butuhkan dalam Satu Platform</h2>
          <p className="mt-3 text-neutral-300">
            Mulai dari memahami kondisi bisnis hingga menyusun strategi, semuanya
            tersedia dalam satu laporan profesional.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <div
              key={f.title}
              className={"group relative overflow-hidden rounded-2xl border border-white/10 bg-surface p-6 transition-transform hover:-translate-y-1 hover:border-primary/40 " + fade(delays[i])}
            >
              <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl transition-transform duration-300 group-hover:scale-110">
                {f.icon}
              </div>
              <h3 className="mb-2 font-bold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-300">{f.desc}</p>
              <span className="mt-3 inline-block text-primary opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">→</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Features;