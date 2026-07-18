import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { Translations } from "../i18n/translations";
import {
  WorkspaceCard,
  SectionHeader,
  WorkspaceSection,
  UpgradeLockCard,
  EmptyState,
  ErrorCard,
} from "./WorkspaceDesignSystem";

type Tier = "free" | "pro" | "platinum";
// decisionSaved/decisionHeadline (revisi Juli 2026): Chat Beemo sekarang
// mendeteksi OTOMATIS pertanyaan keputusan besar dan menjalankan Decision
// Engine di dalam balasan yang sama (lihat parseDecisionBlock di
// services/beemo/chat.ts) — tidak ada lagi form "Bantuan Keputusan"
// terpisah. Field ini dipakai untuk menampilkan catatan kecil di bubble
// chat kalau balasan itu baru saja tersimpan ke Decision Journal.
type ChatMessage = { role: "user" | "assistant"; content: string; decisionSaved?: boolean };
type PendingMemoryFact = { id: string; factKey: string; factValue: unknown; proposedAt: string };

// Fix bug: balasan Beemo (dari Claude) berisi markdown ringan (**bold**,
// list bernomor "1. ...", baris baru antar-poin) tapi sebelumnya dirender
// {m.content} polos tanpa parser DAN tanpa whitespace-pre-wrap -- jadi tanda
// bintang muncul mentah dan semua baris ke-collapse jadi satu paragraf
// panjang. Ditulis manual (bukan pasang react-markdown) supaya tidak perlu
// dependency baru -- cukup untuk menangani **bold** + baris baru, yang
// mencakup hampir semua pola balasan Beemo di prompt saat ini. Kalau nanti
// AI mulai pakai markdown lebih kompleks (heading, tabel, dsb), pertimbangkan
// ganti ke react-markdown.
function renderChatContent(content: string) {
  const boldSplit = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });

  return content.split("\n").map((line, i, arr) => (
    <span key={i}>
      {boldSplit(line)}
      {i < arr.length - 1 && <br />}
    </span>
  ));
}

function ChatBeemoPanel({
  businessProfileId,
  tier,
  businessType,
  t,
  lang,
  onUpgradeClick,
  pendingMemoryFacts,
  pendingMemoryFactsLoading,
  pendingMemoryFactsError,
  reviewingFactId,
  onReviewMemoryFact,
  onRetryPendingMemoryFacts,
}: {
  businessProfileId: string;
  tier: Tier;
  businessType: "start" | "grow";
  t: Translations;
  lang: "id" | "en";
  onUpgradeClick: () => void;
  pendingMemoryFacts: PendingMemoryFact[];
  pendingMemoryFactsLoading: boolean;
  pendingMemoryFactsError: boolean;
  reviewingFactId: string | null;
  onReviewMemoryFact: (factId: string, decision: "approve" | "reject") => void;
  onRetryPendingMemoryFacts: () => void;
}) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Nudge Upgrade (directive PO: indikator sukses = pelanggan Pro pakai
  // fitur sampai mentok kuota, lalu upgrade ke Platinum — bahasa HALUS,
  // bukan hard-sell). true kalau balasan terakhir server bilang
  // quotaExceeded — dipisah dari `error` biasa supaya render-nya beda
  // (kartu ajakan upgrade, bukan teks merah generik).
  const [chatQuotaHit, setChatQuotaHit] = useState(false);

  // Business Context: pertanyaan pancingan berbeda untuk mentor "membuka
  // usaha" vs "mengembangkan usaha" — reuse satu komponen Chat yang sama,
  // hanya kontennya yang menyesuaikan (bukan dua implementasi Chat).
  const staticSuggestions =
    businessType === "start"
      ? [t.workspace.chatSuggestion1Start, t.workspace.chatSuggestion2Start, t.workspace.chatSuggestion3Start]
      : [t.workspace.chatSuggestion1, t.workspace.chatSuggestion2, t.workspace.chatSuggestion3];

  // Phase 5 (Chat Beemo Experience, directive PO: "personalisasi penuh via
  // AI"): starter yang BENAR-BENAR dipikirkan Beemo dari Business Memory
  // bisnis ini (nama/tantangan/target/produk), bukan 3 pertanyaan tetap
  // yang sama untuk semua bisnis. Di-cache di server (14 hari, lihat
  // services/workspace/chat/getChatStarters.ts) -- fetch ini murni baca
  // cache paling sering, bukan panggilan AI baru tiap kali tab dibuka.
  // Fallback ke staticSuggestions selama belum siap/gagal, supaya empty
  // state tidak pernah kosong.
  const [dynamicStarters, setDynamicStarters] = useState<string[] | null>(null);
  // Audit Juli 2026 (ChatGPT Critical #2 + QA langsung: "Beemo masih
  // terlalu pasif, saya ingin Beemo mencari user") — kalimat pembuka dari
  // Beemo sendiri, sekarang dikirim bareng starter pertanyaan (satu
  // panggilan yang sama, lihat services/workspace/chat/getChatStarters.ts).
  // null = belum siap/gagal -- render tetap aman, cuma tidak menampilkan
  // bubble pembuka (empty state generik tetap ada sebagai fallback).
  const [openingLine, setOpeningLine] = useState<string | null>(null);
  useEffect(() => {
    if (tier === "free" || !businessProfileId || !session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: "getChatStarters", businessProfileId, lang }),
        });
        const json = await response.json();
        if (!cancelled && response.ok) {
          if (Array.isArray(json.starters) && json.starters.length > 0) {
            setDynamicStarters(json.starters as string[]);
          }
          if (typeof json.opening === "string" && json.opening.trim().length > 0) {
            setOpeningLine(json.opening.trim());
          }
        }
      } catch (err) {
        console.error("getChatStarters error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfileId, tier, session?.access_token, lang]);

  // Round 2 GAPTEK review (kolaborasi GPT, difilter user 17 Juli 2026):
  // Free-tier tidak boleh memicu generate AI baru (prinsip sadar biaya
  // sesi ini), jadi ini BUKAN panggilan yang sama dengan di atas -- pakai
  // readOnly:true supaya backend cuma baca cache starter yang MUNGKIN sudah
  // ada (mis. bisnis yang pernah Pro/Platinum lalu turun ke Free) dan tidak
  // pernah memanggil Claude. Kalau belum ada cache sama sekali (user baru),
  // array-nya tetap kosong dan UpgradeLockCard tidak menampilkan apa-apa.
  const [freePreviewStarters, setFreePreviewStarters] = useState<string[]>([]);
  useEffect(() => {
    if (tier !== "free" || !businessProfileId || !session?.access_token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: "getChatStarters", businessProfileId, lang, readOnly: true }),
        });
        const json = await response.json();
        if (!cancelled && response.ok && Array.isArray(json.starters)) {
          setFreePreviewStarters((json.starters as string[]).slice(0, 2));
        }
      } catch (err) {
        console.error("getChatStarters (readOnly) error:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessProfileId, tier, session?.access_token, lang]);

  // WOW Moment onboarding (masukan GPT yang kami saring jadi versi murah):
  // daripada langsung menampilkan kalimat pembuka Beemo begitu data siap,
  // sapaan muncul bertahap (sapa dulu -> "sedang meninjau" -> baru kalimat
  // personal) supaya terasa seperti Beemo benar-benar sedang bekerja, bukan
  // template statis. TIDAK ada API call tambahan -- cuma urutan tampil dari
  // 2 kalimat statis (baru) + 1 kalimat yang sudah di-generate (openingLine).
  // 0 = belum ada apa-apa, 1 = sapaan, 2 = "sedang meninjau", 3 = selesai
  // (kalimat personal + pertanyaan starter tampil).
  const [greetingStage, setGreetingStage] = useState(0);
  useEffect(() => {
    if (tier === "free") return;
    const t1 = window.setTimeout(() => setGreetingStage((s) => Math.max(s, 1)), 150);
    const t2 = window.setTimeout(() => setGreetingStage((s) => Math.max(s, 2)), 900);
    // Fallback: kalau opening line gagal/lambat, tetap lanjut ke tahap akhir
    // supaya user tidak terjebak melihat "sedang meninjau..." selamanya.
    const tFallback = window.setTimeout(() => setGreetingStage((s) => Math.max(s, 3)), 3000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(tFallback);
    };
  }, [tier]);

  // Audit pra-soft-launch (19 Jul 2026): riwayat percakapan tidak pernah
  // direset saat businessProfileId berganti (pindah bisnis) -- akibatnya
  // pesan-pesan lama yang membahas bisnis A tetap tampil di layar dan ikut
  // terkirim sebagai context ke /api/beemo bersama businessProfileId bisnis
  // B, membuat Beemo menerima Business Memory bisnis B tapi riwayat chat
  // yang membahas bisnis A -- konteks bercampur. Direset di sini, bukan di
  // resetPerBusinessCaches() milik Workspace.tsx, karena state ini lokal.
  useEffect(() => {
    setMessages([]);
    setInput("");
    setSending(false);
    setError(null);
    setChatQuotaHit(false);
    setGreetingStage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfileId]);
  useEffect(() => {
    if (openingLine === null || greetingStage !== 2) return;
    const t3 = window.setTimeout(() => setGreetingStage(3), 700);
    return () => window.clearTimeout(t3);
  }, [openingLine, greetingStage]);

  const suggestions = dynamicStarters && dynamicStarters.length > 0 ? dynamicStarters : staticSuggestions;

  if (tier === "free") {
    return (
      <WorkspaceSection>
        <SectionHeader title={t.workspace.menuChat} description={t.workspace.chatSectionDesc} />
        <UpgradeLockCard
          description={t.workspace.chatLockedDesc}
          buttonLabel={t.workspace.chatUpgradeButton}
          onUpgradeClick={onUpgradeClick}
          previewLabel={t.workspace.chatLockedPreviewLabel}
          previewItems={freePreviewStarters}
        />
      </WorkspaceSection>
    );
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || !session?.access_token) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    setChatQuotaHit(false);

    try {
      const response = await fetch("/api/beemo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "chat",
          businessProfileId,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          lang,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        if (json.quotaExceeded) {
          setChatQuotaHit(true);
        } else {
          setError(json.error || t.workspace.chatErrorGeneric);
        }
        setSending(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: json.reply, decisionSaved: Boolean(json.decisionSaved) }]);
      setSending(false);
    } catch (err) {
      console.error("chat-beemo error:", err);
      setError(t.workspace.chatErrorGeneric);
      setSending(false);
    }
  }

  return (
    <WorkspaceSection>
      <SectionHeader title={t.workspace.menuChat} description={t.workspace.chatSectionDesc} />

      <WorkspaceCard className="flex h-[min(70vh,500px)] min-h-[360px] flex-col !p-0">
        <div
          role="log"
          aria-live="polite"
          aria-label={t.workspace.menuChat}
          className="flex-1 space-y-3 overflow-y-auto p-4"
        >
          {messages.length === 0 && (
            <>
              {greetingStage < 3 ? (
                // WOW Moment: sapaan bertahap sebelum kalimat personal
                // muncul (lihat effect greetingStage di atas). Tiap bubble
                // pakai animate-fade-up yang sudah dipakai di landing page,
                // jadi tidak menambah animasi/dependency baru.
                <div className="space-y-2">
                  {greetingStage >= 1 && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] animate-fade-up rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-neutral-200">
                        {t.workspace.chatGreetingWave}
                      </div>
                    </div>
                  )}
                  {greetingStage >= 2 && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] animate-fade-up rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm italic text-neutral-500">
                        {t.workspace.chatGreetingThinking}
                      </div>
                    </div>
                  )}
                </div>
              ) : openingLine ? (
                // Beemo menyapa duluan (bukan cuma judul + deskripsi
                // generik) -- ditampilkan PERSIS seperti bubble balasan
                // biasa supaya terasa seperti Beemo benar-benar sudah
                // melihat bisnis ini dan punya sesuatu untuk disampaikan,
                // bukan menunggu diajak bicara.
                <div className="flex justify-start">
                  <div className="max-w-[80%] animate-fade-up rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-neutral-200">
                    {renderChatContent(openingLine)}
                  </div>
                </div>
              ) : (
                <EmptyState
                  variant="default"
                  icon="💬"
                  title={t.workspace.chatEmptyTitle}
                  description={t.workspace.chatEmptyState}
                />
              )}
              {greetingStage >= 3 && (
                <div className="mx-auto mt-4 flex max-w-md flex-wrap animate-fade-up justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors duration-150 hover:border-primary/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[80%]">
                <div
                  className={
                    "rounded-xl px-4 py-2.5 text-sm leading-relaxed " +
                    (m.role === "user" ? "bg-primary text-black" : "border border-white/10 bg-white/5 text-neutral-200")
                  }
                >
                  {renderChatContent(m.content)}
                </div>
                {/* Decision Engine Auto-Detect (revisi Juli 2026): tidak ada
                    form "Bantuan Keputusan" terpisah lagi — kalau Beemo
                    mendeteksi pertanyaan ini sebagai keputusan besar, catatan
                    kecil ini muncul di bawah balasannya, memberi tahu bahwa
                    analisanya sudah tersimpan ke Decision Journal. */}
                {m.role === "assistant" && m.decisionSaved && (
                  <p className="mt-1 text-[11px] font-semibold text-primary">
                    🐝 {t.workspace.decisionAutoSavedNote}
                  </p>
                )}
              </div>
            </div>
          ))}
          {sending && <p className="text-xs text-neutral-500">{t.workspace.chatSending}</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}
          {chatQuotaHit && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.06] p-4">
              <p className="text-sm font-bold text-primary">🐝 {t.workspace.chatQuotaNudgeTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-300">
                {tier === "pro" ? t.workspace.chatQuotaNudgeDescPro : t.workspace.chatQuotaNudgeDescPlatinum}
              </p>
              {tier === "pro" && (
                <button
                  onClick={onUpgradeClick}
                  className="mt-3 rounded-full bg-primary px-4 py-2 text-xs font-bold text-black transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {t.workspace.chatQuotaNudgeButton}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-white/10 p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t.workspace.chatPlaceholder}
            aria-label={t.workspace.chatPlaceholder}
            disabled={sending}
            className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none transition-colors duration-150 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {t.workspace.chatSendButton}
          </button>
        </div>
      </WorkspaceCard>

      {/* "Beemo mengusulkan pembaruan" (revisi Juli 2026): dipindah ke bawah
          Chat — posisi bekas form "Bantuan Keputusan" yang sudah dihapus,
          supaya Chat Beemo terasa satu alur percakapan utuh, bukan dua
          "chat" terpisah. Isinya sudah, dan tetap, bersumber langsung dari
          percakapan chat (lihat parseMemoryProposal di
          services/beemo/chat.ts) — bukan diagang. */}
      {pendingMemoryFactsError ? (
        <ErrorCard
          title={t.workspace.memoryProposalErrorTitle}
          description={t.workspace.workspaceSectionErrorDesc}
          retryLabel={t.workspace.workspaceRetryButton}
          onRetry={onRetryPendingMemoryFacts}
        />
      ) : (
        !pendingMemoryFactsLoading &&
        pendingMemoryFacts.length > 0 && (
          <WorkspaceCard tone="primary">
            <h3 className="mb-1 text-sm font-bold text-primary">{t.workspace.memoryProposalTitle}</h3>
            <p className="mb-4 text-xs leading-relaxed text-neutral-400">{t.workspace.memoryProposalDesc}</p>
            <div className="space-y-2">
              {pendingMemoryFacts.map((fact) => (
                <div
                  key={fact.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <p className="text-sm text-neutral-200">
                    <span className="font-semibold text-white">{fact.factKey.replace(/_/g, " ")}:</span>{" "}
                    {String(fact.factValue)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onReviewMemoryFact(fact.id, "approve")}
                      disabled={reviewingFactId === fact.id}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-black transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {t.workspace.memoryApproveButton}
                    </button>
                    <button
                      onClick={() => onReviewMemoryFact(fact.id, "reject")}
                      disabled={reviewingFactId === fact.id}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors duration-150 hover:text-white disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      {t.workspace.memoryRejectButton}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </WorkspaceCard>
        )
      )}
    </WorkspaceSection>
  );
}

export default ChatBeemoPanel;
