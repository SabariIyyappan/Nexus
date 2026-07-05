# NEXUS — Build Plan

> **Status:** Phase 0 complete & verified. Awaiting approval to start Phase 1.
> **One-liner:** Nexus watches what your team is working on and proactively surfaces
> cross-silo connections (Slack / Jira / support / code / meetings) that nobody thought to search for.

---

## Guiding principle

**Cognee is the spotlight.** Every feature is a thin UI shell over a Cognee call — Cognee
builds the graph, Cognee answers the queries, Cognee is what the judges see working. We ship
**3 tight, reliable features**, not the full 13-section architecture doc. Depth on 3 beats
breadth on 12.

We **never re-`cognify()` during the demo** — the graph is already built and persisted in
`.cognee_data` / `.cognee_system`. Only fast `search()` calls run live.

---

## The 3 demo features

| # | Feature | Trigger | Cognee capability showcased | Status of underlying query |
|---|---------|---------|-----------------------------|----------------------------|
| 1 | 🔴 **The Blind Spot** (hero) | "Adding refund API endpoint" | Multi-hop `GRAPH_COMPLETION` across 4 sources | ✅ Verified — surfaces GlobalPay 2s SLA + PERF-231 + sync writes + chargebacks |
| 2 | 🟡 **The Contradiction** | "Propose Kafka for events" | Graph reasoning over past decisions + new facts | ✅ Verified — INFRA-45 rejection + Maria's Stripe Kafka background + INFRA-89 |
| 3 | 🟢 **The Hidden Expert** | "Debug connection pool timeout" | Graph reasoning finds the right person + prior fix | ✅ Verified — Alex Chen's pool fix (10→50) + PERF-231 + PAY-45 |

Plus a **Living Constellation** graph visualization that all three animate over.

---

## Current state of the repo (what already exists)

| Asset | Status |
|-------|--------|
| `demo_data/` — Slack, Jira, meetings, support, code | ✅ Rich, entities overlap across sources |
| `ingest.py` — parsers + `add()` + `cognify()` + 3 traversal tests | ✅ Working (provider bug + UTF-8 crash fixed) |
| `requirements.txt` — cognee, fastapi, uvicorn, websockets, dotenv | ✅ Installed in `.venv` (cognee 1.2.2) |
| `.env` — OpenAI `gpt-4o-mini`, fastembed local embeddings | ✅ present ⚠️ key exposed, see below |
| Built knowledge graph in `.cognee_*` | ✅ Persisted, all traversals green |
| FastAPI backend | ❌ Not started (Phase 1) |
| React/Vite frontend | ❌ Not started (Phase 2) |

**Key structural finding:** `cognee.search(GRAPH_COMPLETION)` returns a **list of dicts, one
per dataset** — each with `dataset_name` (e.g. `"slack"`, `"jira"`) and a `search_result` list
of markdown strings. The `dataset_name` gives us free **source attribution** for insight-card
badges.

---

## ✅ Phase 0 — De-risk ingestion (COMPLETE)

- [x] Fixed `setup_cognee()` groq→env bug (now reads `LLM_PROVIDER`, defaults OpenAI)
- [x] Added embedding config (fastembed, local, zero external cost)
- [x] Added UTF-8 stdout guard (Windows cp1252 emoji crash)
- [x] Ran full ingestion — graph built & persisted
- [x] Verified all 3 traversal paths return planted cross-silo entities

---

## ✅ Phase 1 — Backend API (FastAPI) — COMPLETE & VERIFIED

Shared `nexus/` package + thin FastAPI server, all endpoints verified over HTTP.

- [x] `nexus/cognee_setup.py` — `setup_cognee()` + config + UTF-8 guard (single source of truth)
- [x] `nexus/parsers.py` — 5 source parsers + `SOURCES`/`load_source_text`
- [x] `ingest.py` — rewritten to import from `nexus/` (no duplication)
- [x] `nexus/graph_extractor.py` — merges per-dataset graphs → constellation shape
- [x] `nexus/insights.py` — `run_trigger()` + 3 tuned `PRESETS`
- [x] `nexus/main.py` — FastAPI app (graph cached after first read)

| Endpoint | Cognee call | Verified result |
|----------|-------------|-----------------|
| `POST /api/trigger` | `cognee.search(GRAPH_COMPLETION)` | ✅ all 3 presets return grounded insights + source badges |
| `GET /api/graph` | per-dataset `get_graph_data()` merged | ✅ 92 nodes / 248 links / 18 cross-silo bridges |
| `GET /api/stats` | derived counts | ✅ nodes, edges, bridges, live counters |
| `GET /api/presets` | static | ✅ the 3 demo triggers for the UI buttons |

**Run:** `uvicorn nexus.main:app --port 8000` (set `PYTHONUTF8=1` on Windows).

### ⚠️ Key lesson learned (do NOT repeat)
**Multi-tenant access control MUST stay ON** (the cognee default). Setting
`ENABLE_BACKEND_ACCESS_CONTROL=false` made `cognify()` write to an empty unified
graph and the demo searches lost all grounding (returned generic boilerplate).
With access control ON, cognee stores **one graph per dataset**; we read each
inside its tenant context (`set_database_global_context_variables`) and merge.
The same entity gets the same UUID across datasets, so merging surfaces the
cross-silo bridges (perf-231, globalpay, kafka, alex chen) for free.

**Out of scope for v1:** WebSocket streaming, `POST /api/feedback` (both stretch).

---

## ✅ Phase 2 — Frontend — COMPLETE (headlessly verified)

Vite + React + TS + react-force-graph-2d. Custom hand-written CSS design system
(liquid glass) instead of Tailwind — more control over `backdrop-filter`,
specular highlights, and glossy node gradients, and one fewer build dependency.

- [x] `frontend/` scaffold (Vite 5, React 18, TS strict) — builds clean (1068 modules)
- [x] `styles.css` + `theme.ts` — dark tokens, `.glass` liquid-glass surface, source palette
- [x] `NeuralBackground.tsx` — ambient 2D particle-network layer (cheap, behind the graph)
- [x] `Constellation.tsx` — glossy radial-gradient nodes, source colors, bridge halos,
      traversal highlight + pulse + directional particles on active links
- [x] `TriggerBar.tsx` — 3 preset buttons + free-text, wired to `/api/trigger`
- [x] `InsightCard.tsx` — glass card, type badge (🔴/🟡/🟢), safe inline markdown, source badges
- [x] `StatsFooter.tsx` + legend — live counters from `/api/stats`
- [x] `App.tsx` — fetches graph/stats/presets; on trigger, scans insight text for node
      labels (+ one-hop neighbors) to light up the path

**Verified headlessly:** `npm run build` clean, both servers up, Vite proxy → backend
works, all 3 presets return grounded insights through the proxy, highlight logic fires
on real node labels, counters increment.
**Not yet eyeballed:** the actual glass/glossy *rendering* needs a human — open the app.

### How to run
```
# terminal 1 — backend (from repo root)
PYTHONUTF8=1 .venv/Scripts/python -m uvicorn nexus.main:app --port 8000
# terminal 2 — frontend
cd frontend && npm run dev   # open http://localhost:5173
```

---

## ✅ Phase 3 — Polish & demo safety (build parts done)

- [x] Grid app-shell: bounded/clipped graph box, no more free-floating overlap
- [x] Trigger "thinking" state — spinner + shimmer skeleton while `cognee.search` runs
      (fills the 3–6s dead air; names the context being traced)
- [x] Loading state with spinner; readable label plates on lit nodes; label-count cap
- [x] `README.md` — problem, architecture, Cognee APIs, run steps, demo script
- [ ] Rehearse the 2-minute demo flow *(yours)*
- [ ] **Record a backup demo video** *(yours — always, in case live fails)*
- [ ] Add screenshots to README once UI is final *(optional)*

---

## Explicitly cut from the original architecture doc

To protect the timeline, these are **out** (add back only if time remains):
- Timeline scrubber
- Full `remember` / `recall` / `forget` / `memify` feedback suite (keep only optional `POST /api/feedback`)
- WebSocket real-time updates
- The "11 Cognee APIs" coverage slide (we use ~4 well, not 11 shallowly)
- `SIMILARITY` / `INSIGHTS` / `GRAPH_COMPLETION_COT` secondary searches (GRAPH_COMPLETION alone is proven)

---

## Open items / risks

| Item | Action |
|------|--------|
| ⚠️ **OpenAI key exposed** in `.env` + this session | **Rotate it.** Graph is already built, so only live `search()` needs the key — swapping is free. |
| `GET /api/graph` data-pull API is unverified | Confirm against installed cognee 1.2.2 first thing in Phase 1. |
| Live demo failure | Recorded video backup (Phase 3). |
| Graph too dense to read | Filter to nodes within N hops of the triggered context; fade the rest. |

---

## Proposed order of execution

1. **Phase 1 backend** (`/api/trigger` + `/api/graph` + `/api/stats`) — gives the frontend real data
2. **Phase 2 frontend** — constellation + insight cards + trigger buttons
3. **Phase 2 traversal animation** — the WOW moment
4. **Phase 3 polish + backup video**

> **Awaiting your approval before starting Phase 1.**
