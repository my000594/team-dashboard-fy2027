/* nav.js — navigation + maintenance control */
const NAV_ITEMS = [
  { href: 'index.html',    icon: 'home',        label: 'トップ' },
  { href: 'info.html',     icon: 'bell',        label: 'インフォメーション' },
  { href: 'member.html',   icon: 'users',       label: 'メンバー' },
  { href: 'reports.html',  icon: 'file-text',   label: '3SEレポート' },
  { href: 'sales.html',    icon: 'trending-up', label: '売上・数字' },
  { href: 'knowledge.html',icon: 'book-open',   label: 'ナレッジ・FAQ' },
];

const ICONS = {
  home:         `<polyline points="3 9 12 2 21 9"/><polyline points="9 22 9 12 15 12 15 22"/><rect x="3" y="9" width="18" height="13" rx="1"/>`,
  bell:         `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`,
  users:        `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  'file-text':  `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>`,
  'trending-up':`<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>`,
  'book-open':  `<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>`,
};

function buildNav() {
  const current = location.pathname.split('/').pop() || 'index.html';
  const nav = document.getElementById('nav');
  if (!nav) return;

  nav.innerHTML = `
    <div class="nav-logo">
      <div class="nav-logo-icon">📊</div>
      <div>
        <div class="nav-logo-text">SI部 第1ライン</div>
        <div class="nav-logo-sub">FY2027 Dashboard</div>
      </div>
    </div>
    <div style="flex:1;overflow-y:auto;padding:.5rem 0">
      <div class="nav-section">メニュー</div>
      ${NAV_ITEMS.map(item => `
        <a href="${item.href}" class="nav-item ${current === item.href ? 'active' : ''}">
          <svg viewBox="0 0 24 24">${ICONS[item.icon]}</svg>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </div>
    <div class="nav-footer">
      <div style="display:flex;align-items:center">
        <span class="pulse"></span>
        <span id="nav-date">—</span>
      </div>
    </div>
  `;

  document.getElementById('nav-date').textContent =
    new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showMaintenance(msg, estimated) {
  document.body.innerHTML = `
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans JP',sans-serif;background:#0a0e17;color:#e2e8f4;min-height:100vh;display:flex;align-items:center;justify-content:center}
      .wrap{text-align:center;padding:2rem;max-width:480px}
      .icon{width:72px;height:72px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 2rem}
      .title{font-size:22px;font-weight:700;letter-spacing:-.02em;margin-bottom:.75rem}
      .msg{font-size:14px;color:#7f8fa8;line-height:1.8;margin-bottom:1.5rem}
      .est{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:#3b82f6;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.2);border-radius:999px;padding:6px 14px}
      .dot{width:6px;height:6px;border-radius:50%;background:#3b82f6;animation:p 2s infinite}
      @keyframes p{0%,100%{opacity:1}50%{opacity:.3}}
      .divider{width:40px;height:1px;background:rgba(255,255,255,.06);margin:2rem auto}
      .label{font-size:11px;color:#3d4f6a;letter-spacing:.08em;text-transform:uppercase}
    </style>
    <div class="wrap">
      <div class="icon">🔧</div>
      <div class="title">メンテナンス中</div>
      <div class="msg">${msg || 'ただいまデータ更新のため一時停止しています。<br>しばらくお待ちください。'}</div>
      ${estimated ? `<div class="est"><span class="dot"></span>${estimated}</div>` : ''}
      <div class="divider"></div>
      <div class="label">第1ライン FY2027 Dashboard</div>
    </div>
  `;
}

async function checkMaintenance() {
  try {
    const res = await fetch('data/maintenance.json?t=' + Date.now());
    if (!res.ok) return false;
    const data = await res.json();
    if (data.active === true) {
      showMaintenance(data.message, data.estimated);
      return true;
    }
  } catch(e) {}
  return false;
}

document.addEventListener('DOMContentLoaded', async () => {
  const isMaint = await checkMaintenance();
  if (!isMaint) buildNav();
});
