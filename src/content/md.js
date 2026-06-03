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

function renderMarkdown(src) {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let inCode = false;
  let code = [];
  let list = null;

  const flushList = () => {
    if (!list) return;
    out.push(`<${list.tag}>`);
    list.items.forEach((item) => out.push(`<li>${inlineMd(escapeHtml(item))}</li>`));
    out.push(`</${list.tag}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith("```")) {
      flushList();
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
    if (!t) {
      flushList();
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushList();
      out.push("<hr>");
      continue;
    }
    const hm = t.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      flushList();
      const lv = hm[1].length;
      out.push(`<h${lv}>${inlineMd(escapeHtml(hm[2]))}</h${lv}>`);
      continue;
    }
    const bq = t.match(/^>\s?(.+)$/);
    if (bq) {
      flushList();
      out.push(`<blockquote>${inlineMd(escapeHtml(bq[1]))}</blockquote>`);
      continue;
    }
    const ul = t.match(/^[-*+]\s+(.+)$/);
    if (ul) {
      if (!list || list.tag !== "ul") {
        flushList();
        list = { tag: "ul", items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = t.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (!list || list.tag !== "ol") {
        flushList();
        list = { tag: "ol", items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    out.push(`<p>${inlineMd(escapeHtml(t))}</p>`);
  }
  flushList();
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return out.join("");
}
