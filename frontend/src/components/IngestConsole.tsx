import { useEffect, useRef, useState } from "react";
import { streamIngest, type IngestEvent } from "../api";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void; // refresh graph + stats when done
}

/**
 * Live ingestion console. Streams the real add()+cognify() pipeline logs from
 * the backend (SSE) and prints them as they arrive. cognify() runs the LLM over
 * every source, so a full run takes a few minutes — the log makes the wait
 * legible instead of a spinner.
 */
export default function IngestConsole({ open, onClose, onComplete }: Props) {
  const [lines, setLines] = useState<IngestEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: 1e9 });
  }, [lines]);

  useEffect(() => () => cancelRef.current?.(), []);

  const start = () => {
    setLines([]);
    setDone(false);
    setRunning(true);
    cancelRef.current = streamIngest(
      (e) => {
        setLines((prev) => [...prev, e]);
        if (e.kind === "done") {
          setDone(true);
          onComplete();
        }
      },
      () => setRunning(false)
    );
  };

  if (!open) return null;

  return (
    <div className="ingest-overlay" onClick={onClose}>
      <div className="ingest-console glass" onClick={(e) => e.stopPropagation()}>
        <header className="ingest-head">
          <span className="ingest-title">
            <span className="ingest-dot" /> Data Ingestion — Cognee pipeline
          </span>
          <button className="chat-close" onClick={onClose} title="Close">
            ×
          </button>
        </header>

        <div className="ingest-log" ref={logRef}>
          {lines.length === 0 && !running && (
            <div className="ingest-intro">
              Ingest the demo sources (Slack · Jira · meetings · support · code ·
              team directory) into Cognee. This runs <code>add()</code> then{" "}
              <code>cognify()</code> to extract entities and relationships into
              one knowledge graph.
              <br />
              <br />
              <b>Note:</b> this rebuilds the graph and takes a few minutes.
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} className={`ingest-line ${l.kind}`}>
              {l.message}
            </div>
          ))}
          {running && !done && <span className="ingest-cursor">▍</span>}
        </div>

        <div className="ingest-actions">
          {!running && !done && (
            <button className="ingest-run" onClick={start}>
              ⚡ Run ingestion
            </button>
          )}
          {running && (
            <span className="ingest-status">Ingesting… keep this open</span>
          )}
          {done && (
            <button className="ingest-run done" onClick={onClose}>
              ✅ Done — close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
