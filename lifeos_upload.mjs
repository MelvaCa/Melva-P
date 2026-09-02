// =============================================================================
// Life OS · Node 自动上传脚本（本地运行，可选）
// 作用：读取 lifeos_export.js 下载的 JSON 文件，用 service_role 密钥上传到 Supabase。
// 注意：service_role 拥有完全权限，切勿在前端/公开仓库中暴露该密钥。
//
// 用法：
//   1) 先在 Life OS 页面运行 lifeos_export.js，下载 lifeos_state_YYYY-MM-DD.json
//   2) 设置环境变量（推荐放到 .env 或终端会话，不要写进代码）：
//        export SUPABASE_URL="https://xxxx.supabase.co"
//        export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."
//   3) 运行：
//        node lifeos_upload.mjs path/to/lifeos_state_YYYY-MM-DD.json
// =============================================================================
import fs from 'node:fs';
import process from 'node:process';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const file = process.argv[2];

if (!url || !key || !file) {
  console.error('用法: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node lifeos_upload.mjs <json文件>');
  process.exit(1);
}

// 读取并校验 JSON
let raw;
try {
  raw = fs.readFileSync(file, 'utf8');
  JSON.parse(raw);
} catch (e) {
  console.error('❌ 读取/解析 JSON 失败：', e.message);
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/lifeos_backups`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=minimal'
  },
  // Supabase REST 支持直接把 JSON 文本作为 jsonb 列的值
  body: JSON.stringify([{ payload: JSON.parse(raw) }])
});

if (!res.ok) {
  console.error('❌ 上传失败', res.status, await res.text());
  process.exit(1);
}

console.log('✅ 已成功备份到 Supabase 表 lifeos_backups');
