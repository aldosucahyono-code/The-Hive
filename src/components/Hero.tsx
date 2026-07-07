import { useEffect, useRef, useState } from "react";
import mascot from "../assets/mascot/beemo-laptop.png";
import { useLanguage } from "../i18n/LanguageContext";

type HeroProps = {
  onStart: () => void;
  animate: boolean;
};

type Quote = { title: string; body: string };

/** Variasi ucapan Beemo di kartu Hero — ditampilkan bergantian secara acak,
 * masing-masing dengan animasi mengetik, ganti tiap ~8 detik. */
const BEEMO_QUOTES_ID: Quote[] = [
  {
    title: "Halo, saya Beemo. 👋",
    body: "Ayo kita capai omzet Rp100 juta pertamamu. Ceritakan bisnismu, dan biarkan saya menemukan peluang yang mungkin belum pernah kamu lihat.",
  },
  {
    title: "Halo, saya Beemo.",
    body: "Bisnismu layak tumbuh lebih cepat. Ceritakan bisnismu, saya akan membantu menyusun strategi yang siap dijalankan.",
  },
  {
    title: "Halo, saya Beemo. 🤖🐝",
    body: "Hari ini kita mulai perjalanan menuju bisnis impianmu. Ceritakan bisnismu, sisanya biar saya yang analisis.",
  },
  {
    title: "Halo, saya Beemo. 🤖🐝",
    body: "Banyak orang bekerja keras. Sedikit yang tahu strategi yang tepat. Mari kita temukan strategi bisnismu.",
  },
  {
    title: "Halo, saya Beemo. 🤖🐝",
    body: "Impianmu besar? Mari kita susun strategi agar impian itu menjadi target yang bisa dicapai.",
  },
  {
    title: "",
    body: "Omzet Rp100 Juta Bukan Sekadar Mimpi. Mulai Strateginya Hari Ini.",
  },
  {
    title: "",
    body: "Ayo Wujudkan Omzet Rp100 Juta Pertamamu. Ceritakan bisnismu, sisanya biar saya bantu analisis.",
  },
  {
    title: "",
    body: "Target Berikutnya? Omzet Rp100 Juta Pertama. Ceritakan bisnismu, dan biarkan saya membantu menyusun strategi untuk mencapainya.",
  },
];

const BEEMO_QUOTES_EN: Quote[] = [
  {
    title: "Hi, I'm Beemo. 👋",
    body: "Let's reach your first Rp100 million in revenue. Tell me about your business, and I'll help you find opportunities you might not have seen yet.",
  },
  {
    title: "Hi, I'm Beemo.",
    body: "Your business deserves to grow faster. Tell me about it, and I'll help you build a strategy that's ready to execute.",
  },
  {
    title: "Hi, I'm Beemo. 🤖🐝",
    body: "Today we start the journey toward your dream business. Tell me about it, I'll handle the analysis.",
  },
  {
    title: "Hi, I'm Beemo. 🤖🐝",
    body: "Many people work hard. Few know the right strategy. Let's find yours.",
  },
  {
    title: "Hi, I'm Beemo. 🤖🐝",
    body: "Got big dreams? Let's turn them into a plan you can actually reach.",
  },
  {
    title: "",
    body: "Rp100 Million in Revenue Isn't Just a Dream. Start the Strategy Today.",
  },
  {
    title: "",
    body: "Let's Make Your First Rp100 Million Happen. Tell me about your business, I'll help with the analysis.",
  },
  {
    title: "",
    body: "What's Next? Your First Rp100 Million. Tell me about your business, and let me help build the strategy to get there.",
  },
];

const ROTATE_MS = 8000;
const CHAR_MS = 18;

/** Kartu Beemo dengan efek mengetik — huruf muncul satu per satu, lalu
 * setelah total ~8 detik pindah ke kalimat lain (urutan acak, tidak
 * mengulang kalimat yang sama dua kali berturut-turut). Bahasa mengikuti
 * toggle ID/EN di Navbar — parent me-remount komponen ini via `key={lang}`
 * setiap kali bahasa berganti, jadi state selalu bersih. */
function BeemoQuoteCard({ quotes }: { quotes: Quote[] }) {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const prevIndexRef = useRef(0);

  const quote = quotes[quoteIndex];
  const fullText = quote.title ? `${quote.title}\n${quote.body}` : quote.body;

  useEffect(() => {
    setTypedLength(0);
    const typingInterval = setInterval(() => {
      setTypedLength((len) => {
        if (len >= fullText.length) {
          clearInterval(typingInterval);
          return len;
        }
        return len + 1;
      });
    }, CHAR_MS);

    const rotateTimeout = setTimeout(() => {
      let next = prevIndexRef.current;
      while (next === prevIndexRef.current) {
        next = Math.floor(Math.random() * quotes.length);
      }
      prevIndexRef.current = next;
      setQuoteIndex(next);
    }, ROTATE_MS);

    return () => {
      clearInterval(typingInterval);
      clearTimeout(rotateTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteIndex]);

  const typedText = fullText.slice(0, typedLength);
  const [typedTitle, typedBody] = quote.title
    ? [typedText.slice(0, quote.title.length), typedText.slice(quote.title.length + 1)]
    : ["", typedText];

  return (
    <div className="flex min-h-[168px] max-w-xs flex-col justify-center rounded-2xl border border-primary/30 bg-surface p-5">
      {typedTitle && <h3 className="mb-2 font-semibold text-primary">{typedTitle}</h3>}
      <p className="text-sm leading-relaxed text-neutral-300">{typedBody}</p>
    </div>
  );
}

function Hero({ onStart, animate }: HeroProps) {
  const { t, lang } = useLanguage();
  const beemoQuotes = lang === "id" ? BEEMO_QUOTES_ID : BEEMO_QUOTES_EN;

  const fade = (delay?: string) => {
    if (!animate) return "";
    return delay ? `animate-fade-up [animation-delay:${delay}]` : "animate-fade-up";
  };

  const badgeItems = [
    { icon: "📄", label: t.hero.badge1 },
    { icon: "🔒", label: t.hero.badge2 },
    { icon: "⚡", label: t.hero.badge3 },
    { icon: "🏢", label: t.hero.badge4 },
  ];

  const badgeDelays = ["250ms", "300ms", "350ms", "400ms"];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-6">

        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">

          <div>
            <span className={"mb-4 inline-block rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary " + fade()}>
              {t.hero.badge}
            </span>

            <h1 className={"text-4xl font-black leading-tight sm:text-5xl " + fade()}>
              {t.hero.title}
            </h1>

            <p className={"mt-5 max-w-lg text-base leading-relaxed text-neutral-300 " + fade("100ms")}>
              {t.hero.subtitle}
            </p>

            <button
              onClick={onStart}
              className={"group relative mt-6 overflow-hidden rounded-xl bg-primary px-7 py-4 text-base font-bold text-black transition-transform hover:-translate-y-0.5 " + fade("200ms")}
            >
              <span className="relative z-10">{t.hero.ctaButton}</span>
              <span className="absolute inset-y-0 left-[-75%] w-1/2 -skew-x-12 bg-white/40 transition-[left] duration-500 group-hover:left-[125%]"></span>
            </button>
          </div>

          <div className="flex flex-col items-center gap-6">
            <div className={fade("150ms")}>
              <BeemoQuoteCard key={lang} quotes={beemoQuotes} />
            </div>
            <div className="relative flex items-center justify-center">
              <div className="absolute h-[28.8rem] w-[28.8rem] rounded-full bg-primary/20 blur-3xl"></div>
              <img
                src={mascot}
                alt="Beemo AI"
                className={"relative w-[28.8rem] max-w-[85vw] drop-shadow-[0_0_40px_rgba(255,152,0,0.4)] " + (animate ? "animate-float-y" : "")}
              />
            </div>
          </div>

        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {badgeItems.map((item, i) => (
            <div
              key={item.label}
              className={"group relative overflow-hidden rounded-xl border border-white/10 bg-surface p-4 text-center transition-transform hover:-translate-y-1 hover:border-primary/30 " + fade(badgeDelays[i])}
            >
              <span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100"></span>
              <div className="mb-1 text-2xl">{item.icon}</div>
              <p className="text-sm text-neutral-300">{item.label}</p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

export default Hero;
