import { useState } from "react";
import type { Preset } from "../types";
import { TYPE_ACCENT } from "../theme";

interface Props {
  presets: Preset[];
  busy: boolean;
  onTrigger: (body: { preset?: string; context?: string }) => void;
}

export default function TriggerBar({ presets, busy, onTrigger }: Props) {
  const [text, setText] = useState("");

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q) onTrigger({ context: q });
  };

  return (
    <div className="glass triggerbar">
      <span className="trigger-label">Trigger&nbsp;context</span>
      {presets.map((p) => (
        <button
          key={p.key}
          className="trigger-btn"
          disabled={busy}
          onClick={() => onTrigger({ preset: p.key })}
          title={`Trigger: ${p.label}`}
        >
          <span
            className="swatch"
            style={{ color: TYPE_ACCENT[p.insight_type] ?? "#60a5fa" }}
          />
          {p.label}
        </button>
      ))}
      <form onSubmit={submitText}>
        <input
          className="trigger-input"
          placeholder="…or type a context"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
      </form>
    </div>
  );
}
