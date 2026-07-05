"""
NEXUS Demo — Data Ingestion Script
====================================
Run this FIRST to build the Cognee knowledge graph from demo data.

Usage:
    python ingest.py

This script:
1. Flattens all demo data sources into plain text (nexus.parsers)
2. Ingests each source into Cognee with a dataset tag
3. Runs cognify() to build the knowledge graph
4. Tests the 3 demo traversal paths to confirm they work

Environment:
    FRESH=1 (default)  prune and rebuild one clean graph. Set FRESH=0 to append.

NOTE: leave multi-tenant access control ON (the default). Disabling it makes
cognify write to an empty unified graph and the demo searches lose grounding.
"""

import asyncio
import os

import cognee
from cognee.api.v1.search import SearchType

# Shared config + parsers live in the nexus package (also used by the backend).
from nexus.cognee_setup import setup_cognee, DATASETS
from nexus.parsers import load_source_text


# ─────────────────────────────────────────────────────────────────────────────
# INGESTION
# ─────────────────────────────────────────────────────────────────────────────

async def ingest_all():
    """Ingest all demo data sources into Cognee and build the graph."""
    await setup_cognee()

    print("\n🧠 NEXUS — Building Knowledge Graph")
    print("=" * 50)

    # Fresh start: prune so datasets rebuild cleanly. Set FRESH=0 to append.
    if os.getenv("FRESH", "1") == "1":
        print("🗑️  Resetting Cognee for a clean rebuild...")
        await cognee.prune.prune_data()
        await cognee.prune.prune_system()
        print("✅ Reset complete\n")

    for name in DATASETS:
        text = load_source_text(name)
        await cognee.add(text, dataset_name=name)
        print(f"   📥 {name:9s} — added {len(text.split())} words")

    print("\n⚡ Running cognify() — extracting entities & relationships...")
    print("   (Uses the LLM; expect a few minutes.)")
    await cognee.cognify(datasets=DATASETS)

    print("\n✅ Knowledge graph built successfully!")
    print("=" * 50)


# ─────────────────────────────────────────────────────────────────────────────
# TEST — Verify the 3 demo traversal paths work
# ─────────────────────────────────────────────────────────────────────────────

DEMO_QUERIES = {
    "🔴 PATH 1 — The Blind Spot": """
        What risks, issues, or prior decisions exist that are relevant to
        adding a new refund API endpoint to the payments service?
        Look across all sources including support tickets, Slack, Jira,
        and meeting notes. What should an engineer know before building this?
    """,
    "🟡 PATH 2 — The Contradiction": """
        Has Kafka been proposed or evaluated before in this team?
        What was the outcome? Are there any team members with Kafka expertise?
        What has changed since the last time this was discussed?
    """,
    "🟢 PATH 3 — The Hidden Expert": """
        Who on the team has previously dealt with payment service timeouts
        or connection pool issues? What did they find and how did they fix it?
        Are there any related Jira tickets or prior investigations?
    """,
}


async def test_traversals():
    """Run the 3 demo traversal paths and print results."""
    print("\n\n🧪 TESTING DEMO TRAVERSAL PATHS")
    print("=" * 50)

    for title, query in DEMO_QUERIES.items():
        print(f"\n{title}")
        results = await cognee.search(
            query_type=SearchType.GRAPH_COMPLETION,
            query_text=query,
        )
        print("RESULT:")
        for r in results:
            print(f"  {r}")

    print("\n" + "=" * 50)
    print("✅ Traversal test complete")


async def main():
    await ingest_all()
    await test_traversals()


if __name__ == "__main__":
    asyncio.run(main())
