/** Shown while cognee.search() runs, so the 3–6s call never feels like dead air. */
export default function Thinking({ context }: { context?: string }) {
  return (
    <div className="glass glass--readable thinking">
      <div className="row">
        <span className="spinner" />
        Cognee is traversing the graph…
      </div>
      {context && (
        <div className="sub">
          Walking connections across Slack, Jira, support, meetings and code for{" "}
          <b style={{ color: "var(--text-hi)" }}>“{context}”</b>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 4 }}>
        <div className="skeleton" style={{ width: "90%" }} />
        <div className="skeleton" style={{ width: "78%" }} />
        <div className="skeleton" style={{ width: "84%" }} />
        <div className="skeleton" style={{ width: "62%" }} />
      </div>
    </div>
  );
}
