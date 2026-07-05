"""
Pull Cognee's knowledge graph and shape it for the frontend constellation.

Cognee (with access control on) stores one graph per dataset. We read each
dataset's graph inside its own tenant context and merge them into a single
node/edge set. Because Cognee assigns the *same* UUID to an entity that appears
in multiple sources, merging naturally surfaces cross-silo connections: a node
tagged with more than one source is a bridge between silos — exactly what Nexus
is about.

Output shape is what react-force-graph-2d expects:
    { "nodes": [{id, label, type, source_type, sources, val}],
      "links": [{source, target, relationship}] }
"""

from collections import defaultdict

from nexus.cognee_setup import setup_cognee, DATASETS

# Only these node types are meaningful "stars". TextSummary / DocumentChunk /
# TextDocument are structural plumbing and are filtered out.
KEEP_TYPES = {"Entity", "EntityType"}


async def _read_dataset_graph(dataset_name: str):
    """Return (nodes, edges) for one dataset, read within its tenant context."""
    from cognee.infrastructure.databases.graph import get_graph_engine
    from cognee.modules.data.methods import get_authorized_existing_datasets
    from cognee.modules.users.methods import get_default_user
    from cognee.context_global_variables import set_database_global_context_variables

    user = await get_default_user()
    resolved = await get_authorized_existing_datasets([dataset_name], "read", user)
    if not resolved:
        return [], []
    d = resolved[0]
    async with set_database_global_context_variables(d.id, d.owner_id):
        engine = await get_graph_engine()
        return await engine.get_graph_data()


async def get_unified_graph() -> dict:
    """Merge all dataset graphs into one constellation-ready structure."""
    await setup_cognee()

    node_props: dict[str, dict] = {}          # node_id -> raw props
    node_sources: dict[str, list[str]] = defaultdict(list)  # node_id -> [datasets]
    edge_set: set[tuple[str, str, str]] = set()  # dedupe (src, tgt, rel)

    for ds in DATASETS:
        nodes, edges = await _read_dataset_graph(ds)
        for nid, props in nodes:
            nid = str(nid)
            if props.get("type") not in KEEP_TYPES:
                continue
            node_props.setdefault(nid, props)
            if ds not in node_sources[nid]:
                node_sources[nid].append(ds)
        for s, t, rel, _props in edges:
            edge_set.add((str(s), str(t), rel))

    kept = set(node_props)

    # Degree = connection count, used to size nodes in the constellation.
    degree: dict[str, int] = defaultdict(int)
    links = []
    for s, t, rel in edge_set:
        if s in kept and t in kept:
            links.append({"source": s, "target": t, "relationship": rel})
            degree[s] += 1
            degree[t] += 1

    nodes_out = []
    for nid, props in node_props.items():
        sources = node_sources[nid]
        nodes_out.append({
            "id": nid,
            "label": props.get("name") or props.get("type", "entity"),
            "type": props.get("type", "Entity"),
            # Primary source drives node color; `sources` (len > 1) marks a
            # cross-silo bridge node the frontend can highlight specially.
            "source_type": sources[0] if sources else "unknown",
            "sources": sources,
            "val": 1 + degree.get(nid, 0),
        })

    return {"nodes": nodes_out, "links": links}
