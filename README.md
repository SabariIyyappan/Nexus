# NEXUS — the cross-silo intelligence layer for product teams

> **Nexus watches what your team is working on and proactively surfaces
> connections across Slack, Jira, code, docs, and support that no one thought to
> search for.** Built on [Cognee](https://www.cognee.ai/)'s open-source knowledge graph.

---

## The problem

Knowledge workers don't have a search problem — they have a **"didn't know to
search"** problem. Engineering ships a refund feature without knowing that:

- **Sales** (Slack, months ago): the biggest client has a hard 2-second SLA on refunds
- **Support** (last 90 days): 14 tickets about refund timeouts already exist
- **A past engineer** (Jira, 6 months ago): flagged this exact latency risk — closed as *wontfix*

Three teams already knew this feature would struggle. Nobody connected the dots,
because the knowledge lived in tools they never check.

**Why search can't fix it:** you can't search for what you don't know you need.
**Why Cognee can:** the path exists in the graph —
`refund_endpoint → payments_service → refund_timeout (support ×14) → 2s_SLA (Slack/sales) → PERF-231 (Jira, wontfix)`.
Five hops across four sources. Only a knowledge graph walks that path proactively.

---

## What it does (3 demo features)

| Trigger | Cognee surfaces | Type |
|---------|-----------------|------|
| *"Adding refund API endpoint"* | GlobalPay's 2s SLA + 14 support timeouts + PERF-231 wontfix — a risk 3 teams already knew | 🔴 Blind Spot |
| *"Proposing Kafka for event processing"* | Rejected in Dec (INFRA-45, "no expertise") — but Maria joined from Stripe in April; blocker resolved | 🟡 Contradiction |
| *"Debugging connection pool timeout"* | Alex already hit this — bumped the pool 10→50; see PERF-231 | 🟢 Hidden Expert |

Each insight is grounded in the real graph and shows which **sources** it crossed.
The constellation lights up the exact path Cognee traced.

---

## Architecture

```
 React + Vite frontend  ──REST──►  FastAPI backend  ──►  COGNEE (open source)
 · react-force-graph-2d                                   ├─ SQLite  (provenance)
 · liquid-glass UI                                        ├─ LanceDB (vectors, local)
 · glossy constellation                                  └─ Ladybug (knowledge graph)
```

- **Ingestion** (`ingest.py`): five demo sources are parsed to text, added with
  `cognee.add(dataset_name=…)`, then `cognee.cognify()` builds one entity/relationship graph.
- **Insights** (`nexus/insights.py`): `cognee.search(GRAPH_COMPLETION)` does multi-hop
  reasoning over the graph for a given work context.
- **Constellation** (`nexus/graph_extractor.py`): reads each dataset's graph within its
  tenant context and merges them. Entities shared across datasets keep the same id, so the
  merge naturally surfaces **cross-silo bridge nodes** (e.g. `perf-231`, `globalpay`, `kafka`).

### Cognee APIs used
`cognee.add` · `cognee.cognify` · `cognee.search(GRAPH_COMPLETION)` ·
`cognee.prune.*` · graph-store access via `get_graph_engine().get_graph_data()`
scoped with `set_database_global_context_variables`.

---

## Project layout

```
Nexus/
├─ ingest.py               # build the graph from demo_data (run once)
├─ nexus/
│  ├─ cognee_setup.py      # shared Cognee config (provider, paths, embeddings)
│  ├─ parsers.py           # Slack/Jira/text source parsers
│  ├─ insights.py          # run_trigger() + the 3 demo presets
│  ├─ graph_extractor.py   # merge per-dataset graphs → constellation shape
│  └─ main.py              # FastAPI: /api/trigger, /graph, /stats, /presets
├─ frontend/               # Vite + React + TS constellation UI
└─ demo_data/              # slack, jira, meetings, support, code
```

---

## Running it

**Prereqs:** Python 3.11+, Node 18+, an OpenAI API key.

```bash
# 1. Configure
cp .env.example .env          # then paste your OPENAI key into LLM_API_KEY

# 2. Backend deps
python -m venv .venv
.venv/Scripts/activate        # Windows;  source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt

# 3. Build the knowledge graph (once; a few minutes — uses the LLM)
python ingest.py              # on Windows: set PYTHONUTF8=1 first

# 4. Run backend + frontend (two terminals)
python -m uvicorn nexus.main:app --port 8000
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** and click a trigger.

> **Windows note:** prefix Python commands with `PYTHONUTF8=1` (or
> `$env:PYTHONUTF8=1`) so console emoji don't crash on cp1252.

> **Cognee note:** leave multi-tenant access control **on** (the default). Disabling
> it makes `cognify()` write to an empty unified graph and searches lose grounding.

---

## Demo flow (~90s)

1. Open cold — the constellation is already bloomed; brighter halos are cross-silo bridges.
2. Click **🔴 Adding refund API endpoint** → the path lights up; the insight card shows
   the SLA + support tickets + PERF-231 that 3 teams already knew.
3. Click **🟡 Proposing Kafka** → past rejection + the new hire who resolves the blocker.
4. Click **🟢 Debugging connection pool timeout** → the hidden expert + prior fix.
5. Footer counters (insights / blind spots / contradictions) tick up live.

**Tip:** warm each preset once before presenting — first calls hit the LLM (~seconds),
after which the graph and answers feel instant.
