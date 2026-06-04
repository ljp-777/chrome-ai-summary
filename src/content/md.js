function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function inlineMd(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${escapeHtml(c)}</strong>`)
    .replace(/\*([^*]+)\*/g, (_, c) => `<em>${escapeHtml(c)}</em>`)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, t, u) =>
      `<a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(t)}</a>`
    );
}

const BULLET = "[-*+\\uFF0D\\u2022\\u00B7]";

function parseListLine(raw) {
  const m = raw.match(new RegExp(`^(\\s*)(${BULLET}|\\d+\\.)\\s+(.+)$`));
  if (!m) return null;
  const indent = m[1].replace(/\t/g, "  ").length;
  const ordered = /^\d+\.$/.test(m[2]);
  return { indent, ordered, content: m[3].trimEnd() };
}

function buildListTree(flat) {
  const root = { children: [] };
  const stack = [{ indent: -1, node: root }];
  for (const item of flat) {
    const node = { content: item.content, ordered: item.ordered, children: [] };
    while (stack.length > 1 && item.indent <= stack[stack.length - 1].indent) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent: item.indent, node });
  }
  return root.children;
}

function renderListNodes(nodes) {
  if (!nodes.length) return "";
  let html = "";
  let i = 0;
  while (i < nodes.length) {
    const tag = nodes[i].ordered ? "ol" : "ul";
    html += `<${tag}>`;
    while (i < nodes.length && nodes[i].ordered === (tag === "ol")) {
      const n = nodes[i];
      html += `<li>${inlineMd(escapeHtml(n.content))}`;
      if (n.children.length) html += renderListNodes(n.children);
      html += "</li>";
      i++;
    }
    html += `</${tag}>`;
  }
  return html;
}

function collectListLines(lines, start) {
  const items = [];
  let i = start;
  while (i < lines.length) {
    const raw = lines[i];
    if (!raw.trim()) {
      if (items.length && i + 1 < lines.length && parseListLine(lines[i + 1])) {
        i++;
        continue;
      }
      break;
    }
    const item = parseListLine(raw);
    if (!item) break;
    if (items.length && item.indent < items[0].indent) break;
    items.push(item);
    i++;
  }
  return { items, next: i };
}

function normalizeMdLists(src) {
  return src
    .replace(/\r\n?/g, "\n")
    .replace(/([。；;!?])\s*([-*+\uFF0D\u2022\u00B7])\s+/g, "$1\n$2 ");
}

function renderMarkdown(src) {
  const lines = normalizeMdLists(src).split("\n");
  const out = [];
  let inCode = false;
  let code = [];

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const line = raw.trimEnd();
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        code = [];
      } else {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        inCode = false;
      }
      continue;
    }
    if (inCode) {
      code.push(raw);
      continue;
    }
    const t = line.trim();
    if (!t) continue;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      out.push("<hr>");
      continue;
    }
    const hm = t.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      const lv = hm[1].length;
      out.push(`<h${lv}>${inlineMd(escapeHtml(hm[2]))}</h${lv}>`);
      continue;
    }
    const bq = t.match(/^>\s?(.+)$/);
    if (bq) {
      out.push(`<blockquote>${inlineMd(escapeHtml(bq[1]))}</blockquote>`);
      continue;
    }
    const listItem = parseListLine(raw);
    if (listItem) {
      const { items, next } = collectListLines(lines, li);
      out.push(renderListNodes(buildListTree(items)));
      li = next - 1;
      continue;
    }
    out.push(`<p>${inlineMd(escapeHtml(t))}</p>`);
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return out.join("");
}
