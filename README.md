# AI 页面总结

Chrome 扩展：在任意网页上划词、粘贴或一键总结，调用 OpenAI 兼容 API 生成摘要。纯前端、无后端，API Key 仅存本地。

## 功能

- **划词总结** — 选中文字后点击浮动「总结」按钮
- **整页总结** — 提取当前页面正文并总结
- **剪贴板 / 微信文字** — 粘贴或自动读取剪贴板内容总结
- **侧边面板** — 总结结果在页面右侧展示，支持重置回初始操作页
- **四种模式** — 精简、详细、要点、观点
- **Markdown 预览** — 结果支持 MD 渲染，可切换源码视图
- **智能篇幅** — 根据原文字数自动调整总结长度，短原文短总结
- **防脑补** — 严格基于原文，选区过短时不替原文作答
- **等待小游戏** — 加载时可切换气泡 / 地鼠 / 接物 / 速点
- **多 API 兼容** — OpenAI、DeepSeek、通义、Moonshot、火山方舟等

## 截图说明

| 场景 | 操作 |
|------|------|
| 弹窗 / 面板首页 | 选模式 → 粘贴或留空 → 点「总结」 |
| 划词 | 选中文字 → 点「总结」 |
| 结果页 | 切换模式 / 复制 / 源码预览 / 重置 |
| 等待中 | 顶部切换小游戏 |

## 安装

```bash
git clone https://github.com/ljp-777/chrome-ai-summary.git
cd chrome-ai-summary
```

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启 **开发者模式**
3. 点击 **加载已解压的扩展程序**，选择项目根目录
4. 修改代码后点击 **重新加载**，并刷新目标网页

## 配置

点击扩展图标 → **设置**，或右键扩展 → **选项**。

| 配置项 | 说明 | 示例 |
|--------|------|------|
| API Key | 模型服务商密钥 | `sk-...` / `ark-...` |
| API Base URL | 接口地址 | `https://api.openai.com/v1` |
| 模型 | 模型名或接入点 ID | `gpt-4o-mini` / `ep-xxx` |
| 系统提示词 | 自定义总结风格（可选） | 留空使用默认 |

### OpenAI

```
API Base: https://api.openai.com/v1
API Key:  sk-xxxxxxxx
模型:     gpt-4o-mini
```

### 火山方舟

```
API Base: https://ark.cn-beijing.volces.com/api/v3
API Key:  ark-xxxxxxxx
模型:     ep-xxxxxxxx
```

> 不要使用 IAM Access Key（`AKLT` 开头），也不要把 `ep-` 接入点 ID 填到 API Key 栏。

## 使用

### 扩展弹窗

1. 选择总结模式（精简 / 详细 / 要点 / 观点）
2. 在文本框粘贴微信或剪贴板文字，留空则自动用页面选区或剪贴板
3. 点击 **总结**，结果在页面右侧面板展示
4. 底部 **整页总结** / **设置** 为快捷入口

### 页面侧边面板

总结后面板顶部提供：

- **源码** — 切换 Markdown 预览 / 原始文本
- **复制** — 复制总结内容
- **重置** — 恢复初始操作页（模式选择 + 粘贴框 + 总结按钮）
- **×** — 关闭面板

结果页可切换模式重新总结同一原文。

### 其他入口

| 方式 | 操作 |
|------|------|
| 划词 | 选中文字 → 浮动「总结」 |
| 右键 | AI 总结本页 / 选中内容 / 剪贴板 |

## 项目结构

```
chrome-ai-summary/
├── manifest.json
├── icons/                      # 16 / 48 / 128 图标
├── docs/
│   └── privacy-policy.html     # 隐私政策（上架必填）
├── scripts/
│   └── pack.ps1                # 打包上架 zip
├── LICENSE
├── README.md
└── src/
    ├── background/
    │   └── background.js
    ├── content/
    │   ├── content.js
    │   ├── content.css
    │   ├── md.js
    │   └── loading-game.js
    ├── popup/
    │   ├── popup.html
    │   └── popup.js
    └── options/
        ├── options.html
        └── options.js
```

## 发布到 Chrome 网上应用店

### 1. 准备

- 注册 [Chrome 开发者账号](https://chrome.google.com/webstore/devconsole)（一次性 $5）
- 将 `docs/privacy-policy.html` 部署到可公开访问的 URL（如 GitHub Pages）
- 隐私政策 URL 示例：`https://ljp-777.github.io/chrome-ai-summary/docs/privacy-policy.html`（需开启 GitHub Pages）
- 准备商店截图（1280×800 或 640×400，至少 1 张）

### 2. 打包

```powershell
.\scripts\pack.ps1
```

生成 `chrome-ai-summary.zip`，仅含 `manifest.json`、`icons/`、`src/`。

### 3. 上传

1. 开发者后台 → **新建项目** → 上传 zip
2. 填写商店信息、分类、简介
3. **隐私政策** 填部署后的 URL
4. **权限说明**：数据发往用户自配 AI API，不经过开发者服务器
5. 提交审核

## 隐私

- 完整说明见 [docs/privacy-policy.html](docs/privacy-policy.html)
- API Key 保存在 Chrome 同步存储（`chrome.storage.sync`）
- 总结请求从浏览器直接发往您配置的 API，不经过第三方服务器
- 扩展不收集或上传浏览数据

## 开发

零依赖纯 JavaScript，无需构建。改完代码在 `chrome://extensions/` 重载即可。

| 消息 | 方向 | 说明 |
|------|------|------|
| `SUMMARIZE` | content → background | 发起总结 |
| `SUMMARIZE_PAGE` | popup/menu → content | 总结整页 |
| `SUMMARIZE_SELECTION` | popup/menu → content | 总结选区 / 粘贴文字 |
| `SUMMARIZE_CLIPBOARD` | menu → content | 读取剪贴板并总结 |
| `GET_SELECTION` | popup → content | 获取页面选中文本 |

## 常见问题

**401 AuthenticationError**

- 检查 API Key 是否正确，是否有多余空格或 `Bearer` 前缀
- 火山方舟需 `ark-` 开头 Key，模型填 `ep-` 接入点 ID

**划词按钮不出现**

- 确认扩展已启用且页面已刷新
- Chrome 内置页、扩展页无法注入脚本

**总结内容「脑补」**

- 选区过短时模型可能过度发挥，扩展已对短文本做约束，建议选中更多上下文

**剪贴板无法读取**

- 首次使用需授予剪贴板权限，或在面板 / 弹窗中手动粘贴

## 贡献

欢迎 Issue 和 Pull Request。

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/xxx`
3. 提交更改并推送
4. 发起 Pull Request

## License

[MIT](LICENSE)
