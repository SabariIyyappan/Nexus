"""
Nexus backend — a thin FastAPI layer over Cognee.

Insight generation uses grounded GRAPH_COMPLETION search; around it we lean on
Cognee's full memory lifecycle:

  POST /api/trigger   -> search  (+ remember the interaction)      insight card
  POST /api/feedback  -> improve (reinforce / memify) on 👍
  POST /api/forget    -> forget  (dismiss / prune learned memory)
  POST /api/recall    -> recall  (auto-routed memory of past sessions)
  GET  /api/ingest    -> streamed add()+cognify() with live logs (SSE)
  GET  /api/graph     -> merged per-dataset graph (constellation)
  GET  /api/stats     -> counts derived from the graph

Run:  uvicorn nexus.main:app --reload --port 8000
"""

import json
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import cognee

from nexus.cognee_setup import setup_cognee, DATASETS
from nexus.parsers import load_source_text
from nexus.insights import run_trigger, PRESETS
from nexus.graph_extractor import get_unified_graph
from nexus.memory import remember_interaction, reinforce, forget_session, recall_memory

app = FastAPI(title="Nexus", description="Cross-silo intelligence layer on Cognee")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo/local only
    allow_methods=["*"],
    allow_headers=["*"],
)

# The graph never changes between ingests, and reading it touches six dataset
# databases — so cache it and invalidate on re-ingest.
_graph_cache: dict | None = None
_counters = {"insights_surfaced": 0, "contradictions_found": 0, "blind_spots_prevented": 0}


class TriggerRequest(BaseModel):
    context: str = ""
    preset: str | None = None


class FeedbackRequest(BaseModel):
    session_id: str
    useful: bool


class SessionRequest(BaseModel):
    session_id: str


class RecallRequest(BaseModel):
    query: str
    session_id: str = "nexus-global"


# ── Insight (search + remember) ──────────────────────────────────────────────

@app.get("/api/presets")
async def presets():
    return [
        {"key": k, "label": v["label"], "insight_type": v["insight_type"]}
        for k, v in PRESETS.items()
    ]


@app.post("/api/trigger")
async def trigger(req: TriggerRequest):
    """Grounded cross-silo insight, then remember the interaction (lifecycle)."""
    result = await run_trigger(context=req.context, preset=req.preset)

    # Fire-and-forget: persist to Cognee session memory without blocking.
    asyncio.create_task(
        remember_interaction(result["context"], result["insight"], result["session_id"])
    )

    _counters["insights_surfaced"] += 1
    if result["insight_type"] == "contradiction":
        _counters["contradictions_found"] += 1
    elif result["insight_type"] == "blind_spot":
        _counters["blind_spots_prevented"] += 1
    return result


# ── Memory lifecycle ─────────────────────────────────────────────────────────

@app.post("/api/feedback")
async def feedback(req: FeedbackRequest):
    """👍 reinforces the session's memory (improve); 👎 forgets it (forget)."""
    if req.useful:
        return await reinforce(req.session_id)
    return await forget_session(req.session_id)


@app.post("/api/forget")
async def forget(req: SessionRequest):
    """Dismiss an insight → prune the learned memory for it."""
    return await forget_session(req.session_id)


@app.post("/api/recall")
async def recall(req: RecallRequest):
    """Auto-routed recall over remembered sessions — 'what have we seen before?'"""
    return await recall_memory(req.query, req.session_id)


# ── Streaming ingestion with live logs (SSE) ─────────────────────────────────

async def _ingest_stream():
    """Run the real add()+cognify() pipeline, emitting SSE log events."""
    global _graph_cache

    def ev(kind: str, message: str, **extra):
        return "data: " + json.dumps({"kind": kind, "message": message, **extra}) + "\n\n"

    try:
        await setup_cognee()
        yield ev("start", "🧠 NEXUS — Building Knowledge Graph")

        yield ev("log", "🗑️  Resetting Cognee for a clean rebuild…")
        await cognee.prune.prune_data()
        await cognee.prune.prune_system()
        yield ev("log", "✅ Reset complete")

        for i, name in enumerate(DATASETS, 1):
            text = load_source_text(name)
            await cognee.add(text, dataset_name=name)
            yield ev(
                "log",
                f"📥 [{i}/{len(DATASETS)}] {name} — added {len(text.split())} words",
                step=i, total=len(DATASETS),
            )

        yield ev("log", "⚡ Running cognify() — extracting entities & relationships…")
        yield ev("log", "   (LLM pass over all sources; this takes a few minutes.)")
        await cognee.cognify(datasets=DATASETS)
        yield ev("log", "✅ Knowledge graph built")

        _graph_cache = None  # force /api/graph + /api/stats to reload
        graph = await get_unified_graph()
        _graph_cache = graph
        bridges = sum(1 for n in graph["nodes"] if len(n["sources"]) > 1)
        yield ev(
            "done",
            f"🎉 Done — {len(graph['nodes'])} nodes, {len(graph['links'])} links, "
            f"{bridges} cross-silo bridges",
            nodes=len(graph["nodes"]), links=len(graph["links"]), bridges=bridges,
        )
    except Exception as e:  # surface failures into the UI log
        yield ev("error", f"❌ Ingestion failed: {e}")


@app.get("/api/ingest")
async def ingest():
    return StreamingResponse(_ingest_stream(), media_type="text/event-stream")


# ── Graph + stats ────────────────────────────────────────────────────────────

@app.get("/api/graph")
async def graph():
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = await get_unified_graph()
    return _graph_cache


@app.get("/api/stats")
async def stats():
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = await get_unified_graph()
    nodes = _graph_cache["nodes"]
    bridges = [n for n in nodes if len(n["sources"]) > 1]
    return {
        "total_nodes": len(nodes),
        "total_edges": len(_graph_cache["links"]),
        "cross_silo_bridges": len(bridges),
        "sources": sorted({s for n in nodes for s in n["sources"]}),
        **_counters,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok"}
