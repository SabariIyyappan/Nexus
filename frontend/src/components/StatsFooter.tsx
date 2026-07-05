import type { Stats } from "../types";

export default function StatsFooter({ stats }: { stats: Stats | null }) {
  if (!stats) return null;
  const items: { num: number; lbl: string; accent?: boolean }[] = [
    { num: stats.total_nodes, lbl: "Nodes" },
    { num: stats.total_edges, lbl: "Connections" },
    { num: stats.cross_silo_bridges, lbl: "Cross-silo bridges", accent: true },
    { num: stats.insights_surfaced, lbl: "Insights" },
    { num: stats.blind_spots_prevented, lbl: "Blind spots" },
    { num: stats.contradictions_found, lbl: "Contradictions" },
  ];
  return (
    <div className="glass footer">
      {items.map((it) => (
        <div className="stat" key={it.lbl}>
          <span className={"num" + (it.accent ? " accent" : "")}>{it.num}</span>
          <span className="lbl">{it.lbl}</span>
        </div>
      ))}
    </div>
  );
}
