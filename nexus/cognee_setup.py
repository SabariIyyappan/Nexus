"""
Shared Cognee configuration for Nexus.

Both the ingestion script and the FastAPI backend import `setup_cognee()` from
here so there is a single source of truth for provider/paths/access-control.
"""

import os
import sys
import pathlib

from dotenv import load_dotenv

load_dotenv()

# Windows consoles default to cp1252 and choke on emoji in log/print output.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import cognee

# Repo root = parent of this package.
ROOT = pathlib.Path(__file__).resolve().parent.parent
COGNEE_SYSTEM_DIR = ROOT / ".cognee_system"
COGNEE_DATA_DIR = ROOT / ".cognee_data"

# All demo datasets — the unified graph is built from these. `directory` is a
# team contact/expertise source so Cognee can surface who to contact and how.
DATASETS = ["slack", "jira", "meetings", "support", "code", "directory"]


async def setup_cognee() -> None:
    """Point Cognee at the local demo graph and configure the LLM/embeddings.

    Reads provider settings from .env so the running config always matches the
    configured API key. Safe to call multiple times (idempotent config).
    """
    from cognee.api.v1.config import config

    cognee.config.system_root_directory(str(COGNEE_SYSTEM_DIR))
    cognee.config.data_root_directory(str(COGNEE_DATA_DIR))

    llm_provider = os.getenv("LLM_PROVIDER", "openai")
    llm_endpoint = os.getenv("LLM_ENDPOINT") or None

    config.set_llm_config({
        "llm_provider": llm_provider,
        "llm_model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
        "llm_endpoint": llm_endpoint,
        "llm_api_key": os.getenv("LLM_API_KEY"),
    })

    config.set_vector_db_config({
        "vector_db_provider": "lancedb",  # local, zero infra
    })

    embedding_provider = os.getenv("EMBEDDING_PROVIDER")
    if embedding_provider:
        config.set_embedding_config({
            "embedding_provider": embedding_provider,
            "embedding_model": os.getenv("EMBEDDING_MODEL", "BAAI/bge-small-en-v1.5"),
            "embedding_dimensions": int(os.getenv("EMBEDDING_DIMENSIONS", "384")),
        })
