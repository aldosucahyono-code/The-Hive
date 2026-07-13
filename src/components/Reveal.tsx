import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/** Shared scroll-reveal transition (ditarik dari TentangKami.tsx, Juli 2026
 * — dipakai juga di landing page: Fitur, Cara Kerja, Contoh Laporan, FAQ,
 * supaya perpindahan antar-section terasa konsisten dengan Tentang Kami).
 *
 * Sengaja minimal: IntersectionObserver + CSS transition bawaan browser,
 * TANPA library animasi (directive PO: "transisinya harus ringan, dan
 * dapat diakses disemua perangkat"). IntersectionObserver dan CSS
 * transition/transform didukung semua browser modern (desktop & mobile)
 * tanpa polyfill tambahan. `motion-reduce:*` menghormati preferensi
 * "Reduce Motion" OS/browser pengguna — transisi langsung nonaktif,
 * konten tetap tampil penuh (bukan disembunyikan). */
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

type RevealProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

function Reveal({ children, className = "", style }: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={style}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100 ${
        inView ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default Reveal;
export { useInView };
