import { useEffect, useState } from "react";

type LoadingAIProps = {
  onDone: () => void;
};

const steps = [
  "Menganalisis kondisi bisnis...",
  "Membandingkan dengan kompetitor...",
  "Mencari peluang pasar...",
  "Menyusun rekomendasi strategi...",
];

function LoadingAI({ onDone }: LoadingAIProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 900);

    const doneTimeout = setTimeout(() => {
      onDone();
    }, steps.length * 900 + 600);

    return () => {
      clearInterval(stepInterval);
      clearTimeout(doneTimeout);
    };
  }, [onDone]);

  const progress = Math.min(100, ((index + 1) / steps.length) * 100);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center px-6 py-24 text-center">
      <div className="mb-6 flex h-16 w-16 animate-pulse items-center justify-center rounded-full border border-primary/30 bg-surface text-2xl">
        🤖
      </div>
      <h2 className="text-lg font-bold">Beemo sedang menganalisis bisnis Anda</h2>
      <p className="mt-2 text-sm text-neutral-400">{steps[index]}</p>

      <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </section>
  );
}

export default LoadingAI;
