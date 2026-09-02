# Melva的个人计划（终版 · PWA）

> 任务 · 习惯 · 学习 · 英语 · 日记 · 复盘 · 表达话术 · AI 笔记 — 一站式个人生活管理

## ✅ 已实现的三项核心需求

| 需求 | 实现方式 |
|------|----------|
| **电脑端 + 手机端稳定打开** | PWA（Progressive Web App）。PC 端 Chrome/Edge 点「安装」即可变为独立窗口应用；手机端浏览器「添加到主屏幕」像原生 App 使用，支持离线运行。 |
| **Supabase 云端实时同步** | 设置页内置 Supabase 连接面板（项目 URL / 匿名 Key / 同步码）。手机与电脑填相同「同步码」即双向实时同步（毫秒级）。离线数据先存本机，联网自动续传。 |
| **输入自动保存不丢失** | 每次操作瞬间写入浏览器 LocalStorage（关闭 App 不丢）；原应用还有 5 秒后台快照防丢。开启云同步后防抖上传云端。顶栏徽标实时显示 `本地已保存 / 同步中… / 已同步云端 / 离线·已存本机`。 |

---

## 🚀 快速开始

### 本地预览（PC）
```bash
cd life-os-app
python -m http.server 8765
```
浏览器打开 **http://localhost:8765**

### 安装为 App
- **PC（Chrome / Edge）**：地址栏右侧「安装」图标 → 安装为独立窗口应用
- **手机端（需 HTTPS）**：Safari 分享 →「添加到主屏幕」；Android Chrome 菜单 →「添加到主屏幕」

> PWA 安装需 **HTTPS 或 localhost**。手机端必须经下方「部署到公网」获得 HTTPS 地址。

---

## ☁️ 开启云端实时同步（Supabase）

设置页 **⚙️ 设置与备份** 已为你准备好全部信息与 SQL：

1. 注册 [supabase.com](https://supabase.com) → New Project → 创建项目
2. 控制台 **Settings → API** 复制：
   - **Project URL**（如 `https://xxxxx.supabase.co`）
   - **anon public key**（以 `eyJ...` 开头）
3. 控制台 **SQL Editor** 粘贴设置页中「▶ 在 Supabase 中创建数据表」里的 SQL 并执行（已含建表、开启匿名读写策略、开启 Realtime）
4. 回到 App 设置页：
   - 填入 **项目 URL** 与 **匿名 Key**
   - 点 **生成随机码** 得到同步码（或自定一个长随机串）
   - 点 **连接并启用同步**
5. **手机端**：同一 App，设置页填**相同的**三项信息 → 连接 → 两端实时同步

> 安全说明：匿名读写策略以 24 位随机「同步码」作为访问密钥，只要不同步码泄露，他人无法访问你的数据。适合个人使用。

---

## 🔐 管理员登录 & 私密保护（两层）

应用有**两层门禁**，确保只有你自己能用：

1. **应用内管理员登录**（`login.js`）
   - 首次进入引导「设置管理员账号」：用户名 + 密码（≥6 位），密码以哈希存入本地，绝不存明文。
   - 之后每次打开需输入账号密码；勾选「记住我」下次自动登录；顶栏可「退出」。
   - 忘记密码可在登录页「重置管理员账号」（仅清空账号，本地生活数据不受影响）。
2. **站点级 Basic Auth**（`_headers`，部署后由 Netlify 边缘强制）
   - 全站先要输入一组账号密码才能加载页面，属于**服务端**校验，他人无法绕过。
   - 默认 `lifeos / ChangeMe123!`，请部署后改成你自己的密码（改 `_headers` 重新部署即可）。

> 说明：应用内登录是客户端校验，可挡普通人与误入者；`_headers` Basic Auth 是服务端校验，二者叠加即为「端到端私密」。即使有人拿到网址，没有这两道密码也进不去、读不到数据。

---

## 🌐 部署到公网（让手机也能用）

PWA 安装需 HTTPS。**推荐 Netlify（免费 + 自带私密）**：

### 方式 A：一键脚本部署（推荐，含私密保护）
1. 在 Netlify 生成 Personal Access Token：登录 [app.netlify.com](https://app.netlify.com) → User settings → Applications → **New access token**，复制保存。
2. 运行（把 TOKEN 换成你的）：
   ```bash
   cd life-os-app
   python deploy_netlify.py --token "你的NETLIFY_TOKEN"
   ```
3. 脚本会创建站点、打包上传（含 `_headers` 私密）、并打印 **站点 HTTPS 地址** 与 **SITE_ID**。
4. 后续更新：保留 SITE_ID，运行 `python deploy_netlify.py --token "..." --site-id "上次的ID"` 即可覆盖部署。
5. **改密码**：编辑 `_headers` 里的 `Basic-Auth: 用户名:密码` → 重新跑脚本。

### 方式 B：拖拽部署
把 `life-os-app` 文件夹拖到 [app.netlify.com/drop](https://app.netlify.com/drop) 即可获得 HTTPS 地址。注意：拖拽方式默认不带 `_headers` 私密，需在 Dashboard 手动开启「Visitor access → Basic protection」（Pro 功能）或自行配置。

### 其它平台
- **CloudStudio / EdgeOne Pages / Vercel / GitHub Pages**：部署文件夹即得 HTTPS。其中 GitHub Pages 站点本身公开，私密完全依赖上述应用内登录（仍建议优先 Netlify 以获服务端 Basic Auth）。

---

## 📁 文件结构

```
life-os-app/
├── index.html          # 应用本体（已植入 PWA + 同步面板 + 登录遮罩 + AI 笔记导出）
├── ai-notes.js         # AI 笔记引擎（多引擎 / 思维导图 / 学习笔记 / Word 导出核心 / 自定义引擎 / 代理）
├── test_ai_notes.js    # 引擎与导出的 Node 单元测试（42 项）
├── login.js            # 管理员登录门禁（设置/校验/记住我/退出/重置）
├── sync-engine.js      # Supabase 实时同步引擎（覆盖 saveState / 实时订阅）
├── manifest.webmanifest# PWA 清单
├── sw.js               # Service Worker（离线缓存外壳，含 login.js / ai-notes.js）
├── _headers            # Netlify 站点级 Basic Auth 私密（免费）
├── netlify.toml        # Netlify 构建/函数/反代豁免配置
├── netlify/
│   └── functions/
│       └── ai-proxy.js # Serverless 反代：浏览器直连 DeepSeek 等绕开 CORS
├── deploy_netlify.py   # Netlify 一键部署脚本
├── life_os_sync.sql    # Supabase 建表 SQL（单独导出，便于复制）
├── icons/              # 192 / 512 / maskable 图标
├── gen_icons.py        # 图标生成脚本（纯标准库）
└── README.md
```

---

## 📒 AI 脑图笔记 · 导出（Word / PDF / 高清图片）

在 **📒 AI 脑图笔记** 板块，选中某个对话后，工具栏右侧有三个导出按钮：

- **📄 Word**：导出为 `.doc`（双击即用 Word / WPS / Pages 打开，思维导图同时附 PNG 图与可编辑文字大纲，笔记保留 Markdown 排版）。
- **📕 PDF**：导出为多页 `.pdf`（每个 AI 回复独立成块分页，思维导图栅格化嵌入；自动横向/纵向适配 A4）。
- **🖼 图片**：导出整段对话为**高清 PNG**（默认 2× 分辨率）；若离线无法加载渲染库，自动退回导出最后一个思维导图 SVG 为 PNG。

> 点任一按钮都会**弹出文件名输入框**，输入即可（无需写扩展名，自动补 `.doc / .pdf / .png`）。点「取消」则中止导出。

**说明**：
- 三者在浏览器端生成，**不经过任何服务器**，私密安全。
- PDF / 高清图片依赖 `html2canvas` 与 `jsPDF`（首次使用自动从 jsDelivr CDN 加载，**需联网**）；若离线，PDF 仍可用（思维导图部分直接栅格化，无需该库），仅纯文字笔记的 PDF/图片需要 CDN。
- Word 导出**完全离线可用**（纯本地 HTML 拼装）。
- 引擎接入：设置页可选 OpenAI / DeepSeek / 豆包 / 通义 / Kimi / Groq / OpenRouter / Claude / Ollama / LM Studio / 自定义（可填自己的 API Base URL）；未配置时自动用本地算法兜底。

### 🛰️ 浏览器直连 AI（绕开 CORS 的 Netlify 同源反代）

浏览器直连 DeepSeek / OpenAI 等官方 API 会被 **CORS 跨域拦截**。本项目内置一个 Netlify Serverless 函数 `netlify/functions/ai-proxy.js`，部署到 Netlify 后在服务端（无跨域限制）代为转发请求，**DeepSeek 即可在浏览器里真正直连成功，无需自建服务器、也无需填写代理**。

- 部署到 Netlify 后，前端会**自动检测并启用** `/.netlify/functions/ai-proxy`（仅当域名为 `*.netlify.app / netlify.com` 时），无需任何额外配置。
- `netlify.toml` 已声明 functions 目录，并把 `/.netlify/functions/*` 从站点 Basic Auth 中豁免（否则反代会被拦截）。
- 若部署到**非 Netlify** 环境，仍可在设置里填「代理/反代地址」走自定义 CORS 代理，或改用 OpenRouter / Groq / 本地 Ollama 等支持浏览器跨域的引擎。
- 设置页「🔌 测试连接」按钮已覆盖反代路径，可一键验证 DeepSeek 是否真正可用。

## 🔧 故障排查

| 问题 | 解决 |
|------|------|
| 连接失败 | 检查 URL（末尾不要 `/`）与 Key 是否正确 |
| 两端不同步 | 确认「同步码」完全一致（区分大小写） |
| 手机打不开 | 必须用 HTTPS 地址，不能 HTTP |
| 数据丢失 | LocalStorage 不主动清除；建议定期导出 JSON 备份 |
| 状态一直「离线」 | 检查网络；联网后自动重连 |
| 旧版本缓存 | Ctrl+Shift+R 强制刷新 |

## 📋 技术栈
- 原生 HTML/CSS/JS（零框架）
- PWA：Manifest + Service Worker
- 同步：Supabase JS v2（PostgreSQL + Realtime）
- 本地：LocalStorage（即时持久化）
