"""
Cognee memory lifecycle wrappers.

Nexus leans on Cognee's memory APIs, not just search:
  - remember()  after every insight, so the team's exploration accrues as memory
  - improve()   when a user marks an insight useful (reinforce / memify)
  - forget()    when a user dismisses an insight (prune learned memory)
  - recall()    auto-routed retrieval over remembered sessions ("memory recall")

The knowledge-graph *insight* itself still comes from GRAPH_COMPLETION search
(which is grounded and reliably surfaces the planted cross-silo facts); these
lifecycle calls wrap around it so the memory genuinely evolves with use.
"""

import cognee

from nexus.cognee_setup import setup_cognee

# Lifecycle writes go to a dedicated dataset, kept separate from the six source
# silos that the constellation reads — so remember()/forget() can never mutate
# or empty the knowledge graph shown in the UI.
MEMORY_DATASET = "nexus_memory"


async def remember_interaction(context: str, insight: str, session_id: str) -> None:
    """Persist an insight interaction into Cognee's session memory.

    self_improvement=True lets Cognee memify the interaction (reinforce the
    connection pattern). Runs in the background so it never blocks the response.
    Best-effort: any failure is swallowed so it can't affect the response path.
    """
    try:
        await setup_cognee()
        note = (
            f"Engineer explored context: {context}\n"
            f"Nexus surfaced this cross-silo insight:\n{insight}"
        )
        await cognee.remember(
            note,
            dataset_name=MEMORY_DATASET,
            session_id=session_id,
            run_in_background=True,
            self_improvement=True,
        )
    except Exception:
        pass


async def reinforce(session_id: str) -> dict:
    """👍 feedback → reinforce this session's memory (improve / memify)."""
    try:
        await setup_cognee()
        await cognee.improve(session_ids=[session_id], run_in_background=True)
    except Exception:
        pass
    return {"status": "reinforced", "session_id": session_id}


async def forget_session(session_id: str) -> dict:
    """Dismiss → prune learned memory (keeps the source graph intact)."""
    try:
        await setup_cognee()
        # memory_only + the dedicated memory dataset: forgets reinforced memory,
        # never the six ingested source silos shown in the constellation.
        result = await cognee.forget(dataset=MEMORY_DATASET, memory_only=True)
    except Exception as e:
        result = {"status": "noop", "detail": str(e)}
    return {"status": "forgotten", "session_id": session_id, "detail": result}


async def recall_memory(query: str, session_id: str) -> dict:
    """Auto-routed recall over session memory — 'what have we surfaced before?'"""
    await setup_cognee()
    entries = await cognee.recall(query_text=query, session_id=session_id)
    texts = []
    for e in entries or []:
        text = getattr(e, "text", None) or str(e)
        if text.strip():
            texts.append(text.strip())
    # Longest entry is the fullest answer.
    texts.sort(key=len, reverse=True)
    return {"answer": texts[0] if texts else "No prior memory yet.", "entries": len(texts)}
