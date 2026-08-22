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

## 🔐 管理员登录 & 私密保护

应用内置**管理员门禁**（`login.js`），确保只有你自己能用：

1. **应用内管理员登录**
   - 预置一个默认管理员账号/密码（哈希存于本地，绝不存明文），首次打开即要求登录。
   - 之后每次打开需输入账号密码；勾选「记住我」下次自动登录；顶栏可「退出」。
   - 管理员登录后，才能在 **⚙️ 设置 → 用户与密码管理** 中创建新的用户密码（未登录时该面板隐藏，且入口有护栏拦截）。
   - 忘记密码可在登录页「重置管理员账号」（恢复为默认 admin，本地生活数据不受影响）。

> ⚠️ **关于 GitHub Pages 的重要说明**：GitHub Pages 是**纯静态托管，没有服务端**，无法做真正的服务端密码校验。应用内登录是**客户端校验**，可挡住普通人与误入者，但无法抵御会查看源码的专业攻击者。若需要服务端级强校验，请改用带后端的托管（如 Vercel/Cloud Studio 等），或把本应用部署到需要密码的私有环境。
>
> 默认管理员账号：**admin**　默认密码：**请在部署前于 `login.js` 中修改为你自己的强密码**（本仓库示例已设占位密码，上线前务必改掉）。

---

## 🌐 部署到公网（让手机也能用 · GitHub Pages）

本项目已**专为 GitHub Pages 纯静态托管**适配（无任何 Netlify/服务端依赖）。PWA 安装需 HTTPS，GitHub Pages 自带 HTTPS。

### 部署步骤
1. 把 `life-os-app/` 目录内容推送到你的 GitHub 仓库（建议作为仓库根目录，或放在子目录后用项目页路径）。
2. 仓库 **Settings → Pages → Build and deployment**：
   - **Source** 选 `Deploy from a branch`
   - **Branch** 选你的分支（如 `main`），目录选 `/ (root)`（若放在子目录则选对应目录）
   - 点 **Save**
3. 等待 1–2 分钟，访问 `https://<你的用户名>.github.io/<仓库名>/` 即可。
4. 仓库根已放置 `.nojekyll`，确保 GitHub Pages 不启用 Jekyll、正确处理静态资源。

### 升级为自定义域名（可选）
- 在 Pages 设置里填自定义域名并配置 DNS（CNAME/A 记录）。
- 开启 **Enforce HTTPS**（GitHub 会自动签发证书），否则手机端 PWA「添加到主屏幕」与 Service Worker 无法工作。

### 其它静态平台
- **CloudStudio / EdgeOne Pages / Vercel / Netlify**：直接部署 `life-os-app/` 文件夹即得 HTTPS，流程与本仓库一致（无需任何平台专属配置）。

---

## 📁 文件结构

```
life-os-app/
├── index.html          # 应用本体（已植入 PWA + 同步面板 + 登录遮罩 + AI 笔记导出）
├── ai-notes.js         # AI 笔记引擎（多引擎 / 思维导图 / 学习笔记 / Word 导出核心 / 自定义引擎 / 代理）
├── test_ai_notes.js    # 引擎与导出的 Node 单元测试（42 项）
├── login.js            # 管理员登录门禁（校验/记住我/退出/重置/创建用户密码）
├── sync-engine.js      # Supabase 实时同步引擎（覆盖 saveState / 实时订阅 / 注册 Service Worker）
├── manifest.webmanifest# PWA 清单
├── sw.js               # Service Worker（离线缓存外壳，含 login.js / ai-notes.js）
├── .nojekyll           # 禁用 GitHub Pages 的 Jekyll 处理（纯静态托管必需）
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

### 🛰️ 浏览器直连 AI（绕开 CORS）

浏览器直连 DeepSeek / OpenAI 等官方 API 会被 **CORS 跨域拦截**。本项目在设置页提供「代理/反代地址」字段，可填入任意 CORS 代理（如自建的小反代服务、或公共代理）来转发请求；也可用 **OpenRouter / Groq / 本地 Ollama / LM Studio** 等本身支持浏览器跨域的引擎，无需代理。

> 说明：本纯静态版不再内置平台专属的 Serverless 反代函数（那依赖 Netlify 等特定平台）。在 GitHub Pages 上，推荐使用「设置代理地址」或上述跨域友好引擎。
>
> 设置页「🔌 测试连接」按钮可一键验证所选引擎/代理是否可用。

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
