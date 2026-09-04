/* =========================================================================
 * Life OS (Melva 终版) — Supabase 实时云端同步引擎
 * 挂载在原有应用之上：复用全局 state / saveState / renderAll
 * - 每次本地保存后防抖上传到 Supabase（设备 ID 防回声）
 * - 实时订阅其它设备的变更并自动合并
 * - 离线数据存本机，联网后自动续传
 * ========================================================================= */
(function () {
  'use strict';

  const SYNC_CFG_KEY  = 'LIFE_OS_MELVA_SYNC_CFG';
  const DEVICE_ID_KEY = 'LIFE_OS_MELVA_DEVICE_ID';
  const TABLE = 'life_os_sync';
  const WORKBENCH_BASE = 'https://b6293612028d4069bdfdf3e2cacf91d0.app.workbuddy.link';

  /* --- 同步配置扫码：编码/解码（UTF-8 安全 base64） --- */
  function utf8ToB64(str) { try { return btoa(unescape(encodeURIComponent(str))); } catch (e) { return btoa(str); } }
  function b64ToUtf8(str) { try { return decodeURIComponent(escape(atob(str))); } catch (e) { return atob(str); } }

  function parseSyncFromUrl() {
    try {
      const p = new URLSearchParams(location.search).get('sync');
      if (!p) return null;
      const o = JSON.parse(b64ToUtf8(p));
      if (o && o.url && o.anonKey && o.syncKey) return o;
    } catch (e) {}
    return null;
  }

  /* --- 设备唯一 ID --- */
  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      try { id = 'dev_' + crypto.randomUUID(); }
      catch (e) { id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2); }
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }
  const deviceId = getDeviceId();

  /* --- 同步配置 --- */
  function loadCfg() {
    try { const r = localStorage.getItem(SYNC_CFG_KEY); if (r) return JSON.parse(r); } catch (e) {}
    return { url: '', anonKey: '', syncKey: '', enabled: false };
  }
  function saveCfg() { localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(cfg)); }

  let cfg = loadCfg();
  let sb = null;
  let channel = null;
  let pushTimer = null;
  let lastPushedSig = '';
  let applyingRemote = false;

  function isEnabled() { return !!(cfg && cfg.enabled && sb && navigator.onLine); }

  /* --- 顶部状态徽标 --- */
  function setBadge(kind) {
    const b = document.getElementById('saveStatusBadge');
    if (!b) return;
    const m = {
      local:   '🟢 本地已保存',
      saved:   '☁️ 已同步云端',
      syncing: '🔄 同步中…',
      error:   '⚠️ 同步异常',
      offline: '📴 离线·已存本机'
    };
    b.innerHTML = `<span>${m[kind] || '🟢 本地已保存'}</span>`;
  }
  function setCfgStatus(msg) {
    const el = document.getElementById('syncCfgStatus');
    if (el) el.innerHTML = msg;
  }

  /* --- 覆盖原 saveState：本地保存 + 调度云端上传 --- */
  const _origSave = window.saveState;
  window.saveState = function () {
    if (typeof _origSave === 'function') _origSave();
    schedulePush();
  };

  function schedulePush() {
    if (!isEnabled()) return;
    const sig = JSON.stringify(state);
    if (sig === lastPushedSig) return;          // 无变化，跳过
    setBadge('syncing');
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(pushToCloud, 700);
  }

  async function pushToCloud() {
    if (!sb || !cfg.syncKey) return;
    const sig = JSON.stringify(state);
    try {
      const { error } = await sb.from(TABLE).upsert({
        sync_key:   cfg.syncKey,
        data:       state,
        updated_at: new Date().toISOString(),
        updated_by: deviceId
      });
      if (error) { setBadge('error'); setCfgStatus('上传失败：' + error.message); }
      else { lastPushedSig = sig; setBadge('saved'); }
    } catch (e) { setBadge('error'); setCfgStatus('上传异常：' + ((e && e.message) || e)); }
  }

  async function pullFromCloud() {
    if (!sb || !cfg.syncKey) return;
    const { data, error } = await sb.from(TABLE)
      .select('data, updated_by').eq('sync_key', cfg.syncKey).maybeSingle();
    if (error) { setBadge('error'); setCfgStatus('拉取失败：' + error.message); return; }
    if (data && data.data) {
      if (data.updated_by !== deviceId) applyRemote(data.data, data.updated_by);
    } else {
      await pushToCloud();                       // 云端尚无数据，上传本机作为初始值
    }
  }

  function applyRemote(remote, updatedBy) {
    if (updatedBy === deviceId) return;          // 忽略自己的回声
    applyingRemote = true;
    state = remote;
    lastPushedSig = JSON.stringify(remote);
    if (typeof _origSave === 'function') _origSave();   // 写本地
    applyingRemote = false;
    if (typeof renderAll === 'function') renderAll();
    setBadge('saved');
  }

  function onRealtime(payload) {
    const row = payload && payload.new;
    if (!row || !row.data) return;
    if (row.updated_by === deviceId) return;
    applyRemote(row.data, row.updated_by);
  }

  function subscribe() {
    if (!sb || !cfg.syncKey) return;
    if (channel) sb.removeChannel(channel);
    channel = sb.channel('life-os-' + cfg.syncKey)
      .on('postgres_changes',
          { event: '*', schema: 'public', table: TABLE, filter: `sync_key=eq.${cfg.syncKey}` },
          onRealtime)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setBadge('saved');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setBadge('error'); setCfgStatus('实时通道异常，将自动重试…');
        }
      });
  }

  async function connect() {
    const url = (document.getElementById('cfgSupabaseUrl').value || '').trim();
    const key = (document.getElementById('cfgSupabaseKey').value || '').trim();
    const key2 = (document.getElementById('cfgSyncKey').value || '').trim();
    if (!url || !key || !key2) { alert('请填写完整的 项目URL、匿名Key 与同步码。'); return; }

    cfg = { url, anonKey: key, syncKey: key2, enabled: true };
    saveCfg();

    if (typeof window.supabase === 'undefined' || !window.supabase || !window.supabase.createClient) {
      setBadge('error'); setCfgStatus('Supabase 客户端未能加载（请检查网络后刷新页面）。'); return;
    }
    try { sb = window.supabase.createClient(url, key); }
    catch (e) { setBadge('error'); setCfgStatus('创建客户端失败：' + (e && e.message ? e.message : e)); return; }

    if (!navigator.onLine) { setBadge('offline'); setCfgStatus('当前离线，恢复网络后自动连接并同步。'); return; }

    setBadge('syncing'); setCfgStatus('已连接，正在拉取云端最新数据…');
    await pullFromCloud();
    subscribe();
    setCfgStatus('✅ 已启用实时同步。手机端填写相同的「同步码」即可双向实时同步。');
  }

  function disconnect() {
    if (channel && sb) { try { sb.removeChannel(channel); } catch (e) {} }
    channel = null; sb = null; cfg.enabled = false; saveCfg();
    setBadge('local'); setCfgStatus('已断开云端同步，数据仅保存在本机。');
  }

  /* --- 暴露给设置页按钮 --- */
  window.connectSync = connect;
  window.disconnectSync = disconnect;
  window.forcePushNow = function () { if (isEnabled()) pushToCloud(); else alert('请先连接并启用同步。'); };
  window.forcePullNow = function () { if (isEnabled()) pullFromCloud(); else alert('请先连接并启用同步。'); };
  window.generateSyncKey = function () {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    try {
      const a = new Uint32Array(24); crypto.getRandomValues(a);
      for (let i = 0; i < 24; i++) s += chars[a[i] % chars.length];
    } catch (e) { for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)]; }
    document.getElementById('cfgSyncKey').value = s;
  };
  window.copySyncKey = function () {
    const v = document.getElementById('cfgSyncKey').value;
    if (!v) { alert('请先填写或生成同步码。'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(v).then(() => alert('同步码已复制到剪贴板。')).catch(() => alert('复制失败，请手动复制。'));
    else alert('请手动复制同步码。');
  };

  /* --- 生成同步二维码（手机扫码一键填入并连接） --- */
  window.generateSyncQr = function () {
    const c = loadCfg();
    if (!c.url || !c.anonKey || !c.syncKey) {
      alert('请先在上方填写并启用同步（或点「连接并启用同步」），再生成二维码。'); return;
    }
    const payload = utf8ToB64(JSON.stringify({ url: c.url, anonKey: c.anonKey, syncKey: c.syncKey }));
    let base;
    if (location.protocol === 'http:' || location.protocol === 'https:') base = location.origin + location.pathname;
    else base = WORKBENCH_BASE;
    const url = base + '?sync=' + payload;
    const box = document.getElementById('syncQrBox');
    if (!box) return;
    box.innerHTML = '';
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const img = qr.createImgTag(6, 10);
      box.innerHTML = '<div style="background:#fff; display:inline-block; padding:10px; border-radius:10px;">' + img + '</div>';
    } catch (e) {
      box.innerHTML = '<div style="background:#2d332a; color:#e8e6e1; padding:12px; border-radius:8px; font-size:11.5px; word-break:break-all;">无法生成二维码，请复制此链接到手机浏览器打开：<br>' + url + '</div>';
    }
    setCfgStatus('📱 用手机相机/扫码 App 扫描上方二维码即可自动填入并连接；或复制该链接在手机打开。');
  };

  /* --- 端到端连接诊断：真实读写 Supabase，回显精确错误 --- */
  window.testSyncConnection = async function () {
    const url = (document.getElementById('cfgSupabaseUrl').value || '').trim();
    const key = (document.getElementById('cfgSupabaseKey').value || '').trim();
    if (!url || !key) { alert('请先填写「项目 URL」与「匿名 Key」再测试。'); return; }
    if (typeof window.supabase === 'undefined' || !window.supabase || !window.supabase.createClient) {
      setCfgStatus('❌ Supabase 客户端未加载（请刷新页面后重试）。'); return;
    }
    setCfgStatus('⏳ 正在测试连接（读取 → 写入 → 清理）…');
    let client;
    try { client = window.supabase.createClient(url, key); }
    catch (e) { setCfgStatus('❌ 创建客户端失败：' + ((e && e.message) || e)); return; }

    // 1) 读取：验证 项目可达 + 表存在 + RLS 可读
    try {
      const { data, error } = await client.from(TABLE).select('sync_key').limit(1);
      if (error) {
        const m = error.message || '';
        if (/relation .* does not exist|does not exist/i.test(m))
          return setCfgStatus('❌ 表 life_os_sync 不存在。请在 Supabase 的 SQL Editor 执行 life_os_sync.sql（下方「创建数据表」可展开复制）。');
        if (/permission denied|42501/i.test(m))
          return setCfgStatus('❌ 权限被拒（RLS）。请在 SQL Editor 跑完 life_os_sync.sql 中的 policy 部分。');
        if (/Failed to fetch|NetworkError|ECONNREFUSED|network/i.test(m))
          return setCfgStatus('❌ 网络无法连接到 Supabase：' + m + '（若在工作台=运行环境禁止外连；若在自己电脑=项目已暂停或 URL 错误）');
        return setCfgStatus('❌ 读取测试失败：' + m);
      }
    } catch (e) {
      return setCfgStatus('❌ 网络/连接异常：' + ((e && e.message) || e) + '（若在工作台，很可能是运行环境禁止外连 supabase.co）');
    }

    // 2) 写入 + 清理：验证 RLS 可写
    const testKey = '__lifeos_test_' + Date.now();
    try {
      const { error: ie } = await client.from(TABLE).upsert({ sync_key: testKey, data: { _test: true }, updated_at: new Date().toISOString(), updated_by: 'diag' });
      if (ie) return setCfgStatus('❌ 写入测试失败（RLS 写权限？）：' + ie.message);
      const { error: de } = await client.from(TABLE).delete().eq('sync_key', testKey);
      if (de) return setCfgStatus('⚠️ 写入成功、但清理失败（可忽略）：' + de.message);
    } catch (e) {
      return setCfgStatus('❌ 写入测试异常：' + ((e && e.message) || e));
    }
    setCfgStatus('✅ 连接与读写全部正常！可以放心点「连接并启用同步」。');
  };

  function loadCfgUI() {
    const c = loadCfg();
    if (document.getElementById('cfgSupabaseUrl')) document.getElementById('cfgSupabaseUrl').value = c.url || '';
    if (document.getElementById('cfgSupabaseKey')) document.getElementById('cfgSupabaseKey').value = c.anonKey || '';
    if (document.getElementById('cfgSyncKey'))    document.getElementById('cfgSyncKey').value    = c.syncKey || '';
    if (c.enabled) setCfgStatus('已启用同步（同步码：' + (c.syncKey || '未设置') + '）。');
  }

  /* --- 网络状态 --- */
  window.addEventListener('online', () => {
    if (cfg && cfg.url && cfg.syncKey) { setBadge('syncing'); connect(); }
    else setBadge('local');
  });
  window.addEventListener('offline', () => { setBadge('offline'); });

  /* --- PWA 注册 --- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }

  /* --- 启动 --- */
  function boot() {
    /* 若通过扫码链接（?sync=...）打开，自动填入并连接 */
    const urlCfg = parseSyncFromUrl();
    if (urlCfg) {
      const u = document.getElementById('cfgSupabaseUrl'); if (u) u.value = urlCfg.url;
      const k = document.getElementById('cfgSupabaseKey'); if (k) k.value = urlCfg.anonKey;
      const s = document.getElementById('cfgSyncKey');    if (s) s.value = urlCfg.syncKey;
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      setCfgStatus('📱 已从扫码链接自动填入同步配置，正在连接…');
      connect();
      return;
    }
    loadCfgUI();
    if (navigator.onLine === false) { setBadge('offline'); return; }
    if (cfg && cfg.enabled && cfg.url && cfg.syncKey) {
      // 回填输入框并自动连接
      const u = document.getElementById('cfgSupabaseUrl'); if (u) u.value = cfg.url;
      const k = document.getElementById('cfgSupabaseKey'); if (k) k.value = cfg.anonKey;
      const s = document.getElementById('cfgSyncKey');    if (s) s.value = cfg.syncKey;
      connect();
    } else {
      setBadge('local');
    }
    // 兜底：每 5 秒检查一次是否有变化需要上传（与原本地快照节奏一致）
    setInterval(() => { if (isEnabled()) schedulePush(); }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
