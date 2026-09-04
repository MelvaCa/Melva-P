/* =============================================================
 *  AI 笔记引擎 (ai-notes.js)
 *  - 关联主流公开 AI 引擎（OpenAI 兼容 / Anthropic 格式）
 *  - 支持自定义 API Base URL
 *  - 文本 / 链接 → 思维导图 或 学习笔记
 *  - 纯函数可单测（Node require），浏览器挂到 window.AINotes
 * ============================================================= */
(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof window !== 'undefined') window.AINotes = api;
})(this, function () {

    /* ---------- 1. 公开 AI 引擎预设 ---------- */
    const AI_ENGINES = {
        local:     { name: '本地智能引擎（无需联网 / API）', base: '', model: '', needsKey: false },
        openai:    { name: 'OpenAI',                         base: 'https://api.openai.com/v1',                    model: 'gpt-4o-mini',        needsKey: true },
        deepseek:  { name: 'DeepSeek 深度求索',               base: 'https://api.deepseek.com/v1',                 model: 'deepseek-chat',      needsKey: true },
        doubao:    { name: '豆包 / 火山方舟',                 base: 'https://ark.cn-beijing.volcengine.com/api/v3', model: 'doubao-seed-1.6-250615', needsKey: true },
        qwen:      { name: '通义千问 Qwen',                   base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', needsKey: true },
        moonshot:  { name: 'Kimi / Moonshot',                base: 'https://api.moonshot.cn/v1',                  model: 'moonshot-v1-8k',     needsKey: true },
        groq:      { name: 'Groq',                           base: 'https://api.groq.com/openai/v1',              model: 'llama-3.1-8b-instant', needsKey: true },
        openrouter:{ name: 'OpenRouter（聚合多家）',          base: 'https://openrouter.ai/api/v1',               model: 'openai/gpt-4o-mini', needsKey: true },
        ollama:    { name: 'Ollama 本地模型',                 base: 'http://localhost:11434/v1',                  model: 'llama3',             needsKey: false },
        lmstudio:  { name: 'LM Studio 本地',                  base: 'http://localhost:1234/v1',                   model: 'local-model',        needsKey: false },
        claude:    { name: 'Claude (Anthropic)',             base: 'https://api.anthropic.com/v1',               model: 'claude-3-5-sonnet-20241022', needsKey: true, format: 'anthropic' },
        custom:    { name: '自定义 / Custom',                 base: '', model: '', needsKey: true }
    };

    function engineMeta(engine) {
        return AI_ENGINES[engine] || AI_ENGINES.custom;
    }

    /* ---------- 2. 通用工具 ---------- */
    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function looksLikeUrl(t) {
        return /^(https?:\/\/|www\.)/i.test((t || '').trim());
    }

    /* ---------- 3. 构建对话消息 ---------- */
    function buildMessages(mode, text) {
        const sysMind =
            '你是一个结构化思维助手。用户会给你一段文本或链接主题，请输出【思维导图】。' +
            '严格使用 Markdown 无序列表嵌套表示层级：每深入一层缩进 2 个空格，项目符号用 "- "；' +
            '顶层为唯一根主题，最多 4 层；不要使用代码块、不要任何额外解释文字，只输出列表本身。';
        const sysNote =
            '你是一个学习笔记助手。请根据用户提供的文本或主题，整理成清晰的【学习笔记】，使用 Markdown 格式：' +
            '包含各级标题(#/##/###)、要点列表、加粗关键词、必要时用代码块，并在结尾给出总结段落。内容要结构化、便于复习。';
        return [
            { role: 'system', content: mode === 'mindmap' ? sysMind : sysNote },
            { role: 'user', content: text }
        ];
    }

    /* ---------- 4. 本地兜底生成（离线 / 未配置 Key 时） ---------- */
    function localGenerate(messages, mode) {
        const last = [...messages].reverse().find(m => m.role === 'user');
        const raw = (last ? last.content : '').replace(/\s+/g, ' ').trim();
        const sentences = raw.split(/[。！？!?；;\n]/).map(s => s.trim()).filter(s => s.length > 1);

        if (mode === 'mindmap') {
            const topic = sentences[0] ? sentences[0].slice(0, 22) : '输入主题';
            let md = '- ' + topic + '\n';
            sentences.slice(1, 6).forEach(se => {
                md += '  - ' + se.slice(0, 26) + '\n';
                const parts = se.split(/[，,、]/).map(p => p.trim()).filter(p => p.length > 1).slice(0, 3);
                parts.forEach(p => md += '    - ' + p.slice(0, 22) + '\n');
            });
            if (sentences.length <= 1) {
                md += '  - 子主题一\n    - 要点 A\n    - 要点 B\n  - 子主题二\n    - 要点 C\n';
            }
            return md;
        }
        // notes
        let md = '# 学习笔记（本地引擎）\n\n';
        md += '> 当前未配置联网 AI 引擎，以下由本地算法初步结构化生成。配置引擎后可获得更深入分析。\n\n';
        md += '## 核心要点\n';
        (sentences.length ? sentences : ['（请在设置中配置 AI 引擎后，粘贴文本或链接以获得智能笔记）'])
            .slice(0, 8).forEach(s => md += '- ' + s + '\n');
        md += '\n## 总结\n建议前往「设置与备份」配置任意公开 AI 引擎 API，即可让本板块生成高质量思维导图与学习笔记。\n';
        return md;
    }

    /* ---------- 5. 调用 AI（OpenAI 兼容 + Anthropic + 自定义 + 代理 + Netlify 同源反代） ---------- */
    // Netlify serverless 反代路径（部署在 Netlify 时自动启用，绕开 CORS）
    const NETLIFY_PROXY = '/.netlify/functions/ai-proxy';

    async function callAI(opts) {
        const { engine = 'local', baseUrl = '', apiKey = '', model = '', messages = [], signal, proxy = '', engOverride, useProxyFn = true } = opts || {};
        // 允许直接传入完整引擎配置（自定义引擎）
        const eng = engOverride || engineMeta(engine);

        // 本地引擎，或需要 Key 但未提供 → 本地兜底（明确标注）
        if (engine === 'local' || (eng.needsKey && !apiKey)) {
            return { text: localGenerate(messages, detectMode(messages)), local: true, error: '未配置联网引擎，已使用本地算法生成' };
        }

        const base = (baseUrl || eng.base || '').replace(/\/+$/, '');
        let realUrl, headers, body;
        if (eng.format === 'anthropic') {
            realUrl = base + '/messages';
            const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
            const conv = messages.filter(m => m.role !== 'system')
                .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
            headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
            body = { model: model || eng.model, system: sys, messages: conv, max_tokens: 4000 };
        } else {
            realUrl = base + '/chat/completions';
            headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
            body = { model: model || eng.model, messages, temperature: 0.7, stream: false };
        }

        // 代理优先级：用户自定义代理 > Netlify 同源反代 > 浏览器直连
        const useNetlifyFn = useProxyFn && !proxy && typeof location !== 'undefined' &&
            /netlify\.app|netlify\.com/.test(location.hostname);

        try {
            let j;
            if (proxy) {
                // 自定义 CORS 代理：proxy?url=真实地址
                const url = proxy.replace(/\/+$/, '') + '?url=' + encodeURIComponent(realUrl);
                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
                j = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error((j && j.error && (j.error.message || j.error)) || ('HTTP ' + res.status));
            } else if (useNetlifyFn) {
                // 同源 Netlify 函数转发（真正绕开 CORS，可在浏览器直连 DeepSeek 等）
                const res = await fetch(NETLIFY_PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        upstream: realUrl, apiKey, model: model || eng.model,
                        format: eng.format || 'openai', messages
                    }),
                    signal
                });
                const r = await res.json().catch(() => ({}));
                if (!res.ok || !r.ok) {
                    const jr = r.data || {};
                    const msg = (jr.error && (jr.error.message || jr.error)) || r.error || ('HTTP ' + (r.status || res.status));
                    throw new Error(msg);
                }
                j = r.data;
            } else {
                // 浏览器直连（仅 OpenRouter/Groq/本地 等支持 CORS 的引擎可用）
                const res = await fetch(realUrl, { method: 'POST', headers, body: JSON.stringify(body), signal });
                j = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error((j && j.error && (j.error.message || j.error)) || ('HTTP ' + res.status));
            }

            let text;
            if (eng.format === 'anthropic') {
                text = (j.content && j.content[0] && j.content[0].text) || '';
            } else {
                text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
            }
            if (!text) throw new Error('AI 返回内容为空');
            return { text, local: false };
        } catch (e) {
            // 区分网络 / 跨域 / 鉴权，给出可操作提示（不再静默回退本地）
            let reason = String(e && e.message || e);
            if (e && (e.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed/i.test(reason))) {
                reason = '网络/跨域(CORS)被拦截：浏览器无法直接访问该官方 API。请在「设置 → AI 接口」填写「代理/反代地址」，或改用 OpenRouter / Groq / 本地 Ollama 等支持浏览器跨域的引擎。';
            }
            const err = new Error(reason);
            err.code = 'AI_CALL_FAILED';
            throw err;
        }
    }

    /* ---------- 5.1 测试引擎连通性（设置里「测试连接」用） ---------- */
    async function testConnection(opts) {
        const { engine = 'local', baseUrl = '', apiKey = '', model = '', proxy = '', engOverride, useProxyFn = true } = opts || {};
        const eng = engOverride || engineMeta(engine);
        if (engine === 'local' || (eng.needsKey && !apiKey)) {
            return { ok: false, message: '本地引擎无需测试；联网引擎请先填写 API Key。' };
        }
        const base = (baseUrl || eng.base || '').replace(/\/+$/, '');
        let realUrl = base + (eng.format === 'anthropic' ? '/messages' : '/chat/completions');
        const headers = eng.format === 'anthropic'
            ? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
            : { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey };
        const body = eng.format === 'anthropic'
            ? { model: model || eng.model, system: 'ping', messages: [{ role: 'user', content: 'hi' }], max_tokens: 8 }
            : { model: model || eng.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 8, stream: false };

        const useNetlifyFn = useProxyFn && !proxy && typeof location !== 'undefined' &&
            /netlify\.app|netlify\.com/.test(location.hostname);

        try {
            let ok, msg;
            if (proxy) {
                const url = proxy.replace(/\/+$/, '') + '?url=' + encodeURIComponent(realUrl);
                const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
                const j = await res.json().catch(() => ({}));
                ok = res.ok; msg = ok ? '连接成功 ✓ 引擎可用' : ('连接失败：' + ((j && j.error && (j.error.message || j.error)) || ('HTTP ' + res.status)));
            } else if (useNetlifyFn) {
                const res = await fetch(NETLIFY_PROXY, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ upstream: realUrl, apiKey, model: model || eng.model, format: eng.format || 'openai', messages: body.messages })
                });
                const r = await res.json().catch(() => ({}));
                ok = (res.ok && r.ok); msg = ok ? '连接成功 ✓（经 Netlify 反代）' : ('连接失败：' + ((r.data && r.data.error && (r.data.error.message || r.data.error)) || r.error || ('HTTP ' + (r.status || res.status))));
            } else {
                const res = await fetch(realUrl, { method: 'POST', headers, body: JSON.stringify(body) });
                const j = await res.json().catch(() => ({}));
                ok = res.ok; msg = ok ? '连接成功 ✓ 引擎可用' : ('连接失败：' + ((j && j.error && (j.error.message || j.error)) || ('HTTP ' + res.status)));
            }
            return { ok, message: msg };
        } catch (e) {
            let reason = String(e && e.message || e);
            if (e && (e.name === 'TypeError' || /Failed to fetch|NetworkError|Load failed/i.test(reason))) {
                reason = '跨域(CORS)被拦截：浏览器无法直接访问该 API，请配置「代理/反代地址」或部署到 Netlify 启用同源反代。';
            }
            return { ok: false, message: reason };
        }
    }

    function detectMode(messages) {
        const sys = messages.find(m => m.role === 'system');
        return sys && /学习笔记/.test(sys.content) ? 'notes' : 'mindmap';
    }

    /* ---------- 6. Markdown 大纲 → 树 ---------- */
    function parseOutlineToTree(md) {
        const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
        const root = { text: '思维导图', children: [] };
        const stack = [{ node: root, level: -1 }];
        for (const raw of lines) {
            const m = raw.match(/^(\s*)[-*+]\s+(.*)$/);
            if (!m) continue;
            const indent = m[1].replace(/\t/g, '  ').length;
            const level = Math.floor(indent / 2);
            const node = { text: m[2].trim(), children: [] };
            while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
            stack[stack.length - 1].node.children.push(node);
            stack.push({ node, level });
        }
        if (!root.children.length) return { text: '（无内容）', children: [] };
        if (root.children.length === 1) return root.children[0];
        return root;
    }

    /* ---------- 7. 树 → SVG 思维导图 ---------- */
    function renderMindmapSVG(tree, opts) {
        opts = opts || {};
        const COL_W = opts.colW || 210;
        const ROW_H = opts.rowH || 52;
        const BOX_H = 36;
        let leaf = 0, maxDepth = 0;

        function layout(n, d) {
            n.depth = d;
            if (d > maxDepth) maxDepth = d;
            if (!n.children || !n.children.length) {
                n.y = leaf * ROW_H + ROW_H / 2; leaf++;
            } else {
                n.children.forEach(c => layout(c, d + 1));
                n.y = (n.children[0].y + n.children[n.children.length - 1].y) / 2;
            }
        }
        layout(tree, 0);

        const width = (maxDepth + 1) * COL_W + 40;
        const height = Math.max(leaf * ROW_H, 200) + 20;

        let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height +
            '" viewBox="0 0 ' + width + ' ' + height + '">';
        svg += '<style>' +
            '.mm-node{fill:#fff;stroke:#668c71;stroke-width:1.5;}' +
            '.mm-root{fill:#668c71;stroke:#4f6b57;}' +
            '.mm-text{font-size:13px;fill:#2d332a;font-family:-apple-system,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;}' +
            '.mm-root-text{fill:#fff;font-weight:700;}' +
            '.mm-link{fill:none;stroke:#a9bfa9;stroke-width:1.5;}' +
            '</style>';

        function truncate(s) {
            s = (s || '').replace(/\s+/g, ' ');
            return s.length > 13 ? s.slice(0, 12) + '…' : s;
        }
        function draw(n) {
            const x = n.depth * COL_W + 20;
            const w = COL_W - 30;
            const y = n.y - BOX_H / 2;
            const isRoot = n.depth === 0;
            if (n.children) {
                for (const c of n.children) {
                    const x1 = x + w, y1 = n.y, x2 = c.depth * COL_W + 20, y2 = c.y, mx = (x1 + x2) / 2;
                    svg += '<path class="mm-link" d="M' + x1 + ',' + y1 + ' C' + mx + ',' + y1 + ' ' + mx + ',' + y2 + ' ' + x2 + ',' + y2 + '"/>';
                }
            }
            svg += '<g>';
            svg += '<rect class="' + (isRoot ? 'mm-node mm-root' : 'mm-node') + '" x="' + x + '" y="' + y +
                '" width="' + w + '" height="' + BOX_H + '" rx="9"/>';
            svg += '<text class="' + (isRoot ? 'mm-text mm-root-text' : 'mm-text') + '" x="' + (x + w / 2) +
                '" y="' + (n.y + 4) + '" text-anchor="middle">' + escapeHtml(truncate(n.text)) +
                '<title>' + escapeHtml(n.text) + '</title></text>';
            svg += '</g>';
            if (n.children) n.children.forEach(draw);
        }
        draw(tree);
        svg += '</svg>';
        return svg;
    }

    /* ---------- 8. Markdown → HTML 笔记 ---------- */
    function inlineMd(s) {
        s = escapeHtml(s);
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        return s;
    }

    function renderMarkdownNotes(md) {
        if (!md) return '';
        const lines = md.replace(/\r\n/g, '\n').split('\n');
        let html = '', i = 0, inCode = false, codeBuf = [];
        let listType = null, listBuf = [];
        function flushList() {
            if (listType) { html += '<' + listType + '>' + listBuf.join('') + '</' + listType + '>'; listType = null; listBuf = []; }
        }
        while (i < lines.length) {
            const line = lines[i];
            if (/^```/.test(line.trim())) {
                if (inCode) { html += '<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>'; inCode = false; codeBuf = []; }
                else { flushList(); inCode = true; }
                i++; continue;
            }
            if (inCode) { codeBuf.push(line); i++; continue; }
            const t = line.trim();
            if (t === '') { flushList(); i++; continue; }
            let m;
            if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { flushList(); const l = m[1].length; html += '<h' + l + '>' + inlineMd(m[2]) + '</h' + l + '>'; i++; continue; }
            if (/^(-{3,}|\*{3,})$/.test(t)) { flushList(); html += '<hr>'; i++; continue; }
            if (/^>\s?/.test(t)) { flushList(); html += '<blockquote>' + inlineMd(t.replace(/^>\s?/, '')) + '</blockquote>'; i++; continue; }
            if (/^\s*[-*]\s+/.test(t)) { if (listType && listType !== 'ul') flushList(); listType = 'ul'; listBuf.push('<li>' + inlineMd(t.replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; continue; }
            if (/^\s*\d+\.\s+/.test(t)) { if (listType && listType !== 'ol') flushList(); listType = 'ol'; listBuf.push('<li>' + inlineMd(t.replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; continue; }
            flushList();
            html += '<p>' + inlineMd(t) + '</p>';
            i++;
        }
        if (inCode) html += '<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>';
        flushList();
        return html;
    }

    /* ---------- 9. 导出：文件名清洗（纯函数） ---------- */
    function sanitizeFilename(name) {
        name = String(name == null ? '' : name).replace(/\s+/g, '_').trim();
        name = name.replace(/[\\/:*?"<>|]+/g, '').replace(/\.(docx?|pdf|png)$/i, '');
        name = name.replace(/_+/g, '_').replace(/^_|_$/g, '');
        return name || 'LifeOS_笔记';
    }

    /* ---------- 10. 树 → 嵌套 HTML 列表（供 Word 编辑） ---------- */
    function treeToHtmlList(node) {
        if (!node || !node.children || !node.children.length) return '';
        let h = '<ul>';
        node.children.forEach(c => {
            h += '<li>' + escapeHtml(c.text) + treeToHtmlList(c) + '</li>';
        });
        return h + '</ul>';
    }

    /* ---------- 11. 构建 Word(.doc) 文档 HTML（纯函数，可单测） ---------- */
    // images: { [messageIndex]: dataURL(PNG) } 由浏览器侧把思维导图 SVG 栅格化后传入
    function buildWordDocHTML(opts) {
        const o = opts || {};
        const title = o.title || 'Melva的个人计划 · AI 笔记';
        const messages = o.messages || [];
        const images = o.images || {};
        const engineLabel = o.engineLabel || '';
        let body = '';
        body += '<h1 style="color:#4f6b57;">' + escapeHtml(title) + '</h1>';
        if (engineLabel) body += '<p style="color:#888;"><i>生成引擎：' + escapeHtml(engineLabel) + '</i></p>';
        messages.forEach((m, idx) => {
            if (m.role === 'user') {
                body += '<h2 style="color:#668c71;">我</h2><p>' + escapeHtml(m.content) + '</p>';
            } else {
                const label = (m.mode === 'mindmap' ? '思维导图' : '学习笔记') + (m.local ? '（本地生成）' : '');
                body += '<h2 style="color:#668c71;">AI · ' + escapeHtml(label) + '</h2>';
                if (m.mode === 'mindmap') {
                    const img = images[idx];
                    if (img) body += '<p><img src="' + img + '" style="max-width:100%;"></p>';
                    const tree = parseOutlineToTree(m.content);
                    body += '<div style="font-family:Calibri,Microsoft YaHei;">' + treeToHtmlList(tree) + '</div>';
                } else {
                    body += '<div>' + renderMarkdownNotes(m.content) + '</div>';
                }
            }
        });
        return '<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
            'xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml">' +
            '<head><meta charset="utf-8"><title>' + escapeHtml(title) + '</title>' +
            '<style>body{font-family:Calibri,Microsoft YaHei,sans-serif;line-height:1.6;}' +
            'h1{font-size:22px;}h2{font-size:16px;border-left:4px solid #668c71;padding-left:8px;}' +
            'img{max-width:100%;}code{background:#f3f3f3;padding:2px 4px;border-radius:3px;}' +
            'blockquote{border-left:3px solid #ccc;margin:0;padding-left:10px;color:#666;}</style></head>' +
            '<body>' + body + '</body></html>';
    }

    return {
        AI_ENGINES, engineMeta, buildMessages, localGenerate, callAI, testConnection,
        parseOutlineToTree, renderMindmapSVG, renderMarkdownNotes, escapeHtml, looksLikeUrl, detectMode,
        sanitizeFilename, treeToHtmlList, buildWordDocHTML
    };
});
