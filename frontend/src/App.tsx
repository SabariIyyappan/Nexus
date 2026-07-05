import { useCallback, useEffect, useMemo, useState } from "react";
import Constellation from "./components/Constellation";
import NeuralBackground from "./components/NeuralBackground";
import TriggerBar from "./components/TriggerBar";
import InsightCard from "./components/InsightCard";
import StatsFooter from "./components/StatsFooter";
import Thinking from "./components/Thinking";
import { fetchGraph, fetchPresets, fetchStats, trigger } from "./api";
import type { GraphData, Insight, Preset, Stats } from "./types";
import { SOURCE_COLORS } from "./theme";

// Generic entity labels we never want to light up as a "connection".
const STOP = new Set([
  "date", "person", "company", "service", "ticket", "team", "issue",
  "meeting", "customer", "client", "quarter", "endpoint", "api", "sla",
  "concept", "role", "status", "priority",
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
  // Cap labelled nodes to the most-connected matches so labels stay legible.
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

export default function App() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [labelIds, setLabelIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGraph().then(setGraph).catch(console.error);
    fetchStats().then(setStats).catch(console.error);
    fetchPresets().then(setPresets).catch(console.error);
  }, []);

  const onTrigger = useCallback(
    async (body: { preset?: string; context?: string }) => {
      if (!graph) return;
      const label =
        body.context ??
        presets.find((p) => p.key === body.preset)?.label ??
        "";
      setPending(label);
      setBusy(true);
      setActiveIds(new Set());
      setLabelIds(new Set());
      try {
        const res = await trigger(body);
        setInsight(res);
        const { active, labelIds } = computeActive(
          graph,
          res.insight + " " + res.context
        );
        setActiveIds(active);
        setLabelIds(labelIds);
        fetchStats().then(setStats).catch(() => {});
      } catch (e) {
        console.error(e);
      } finally {
        setBusy(false);
      }
    },
    [graph, presets]
  );

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

      <div className="app">
        <header className="topbar">
          <div className="glass brand">
            <h1>
              NEXUS<span className="dot">.</span>
            </h1>
            <span className="tag">cross-silo intelligence · powered by Cognee</span>
          </div>
          <TriggerBar presets={presets} busy={busy} onTrigger={onTrigger} />
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

          <aside className="insight-panel">
            {busy ? (
              <Thinking context={pending} />
            ) : insight ? (
              <InsightCard insight={insight} />
            ) : (
              <div className="glass hint">
                <b>Trigger a context</b> to see what your team already knows across
                Slack, Jira, support, meetings and code — connections nobody
                thought to search for.
              </div>
            )}
          </aside>
        </main>

        <footer className="footer-row">
          <StatsFooter stats={stats} />
          <div className="glass legend">
            {legend.map(([name, color]) => (
              <span className="item" key={name} style={{ color }}>
                <i style={{ background: color }} />
                {name}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
}
