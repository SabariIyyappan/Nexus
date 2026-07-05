"""
Source parsers — flatten each demo data source into a rich text string that
Cognee's cognify pipeline can extract entities and relationships from.

Shared by the ingestion script and (potentially) a live upload endpoint.
"""

import csv
import json
import pathlib

# demo_data lives at the repo root, next to this package.
DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "demo_data"


def parse_slack(filepath: pathlib.Path) -> str:
    """Convert a Slack JSON export into a readable [ts] user: text transcript."""
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)

    lines = [f"SLACK WORKSPACE: {data['workspace']}\n"]
    for channel in data["channels"]:
        lines.append(f"\n--- Channel: #{channel['name']} ---")
        for msg in channel["messages"]:
            lines.append(f"[{msg['ts']}] {msg['user']}: {msg['text']}")
    return "\n".join(lines)


def parse_jira(filepath: pathlib.Path) -> str:
    """Convert a Jira CSV export into a readable per-ticket text block."""
    lines = ["JIRA TICKETS — ProjectVelocity\n"]
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lines.append(f"\nTICKET: {row['ticket_id']}")
            lines.append(f"Title: {row['title']}")
            lines.append(f"Status: {row['status']}")
            lines.append(f"Priority: {row['priority']}")
            lines.append(f"Assignee: {row['assignee']}")
            lines.append(f"Reporter: {row['reporter']}")
            lines.append(f"Created: {row['created_date']}")
            if row.get("resolved_date"):
                lines.append(f"Resolved: {row['resolved_date']}")
            lines.append(f"Labels: {row['labels']}")
            lines.append(f"Description: {row['description']}")
            lines.append("")
    return "\n".join(lines)


def parse_text_file(filepath: pathlib.Path) -> str:
    """Read plain-text sources (meetings, support tickets, code) as-is."""
    with open(filepath, encoding="utf-8") as f:
        return f.read()


# Maps each dataset name to (parser, source file). Single source of truth for
# what gets ingested, reused by ingest.py.
SOURCES = {
    "slack": (parse_slack, DATA_DIR / "slack" / "slack_export.json"),
    "jira": (parse_jira, DATA_DIR / "jira" / "jira_export.csv"),
    "meetings": (parse_text_file, DATA_DIR / "meetings" / "meeting_notes.txt"),
    "support": (parse_text_file, DATA_DIR / "support" / "support_tickets.txt"),
    "code": (parse_text_file, DATA_DIR / "code" / "payments_refund.py"),
}


def load_source_text(dataset_name: str) -> str:
    """Parse a single named source into its flattened text."""
    parser, path = SOURCES[dataset_name]
    return parser(path)
