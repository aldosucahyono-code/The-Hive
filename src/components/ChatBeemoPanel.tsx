import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import type { Translations } from "../i18n/translations";

type Tier = "free" | "pro" | "platinum";
type ChatMessage = { role: "user" | "assistant"; content: string };

function ChatBeemoPanel({
  businessProfileId,
  tier,
  t,
  lang,
  onUpgradeClick,
}: {
  businessProfileId: string;
  tier: Tier;
  t: Translations;
  lang: "id" | "en";
  onUpgradeClick: () => void;
}) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (tier === "free") {
    return (
      <div className="rounded-2xl border border-white/10 bg-surface p-8 text-center">
        <div className="mb-3 text-2xl">🔒</div>
        <p className="mx-auto max-w-sm text-sm text-neutral-400">{t.workspace.chatLockedDesc}</p>
        <button
          onClick={onUpgradeClick}
          className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black hover:opacity-90"
        >
          {t.workspace.chatUpgradeButton}
        </button>
      </div>
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

    try {
      const response = await fetch("/api/beemo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action: "chat", businessProfileId, messages: nextMessages, lang }),
      });
      const json = await response.json();

      if (!response.ok) {
        setError(json.error || t.workspace.chatErrorGeneric);
        setSending(false);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
      setSending(false);
    } catch (err) {
      console.error("chat-beemo error:", err);
      setError(t.workspace.chatErrorGeneric);
      setSending(false);
    }
  }

  return (
    <div className="flex h-[500px] flex-col rounded-2xl border border-white/10 bg-surface">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-neutral-500">{t.workspace.chatEmptyState}</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={
                "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed " +
                (m.role === "user" ? "bg-primary text-black" : "border border-white/10 bg-white/5 text-neutral-200")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-neutral-500">{t.workspace.chatSending}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
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
          disabled={sending}
          className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-primary/50"
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t.workspace.chatSendButton}
        </button>
      </div>
    </div>
  );
}

export default ChatBeemoPanel;
