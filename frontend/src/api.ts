import type { GraphData, Insight, Preset, Stats } from "./types";

// Same-origin: Vite proxies /api -> http://127.0.0.1:8000 (see vite.config.ts).
const BASE = "/api";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const fetchGraph = () => getJSON<GraphData>("/graph");
export const fetchStats = () => getJSON<Stats>("/stats");
export const fetchPresets = () => getJSON<Preset[]>("/presets");

export async function trigger(body: {
  preset?: string;
  context?: string;
}): Promise<Insight> {
  const res = await fetch(`${BASE}/trigger`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`/trigger -> ${res.status}`);
  return res.json();
}
