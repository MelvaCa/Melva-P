// =============================================================================
// Life OS · 浏览器导出脚本（在 Life OS 页面 Console 中运行）
// 作用：把当前 localStorage 的完整 state 导出为 JSON，并生成可直接在
//      Supabase SQL Editor 执行的 INSERT 语句（已复制到剪贴板）。
// 配套：supabase_backup.sql（建表）、lifeos_upload.mjs（Node 自动上传）
// =============================================================================
(function () {
  const KEY = 'life_os_melva_db_v5';
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    console.error('❌ 未找到 Life OS 数据，请先打开 Life OS 页面再运行本脚本');
    return;
  }

  // 1) 生成 Supabase INSERT 语句（转义单引号与反斜杠，避免 JSON 破坏 SQL）
  const json = JSON.stringify(JSON.parse(raw));
  const escaped = json.replace(/\\/g, '\\\\').replace(/'/g, "''");
  const insertSql = `insert into lifeos_backups (payload) values ('${escaped}'::jsonb);`;

  // 2) 复制到剪贴板（部分环境无 copy()，可手动复制下方日志）
  if (typeof copy === 'function') {
    copy(insertSql);
    console.log('✅ 已复制 INSERT 语句到剪贴板，去 Supabase SQL Editor 粘贴执行即可');
  } else {
    console.log('⚠️ 当前环境无 copy()，请手动复制下方 INSERT 语句：');
  }

  // 3) 触发下载 JSON 文件（供 lifeos_upload.mjs 自动上传）
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lifeos_state_' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  console.log('✅ 已下载 ' + a.download + '（可交给 lifeos_upload.mjs 上传）');

  console.log('----- 以下为 INSERT 语句（如需手动复制）-----');
  console.log(insertSql);
})();
