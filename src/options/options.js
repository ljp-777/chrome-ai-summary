const fields = ["apiKey", "apiBase", "model", "systemPrompt"];

chrome.storage.sync.get(fields, (data) => {
  fields.forEach((k) => {
    const el = document.getElementById(k);
    if (el && data[k]) el.value = data[k];
  });
});

document.getElementById("save").addEventListener("click", () => {
  const payload = {};
  fields.forEach((k) => {
    payload[k] = document.getElementById(k).value.trim();
  });
  chrome.storage.sync.set(payload, () => {
    document.getElementById("status").textContent = "已保存";
    setTimeout(() => {
      document.getElementById("status").textContent = "";
    }, 2000);
  });
});
