import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import founderPhoto from "../assets/founder/aldo.png";
import hiveLogo from "../assets/logo/hive-logo.png";

/** Minimal scroll-reveal via IntersectionObserver — no animation library,
 * matches the guidance's "CSS Transition/Animation + Intersection Observer,
 * jangan library animasi berat". */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/** Shared list style for every "numbered insight" accordion (Misi, Mengapa
 * Harus, Nilai) so they all read as one consistent design language instead
 * of three different list styles. A light hover shift is the only motion
 * here — deliberately subtle. */
function NumberedList({ items }: { items: { title: string; text?: string }[] }) {
  return (
    <ol className="space-y-4">
      {items.map((m, i) => (
        <li
          key={m.title}
          className="group flex gap-3 transition-transform duration-300 ease-out hover:translate-x-1"
        >
          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-black">
            {i + 1}
          </span>
          <div>
            <p className="font-semibold text-neutral-200">{m.title}</p>
            {m.text && <p className="mt-1 text-neutral-400">{m.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

type AccordionItem = {
  icon: string;
  title: string;
  content: ReactNode;
};

const accordionItems: AccordionItem[] = [
  {
    icon: "👁️",
    title: "Visi Kami",
    content:
      "Kami percaya bahwa setiap pelaku usaha berhak memiliki akses terhadap analisis bisnis kelas profesional. THE HIVE hadir untuk menghilangkan kesenjangan tersebut dengan menghadirkan Artificial Intelligence dan Business Intelligence yang membantu setiap keputusan bisnis menjadi lebih cerdas, lebih cepat, dan lebih berdampak. Visi kami adalah menjadi platform AI Business Intelligence paling dipercaya di Indonesia yang mengubah data menjadi keputusan, keputusan menjadi pertumbuhan, dan pertumbuhan menjadi masa depan bisnis yang lebih baik.",
  },
  {
    icon: "🎯",
    title: "Misi Kami",
    content: (
      <NumberedList
        items={[
          {
            title: "Menghadirkan Analisis Bisnis Profesional untuk Semua",
            text: "Kami percaya bahwa setiap pelaku usaha berhak mendapatkan akses terhadap analisis bisnis berkualitas. Karena itu, kami membangun teknologi yang mampu menyederhanakan proses analisis tanpa mengurangi kedalaman insight yang diberikan.",
          },
          {
            title: "Mengubah Data Menjadi Keputusan yang Bernilai",
            text: "Kami mengolah berbagai informasi bisnis menjadi rekomendasi yang jelas, terukur, dan dapat langsung digunakan, sehingga setiap keputusan didasarkan pada data, bukan sekadar asumsi.",
          },
          {
            title: "Membantu Bisnis Bertumbuh Secara Berkelanjutan",
            text: "THE HIVE tidak hanya membantu menyelesaikan masalah hari ini, tetapi juga membantu pelaku usaha melihat peluang baru, memahami risiko, dan menyusun strategi pertumbuhan jangka panjang.",
          },
          {
            title: "Menggabungkan Artificial Intelligence dan Business Intelligence",
            text: "Kami mengintegrasikan kecerdasan buatan dengan pendekatan Business Intelligence agar setiap laporan tidak hanya cepat dihasilkan, tetapi juga relevan, mudah dipahami, dan memiliki nilai praktis.",
          },
          {
            title: "Terus Belajar, Terus Berkembang",
            text: "Kami berkomitmen untuk terus meningkatkan kualitas AI, memperluas sumber data, serta menyempurnakan metode analisis agar THE HIVE selalu memberikan insight yang semakin akurat seiring berkembangnya dunia bisnis.",
          },
          {
            title: "Membangun Ekosistem Keputusan Bisnis Indonesia",
            text: "Kami ingin menjadi mitra berpikir bagi jutaan pelaku usaha Indonesia, membantu mereka memahami bisnisnya lebih dalam, mengambil keputusan yang lebih baik, dan menciptakan dampak nyata bagi pertumbuhan ekonomi nasional.",
          },
        ]}
      />
    ),
  },
  {
    icon: "💡",
    title: "Kenapa THE HIVE Dibuat?",
    content:
      "THE HIVE lahir dari keyakinan bahwa keputusan bisnis terbaik selalu dimulai dari data, bukan dugaan. Kami percaya setiap pelaku usaha, mulai dari UMKM hingga perusahaan besar, berhak mendapatkan analisis bisnis yang akurat tanpa harus memiliki tim konsultan atau kemampuan teknis yang rumit. Melalui perpaduan Artificial Intelligence (AI) dan analisis bisnis modern, THE HIVE membantu Anda memahami kondisi usaha, mengenali peluang pasar, menganalisis kompetitor, serta mengambil keputusan dengan lebih percaya diri. Tujuan kami sederhana: membuat analisis bisnis profesional menjadi lebih cepat, mudah, dan terjangkau agar semakin banyak bisnis di Indonesia dapat tumbuh secara berkelanjutan.",
  },
  {
    icon: "🔶",
    title: 'Filosofi Nama "THE HIVE"',
    content: (
      <>
        <p>
          THE HIVE bukan sekadar nama, tetapi sebuah filosofi. Terinspirasi dari cara lebah bekerja dalam satu ekosistem yang penuh disiplin, kolaborasi, dan kecerdasan, setiap bagian memiliki peran untuk menghasilkan sesuatu yang bernilai. Begitu pula THE HIVE yang menggabungkan berbagai sumber data, analisis, dan teknologi AI menjadi satu sistem yang mampu memberikan pemahaman bisnis secara menyeluruh.
        </p>
        <p className="mt-3">
          Seperti lebah yang mengubah nektar menjadi madu, THE HIVE mengubah ribuan data menjadi wawasan yang mudah dipahami dan siap digunakan. Hasilnya bukan sekadar angka atau grafik, melainkan rekomendasi yang membantu pelaku usaha mengambil keputusan lebih cepat, lebih tepat, dan lebih percaya diri untuk mengembangkan bisnisnya.
        </p>
      </>
    ),
  },
  {
    icon: "⭐",
    title: "Mengapa Harus THE HIVE?",
    content: (
      <NumberedList
        items={[
          { title: "Business Intelligence yang Berorientasi Keputusan" },
          { title: "Artificial Intelligence yang Memahami Konteks Bisnis" },
          { title: "Dibangun Khusus untuk Pelaku Usaha Indonesia" },
          { title: "Laporan Profesional yang Siap Digunakan" },
          { title: "Rekomendasi yang Dapat Langsung Diterapkan" },
          { title: "Dibangun untuk Menjadi Mitra Bisnis, Bukan Sekadar AI" },
        ]}
      />
    ),
  },
  {
    icon: "💎",
    title: "Nilai yang Kami Pegang",
    content: (
      <NumberedList
        items={[
          { title: "Data adalah Dasar Setiap Keputusan" },
          { title: "Insight Harus Bisa Diterapkan" },
          { title: "Dibangun untuk Bisnis Indonesia" },
          { title: "Menjadi Partner, Bukan Sekadar AI" },
          { title: "Terus Belajar dan Berkembang" },
          { title: "Integritas di Atas Segalanya" },
        ]}
      />
    ),
  },
];

const coreValues = [
  { icon: "📊", title: "Data Before Opinion", desc: "Keputusan yang baik selalu dimulai dari data." },
  { icon: "🧩", title: "Simple but Powerful", desc: "Analisis yang baik tidak harus rumit untuk dipahami." },
  { icon: "🚀", title: "Actionable Insight", desc: "Setiap rekomendasi harus dapat diterapkan." },
  { icon: "📈", title: "Continuous Improvement", desc: "AI akan terus belajar, berkembang, dan menjadi lebih cerdas." },
];

function Accordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {accordionItems.map((item, i) => {
        const isOpen = openIndex === i;
        const panelId = `about-panel-${i}`;
        return (
          <div
            key={item.title}
            className="overflow-hidden rounded-2xl border border-white/10 bg-surface transition-colors hover:border-primary/30"
          >
            <button
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left sm:px-6"
            >
              <span className="text-lg">{item.icon}</span>
              <span className="flex-1 text-[15px] font-semibold">{item.title}</span>
              <span
                className={`text-primary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                aria-hidden
              >
                ▾
              </span>
            </button>
            <div
              id={panelId}
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-5 pr-10 text-sm leading-relaxed text-neutral-400 sm:px-6">
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TentangKami() {
  return (
    <section className="py-16" id="tentang-kami">
      <div className="mx-auto max-w-6xl px-6">
        {/* ---------- Hero ---------- */}
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
          <Reveal>
            <span
              className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-widest text-primary
              before:h-px before:w-5 before:bg-gradient-to-r before:from-transparent before:to-primary before:content-['']
              after:h-px after:w-5 after:bg-gradient-to-r after:from-primary after:to-transparent after:content-['']"
            >
              Tentang Kami
            </span>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              AI Business Consultant Pertama yang Dibangun untuk{" "}
              <span className="text-primary">Bisnis Indonesia</span>
            </h1>
            <p className="mt-4 text-neutral-300">
              THE HIVE membantu pemilik usaha memahami kondisi bisnis, menemukan
              peluang pasar, mempelajari kompetitor, hingga menyusun strategi
              bisnis berbasis AI dan Business Intelligence.
            </p>
            <a
              href="#filosofi"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black transition-transform hover:-translate-y-0.5"
            >
              Pelajari Filosofi Kami
            </a>
          </Reveal>

          <Reveal className="flex justify-center">
            <div className="relative mx-auto flex aspect-square w-full max-w-[860px] items-center justify-center">
              <div className="absolute inset-0 animate-float-y rounded-full bg-primary/25 blur-3xl" />
              <div className="relative rounded-full border border-primary/40 p-5">
                <div className="rounded-full border border-primary/20 p-3">
                  <img
                    src={hiveLogo}
                    alt="THE HIVE"
                    className="h-auto w-[93%] max-w-[800px] object-contain drop-shadow-[0_0_25px_rgba(255,152,0,0.55)]"
                  />
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ---------- Accordion ---------- */}
        <Reveal className="mt-16 scroll-mt-24">
          <div id="filosofi">
            <Accordion />
          </div>
        </Reveal>

        {/* ---------- Founder ---------- */}
        <Reveal className="mt-16">
          <div className="grid grid-cols-1 items-center gap-10 rounded-2xl border border-white/10 bg-surface p-8 md:grid-cols-2 md:p-10">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                Tentang Pendiri
              </span>
              <h2 className="mt-2 text-2xl font-extrabold leading-snug">
                Dibangun oleh Seseorang yang Percaya Bahwa Setiap Bisnis Berhak Bertumbuh
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                THE HIVE didirikan oleh A. Aldo Sucahyono, seorang profesional yang menghabiskan bertahun-tahun mendampingi dunia bisnis, mulai dari sektor perbankan hingga pengembangan strategi usaha umkm ataupun korprasi.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                Dari pengalaman tersebut, ia menyadari bahwa banyak keputusan bisnis gagal bukan karena kurangnya semangat, melainkan karena minimnya akses terhadap analisis yang tepat.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-neutral-400">
                Berangkat dari keyakinan bahwa teknologi seharusnya membantu, bukan menggantikan manusia, ia membangun THE HIVE sebagai platform yang menggabungkan Artificial Intelligence dan Business Intelligence agar setiap pelaku usaha—baik UMKM, startup, maupun perusahaan—dapat memperoleh analisis bisnis profesional yang sebelumnya hanya dapat diakses oleh organisasi besar.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                "Saya percaya, keputusan yang lebih baik akan melahirkan bisnis yang lebih kuat. Dan bisnis yang lebih kuat akan membawa dampak yang lebih besar bagi Indonesia."
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                  — Founder of THE HIVE
                </span>
                <a
                  href="https://www.linkedin.com/in/michael-aldo26"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-neutral-300 underline decoration-white/20 underline-offset-4 hover:text-primary"
                >
                  Lihat LinkedIn →
                </a>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[280px]">
              <img
                src={founderPhoto}
                alt="Albertus Aldo Sucahyono, Founder of THE HIVE"
                className="h-auto w-full object-contain drop-shadow-[0_10px_40px_rgba(255,152,0,0.25)]"
              />
              <p className="mt-3 text-center text-[15px] font-bold">A. Aldo Sucahyono</p>
              <p className="text-center text-xs text-neutral-500">Founder of THE HIVE</p>
            </div>
          </div>
        </Reveal>

        {/* ---------- Core Values ---------- */}
        <Reveal className="mt-16">
          <span className="mb-6 block text-xs font-bold uppercase tracking-widest text-primary">
            Nilai yang Kami Pegang
          </span>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {coreValues.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-white/10 bg-surface p-6 transition-transform hover:-translate-y-1 hover:border-primary/40"
              >
                <span className="text-xl">{v.icon}</span>
                <h3 className="mt-3 text-[15px] font-bold">{v.title}</h3>
                <p className="mt-2 text-sm text-neutral-400">{v.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ---------- Quote ---------- */}
        <Reveal className="mt-16">
          <blockquote className="rounded-2xl border border-white/10 bg-surface p-10 text-center">
            <span className="text-4xl text-primary/50" aria-hidden>
              “
            </span>
            <p className="mx-auto -mt-2 max-w-2xl text-lg font-medium leading-relaxed text-neutral-200">
              Mengubah Data Menjadi Keputusan.
              <br />
              Mengubah Keputusan Menjadi Pertumbuhan.
            </p>
            <footer className="mt-4 text-sm font-bold text-primary">— THE HIVE</footer>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

export default TentangKami;
