"""
The proactive intelligence layer: given a work context, ask Cognee's graph what
cross-silo connections the user doesn't know about, and shape the answer into an
insight card.

Cognee's GRAPH_COMPLETION returns a list of per-dataset dicts, each with a
`dataset_name` and a `search_result` list of markdown strings. We pick the
richest answer as the insight body and use the dataset names as source badges.
"""

import uuid

import cognee
from cognee.api.v1.search import SearchType

from nexus.cognee_setup import setup_cognee
from nexus.contacts import extract_contacts

# The three demo triggers. Each carries a known insight type (for the card badge)
# and a well-tuned query proven to surface the planted cross-silo connections.
PRESETS = {
    "blind_spot": {
        "label": "Adding refund API endpoint",
        "insight_type": "blind_spot",  # 🔴
        "query": """
            What risks, issues, or prior decisions exist that are relevant to
            adding a new refund API endpoint to the payments service?
            Look across all sources including support tickets, Slack, Jira,
            and meeting notes. What should an engineer know before building
            this? Who on the team should I contact about this, and what is
            their email address from the team directory?
        """,
    },
    "contradiction": {
        "label": "Proposing Kafka for event processing",
        "insight_type": "contradiction",  # 🟡
        "query": """
            Has Kafka been proposed or evaluated before in this team?
            What was the outcome? Are there any team members with Kafka
            expertise? What has changed since the last time this was discussed?
            Who specifically should I contact to help with Kafka, and what is
            their email address from the team directory?
        """,
    },
    "hidden_expert": {
        "label": "Debugging payments connection pool timeout",
        "insight_type": "hidden_expert",  # 🟢
        "query": """
            Who on the team has previously dealt with payment service timeouts
            or connection pool issues? What did they find and how did they fix
            it? Are there any related Jira tickets or prior investigations?
            Who should I contact about this, and what is their email address
            from the team directory?
        """,
    },
}


# Datasets written by the memory lifecycle; not real source silos, so they
# should never appear as source badges on an insight card.
_HIDDEN_SOURCES = {"main_dataset", "nexus_memory"}


def _flatten(results) -> list[dict]:
    """Normalize Cognee search output into [{source, text}] with non-empty text."""
    out = []
    for item in results or []:
        if not isinstance(item, dict):
            # Some search types return bare strings.
            text = str(item).strip()
            if text:
                out.append({"source": "graph", "text": text})
            continue
        source = item.get("dataset_name", "graph")
        if source in _HIDDEN_SOURCES:
            continue
        for part in item.get("search_result", []):
            text = str(part).strip()
            if text:
                out.append({"source": source, "text": text})
    return out


async def run_trigger(context: str = "", preset: str | None = None) -> dict:
    """Run a context trigger and return an insight card payload.

    Args:
        context: free-text work context (used when no preset is given).
        preset: one of PRESETS keys for a proven demo trigger.
    """
    await setup_cognee()

    if preset and preset in PRESETS:
        cfg = PRESETS[preset]
        query = cfg["query"]
        insight_type = cfg["insight_type"]
        label = cfg["label"]
    else:
        # Ad-hoc typed context: nudge Cognee to also surface the right contact
        # + email from the team directory, so the chat can offer a mailto (#6).
        query = (
            f"{context}\n\nWhat cross-silo risks, prior decisions, or relevant "
            f"context exist for this? Who on the team should I contact about it, "
            f"and what is their email address from the team directory?"
        )
        insight_type = "relevant"  # 🟢 default for ad-hoc queries
        label = context

    results = await cognee.search(
        query_type=SearchType.GRAPH_COMPLETION,
        query_text=query,
    )
    parts = _flatten(results)

    # Richest (longest) answer becomes the insight body; the distinct dataset
    # names that contributed become the source badges on the card.
    parts.sort(key=lambda p: len(p["text"]), reverse=True)
    insight = parts[0]["text"] if parts else "No cross-silo connections found."
    sources = list(dict.fromkeys(p["source"] for p in parts))  # order-preserving

    # Pull any known team contacts Cognee surfaced (emails) across all views so
    # the UI can show one-click mailto chips (#6).
    all_text = " ".join(p["text"] for p in parts)
    contacts = extract_contacts(all_text)

    return {
        "context": label,
        "insight_type": insight_type,
        "insight": insight,
        "sources": sources,
        "supporting": parts[1:],  # other per-source views, for expansion
        "contacts": contacts,
        "session_id": f"nexus-{uuid.uuid4().hex[:12]}",
    }
