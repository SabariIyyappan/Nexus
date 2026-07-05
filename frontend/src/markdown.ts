/**
 * Minimal, safe markdown → HTML for the subset Cognee returns:
 * **bold**, ### / #### headings, "- " bullets, "1." numbered lists, blank-line
 * paragraph breaks. Everything is HTML-escaped first, so it is XSS-safe.
 */
export function renderMarkdown(src: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const inline = (s: string) =>
    esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  const lines = src.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let listOpen = false;

  const closeList = () => {
    if (listOpen) {
      out.push("</ul>");
      listOpen = false;
    }
  };

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^#{3,4}\s+/.test(line)) {
      closeList();
      out.push(`<h4>${inline(line.replace(/^#{3,4}\s+/, ""))}</h4>`);
      continue;
    }
    const bullet = line.match(/^([-*]|\d+\.)\s+(.*)$/);
    if (bullet) {
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${inline(bullet[2])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join("");
}
