"""
Nexus backend — a thin FastAPI layer over Cognee.

Every endpoint is a shell around a Cognee call:
  POST /api/trigger  -> cognee.search(GRAPH_COMPLETION)  (proactive insight)
  GET  /api/graph    -> merged per-dataset graph          (constellation)
  GET  /api/stats    -> counts derived from the graph

Run:  uvicorn nexus.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from nexus.insights import run_trigger, PRESETS
from nexus.graph_extractor import get_unified_graph

app = FastAPI(title="Nexus", description="Cross-silo intelligence layer on Cognee")

# The Vite dev server runs on 5173; allow it (and localhost variants) to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # demo/local only
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache the graph after first read — it never changes during a demo, and reading
# it touches five dataset databases. /api/graph therefore stays instant.
_graph_cache: dict | None = None

# Simple in-process demo counters.
_counters = {"insights_surfaced": 0, "contradictions_found": 0, "blind_spots_prevented": 0}


class TriggerRequest(BaseModel):
    context: str = ""
    preset: str | None = None


@app.get("/api/presets")
async def presets():
    """The 3 canned demo triggers, for the frontend's trigger buttons."""
    return [
        {"key": k, "label": v["label"], "insight_type": v["insight_type"]}
        for k, v in PRESETS.items()
    ]


@app.post("/api/trigger")
async def trigger(req: TriggerRequest):
    """Run a context trigger and return the proactive insight card."""
    result = await run_trigger(context=req.context, preset=req.preset)
    _counters["insights_surfaced"] += 1
    if result["insight_type"] == "contradiction":
        _counters["contradictions_found"] += 1
    elif result["insight_type"] == "blind_spot":
        _counters["blind_spots_prevented"] += 1
    return result


@app.get("/api/graph")
async def graph():
    """Return the unified constellation (nodes + links), cached after first read."""
    global _graph_cache
    if _graph_cache is None:
        _graph_cache = await get_unified_graph()
    return _graph_cache


@app.get("/api/stats")
async def stats():
    """Aggregate stats for the footer."""
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
