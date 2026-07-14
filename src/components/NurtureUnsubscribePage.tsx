// src/components/NurtureUnsubscribePage.tsx
//
// Halaman PUBLIK (tidak butuh login apapun) untuk link "berhenti langganan"
// di email dorongan personal (services/nurture/). Dibuka lewat
// thehive-bisnis.com/?unsub=<token> -- lihat App.tsx untuk pemeriksaan
// query param ini, dan services/nurture/unsubscribe.ts untuk validasi
// token di backend.

import { useEffect, useState } from "react";

function NurtureUnsubscribePage({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "nurtureUnsubscribe", token }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal memproses permintaan.");
        setStatus("done");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Gagal memproses permintaan.");
        setStatus("error");
      }
    })();
  }, [token]);

  return (
    <section className="mx-auto max-w-sm px-6 py-24 text-center">
      {status === "loading" && <p className="text-sm text-neutral-500">Memproses...</p>}
      {status === "done" && (
        <>
          <h1 className="mb-2 text-lg font-bold">Sudah dihentikan</h1>
          <p className="text-sm text-neutral-500">
            Kamu tidak akan menerima email dorongan personal seperti ini lagi dari THE HIVE. Kamu tetap bisa membuka THE HIVE
            kapan saja lewat website.
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="mb-2 text-lg font-bold">Link tidak valid</h1>
          <p className="text-sm text-neutral-500">{message}</p>
        </>
      )}
    </section>
  );
}

export default NurtureUnsubscribePage;
