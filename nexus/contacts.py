"""
Extract "who to contact" chips from an insight.

The team directory (demo_data/directory/team_directory.txt) is the source of
truth for names, emails, and roles — we parse it rather than hardcoding contacts.
When an insight text mentions one of those emails (Cognee surfaces them from the
graph), we return a structured contact so the UI can show a one-click mailto.
"""

import re
import functools

from nexus.parsers import DATA_DIR

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


@functools.lru_cache(maxsize=1)
def _directory() -> dict[str, dict]:
    """Parse the team directory file into {email: {name, email, role}}."""
    path = DATA_DIR / "directory" / "team_directory.txt"
    people: dict[str, dict] = {}
    cur: dict[str, str] = {}

    def flush():
        email = cur.get("email", "").lower()
        if email:
            people[email] = {
                "name": cur.get("name", email),
                "email": cur.get("email"),
                "role": cur.get("role", ""),
            }

    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("Name:"):
            flush()
            cur = {"name": line.split(":", 1)[1].strip()}
        elif line.startswith("Email:"):
            cur["email"] = line.split(":", 1)[1].strip()
        elif line.startswith("Role:"):
            cur["role"] = line.split(":", 1)[1].strip()
    flush()
    return people


def extract_contacts(text: str) -> list[dict]:
    """Return known directory contacts whose email appears in the insight text.

    Only real people from the team directory are returned — this deliberately
    drops any address the LLM might hallucinate (e.g. someone@example.com), so
    the UI never offers a fake mailto.
    """
    directory = _directory()
    seen: set[str] = set()
    out: list[dict] = []
    for email in _EMAIL_RE.findall(text or ""):
        key = email.lower()
        if key in seen or key not in directory:
            continue
        seen.add(key)
        out.append(directory[key])
    return out
