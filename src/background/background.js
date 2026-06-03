chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "summarize-page",
    title: "AI 总结本页",
    contexts: ["page"]
  });
  chrome.contextMenus.create({
    id: "summarize-selection",
    title: "AI 总结选中内容",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "summarize-clipboard",
    title: "AI 总结剪贴板",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === "summarize-page") {
    chrome.tabs.sendMessage(tab.id, { type: "SUMMARIZE_PAGE" });
  } else if (info.menuItemId === "summarize-clipboard") {
    chrome.tabs.sendMessage(tab.id, { type: "SUMMARIZE_CLIPBOARD" });
  } else if (info.menuItemId === "summarize-selection" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: "SUMMARIZE_SELECTION",
      text: info.selectionText
    });
  }
});

const BASE_RULES =
  "严格基于用户提供的原文，禁止补充、推断或编造原文中没有的信息、观点、答案和例子。";
const MODES = {
  brief: "用1-3句简洁中文概括原文说了什么。可用 Markdown 列表。",
  detail: "分点说明原文已写明的信息，不展开原文未提及的内容。用 Markdown 格式输出。",
  bullet: "仅把原文已有要点分条列出，不新增条目。用 Markdown 无序列表。",
  insight: "仅提取原文明确表达的观点或结论，不做延伸解读。用 Markdown 格式。"
};
const SHORT_RULES =
  "原文很短。只用1-2句话说明其在问什么或说什么，不要展开，不要替原文作答。";

function getLengthPolicy(len) {
  if (len < 60) {
    return { rule: "原文极短。只用1句话，不超过25字。", maxTokens: 50, temperature: 0.1 };
  }
  if (len < 150) {
    return { rule: "原文很短。1-2句话，不超过50字。", maxTokens: 80, temperature: 0.1 };
  }
  if (len < 400) {
    return { rule: "原文较短。2-4句话或2-4个要点，不超过120字。", maxTokens: 160, temperature: 0.2 };
  }
  if (len < 1200) {
    return { rule: "总结约为原文的1/4到1/3，不要比原文还长。", maxTokens: 350, temperature: 0.25 };
  }
  if (len < 4000) {
    return { rule: "分点总结，篇幅约为原文的1/5。", maxTokens: 600, temperature: 0.3 };
  }
  return { rule: "原文较长，分点详细总结。", maxTokens: 1000, temperature: 0.3 };
}

function getModeStyle(mode, len) {
  if (len < 60) return "1句话，不超过25字。";
  if (len < 150) {
    const m = { brief: "1-2句话。", detail: "1-2句话，不展开。", bullet: "最多2个要点。", insight: "1句话点明核心。" };
    return m[mode] || m.brief;
  }
  if (len < 400) {
    const m = { brief: "2-3句话。", detail: "3-4句话或3-4个要点。", bullet: "3-4个要点。", insight: "2-3句话提取核心。" };
    return m[mode] || m.brief;
  }
  return MODES[mode] || MODES.brief;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "SUMMARIZE") {
    summarize(msg.text, msg.mode, msg.scope)
      .then((text) => sendResponse({ ok: true, text }))
      .catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
});

async function getConfig() {
  const data = await chrome.storage.sync.get([
    "apiKey",
    "apiBase",
    "model",
    "systemPrompt"
  ]);
  let apiKey = (data.apiKey || "").trim().replace(/^["']|["']$/g, "");
  if (/^bearer\s+/i.test(apiKey)) apiKey = apiKey.replace(/^bearer\s+/i, "");
  return {
    apiKey,
    apiBase: (data.apiBase || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: (data.model || "gpt-4o-mini").trim(),
    systemPrompt:
      data.systemPrompt ||
      "你是阅读助手。只总结原文已有内容，言简意赅，不脑补。"
  };
}

async function summarize(text, mode = "brief", scope = "selection") {
  const { apiKey, apiBase, model, systemPrompt } = await getConfig();
  if (!apiKey) throw new Error("请先在扩展选项中配置 API Key");
  if (/volces\.com|volcengine/i.test(apiBase)) {
    if (/^ep-/.test(apiKey))
      throw new Error("API Key 填错了：ep- 是接入点 ID，应填到「模型」；API Key 在方舟控制台 → API Key 管理（ark- 开头）");
    if (/^AKLT/i.test(apiKey))
      throw new Error("不能填 IAM Access Key，请在方舟控制台 → API Key 管理 创建 API Key");
    if (/^sk-/.test(apiKey))
      throw new Error("这是 OpenAI Key，不能用于火山方舟");
    if (!/^ark-/.test(apiKey))
      throw new Error("火山方舟 API Key 应以 ark- 开头，请到控制台重新复制");
  }
  const trimmed = text.trim().slice(0, 12000);
  if (!trimmed) throw new Error("没有可总结的内容");
  const len = trimmed.length;
  const policy = getLengthPolicy(len);
  const style = getModeStyle(mode, len);
  let system = `${systemPrompt}\n${BASE_RULES}\n${style}\n${policy.rule}`;
  if (scope === "selection") {
    system += "\n这是用户选中的片段，不是完整文章，不要脑补上下文。";
    if (len < 150) system += `\n${SHORT_RULES}`;
  }

  const res = await fetch(`${apiBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: `原文约${len}字。总结篇幅须与原文信息量匹配，短原文短总结，不得比原文更长：\n\n${trimmed}`
        }
      ],
      temperature: policy.temperature,
      max_tokens: policy.maxTokens
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API 错误 ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("API 返回为空");
  return content;
}
