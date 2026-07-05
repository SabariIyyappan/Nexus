import { useEffect, useRef, useState } from "react";
import type { Insight, Preset } from "../types";
import { TYPE_ACCENT, TYPE_LABEL, sourceColor } from "../theme";
import { renderMarkdown } from "../markdown";

export interface ChatMessage {
  id: string;
  role: "user" | "nexus";
  text?: string; // user text or a system note
  insight?: Insight; // nexus insight payload
  feedback?: "up" | "down" | "dismissed";
}

interface Props {
  open: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  busy: boolean;
  presets: Preset[];
  onSend: (text: string) => void;
  onPreset: (key: string) => void;
  onFeedback: (msg: ChatMessage, useful: boolean) => void;
  onDismiss: (msg: ChatMessage) => void;
}

export default function ChatDock({
  open,
  onToggle,
  messages,
  busy,
  presets,
  onSend,
  onPreset,
  onFeedback,
  onDismiss,
}: Props) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [messages, busy]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q && !busy) {
      onSend(q);
      setText("");
    }
  };

  if (!open) {
    return (
      <button className="chat-fab" onClick={onToggle} title="Ask Nexus">
        <span className="chat-fab-glyph">◈</span>
        Ask Nexus
      </button>
    );
  }

  return (
    <div className="chat-dock glass">
      <header className="chat-head">
        <span className="chat-title">
          <span className="chat-dot" /> Nexus Assistant
        </span>
        <button className="chat-close" onClick={onToggle} title="Close">
          ×
        </button>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <b>Describe what you're working on.</b>
            <p>
              Nexus walks the knowledge graph across Slack, Jira, support,
              meetings, code and the team directory — and surfaces what you
              didn't know to search for.
            </p>
            <div className="chat-suggest-label">Try one:</div>
            <div className="chat-suggests">
              {presets.map((p) => (
                <button
                  key={p.key}
                  className="chat-suggest"
                  disabled={busy}
                  onClick={() => onPreset(p.key)}
                  style={{ ["--accent" as any]: TYPE_ACCENT[p.insight_type] }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div className="chat-msg user" key={m.id}>
              {m.text}
            </div>
          ) : m.insight ? (
            <InsightBubble
              key={m.id}
              msg={m}
              onFeedback={onFeedback}
              onDismiss={onDismiss}
            />
          ) : (
            <div className="chat-msg note" key={m.id}>
              {m.text}
            </div>
          )
        )}

        {busy && (
          <div className="chat-msg nexus thinking">
            <span className="tdot" />
            <span className="tdot" />
            <span className="tdot" />
            <span className="tlabel">walking the graph…</span>
          </div>
        )}
      </div>

      <form className="chat-input-row" onSubmit={submit}>
        <input
          className="chat-input"
          placeholder="e.g. I'm adding a refund API endpoint…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <button className="chat-send" disabled={busy || !text.trim()} title="Send">
          ➤
        </button>
      </form>
    </div>
  );
}

function InsightBubble({
  msg,
  onFeedback,
  onDismiss,
}: {
  msg: ChatMessage;
  onFeedback: (m: ChatMessage, useful: boolean) => void;
  onDismiss: (m: ChatMessage) => void;
}) {
  const ins = msg.insight!;
  const accent = TYPE_ACCENT[ins.insight_type] ?? TYPE_ACCENT.relevant;
  const label = TYPE_LABEL[ins.insight_type] ?? "Insight";

  return (
    <div className="chat-msg nexus insight" style={{ ["--accent" as any]: accent }}>
      <span className="type-badge">
        <span className="glyph" />
        {label}
        {ins.from_recall && <span className="recall-tag">🧠 recalled</span>}
      </span>

      <div
        className="insight-body"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(ins.insight) }}
      />

      {ins.contacts.length > 0 && (
        <div className="contacts">
          <div className="contacts-label">Contact instantly</div>
          {ins.contacts.map((c) => (
            <a
              key={c.email}
              className="contact-chip"
              href={`mailto:${c.email}?subject=${encodeURIComponent(
                "Re: " + ins.context
              )}`}
            >
              <span className="contact-name">{c.name}</span>
              {c.role && <span className="contact-role">{c.role}</span>}
              <span className="contact-email">{c.email}</span>
            </a>
          ))}
        </div>
      )}

      {ins.sources.length > 0 && (
        <div className="source-badges">
          {ins.sources.map((s) => (
            <span
              key={s}
              className="source-badge"
              style={{ ["--sc" as any]: sourceColor(s) }}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="feedback-row">
        {msg.feedback === "up" ? (
          <span className="fb-done up">👍 Reinforced in memory</span>
        ) : msg.feedback === "dismissed" ? (
          <span className="fb-done gone">Dismissed · forgotten</span>
        ) : (
          <>
            <button className="fb-btn" onClick={() => onFeedback(msg, true)}>
              👍 Useful
            </button>
            <button className="fb-btn" onClick={() => onDismiss(msg)}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}
