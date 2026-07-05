import { useCallback, useEffect, useMemo, useState } from "react";
import Constellation from "./components/Constellation";
import NeuralBackground from "./components/NeuralBackground";
import StatsFooter from "./components/StatsFooter";
import ChatDock, { type ChatMessage } from "./components/ChatDock";
import IngestConsole from "./components/IngestConsole";
import {
  fetchGraph,
  fetchPresets,
  fetchStats,
  trigger,
  sendFeedback,
} from "./api";
import type { GraphData, Insight, Preset, Stats } from "./types";
import { SOURCE_COLORS } from "./theme";

// Generic entity labels we never want to light up as a "connection".
const STOP = new Set([
  "date", "person", "company", "service", "ticket", "team", "issue",
  "meeting", "customer", "client", "quarter", "endpoint", "api", "sla",
  "concept", "role", "status", "priority", "directory", "email",
]);

/**
 * From the insight text, find the primary matched entities (`hits`) and expand
 * one hop to trace the path (`active`). Only `hits` get labels — that keeps the
 * lit cluster readable instead of a pile of overlapping text.
 */
function computeActive(graph: GraphData, text: string) {
  const lower = text.toLowerCase();
  const hits: { id: string; val: number }[] = [];
  for (const n of graph.nodes) {
    const l = n.label.toLowerCase();
    if (n.type === "EntityType" || l.length < 4 || STOP.has(l)) continue;
    if (lower.includes(l)) hits.push({ id: n.id, val: n.val });
  }
  hits.sort((a, b) => b.val - a.val);
  const labelIds = new Set(hits.slice(0, 8).map((h) => h.id));
  const hitSet = new Set(hits.map((h) => h.id));

  const active = new Set(hitSet);
  for (const link of graph.links) {
    const s = (typeof link.source === "object" ? link.source.id : link.source) as string;
    const t = (typeof link.target === "object" ? link.target.id : link.target) as string;
    if (hitSet.has(s)) active.add(t);
    if (hitSet.has(t)) active.add(s);
  }
  return { active, labelIds };
}

let msgSeq = 0;
const nextId = () => `m${++msgSeq}`;

export default function App() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [labelIds, setLabelIds] = useState<Set<string>>(new Set());

  const loadGraph = useCallback(() => {
    fetchGraph().then(setGraph).catch(console.error);
    fetchStats().then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    loadGraph();
    fetchPresets().then(setPresets).catch(console.error);
  }, [loadGraph]);

  // Core flow: send a context (typed or preset) → insight → light the graph.
  const runTrigger = useCallback(
    async (body: { preset?: string; context?: string }, label: string) => {
      if (busy) return;
      setMessages((m) => [...m, { id: nextId(), role: "user", text: label }]);
      setBusy(true);
      setActiveIds(new Set());
      setLabelIds(new Set());
      try {
        const res: Insight = await trigger(body);
        setMessages((m) => [...m, { id: nextId(), role: "nexus", insight: res }]);
        if (graph) {
          const { active, labelIds } = computeActive(
            graph,
            res.insight + " " + res.context
          );
          setActiveIds(active);
          setLabelIds(labelIds);
        }
        fetchStats().then(setStats).catch(() => {});
      } catch (e) {
        console.error(e);
        setMessages((m) => [
          ...m,
          { id: nextId(), role: "nexus", text: "⚠️ Something went wrong reaching Cognee." },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, graph]
  );

  const onSend = useCallback((text: string) => runTrigger({ context: text }, text), [runTrigger]);
  const onPreset = useCallback(
    (key: string) => {
      const label = presets.find((p) => p.key === key)?.label ?? key;
      runTrigger({ preset: key }, label);
    },
    [presets, runTrigger]
  );

  const onFeedback = useCallback((msg: ChatMessage, useful: boolean) => {
    if (!msg.insight) return;
    sendFeedback(msg.insight.session_id, useful).catch(console.error);
    setMessages((m) =>
      m.map((x) => (x.id === msg.id ? { ...x, feedback: useful ? "up" : "down" } : x))
    );
  }, []);

  // Dismiss is UI-only. (cognee.forget() is wired at POST /api/forget, but in
  // local embedded mode it closes the vector adapter, so we don't call it from
  // the live chat — see DEMO_WALKTHROUGH.md.)
  const onDismiss = useCallback((msg: ChatMessage) => {
    if (!msg.insight) return;
    setMessages((m) =>
      m.map((x) => (x.id === msg.id ? { ...x, feedback: "dismissed" } : x))
    );
    setActiveIds(new Set());
    setLabelIds(new Set());
  }, []);

  const clearHighlight = useCallback(() => {
    setActiveIds(new Set());
    setLabelIds(new Set());
  }, []);

  const legend = useMemo(
    () => Object.entries(SOURCE_COLORS).filter(([k]) => k !== "unknown"),
    []
  );

  return (
    <>
      <NeuralBackground />

      <div className={`app ${chatOpen ? "chat-open" : ""}`}>
        <header className="topbar">
          <div className="glass brand">
            <h1>
              NEXUS<span className="dot">.</span>
            </h1>
          </div>
          <button className="glass ingest-btn" onClick={() => setIngestOpen(true)}>
            <span className="ingest-btn-glyph">⚡</span> Ingest data
          </button>
        </header>

        <main className="main">
          <section className="glass graph-box">
            {graph ? (
              <>
                <Constellation
                  data={graph}
                  activeIds={activeIds}
                  labelIds={labelIds}
                  onBackgroundClick={clearHighlight}
                />
                <div className="legend legend--graph">
                  {legend.map(([name, color]) => (
                    <span className="item" key={name} style={{ color }}>
                      <i style={{ background: color }} />
                      {name}
                    </span>
                  ))}
                </div>
                <div className="graph-hint">
                  {activeIds.size > 0
                    ? "Lit path = the connection Cognee traced · click empty space to reset"
                    : "Drag to pan · scroll to zoom · brighter halos are cross-silo bridge nodes"}
                </div>
              </>
            ) : (
              <div className="loading">
                <span className="spinner" />
                Loading the knowledge graph…
              </div>
            )}
          </section>
        </main>

        <footer className="footer-row">
          <StatsFooter stats={stats} />
        </footer>
      </div>

      <ChatDock
        open={chatOpen}
        onToggle={() => setChatOpen((o) => !o)}
        messages={messages}
        busy={busy}
        presets={presets}
        onSend={onSend}
        onPreset={onPreset}
        onFeedback={onFeedback}
        onDismiss={onDismiss}
      />

      <IngestConsole
        open={ingestOpen}
        onClose={() => setIngestOpen(false)}
        onComplete={loadGraph}
      />
    </>
  );
}
