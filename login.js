/* =========================================================================
 * Life OS — 管理员登录门禁（应用层，适配 GitHub Pages 纯静态托管）
 * - 预置一个默认管理员账号/密码（哈希存于本地，不存明文），首次打开即要求登录
 * - 之后每次打开需输入账号密码；勾选「记住我」则下次自动登录
 * - 仅管理员本人可用，其他人打开后无法进入主程序
 * - 管理员登录后，可在「设置 → 用户与密码管理」中创建新的用户密码
 *
 * 说明：GitHub Pages 为纯静态托管，没有服务端，无法做真正的服务端校验。
 *       本门禁为客户端防护，可挡住普通人与误入者；若需抵御专业攻击者，
 *       请改用带服务端的托管或私有部署环境。
 * ========================================================================= */
(function () {
  'use strict';

  const LS_USER = 'life_os_admin_user';
  const LS_PASS = 'life_os_admin_pass';   // sha256(PEPPER + pw) 十六进制
  const LS_SESS = 'life_os_session_ls';   // 持久会话（记住我）
  const SS_SESS = 'life_os_session_ss';   // 临时会话（关闭浏览器即失效）
  const PEPPER = 'life_os_2026_gate';

  // —— 预置默认管理员（可在登录后于设置面板修改；此处仅作首次种子） ——
  // 默认账号：admin   默认密码：123456mh.
  // 下面这串是 sha256(PEPPER + '123456mh.') 的十六进制（与运行时算法一致）
  const DEFAULT_ADMIN_USER = 'admin';
  const DEFAULT_ADMIN_PASS_HASH = '68e0eb6509ac8de3752cf5c390edfc04f489e3a3999157ca8fac5d44beb2a74b';

  const overlay = document.getElementById('loginScreen');
  const errEl   = document.getElementById('loginError');

  async function hashPW(pw) {
    const material = PEPPER + pw;
    // 优先使用 Web Crypto（需安全上下文：https / localhost）
    if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
      try {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) { /* 落到下面的降级方案 */ }
    }
    // 降级：非安全上下文（如 file://）下也能用，避免登录完全失效
    let h = 0x811c9dc5;
    for (let i = 0; i < material.length; i++) {
      h ^= material.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + (h >>> 0).toString(16)).slice(-8) + ':' + material.length;
  }

  function isAuthed() {
    return localStorage.getItem(LS_SESS) === '1' || sessionStorage.getItem(SS_SESS) === '1';
  }
  function setAuthed(remember) {
    if (remember) localStorage.setItem(LS_SESS, '1');
    else sessionStorage.setItem(SS_SESS, '1');
  }
  function clearAuth() {
    localStorage.removeItem(LS_SESS);
    sessionStorage.removeItem(SS_SESS);
  }

  // 是否已登录管理员（供设置面板判断显示「用户与密码管理」）
  function isAdmin() {
    return isAuthed();
  }

  function showErr(msg) { errEl.textContent = msg; errEl.style.display = 'block'; }
  function hideErr()    { errEl.textContent = ''; errEl.style.display = 'none'; }

  function getEl(id) { return document.getElementById(id); }

  function renderMode(mode) {
    // 已移除「首次设置」流程：始终只显示登录卡片
    getEl('loginCardSetup').style.display = 'none';
    getEl('loginCardLogin').style.display = 'block';
    getEl('loginTitle').textContent = '🔐 欢迎回来';
    getEl('loginSub').textContent   = '请输入管理员账号密码以继续使用';
    hideErr();
  }

  function updateChip() {
    const u = localStorage.getItem(LS_USER) || '';
    const authed = document.body.classList.contains('authed');
    const nameEl = getEl('settingsAccName');
    const loginBtn = getEl('settingsAccountLoginBtn');
    const logoutBtn = getEl('settingsAccountLogoutBtn');
    // 账号名常驻显示：已登录显示账号，未登录显示「未登录」
    if (nameEl) nameEl.textContent = authed ? (u || '已登录') : '未登录';
    // 登录按钮：仅未登录时可点，已登录则隐藏（避免重复登录）
    if (loginBtn) {
      loginBtn.style.display = authed ? 'none' : 'inline-block';
      loginBtn.disabled = authed;
    }
    // 退出按钮：常驻显示；未登录时置灰并提示
    if (logoutBtn) {
      logoutBtn.disabled = !authed;
      logoutBtn.style.opacity = authed ? '1' : '0.5';
      logoutBtn.title = authed ? '退出当前登录' : '当前未登录';
    }
    // 同步「用户与密码管理」面板可见性（仅管理员已登录可见）
    const umCard = getEl('userMgmtCard');
    if (umCard) umCard.style.display = authed ? 'block' : 'none';
    if (authed) renderUserList();
  }

  function unlock() {
    overlay.style.display = 'none';
    document.body.classList.add('authed');
    updateChip();
  }
  function lock() {
    overlay.style.display = 'flex';
    document.body.classList.remove('authed');
    updateChip();
  }

  async function doLogin() {
    hideErr();
    const u = getEl('loginUser').value.trim();
    const p = getEl('loginPass').value;
    const rem = getEl('loginRemember').checked;
    const su = localStorage.getItem(LS_USER);
    const sp = localStorage.getItem(LS_PASS);
    if (u !== su) { showErr('用户名或密码错误'); return; }
    const h = await hashPW(p);
    if (h !== sp) { showErr('用户名或密码错误'); return; }
    setAuthed(rem);
    unlock();
  }

  function doLogout() {
    if (!document.body.classList.contains('authed')) { showToast('当前未登录'); return; }
    clearAuth();
    getEl('loginUser').value = '';
    getEl('loginPass').value = '';
    renderMode('login');
    lock();
  }

  // 供导航栏「登录账户」按钮：重新显示登录层（应用已在运行，仅弹登录框）
  function showLogin() {
    if (document.body.classList.contains('authed')) return;
    renderMode('login');
    lock();
  }

  // 重置管理员账号：清空自定义账号，恢复为预置默认管理员（本地生活数据不受影响）
  function doReset() {
    if (!confirm('确定要重置管理员账号吗？\n将恢复为默认管理员（admin），需要重新登录（本地生活数据不受影响）。\n建议登录后在「用户与密码管理」中修改密码。')) return;
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_PASS);
    clearAuth();
    getEl('loginUser').value = '';
    getEl('loginPass').value = '';
    // 重新写入默认管理员种子
    seedDefaultAdmin();
    renderMode('login');
    lock();
  }

  // 预置默认管理员：若尚未设置过自定义管理员，则写入默认账号/哈希
  function seedDefaultAdmin() {
    if (!localStorage.getItem(LS_USER)) {
      localStorage.setItem(LS_USER, DEFAULT_ADMIN_USER);
      localStorage.setItem(LS_PASS, DEFAULT_ADMIN_PASS_HASH);
    }
  }

  /* ===================== 用户与密码管理（仅管理员） ===================== */
  const LS_USERS = 'life_os_users'; // JSON: [{user, passHash}]

  async function addUser() {
    // 门禁护栏：必须先以管理员身份登录，才能创建新用户密码。
    // 即便有人通过控制台手动调用 lifeOSAddUser，也会在此被拦截。
    if (!isAuthed()) {
      const msg = getEl('umMsg');
      if (msg) { msg.textContent = '请先以管理员身份登录后再创建用户密码'; msg.style.color = '#e53935'; }
      showToast('请先登录管理员账号');
      return;
    }
    const u = getEl('umNewUser').value.trim();
    const p = getEl('umNewPass').value;
    const p2 = getEl('umNewPass2').value;
    const msg = getEl('umMsg');
    msg.textContent = '';
    if (!u) { msg.textContent = '请输入用户名'; return; }
    if (p.length < 6) { msg.textContent = '密码至少 6 位'; return; }
    if (p !== p2) { msg.textContent = '两次输入的密码不一致'; return; }
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_USERS) || '[]'); } catch (e) { list = []; }
    if (list.some(x => x.user === u)) { msg.textContent = '该用户名已存在'; return; }
    const h = await hashPW(p);
    list.push({ user: u, passHash: h });
    localStorage.setItem(LS_USERS, JSON.stringify(list));
    getEl('umNewUser').value = '';
    getEl('umNewPass').value = '';
    getEl('umNewPass2').value = '';
    msg.textContent = '已创建用户：' + u;
    msg.style.color = 'var(--accent, #4caf50)';
    renderUserList();
  }

  function deleteUser(idx) {
    if (!confirm('确定删除该用户密码吗？')) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_USERS) || '[]'); } catch (e) { list = []; }
    list.splice(idx, 1);
    localStorage.setItem(LS_USERS, JSON.stringify(list));
    renderUserList();
  }

  function renderUserList() {
    const box = getEl('umList');
    if (!box) return;
    let list = [];
    try { list = JSON.parse(localStorage.getItem(LS_USERS) || '[]'); } catch (e) { list = []; }
    if (!list.length) {
      box.innerHTML = '<div style="font-size:12px;color:var(--text-muted)">暂无其他用户密码。创建后可用于分享给家人/同伴（同样仅客户端保存）。</div>';
      return;
    }
    box.innerHTML = list.map((x, i) =>
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px dashed var(--border,#eee);">' +
        '<span style="font-size:13px;"><b>' + escapeHtml(x.user) + '</b></span>' +
        '<button class="btn btn-secondary" type="button" onclick="lifeOSDeleteUser(' + i + ')">删除</button>' +
      '</div>'
    ).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function bindEnter(ids, fn) {
    ids.forEach(id => {
      const el = getEl(id);
      if (el) el.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
    });
  }

  function init() {
    // 写入预置默认管理员（仅当未自定义过）
    seedDefaultAdmin();

    const hasAdmin = !!localStorage.getItem(LS_USER);
    if (!hasAdmin)      { renderMode('login'); lock(); }
    else if (isAuthed()){ renderMode('login'); unlock(); }
    else                { renderMode('login'); lock(); }

    getEl('loginBtn').addEventListener('click', doLogin);
    getEl('logoutBtn').addEventListener('click', doLogout);
    getEl('resetBtn').addEventListener('click', doReset);
    bindEnter(['loginUser', 'loginPass'], doLogin);

    // 用户管理面板事件
    const umAdd = getEl('umAddBtn');
    if (umAdd) umAdd.addEventListener('click', addUser);
    bindEnter(['umNewUser', 'umNewPass', 'umNewPass2'], addUser);

    window.lifeOSLogout = doLogout;          // 供导航栏「退出登录」按钮调用
    window.lifeOSShowLogin = showLogin;      // 供导航栏「登录账户」按钮调用
    window.lifeOSIsAdmin = isAdmin;          // 供设置面板判断
    window.lifeOSDeleteUser = deleteUser;    // 供列表删除按钮调用
    window.lifeOSAddUser = addUser;

    updateChip();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
