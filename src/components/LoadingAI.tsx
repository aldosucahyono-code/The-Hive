import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

type LoadingAIProps = {
  /** true begitu hasil (sukses ATAU error) dari pemanggilan API sudah didapat. */
  ready: boolean;
  onDone: () => void;
};

const MIN_DISPLAY_MS = 3600;

function LoadingAI({ ready, onDone }: LoadingAIProps) {
  const { t } = useLanguage();
  const steps = t.loadingAI.steps;
  const [index, setIndex] = useState(0);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 900);

    const minTimeTimeout = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_DISPLAY_MS);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(minTimeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Baru pindah ke hasil begitu KEDUANYA terpenuhi: animasi minimum sudah
  // berjalan cukup lama (supaya tidak terasa "instan" dan mencurigakan),
  // DAN hasil sungguhan dari Claude API (sukses atau error) sudah didapat.
  useEffect(() => {
    if (ready && minTimeElapsed) {
      onDone();
    }
  }, [ready, minTimeElapsed, onDone]);

  const progress = ready ? 100 : Math.min(95, ((index + 1) / steps.length) * 100);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-6 flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-primary/30 bg-white text-2xl">
        🤖
      </div>
      <h2 className="text-lg font-bold">{t.loadingAI.title}</h2>
      <p className="mt-2 text-sm text-neutral-600">{steps[index]}</p>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </section>
  );
}

export default LoadingAI;
