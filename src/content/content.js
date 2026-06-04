const PANEL_HOST_ID = "ai-summary-panel-host";
const PANEL_ID = "ai-summary-panel";
const BTN_ID = "ai-summary-float-btn";
const MODES = [
  { id: "brief", label: "精简" },
  { id: "detail", label: "详细" },
  { id: "bullet", label: "要点" },
  { id: "insight", label: "观点" }
];
let lastRange = null;
let lastSourceText = "";
let lastMode = "brief";
let lastResult = "";
let viewMode = "preview";
let panelHost = null;

function getPanel() {
  return panelHost?.shadowRoot?.getElementById(PANEL_ID) ?? null;
}

function getSelectedText() {
  const sel = window.getSelection()?.toString().trim();
  if (sel) return sel;
  const el = document.activeElement;
  if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) {
    const { selectionStart: s, selectionEnd: e, value } = el;
    if (s != null && e != null && s !== e) return value.slice(s, e).trim();
  }
  return lastRange?.toString().trim() || "";
}

document.addEventListener("mouseup", onMouseUp);
document.addEventListener("mousedown", onMouseDown);
chrome.runtime.onMessage.addListener(onMessage);

function onMouseDown(e) {
  const host = document.getElementById(PANEL_HOST_ID);
  const btn = document.getElementById(BTN_ID);
  if (host?.shadowRoot?.contains(e.target) || btn?.contains(e.target)) return;
  removeFloatBtn();
}

function onMouseUp() {
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) {
      removeFloatBtn();
      return;
    }
    if (!sel.rangeCount) return;
    lastRange = sel.getRangeAt(0).cloneRange();
    showFloatBtn(lastRange);
  }, 10);
}

function showFloatBtn(range) {
  removeFloatBtn();
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.textContent = "总结";
  btn.title = "AI 总结选中内容";
  btn.style.top = `${window.scrollY + rect.bottom + 6}px`;
  btn.style.left = `${window.scrollX + rect.left}px`;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const t = getSelectedText();
    removeFloatBtn();
    if (t) runSummarize(t, lastMode);
  });
  document.body.appendChild(btn);
}

function removeFloatBtn() {
  document.getElementById(BTN_ID)?.remove();
}

async function runSummarize(text, mode = "brief", scope = "selection") {
  lastSourceText = text;
  lastMode = mode;
  showPanel({ loading: true, mode });
  try {
    const res = await chrome.runtime.sendMessage({ type: "SUMMARIZE", text, mode, scope });
    if (!res?.ok) throw new Error(res?.error || "总结失败");
    lastResult = res.text;
    showPanel({ text: res.text, mode });
  } catch (e) {
    showPanel({ error: e.message, mode });
  }
}

function onMessage(msg, _sender, sendResponse) {
  if (msg.type === "GET_SELECTION") {
    sendResponse({ text: getSelectedText() });
    return;
  }
  if (msg.type === "SUMMARIZE_CLIPBOARD") {
    navigator.clipboard.readText()
      .then((text) => {
        const t = text.trim();
        if (!t) throw new Error("剪贴板为空，请先在微信等应用中复制文字");
        runSummarize(t, msg.mode || "brief", "selection");
      })
      .catch((e) => showPanel({ error: e.message || "无法读取剪贴板" }));
    return;
  }
  if (msg.type === "SUMMARIZE_SELECTION") {
    runSummarize(msg.text || getSelectedText(), msg.mode || "brief");
    return;
  }
  if (msg.type === "SUMMARIZE_PAGE") {
    runSummarize(extractPageText(), msg.mode || "brief", "page");
  } else if (msg.type === "SHOW_RESULT") {
    showPanel(msg);
  }
}

function extractPageText() {
  const clone = document.body.cloneNode(true);
  clone
    .querySelectorAll(
      "script,style,noscript,nav,footer,header,aside,#" + PANEL_HOST_ID + ",#" + BTN_ID
    )
    .forEach((el) => el.remove());
  return (clone.innerText || "").replace(/\s+/g, " ").trim().slice(0, 15000);
}

function ensurePanel() {
  const existing = getPanel();
  if (existing) return existing;

  panelHost = document.createElement("div");
  panelHost.id = PANEL_HOST_ID;
  const shadow = panelHost.attachShadow({ mode: "open" });

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("src/content/content.css");
  shadow.appendChild(link);

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="ai-summary-header">
      <span>AI 总结</span>
      <div class="ai-summary-actions">
        <span class="ai-summary-result-actions">
          <button type="button" class="ai-summary-view" title="切换预览">源码</button>
          <button type="button" class="ai-summary-copy" title="复制">复制</button>
          <button type="button" class="ai-summary-reset" title="恢复初始状态">重置</button>
        </span>
        <button type="button" class="ai-summary-close" aria-label="关闭">×</button>
      </div>
    </div>
    <div class="ai-summary-body"></div>
  `;
  panel.querySelector(".ai-summary-close").addEventListener("click", () => {
    stopLoadingGame();
    lastSourceText = "";
    lastResult = "";
    panelHost?.remove();
    panelHost = null;
  });
  panel.querySelector(".ai-summary-view").addEventListener("click", () => {
    viewMode = viewMode === "preview" ? "source" : "preview";
    panel.querySelector(".ai-summary-view").textContent =
      viewMode === "preview" ? "源码" : "预览";
    const el = panel.querySelector(".ai-summary-result");
    if (el && lastResult) renderResult(el, lastResult);
  });
  panel.querySelector(".ai-summary-copy").addEventListener("click", async () => {
    if (!lastResult) return;
    await navigator.clipboard.writeText(lastResult);
    const btn = panel.querySelector(".ai-summary-copy");
    btn.textContent = "已复制";
    setTimeout(() => { btn.textContent = "复制"; }, 1500);
  });
  panel.querySelector(".ai-summary-reset").addEventListener("click", () => resetPanel());
  shadow.appendChild(panel);
  document.body.appendChild(panelHost);
  return panel;
}

function getHomeMode(panel) {
  return panel.querySelector('input[name="ai-mode"]:checked')?.value || "brief";
}

function renderHome(panel) {
  stopLoadingGame();
  lastSourceText = "";
  lastResult = "";
  viewMode = "preview";
  panel.querySelector(".ai-summary-result-actions").classList.add("hidden");
  panel.querySelector(".ai-summary-view").textContent = "源码";
  const body = panel.querySelector(".ai-summary-body");
  body.innerHTML = `
    <div class="ai-summary-home">
      <div class="ai-home-modes">
        ${MODES.map(
          ({ id, label }) =>
            `<label><input type="radio" name="ai-mode" value="${id}"${id === lastMode ? " checked" : ""} /><span>${label}</span></label>`
        ).join("")}
      </div>
      <textarea class="ai-home-paste" placeholder="粘贴微信/剪贴板文字，留空则用页面选中内容"></textarea>
      <button type="button" class="ai-home-summarize">总结</button>
      <div class="ai-home-footer">
        <a href="#" class="ai-home-page">整页总结</a>
        <span>|</span>
        <a href="#" class="ai-home-options">设置</a>
      </div>
    </div>
  `;
  body.querySelector(".ai-home-summarize").addEventListener("click", () => onHomeSummarize(panel));
  body.querySelector(".ai-home-page").addEventListener("click", (e) => {
    e.preventDefault();
    runSummarize(extractPageText(), getHomeMode(panel), "page");
  });
  body.querySelector(".ai-home-options").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  navigator.clipboard.readText().then((t) => {
    if (t.trim().length >= 2) body.querySelector(".ai-home-paste").value = t.trim();
  }).catch(() => {});
}

async function onHomeSummarize(panel) {
  const mode = getHomeMode(panel);
  let text = panel.querySelector(".ai-home-paste").value.trim();
  if (text) {
    runSummarize(text, mode);
    return;
  }
  text = getSelectedText();
  if (text) {
    runSummarize(text, mode);
    return;
  }
  try {
    text = (await navigator.clipboard.readText()).trim();
    if (text) {
      runSummarize(text, mode);
      return;
    }
  } catch {}
  showPanel({ error: "请粘贴文字、选中页面内容，或先在微信等应用中复制", mode });
}

function resetPanel() {
  removeFloatBtn();
  const panel = getPanel();
  if (panel) renderHome(panel);
}

function renderModesHtml(activeMode, disabled) {
  return MODES.map(
    ({ id, label }) =>
      `<button type="button" class="ai-summary-mode${id === activeMode ? " active" : ""}" data-mode="${id}"${disabled ? " disabled" : ""}>${label}</button>`
  ).join("");
}

function bindResultModes(container, activeMode) {
  container.querySelectorAll(".ai-summary-mode").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.mode;
      if (lastSourceText && id !== lastMode) runSummarize(lastSourceText, id);
    });
  });
}

function showPanel({ loading, text, error, mode = lastMode }) {
  const panel = ensurePanel();
  panel.querySelector(".ai-summary-result-actions").classList.remove("hidden");
  lastMode = mode;
  if (text) lastResult = text;
  const body = panel.querySelector(".ai-summary-body");
  if (loading) {
    body.innerHTML = `<div class="ai-summary-modes">${renderModesHtml(mode, true)}</div><div class="ai-summary-loading"></div>`;
    bindResultModes(body, mode);
    startLoadingGame(body.querySelector(".ai-summary-loading"));
  } else {
    stopLoadingGame();
    if (error) {
      body.innerHTML = `<div class="ai-summary-modes">${renderModesHtml(mode, false)}</div><div class="ai-summary-error">${escapeHtml(error)}</div>`;
      bindResultModes(body, mode);
    } else {
      body.innerHTML = `<div class="ai-summary-modes">${renderModesHtml(mode, false)}</div><div class="ai-summary-result"></div>`;
      bindResultModes(body, mode);
      renderResult(body.querySelector(".ai-summary-result"), text);
    }
  }
}

function normalizeMd(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/([。；;!?])\s*([-*+\uFF0D\u2022\u00B7])\s+/g, "$1\n$2 ");
}

marked.setOptions({ breaks: true, gfm: true });

function renderResult(body, text) {
  if (viewMode === "source") {
    body.innerHTML = `<div class="ai-summary-text ai-summary-source">${escapeHtml(text)}</div>`;
  } else {
    const html = marked.parse(normalizeMd(text));
    body.innerHTML = `<div class="ai-summary-md">${DOMPurify.sanitize(html)}</div>`;
  }
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
