function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "brief";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function summarizeOnPage(payload) {
  const tab = await getActiveTab();
  if (!tab?.id) throw new Error("无可用标签页");
  await chrome.tabs.sendMessage(tab.id, payload);
}

async function readClipboard() {
  return (await navigator.clipboard.readText()).trim();
}

document.getElementById("summarize").addEventListener("click", async () => {
  const mode = getMode();
  let text = document.getElementById("pasteText").value.trim();

  try {
    if (text) {
      await summarizeOnPage({ type: "SUMMARIZE_SELECTION", text, mode });
    } else {
      const tab = await getActiveTab();
      const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
      if (res?.text) {
        await summarizeOnPage({ type: "SUMMARIZE_SELECTION", text: res.text, mode });
      } else {
        text = await readClipboard();
        if (!text) {
          alert("请粘贴文字、选中页面内容，或先在微信等应用中复制");
          return;
        }
        await summarizeOnPage({ type: "SUMMARIZE_SELECTION", text, mode });
      }
    }
    window.close();
  } catch {
    alert("无法总结，请打开普通网页后重试");
  }
});

document.getElementById("summarizePage").addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await summarizeOnPage({ type: "SUMMARIZE_PAGE", mode: getMode() });
    window.close();
  } catch {
    alert("无法总结当前页面，请刷新后重试");
  }
});

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

(async () => {
  try {
    const text = await readClipboard();
    if (text.length >= 2) document.getElementById("pasteText").value = text;
  } catch {}
})();
