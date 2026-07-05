import { useEffect, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import type { GraphData, GraphNode } from "../types";
import { sourceColor } from "../theme";

interface Props {
  data: GraphData;
  activeIds: Set<string>;
  labelIds: Set<string>;
  onBackgroundClick?: () => void;
}

/**
 * The real Cognee knowledge graph as a glossy neural constellation, sized to
 * fill its (clipped) container box. Cross-silo bridge nodes get brighter halos.
 * On trigger, `activeIds` lights the traced path and the view zooms to it;
 * only `labelIds` (the primary matched entities) are labelled, so the lit
 * cluster stays readable instead of a pile of overlapping text.
 */
export default function Constellation({
  data,
  activeIds,
  labelIds,
  onBackgroundClick,
}: Props) {
  const fgRef = useRef<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Fit the graph canvas to its container box.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Sync __active flags.
  useEffect(() => {
    for (const n of data.nodes) n.__active = activeIds.has(n.id);
    for (const l of data.links) {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      l.__active = activeIds.has(s as string) && activeIds.has(t as string);
    }
  }, [activeIds, data]);

  // Pulse while anything is active; zoom to the lit subgraph so it's readable.
  useEffect(() => {
    if (activeIds.size === 0) {
      fgRef.current?.zoomToFit(700, 60);
      return;
    }
    const t = setTimeout(
      () => fgRef.current?.zoomToFit(700, 90, (n: GraphNode) => activeIds.has(n.id)),
      60
    );
    let raf = 0;
    const loop = () => {
      pulseRef.current = performance.now();
      fgRef.current?.refresh();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [activeIds]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    fg.d3Force("charge")?.strength(-140);
    fg.d3Force("link")?.distance(48);
  }, [data]);

  const drawNode = (node: GraphNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const x = node.x!;
    const y = node.y!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const color = sourceColor(node.source_type);
    const isBridge = node.sources.length > 1;
    const base = 2.2 + Math.sqrt(node.val) * 0.9;
    const r = base * (isBridge ? 1.25 : 1);

    const dim = activeIds.size > 0 && !node.__active;
    const pulse = node.__active ? 0.6 + 0.4 * Math.sin(pulseRef.current / 240) : 1;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = (node.__active ? 26 : isBridge ? 14 : 7) * pulse;
    ctx.globalAlpha = dim ? 0.18 : 1;

    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.35, color);
    g.addColorStop(1, shade(color, -0.4));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    if (node.__active || isBridge) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = (node.__active ? 1.6 : 0.9) / scale;
      ctx.strokeStyle = node.__active
        ? "rgba(255,255,255,0.95)"
        : "rgba(255,255,255,0.5)";
      ctx.stroke();
    }
    ctx.restore();

    // Label only the primary matched entities, or bridges/all when zoomed in.
    const showLabel =
      labelIds.has(node.id) ||
      (activeIds.size === 0 && ((isBridge && scale > 1.3) || scale > 2.6));
    if (showLabel && node.label) {
      const fs = Math.max(4, 11 / scale);
      const text = node.label;
      ctx.font = `${labelIds.has(node.id) ? 600 : 500} ${fs}px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      // Readability plate behind label text.
      const tw = ctx.measureText(text).width;
      const pad = 2 / scale;
      ctx.fillStyle = "rgba(5,8,16,0.66)";
      ctx.fillRect(x - tw / 2 - pad, y + r + 1.5, tw + pad * 2, fs + pad);
      ctx.fillStyle = labelIds.has(node.id) ? "#fff" : "rgba(255,255,255,0.8)";
      ctx.fillText(text, x, y + r + 1.5 + pad / 2);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      {size.w > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.w}
          height={size.h}
          graphData={data}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={4}
          nodeCanvasObject={drawNode as any}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            const r = 2.2 + Math.sqrt(node.val) * 0.9 + 3;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
            ctx.fill();
          }}
          linkColor={(l: any) =>
            l.__active ? "rgba(255,255,255,0.85)" : "rgba(140,170,220,0.13)"
          }
          linkWidth={(l: any) => (l.__active ? 2 : 0.6)}
          linkDirectionalParticles={(l: any) => (l.__active ? 3 : 0)}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => "rgba(255,255,255,0.9)"}
          cooldownTicks={120}
          onEngineStop={() => fgRef.current?.zoomToFit(600, 60)}
          onBackgroundClick={() => onBackgroundClick?.()}
        />
      )}
    </div>
  );
}

/** Lighten (t>0) or darken (t<0) a hex color by fraction t. */
function shade(hex: string, t: number): string {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const f = (v: number) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
