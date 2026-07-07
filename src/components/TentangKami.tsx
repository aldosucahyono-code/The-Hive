import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import founderPhoto from "../assets/founder/aldo.png";
import hiveLogo from "../assets/logo/hive-logo.png";
import { useLanguage } from "../i18n/LanguageContext";

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

function Accordion() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const a = t.aboutPage.accordion;

  const accordionItems: { icon: string; title: string; content: ReactNode }[] = [
    { icon: "👁️", title: a.visi.title, content: a.visi.content },
    { icon: "🎯", title: a.misi.title, content: <NumberedList items={a.misi.items} /> },
    { icon: "💡", title: a.kenapaDibuat.title, content: a.kenapaDibuat.content },
    {
      icon: "🔶",
      title: a.filosofiNama.title,
      content: (
        <>
          {a.filosofiNama.paragraphs.map((p, i) => (
            <p key={i} className={i > 0 ? "mt-3" : ""}>
              {p}
            </p>
          ))}
        </>
      ),
    },
    { icon: "⭐", title: a.mengapaHarus.title, content: <NumberedList items={a.mengapaHarus.items} /> },
    { icon: "💎", title: a.nilaiKami.title, content: <NumberedList items={a.nilaiKami.items} /> },
  ];

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
  const { t } = useLanguage();
  const p = t.aboutPage;

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
              {p.badge}
            </span>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              {p.heroTitlePrefix}{" "}
              <span className="text-primary">{p.heroTitleHighlight}</span>
            </h1>
            <p className="mt-4 text-neutral-300">
              {p.heroDesc}
            </p>
            <a
              href="#filosofi"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-black transition-transform hover:-translate-y-0.5"
            >
              {p.heroCta}
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
                {p.founder.eyebrow}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold leading-snug">
                {p.founder.heading}
              </h2>
              {p.founder.paragraphs.map((text, i) => (
                <p key={i} className="mt-4 text-sm leading-relaxed text-neutral-400">
                  {text}
                </p>
              ))}
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                {p.founder.quote}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
                  {p.founder.badge}
                </span>
                <a
                  href="https://www.linkedin.com/in/michael-aldo26"
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-neutral-300 underline decoration-white/20 underline-offset-4 hover:text-primary"
                >
                  {p.founder.linkedinLabel}
                </a>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[280px]">
              <img
                src={founderPhoto}
                alt="Albertus Aldo Sucahyono, Founder of THE HIVE"
                className="h-auto w-full object-contain drop-shadow-[0_10px_40px_rgba(255,152,0,0.25)]"
              />
              <p className="mt-3 text-center text-[15px] font-bold">{p.founder.name}</p>
              <p className="text-center text-xs text-neutral-500">{p.founder.role}</p>
            </div>
          </div>
        </Reveal>

        {/* ---------- Core Values ---------- */}
        <Reveal className="mt-16">
          <span className="mb-6 block text-xs font-bold uppercase tracking-widest text-primary">
            {p.coreValuesLabel}
          </span>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {p.coreValues.map((v) => (
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
              {p.quote.line1}
              <br />
              {p.quote.line2}
            </p>
            <footer className="mt-4 text-sm font-bold text-primary">{p.quote.footer}</footer>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}

export default TentangKami;
