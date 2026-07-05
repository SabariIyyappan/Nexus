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

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

// 👍 reinforces (improve/memify); 👎 forgets the session memory.
export const sendFeedback = (session_id: string, useful: boolean) =>
  postJSON<{ status: string }>("/feedback", { session_id, useful });

export const forgetInsight = (session_id: string) =>
  postJSON<{ status: string }>("/forget", { session_id });

// Auto-routed recall over remembered sessions ("what have we seen before?").
export const recallMemory = (query: string, session_id = "nexus-global") =>
  postJSON<{ answer: string; entries: number }>("/recall", { query, session_id });

export interface IngestEvent {
  kind: "start" | "log" | "done" | "error";
  message: string;
  nodes?: number;
  links?: number;
  bridges?: number;
}

/**
 * Stream the real add()+cognify() pipeline logs via SSE. Returns a cancel fn.
 * Uses fetch streaming (not EventSource) so it's a plain GET we can abort.
 */
export function streamIngest(
  onEvent: (e: IngestEvent) => void,
  onClose: () => void
): () => void {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch(`${BASE}/ingest`, { signal: ctrl.signal });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const c of chunks) {
          const line = c.trim();
          if (line.startsWith("data:")) {
            try {
              onEvent(JSON.parse(line.slice(5).trim()));
            } catch {
              /* ignore malformed keep-alive */
            }
          }
        }
      }
    } catch {
      /* aborted or network error */
    } finally {
      onClose();
    }
  })();
  return () => ctrl.abort();
}
