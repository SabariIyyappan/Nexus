import type { Insight } from "../types";
import { TYPE_ACCENT, TYPE_LABEL, sourceColor } from "../theme";
import { renderMarkdown } from "../markdown";

export default function InsightCard({ insight }: { insight: Insight }) {
  const accent = TYPE_ACCENT[insight.insight_type] ?? TYPE_ACCENT.relevant;
  const label = TYPE_LABEL[insight.insight_type] ?? "Insight";

  return (
    <div
      className="glass glass--readable insight-card"
      style={{ ["--accent" as any]: accent }}
    >
      <span className="type-badge">
        <span className="glyph" />
        {label}
      </span>

      <div className="insight-context">
        Context: <b>{insight.context}</b>
      </div>

      <div
        className="insight-body"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(insight.insight) }}
      />

      {insight.sources.length > 0 && (
        <div className="source-badges">
          {insight.sources.map((s) => (
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
    </div>
  );
}
