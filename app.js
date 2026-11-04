'use strict';

const KEY = 'so-chi.v1';
const OTHER = 'Khác';
const DEFAULT_CATS = ['Ăn uống', 'Cà phê', 'Đi chợ', 'Đi lại', 'Nhà cửa', 'Điện nước', 'Mua sắm', 'Sức khỏe', 'Giải trí', 'Gia đình', 'Hiếu hỉ', OTHER];
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MAX_AMOUNT = 999999999999;
const BACKUP_REMIND_DAYS = 30;
const BACKUP_REMIND_ENTRIES = 20;
const USAGE_WINDOW_DAYS = 90;
const QUICK_LIMIT = 6;
const BACK_HOLD_MS = 500;
const NEAR_LIMIT_PCT = 85;
const PACE_TOLERANCE = 0.05;
const SWIPE_CLOSE_PX = 100;
const SWIPE_FLICK_PX = 24;
const SWIPE_FLICK_SPEED = 0.6;

const $ = (id) => document.getElementById(id);

const CAT_ICONS = {
  'Ăn uống': 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M17 21V3c-2 1.5-3 4-3 7v3h3',
  'Cà phê': 'M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3',
  'Đi chợ': 'M3 10h18l-2 10H5zM8 10l3-6M16 10l-3-6M9.5 14v2.5M14.5 14v2.5',
  'Đi lại': 'M8 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM21 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM8 17.5h8c0-4 .5-7.5-1-11h-3M15 6.5h3M3.5 13c2-2 5.500-2 7 0l1.500 2',
  'Nhà cửa': 'M3 11l9-8 9 8M5 9.5V21h14V9.5M10 21v-6h4v6',
  'Điện nước': 'M13 3L5 14h6l-1 7 8-11h-6z',
  'Mua sắm': 'M5 8h14l1 13H4zM9 11V6a3 3 0 0 1 6 0v5',
  'Sức khỏe': 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11zM9 12h1.5l1-2 1.5 4 1-2H16',
  'Giải trí': 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 0 3V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a1.5 1.5 0 0 0 0-3zM14 6v2M14 11v2M14 16v2',
  'Gia đình': 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.5 2.5-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M17.5 14.3c2.2.6 3.5 2.8 3.5 5.7',
  'Hiếu hỉ': 'M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7C10 3 6 3 6 5.500S9 7 12 7zM12 7c2-4 6-4 6-1.500S15 7 12 7z',
  [OTHER]: 'M6 12h.01M12 12h.01M18 12h.01',
};

// Categories the family adds themselves show their first letter instead of a drawing.
function catTile(name) {
  const path = CAT_ICONS[name];
  const inner = path
    ? `<svg viewBox="0 0 24 24"><path d="${path}"/></svg>`
    : esc(Array.from(name)[0].toUpperCase());
  return `<span class="tile" aria-hidden="true">${inner}</span>`;
}

/* ---------- Dates: always local time, never toISOString (Vietnam is UTC+7). ---------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const currentYm = () => today().slice(0, 7);
const toDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const monthNum = (ym) => Number(ym.slice(5));
const monthTitle = (ym) => `Tháng ${monthNum(ym)}, ${ym.slice(0, 4)}`;
const isValidDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return ymd(toDate(s)) === s;
};
function dayLabel(s) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (s === today()) return 'Hôm nay';
  if (s === ymd(yesterday)) return 'Hôm qua';
  const d = toDate(s);
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/* ---------- Formatting ---------- */
const groupDigits = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const money = (n) => `${groupDigits(n)} đ`;
const moneyHtml = (n) => `${groupDigits(n)}<small> đ</small>`;
function short(n) {
  if (n >= 999500) return `${String(Math.round(n / 1e5) / 10).replace('.', ',')} tr`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Storage ---------- */
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function cleanExpense(e) {
  if (!e || typeof e !== 'object') return null;
  const amount = Number(e.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
  if (!isValidDate(e.date)) return null;
  const cat = typeof e.cat === 'string' && e.cat.trim() ? e.cat.trim().slice(0, 24) : OTHER;
  return {
    id: typeof e.id === 'string' && e.id ? e.id : newId(),
    amount,
    cat,
    date: e.date,
    note: typeof e.note === 'string' ? e.note.slice(0, 120) : '',
    createdAt: Number(e.createdAt) || 0,
  };
}

function normalize(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const budget = Number(source.budget);
  let cats = Array.isArray(source.cats)
    ? source.cats.filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim().slice(0, 24))
    : DEFAULT_CATS.slice();
  cats = [...new Set(cats)];
  if (!cats.includes(OTHER)) cats.push(OTHER);
  const list = Array.isArray(source.expenses) ? source.expenses : [];
  const expenses = list.map(cleanExpense).filter(Boolean);
  return {
    data: {
      budget: Number.isInteger(budget) && budget > 0 && budget <= MAX_AMOUNT ? budget : 0,
      cats,
      expenses,
      lastCat: typeof source.lastCat === 'string' ? source.lastCat : cats[0],
      lastBackup: typeof source.lastBackup === 'string' ? source.lastBackup : '',
    },
    dropped: list.length - expenses.length,
  };
}

function load() {
  let text = null;
  try {
    text = localStorage.getItem(KEY);
    return normalize(text ? JSON.parse(text) : null).data;
  } catch (err) {
    // Keep unreadable data aside so a later save cannot overwrite it.
    try { if (text) localStorage.setItem(`${KEY}.corrupt`, text); } catch (_) { /* storage unavailable */ }
    return normalize(null).data;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (err) {
    toast('Không lưu được vào máy. Hãy sao lưu dữ liệu và giải phóng dung lượng iPhone.');
    return false;
  }
}

let db = load();
const ui = { view: 'book', prev: 'book', ym: currentYm(), filter: null, freshId: null };

/* ---------- Queries ---------- */
const inMonth = (ym) => db.expenses.filter((e) => e.date.startsWith(ym));
const sum = (list) => list.reduce((t, e) => t + e.amount, 0);
const newestFirst = (a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt);

/* ---------- Shared header ---------- */
function monthNav() {
  const atNow = ui.ym >= currentYm();
  return `<div class="top-row">
    <button type="button" class="chev" data-act="month" data-step="-1" aria-label="Tháng trước">&#8249;</button>
    <h1>${monthTitle(ui.ym)}</h1>
    <button type="button" class="chev" data-act="month" data-step="1" aria-label="Tháng sau" ${atNow ? 'disabled' : ''}>&#8250;</button>
    <button type="button" class="top-link push" data-act="tab" data-view="settings">Cài đặt</button>
  </div>`;
}

function backToNow() {
  return ui.ym < currentYm()
    ? '<button type="button" class="band-link" data-act="now">Về tháng này</button>'
    : '';
}

function bookHero(spent) {
  const budget = db.budget;
  if (!budget) {
    return {
      over: false,
      mini: { left: `Đã chi ${money(spent)}` },
      html: `<p class="hero-label">Đã chi</p>
        <p class="hero-amount">${moneyHtml(spent)}</p>
        <button type="button" class="band-ghost" data-act="set-budget">Đặt ngân sách tháng</button>`,
    };
  }
  const remaining = budget - spent;
  const over = remaining < 0;
  const pct = Math.round((spent / budget) * 100);
  const isNow = ui.ym === currentYm();
  const pace = isNow && !over ? budgetPace(spent, budget) : null;
  const paceAhead = pace !== null && pace.ahead > budget * PACE_TOLERANCE;
  const warn = !over && (pct >= NEAR_LIMIT_PCT || paceAhead);
  const label = over ? 'Đã vượt ngân sách' : isNow ? 'Còn lại' : 'Còn dư';

  let paceLine = '';
  if (pace) {
    paceLine = paceAhead
      ? `<p class="pace warn">Vượt dự kiến đến hôm nay ${money(Math.round(pace.ahead / 1000) * 1000)}</p>`
      : '<p class="pace">Trong mức dự kiến đến hôm nay</p>';
  }
  const stats = [`<div><dt>Đã chi (${pct}%)</dt><dd>${money(spent)}</dd></div>`];
  if (pace) stats.unshift(`<div><dt>${pace.daysLeft === 1 ? 'Hôm nay tiêu được' : 'Mỗi ngày tiêu được'}</dt><dd>${money(pace.perDay)}</dd></div>`);

  return {
    over,
    mini: {
      over,
      left: `${label} ${money(Math.abs(remaining))}`,
      right: pace ? `${money(pace.perDay)}/ngày` : '',
    },
    html: `<p class="hero-label">${label}</p>
      <p class="hero-amount">${moneyHtml(Math.abs(remaining))}</p>
      <div class="meter ${warn ? 'warn' : ''}" role="img" aria-label="Đã dùng ${pct}% ngân sách">
        <i style="width:${Math.min(pct, 100)}%"></i>
        ${pace ? `<b class="tick" style="left:${pace.markPct}%"></b>` : ''}
      </div>
      ${paceLine}
      <dl class="hero-stats">${stats.join('')}</dl>`,
  };
}

// Pace treats the budget as spread evenly across the days of the month.
function budgetPace(spent, budget) {
  const day = new Date().getDate();
  const days = daysInMonth(ui.ym);
  const daysLeft = days - day + 1;
  return {
    markPct: (day / days) * 100,
    ahead: spent - Math.round((budget * day) / days),
    daysLeft,
    perDay: Math.floor((budget - spent) / daysLeft / 1000) * 1000,
  };
}

/* ---------- Book view ---------- */
function isIosBrowserTab() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && navigator.standalone === false;
}

function backupNotice() {
  const count = db.expenses.length;
  if (!count) return '';
  let text = '';
  if (db.lastBackup) {
    const days = Math.floor((Date.now() - new Date(db.lastBackup).getTime()) / 86400000);
    if (days >= BACKUP_REMIND_DAYS) text = `Đã ${days} ngày chưa sao lưu dữ liệu.`;
  } else if (count >= BACKUP_REMIND_ENTRIES) {
    text = `Bạn đã ghi ${count} khoản và chưa sao lưu lần nào.`;
  }
  if (!text) return '';
  return `<div class="notice"><p>${text}</p><button type="button" class="link" data-act="tab" data-view="settings">Sao lưu</button></div>`;
}

function installNotice() {
  if (!isIosBrowserTab() || readFlag('hideInstall')) return '';
  return `<div class="notice"><p>Bấm nút Chia sẻ của Safari, chọn <b>Thêm vào MH chính</b> để dùng như app và giữ dữ liệu lâu dài.</p>
    <button type="button" class="link" data-act="hide-install">Ẩn</button></div>`;
}

function readFlag(name) { try { return localStorage.getItem(`${KEY}.${name}`) === '1'; } catch (_) { return false; } }
function setFlag(name) { try { localStorage.setItem(`${KEY}.${name}`, '1'); } catch (_) { /* storage unavailable */ } }

function welcome() {
  return `<section class="welcome">
    <h2>Chào mừng bạn đến với Sổ Chi</h2>
    <dl>
      <div><dt>Ghi khoản chi</dt><dd>Bấm nút ở dưới, nhập số tiền, chọn danh mục rồi lưu.</dd></div>
      <div><dt>Biết còn tiêu được bao nhiêu</dt><dd>Đặt ngân sách tháng, app sẽ tính mỗi ngày còn tiêu được bao nhiêu.</dd></div>
      <div><dt>Dữ liệu của bạn</dt><dd>Sổ này chỉ nằm trên điện thoại của bạn. Thỉnh thoảng hãy sao lưu trong Cài đặt.</dd></div>
    </dl>
  </section>`;
}

function renderBook() {
  const month = inMonth(ui.ym);
  const hero = bookHero(sum(month));
  const shown = (ui.filter ? month.filter((e) => e.cat === ui.filter) : month).slice().sort(newestFirst);

  const days = [];
  for (const e of shown) {
    const last = days[days.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else days.push({ date: e.date, items: [e] });
  }

  const filterBar = ui.filter
    ? `<div class="filter-bar"><span>${esc(ui.filter)}: <b>${money(sum(shown))}</b></span>
        <button type="button" class="link" data-act="clear-filter">Xem tất cả</button></div>`
    : '';

  let list;
  if (days.length) {
    list = days.map((d) => `<section class="day">
      <div class="day-head"><b>${dayLabel(d.date)}</b><span>${money(sum(d.items))}</span></div>
      <div class="group">${d.items.map((e) => `<button type="button" class="row ${e.id === ui.freshId ? 'fresh' : ''}" data-act="edit" data-id="${esc(e.id)}">
        ${catTile(e.cat)}
        <span class="row-text"><span class="row-cat">${esc(e.cat)}</span>${e.note ? `<span class="row-note">${esc(e.note)}</span>` : ''}</span>
        <span class="row-amount">${money(e.amount)}</span>
        <span class="chev-r" aria-hidden="true">&#8250;</span>
      </button>`).join('')}</div>
    </section>`).join('');
  } else if (ui.filter) {
    list = `<div class="empty"><strong>Không có khoản nào thuộc ${esc(ui.filter)}</strong>Tháng ${monthNum(ui.ym)} chưa ghi khoản chi nào cho danh mục này.</div>`;
  } else if (!db.expenses.length) {
    list = welcome();
  } else {
    list = `<div class="empty"><strong>Tháng ${monthNum(ui.ym)} chưa có khoản chi nào</strong>Bấm nút Ghi khoản chi ở dưới để thêm khoản đầu tiên.</div>`;
  }

  ui.mini = hero.mini;
  return `<header class="band ${hero.over ? 'over' : ''}"><div class="band-inner">${monthNav()}${hero.html}${backToNow()}</div></header>
    <main class="content">${installNotice()}${backupNotice()}${filterBar}${list}</main>`;
}

/* ---------- Stats view ---------- */
function compareText(month) {
  const prevYm = addMonths(ui.ym, -1);
  const prev = inMonth(prevYm);
  if (!prev.length || !month.length) return '';
  const isNow = ui.ym === currentYm();
  const cutoff = isNow ? new Date().getDate() : 31;
  const prevSpent = sum(prev.filter((e) => Number(e.date.slice(8)) <= cutoff));
  const diff = sum(month) - prevSpent;
  const lead = isNow
    ? `So với cùng kỳ tháng ${monthNum(prevYm)} (đến ngày ${cutoff})`
    : `So với tháng ${monthNum(prevYm)}`;
  if (diff === 0) return `${lead}: bằng nhau.`;
  return `${lead}: ${diff > 0 ? 'nhiều hơn' : 'ít hơn'} <strong>${money(Math.abs(diff))}</strong>.`;
}

function renderCategories(month) {
  const m = monthNum(ui.ym);
  if (!month.length) {
    return `<div class="empty"><strong>Tháng ${m} chưa có gì để thống kê</strong>Số liệu sẽ hiện ở đây sau khi bạn ghi khoản chi đầu tiên của tháng.</div>`;
  }
  const totals = new Map();
  for (const e of month) totals.set(e.cat, (totals.get(e.cat) || 0) + e.amount);
  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = sum(month);
  const top = sorted[0][1];
  return `<section class="section">
    <h2>Tháng ${m} tiền đi đâu?</h2>
    <div class="group">${sorted.map(([cat, value]) => `<button type="button" class="cat-row" data-act="filter" data-cat="${esc(cat)}" aria-label="${esc(cat)}, ${money(value)}, xem các khoản">
      ${catTile(cat)}
      <span class="cat-name">${esc(cat)}<small>${Math.round((value / total) * 100)}%</small></span>
      <span class="cat-value">${money(value)} <span class="chev-r" aria-hidden="true">&#8250;</span></span>
      <span class="cat-track"><i style="width:${(value / top) * 100}%"></i></span>
    </button>`).join('')}</div>
    <p class="section-note">Chạm vào một danh mục để xem các khoản trong đó.</p>
  </section>`;
}

function renderMonths() {
  if (!db.expenses.length) return '';
  const now = currentYm();
  const end = ui.ym < addMonths(now, -5) ? ui.ym : now;
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(addMonths(end, -i));
  const values = months.map((ym) => sum(inMonth(ym)));
  const max = Math.max(...values, 1);
  return `<section class="section">
    <h2>6 tháng chi bao nhiêu?</h2>
    <div class="months">${months.map((ym, i) => `<button type="button" class="month-bar" data-act="pick-month" data-ym="${ym}"
        aria-label="Tháng ${monthNum(ym)}: ${money(values[i])}" aria-current="${ym === ui.ym}">
      <span>${values[i] ? short(values[i]) : '0'}</span>
      <span class="plot"><i style="height:${(values[i] / max) * 100}%"></i></span>
      <span>T${monthNum(ym)}</span>
    </button>`).join('')}</div>
  </section>`;
}

function renderStats() {
  const month = inMonth(ui.ym);
  const compare = compareText(month);
  ui.mini = { left: `Đã chi ${money(sum(month))}` };
  return `<header class="band"><div class="band-inner">${monthNav()}
      <p class="hero-label">Đã chi</p>
      <p class="hero-amount">${moneyHtml(sum(month))}</p>
      ${compare ? `<p class="hero-sub">${compare}</p>` : ''}
      ${backToNow()}
    </div></header>
    <main class="content">${renderMonths()}${renderCategories(month)}</main>`;
}

/* ---------- Settings view ---------- */
function backupStatus() {
  if (!db.lastBackup) return 'Bạn chưa sao lưu lần nào.';
  const d = new Date(db.lastBackup);
  return `Sao lưu gần nhất: ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}.`;
}

function renderSettings() {
  return `<header class="band"><div class="band-inner">
      <div class="top-row"><button type="button" class="top-link" data-act="back">&#8249; Quay lại</button></div>
      <h1 class="page-title">Cài đặt</h1>
    </div></header>
    <main class="content">
      ${isIosBrowserTab() ? `<div class="notice"><p>Bấm nút Chia sẻ của Safari, chọn <b>Thêm vào MH chính</b> để dùng như app và giữ dữ liệu lâu dài.</p></div>` : ''}
      <section class="section">
        <h2><label for="budget">Ngân sách mỗi tháng</label></h2>
        <div class="card">
          <span class="money-input">
            <input id="budget" type="text" inputmode="numeric" autocomplete="off" placeholder="Ví dụ: 8.000.000" value="${db.budget ? groupDigits(db.budget) : ''}">
            <span>đ</span>
          </span>
          <p>Để trống nếu bạn không cần theo dõi ngân sách.</p>
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>Danh mục</h2>
          <button type="button" class="link" data-act="edit-cats">${ui.editCats ? 'Xong' : 'Sửa'}</button>
        </div>
        <div class="card">
          <div class="chips">${db.cats.map((c) => `<span class="chip">${esc(c)}${ui.editCats && c !== OTHER
            ? `<button type="button" class="chip-x" data-act="del-cat" data-cat="${esc(c)}" aria-label="Xóa danh mục ${esc(c)}"><span aria-hidden="true">&times;</span></button>`
            : ''}</span>`).join('')}</div>
          ${ui.editCats ? `<form class="inline-form" id="add-cat">
            <input id="new-cat" type="text" maxlength="24" placeholder="Tên danh mục mới" aria-label="Tên danh mục mới" aria-describedby="cat-error" autocomplete="off">
            <button type="submit" class="secondary">Thêm</button>
          </form>
          <p id="cat-error" class="field-error" role="alert" hidden></p>
          <p>Xóa danh mục không làm mất các khoản đã ghi.</p>` : ''}
        </div>
      </section>

      <section class="section">
        <h2>Sao lưu</h2>
        <div class="card">
          <p>Dữ liệu chỉ nằm trên điện thoại này. Nếu xóa app hoặc đổi máy mà chưa sao lưu, dữ liệu sẽ mất. ${backupStatus()}</p>
          <div class="stack">
            <button type="button" class="primary" data-act="backup">Sao lưu vào Tệp hoặc iCloud</button>
            <button type="button" class="secondary" data-act="restore">Khôi phục từ bản sao lưu</button>
            <button type="button" class="secondary" data-act="csv">Xuất file Excel (CSV)</button>
          </div>
        </div>
      </section>

      <section class="section">
        <h2>Người nhà</h2>
        <div class="card">
          <p>Mỗi điện thoại có một sổ riêng. Người nhà cài app từ đường dẫn này và không xem được dữ liệu của bạn.</p>
          <button type="button" class="secondary" data-act="share-app">Gửi app cho người nhà</button>
        </div>
      </section>

      <section class="section">
        <h2>Xóa dữ liệu</h2>
        <div class="card">
          <p>Đang có ${db.expenses.length} khoản chi trong sổ.</p>
          <button type="button" class="danger-outline" data-act="wipe">Xóa toàn bộ khoản chi</button>
        </div>
      </section>
    </main>`;
}

/* ---------- Render ---------- */
let miniObserver = null;

// A slim summary stays pinned once the green band has scrolled out of view.
function syncMini() {
  const el = $('mini');
  if (miniObserver) miniObserver.disconnect();
  if (!el) return; // A page still on an older index.html has no pinned summary.
  el.hidden = true;
  if (!ui.mini || !('IntersectionObserver' in window)) return;
  el.classList.toggle('over', Boolean(ui.mini.over));
  el.innerHTML = `<b>${ui.mini.left}</b>${ui.mini.right ? `<span>${ui.mini.right}</span>` : ''}`;
  miniObserver = new IntersectionObserver(([entry]) => { el.hidden = entry.isIntersecting; });
  miniObserver.observe(document.querySelector('.band'));
}

function render() {
  ui.mini = null;
  const html = ui.view === 'book' ? renderBook() : ui.view === 'stats' ? renderStats() : renderSettings();
  $('app').innerHTML = html;
  syncMini();
  ui.freshId = null;
  document.querySelectorAll('.dock-tab').forEach((b) => {
    if (b.dataset.view === ui.view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function goTo(view) {
  if (view === 'settings' && ui.view !== 'settings') ui.prev = ui.view;
  if (view !== 'settings') ui.editCats = false;
  ui.view = view;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Toast ---------- */
let toastTimer = 0;
function toast(message, actionLabel, onAction) {
  const el = $('toast');
  el.textContent = '';
  const span = document.createElement('span');
  span.textContent = message;
  el.append(span);
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { el.hidden = true; onAction(); });
    el.append(btn);
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 3500);
}

/* ---------- Confirm ---------- */
function ask(message, yesLabel) {
  const dialog = $('confirm');
  $('confirm-msg').textContent = message;
  $('confirm-yes').textContent = yesLabel;
  dialog.showModal();
  return new Promise((resolve) => {
    const finish = (value) => {
      $('confirm-yes').onclick = null;
      $('confirm-no').onclick = null;
      dialog.oncancel = null;
      dialog.close();
      resolve(value);
    };
    $('confirm-yes').onclick = () => finish(true);
    $('confirm-no').onclick = () => finish(false);
    dialog.oncancel = (e) => { e.preventDefault(); finish(false); };
  });
}

/* ---------- Entry sheet ---------- */
const sheetState = { id: null, digits: '', cat: '', order: [] };

function drawAmount() {
  const out = $('sheet-amount');
  const value = Number(sheetState.digits) || 0;
  out.textContent = money(value);
  out.classList.toggle('zero', value === 0);
  out.classList.toggle('mid', sheetState.digits.length > 6);
  out.classList.toggle('long', sheetState.digits.length > 9);
  const save = $('sheet-save');
  save.disabled = value === 0;
  save.textContent = value ? `Lưu ${money(value)} · ${sheetState.cat}` : 'Nhập số tiền';
}

function drawDate() {
  const value = $('sheet-date').value;
  $('sheet-date-label').textContent = isValidDate(value) ? dayLabel(value) : 'Hôm nay';
}

function recentEntries() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - USAGE_WINDOW_DAYS);
  const from = ymd(cutoff);
  return db.expenses.filter((e) => e.date >= from);
}

// Most-used categories come first so the usual one needs no scrolling. "Khác" stays last.
function orderedCats(current) {
  const uses = new Map();
  for (const e of recentEntries()) uses.set(e.cat, (uses.get(e.cat) || 0) + 1);
  const names = db.cats.includes(current) ? db.cats.slice() : [current, ...db.cats];
  const rank = (c) => (c === OTHER ? -1 : uses.get(c) || 0);
  return names
    .map((c, i) => [c, i])
    .sort((a, b) => rank(b[0]) - rank(a[0]) || a[1] - b[1])
    .map(([c]) => c);
}

// Amounts entered at least twice for the same category are offered as one-tap fills.
function quickPicks() {
  const seen = new Map();
  for (const e of recentEntries().sort(newestFirst)) {
    const key = `${e.cat}|${e.amount}`;
    const item = seen.get(key) || { cat: e.cat, amount: e.amount, count: 0 };
    item.count += 1;
    seen.set(key, item);
  }
  return [...seen.values()]
    .filter((p) => p.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, QUICK_LIMIT);
}

function drawQuick(isNew) {
  const picks = isNew ? quickPicks() : [];
  const box = $('sheet-quick');
  box.hidden = picks.length === 0;
  box.innerHTML = picks.map((p) => `<button type="button" data-act="quick" data-cat="${esc(p.cat)}" data-amount="${p.amount}"
      aria-label="Điền ${esc(p.cat)}, ${money(p.amount)}">${esc(p.cat)} <b>${money(p.amount)}</b></button>`).join('');
}

function drawCats() {
  $('sheet-cats').innerHTML = sheetState.order.map((c) => `<button type="button" data-act="pick-cat" data-cat="${esc(c)}" aria-pressed="${c === sheetState.cat}">${catTile(c)}<span>${esc(c)}</span></button>`).join('');
}

// Scrolls only the category box; scrollIntoView would also move the sheet.
function revealChosenCat() {
  const box = $('sheet-cats');
  const chosen = box.querySelector('[aria-pressed="true"]');
  if (!chosen) return;
  box.scrollLeft = Math.max(0, chosen.offsetLeft - box.offsetLeft - 16);
  box.scrollTop = Math.max(0, chosen.offsetTop - box.offsetTop - 8);
}

function openSheet(entry) {
  sheetState.id = entry ? entry.id : null;
  sheetState.digits = entry ? String(entry.amount) : '';
  sheetState.cat = entry ? entry.cat : (db.cats.includes(db.lastCat) ? db.lastCat : db.cats[0]);
  sheetState.order = orderedCats(sheetState.cat);
  $('sheet-title').textContent = entry ? 'Sửa khoản chi' : 'Khoản chi mới';
  $('sheet-delete').hidden = !entry;
  $('sheet-date').max = today();
  $('sheet-date').value = entry ? entry.date : defaultEntryDate();
  $('sheet-note').value = entry ? entry.note : '';
  $('sheet').classList.remove('typing');
  document.body.classList.add('locked');
  $('sheet').showModal();
  drawAmount();
  drawDate();
  drawQuick(!entry);
  drawCats();
  revealChosenCat();
}

// A new entry goes on today, or on the last day of the past month being viewed.
function defaultEntryDate() {
  if (ui.ym >= currentYm()) return today();
  return `${ui.ym}-${pad(daysInMonth(ui.ym))}`;
}

function closeSheet() {
  $('sheet').close();
  $('sheet').style.bottom = '';
  $('sheet').style.transform = '';
  document.body.classList.remove('locked');
}

let backHoldTimer = 0;
let backHeld = false;

function pressKey(key) {
  if (key === 'back' && backHeld) { backHeld = false; return; }
  let d = sheetState.digits;
  if (key === 'back') d = d.slice(0, -1);
  else if (d === '' && /^0+$/.test(key)) return;
  else d += key;
  if (Number(d) > MAX_AMOUNT) return;
  sheetState.digits = d;
  drawAmount();
}

function saveSheet() {
  const amount = Number(sheetState.digits);
  if (!amount) return;
  let date = $('sheet-date').value;
  if (!isValidDate(date) || date > today()) date = today();
  const note = $('sheet-note').value.trim();
  const existing = sheetState.id && db.expenses.find((e) => e.id === sheetState.id);
  const before = existing ? { ...existing } : null;
  const id = existing ? existing.id : newId();
  if (existing) {
    Object.assign(existing, { amount, date, note, cat: sheetState.cat });
  } else {
    db.expenses.push({ id, amount, date, note, cat: sheetState.cat, createdAt: Date.now() });
    db.lastCat = sheetState.cat;
  }
  const saved = save();
  closeSheet();
  ui.ym = date.slice(0, 7);
  if (ui.filter && ui.filter !== sheetState.cat) ui.filter = null;
  ui.view = 'book';
  ui.freshId = id;
  render();
  if (!saved) return;
  toast(`${before ? 'Đã sửa' : 'Đã ghi'} ${money(amount)}, ${sheetState.cat}`, 'Hoàn tác', () => {
    if (before) Object.assign(db.expenses.find((e) => e.id === id) || {}, before);
    else db.expenses = db.expenses.filter((e) => e.id !== id);
    save();
    if (before) ui.ym = before.date.slice(0, 7);
    render();
  });
}

async function shareApp() {
  const url = location.href.split('#')[0];
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Sổ Chi', text: 'Sổ ghi chi tiêu trên điện thoại. Mở bằng Safari rồi chọn Thêm vào MH chính.', url });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Đã chép đường dẫn app. Bạn dán vào tin nhắn gửi người nhà.');
  } catch (err) {
    toast(`Đường dẫn app: ${url}`);
  }
}

function deleteFromSheet() {
  const index = db.expenses.findIndex((e) => e.id === sheetState.id);
  closeSheet();
  if (index < 0) return;
  const [removed] = db.expenses.splice(index, 1);
  save();
  render();
  toast(`Đã xóa ${money(removed.amount)}`, 'Hoàn tác', () => {
    db.expenses.push(removed);
    save();
    render();
  });
}

/* ---------- Backup ---------- */
function stamp() { return today(); }

async function deliver(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

async function backup() {
  const payload = {
    app: 'so-chi',
    version: 1,
    exportedAt: new Date().toISOString(),
    budget: db.budget,
    cats: db.cats,
    expenses: db.expenses,
  };
  const file = new File([JSON.stringify(payload, null, 1)], `so-chi-sao-luu-${stamp()}.json`, { type: 'application/json' });
  if (await deliver(file)) {
    db.lastBackup = new Date().toISOString();
    save();
    render();
    toast(`Đã tạo bản sao lưu ${db.expenses.length} khoản chi`);
  }
}

function csvCell(value) {
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // Stops Excel from running a note as a formula.
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCsv() {
  if (!db.expenses.length) { toast('Chưa có khoản chi nào để xuất.'); return; }
  const rows = db.expenses.slice().sort(newestFirst)
    .map((e) => [e.date, e.cat, e.amount, e.note].map(csvCell).join(','));
  const text = `﻿Ngày,Danh mục,Số tiền (đ),Ghi chú\n${rows.join('\n')}\n`;
  await deliver(new File([text], `so-chi-${stamp()}.csv`, { type: 'text/csv' }));
}

async function importFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch (err) {
    toast('File này không đọc được. Hãy chọn file so-chi-sao-luu-….json.');
    return;
  }
  if (!parsed || parsed.app !== 'so-chi' || !Array.isArray(parsed.expenses)) {
    toast('File này không phải bản sao lưu của Sổ Chi.');
    return;
  }
  const { data, dropped } = normalize(parsed);
  const ok = await ask(
    `Thay ${db.expenses.length} khoản hiện có bằng ${data.expenses.length} khoản trong file? Dữ liệu hiện tại sẽ bị ghi đè.`,
    'Khôi phục',
  );
  if (!ok) return;
  data.lastBackup = db.lastBackup;
  db = data;
  save();
  ui.filter = null;
  render();
  toast(`Đã khôi phục ${data.expenses.length} khoản chi${dropped ? `, bỏ qua ${dropped} dòng lỗi` : ''}.`);
}

async function wipe() {
  if (!db.expenses.length) { toast('Sổ đang trống.'); return; }
  const ok = await ask(`Xóa toàn bộ ${db.expenses.length} khoản chi? Không thể hoàn tác nếu bạn chưa sao lưu.`, 'Xóa hết');
  if (!ok) return;
  db.expenses = [];
  save();
  ui.filter = null;
  render();
  toast('Đã xóa toàn bộ khoản chi.');
}

/* ---------- Events ---------- */
const actions = {
  add: () => openSheet(null),
  tab: (el) => goTo(el.dataset.view),
  back: () => goTo(ui.prev),
  now: () => { ui.ym = currentYm(); render(); },
  quick: (el) => {
    sheetState.digits = el.dataset.amount;
    sheetState.cat = el.dataset.cat;
    drawAmount();
    drawCats();
    revealChosenCat();
  },
  'share-app': shareApp,
  month: (el) => {
    const next = addMonths(ui.ym, Number(el.dataset.step));
    if (next > currentYm()) return;
    ui.ym = next;
    render();
  },
  'pick-month': (el) => { ui.ym = el.dataset.ym; render(); },
  edit: (el) => {
    const entry = db.expenses.find((e) => e.id === el.dataset.id);
    if (entry) openSheet(entry);
  },
  filter: (el) => { ui.filter = el.dataset.cat; goTo('book'); },
  'clear-filter': () => { ui.filter = null; render(); },
  'set-budget': () => { goTo('settings'); $('budget').focus(); },
  'edit-cats': () => { ui.editCats = !ui.editCats; render(); },
  'hide-install': () => { setFlag('hideInstall'); render(); },
  'sheet-cancel': closeSheet,
  'sheet-save': saveSheet,
  'sheet-delete': deleteFromSheet,
  'pick-cat': (el) => { sheetState.cat = el.dataset.cat; drawCats(); drawAmount(); },
  backup,
  csv: exportCsv,
  restore: () => $('import-file').click(),
  wipe,
  'del-cat': (el) => {
    const name = el.dataset.cat;
    const at = db.cats.indexOf(name);
    if (at < 0) return;
    db.cats.splice(at, 1);
    save();
    render();
    toast(`Đã xóa danh mục ${name}`, 'Hoàn tác', () => {
      db.cats.splice(at, 0, name);
      save();
      render();
    });
  },
};

document.addEventListener('click', (e) => {
  const key = e.target.closest('[data-key]');
  if (key) { pressKey(key.dataset.key); return; }
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});

// Holding the backspace key clears the whole amount.
$('keypad').addEventListener('pointerdown', (e) => {
  if (!e.target.closest('[data-key="back"]')) return;
  backHeld = false;
  backHoldTimer = setTimeout(() => {
    backHeld = true;
    sheetState.digits = '';
    drawAmount();
  }, BACK_HOLD_MS);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
  $('keypad').addEventListener(type, () => clearTimeout(backHoldTimer));
});

// Drag the top of the sheet down to dismiss it, as on native iOS sheets.
let sheetDrag = null;
function dragStart(e) {
  if (e.target.closest('button')) return;
  sheetDrag = { y: e.clientY, t: e.timeStamp, dy: 0 };
  $('sheet').classList.add('dragging');
  e.currentTarget.setPointerCapture(e.pointerId);
}
function dragMove(e) {
  if (!sheetDrag) return;
  sheetDrag.dy = Math.max(0, e.clientY - sheetDrag.y);
  $('sheet').style.transform = `translateY(${sheetDrag.dy}px)`;
}
function dragEnd(e) {
  if (!sheetDrag) return;
  const { dy, t } = sheetDrag;
  const speed = dy / Math.max(1, e.timeStamp - t);
  sheetDrag = null;
  $('sheet').classList.remove('dragging');
  if (dy > SWIPE_CLOSE_PX || (dy > SWIPE_FLICK_PX && speed > SWIPE_FLICK_SPEED)) closeSheet();
  else $('sheet').style.transform = '';
}
['sheet-grab', 'sheet-head'].forEach((id) => {
  const handle = $(id);
  if (!handle) return; // Absent on a page still using an older index.html.
  handle.addEventListener('pointerdown', dragStart);
  handle.addEventListener('pointermove', dragMove);
  handle.addEventListener('pointerup', dragEnd);
  handle.addEventListener('pointercancel', dragEnd);
});

// Tapping outside closes an untouched sheet; an entered amount is never dropped that way.
$('sheet').addEventListener('click', (e) => {
  if (e.target === $('sheet') && !sheetState.digits) closeSheet();
});

$('sheet-date').addEventListener('input', drawDate);
$('sheet-date').addEventListener('change', drawDate);

document.addEventListener('input', (e) => {
  if (e.target.id === 'new-cat') {
    $('cat-error').hidden = true;
    e.target.removeAttribute('aria-invalid');
  }
  if (e.target.id !== 'budget') return;
  const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
  e.target.value = digits ? groupDigits(digits) : '';
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'budget') {
    db.budget = Number(e.target.value.replace(/\D/g, '')) || 0;
    if (save()) toast(db.budget ? `Ngân sách mỗi tháng: ${money(db.budget)}` : 'Đã tắt theo dõi ngân sách');
  }
  if (e.target.id === 'import-file') {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importFile(file);
  }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id !== 'add-cat') return;
  const input = $('new-cat');
  const name = input.value.trim().slice(0, 24);
  if (!name) { input.focus(); return; }
  if (db.cats.some((c) => c.toLowerCase() === name.toLowerCase())) {
    $('cat-error').textContent = `Danh mục ${name} đã có sẵn. Hãy đặt tên khác.`;
    $('cat-error').hidden = false;
    input.setAttribute('aria-invalid', 'true');
    input.focus();
    return;
  }
  // New categories go before "Khác", which stays last.
  db.cats.splice(db.cats.indexOf(OTHER), 0, name);
  save();
  render();
  toast(`Đã thêm danh mục ${name}`);
});

// Hardware keyboard in the sheet (iPad, desktop browsers).
document.addEventListener('keydown', (e) => {
  if (!$('sheet').open || $('confirm').open || e.target.tagName === 'INPUT') return;
  if (/^[0-9]$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('back');
  else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); saveSheet(); }
});

$('sheet').addEventListener('cancel', () => {
  document.body.classList.remove('locked');
  $('sheet').style.bottom = '';
});

// While the iOS keyboard is up for the note, hide the keypad and sit above the keyboard.
$('sheet-note').addEventListener('focus', () => $('sheet').classList.add('typing'));
$('sheet-note').addEventListener('blur', () => $('sheet').classList.remove('typing'));
$('sheet-note').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
});
if (window.visualViewport) {
  const followKeyboard = () => {
    if (!$('sheet').open) return;
    const vv = window.visualViewport;
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    $('sheet').style.bottom = covered ? `${covered}px` : '';
  };
  window.visualViewport.addEventListener('resize', followKeyboard);
  window.visualViewport.addEventListener('scroll', followKeyboard);
}

// Reopening the app on a later day or month must show fresh figures.
let lastSeenDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.hidden || today() === lastSeenDay) return;
  if (ui.ym === lastSeenDay.slice(0, 7)) ui.ym = currentYm();
  lastSeenDay = today();
  if (!$('sheet').open && !$('confirm').open) render();
});

const BIG_TEXT_PX = 20;
function syncTextSize() {
  const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
  document.documentElement.classList.toggle('big-text', px >= BIG_TEXT_PX);
}
window.addEventListener('resize', syncTextSize);
document.addEventListener('visibilitychange', syncTextSize);

/* ---------- Start ---------- */
syncTextSize();
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

  // Home-screen apps can stay open for days, so look for a new release on each return.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    navigator.serviceWorker.getRegistration()
      .then((reg) => reg && reg.update())
      .catch(() => {});
  });

  // Switch to a new release straight away, unless someone is partway through an entry.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading || $('sheet').open || $('confirm').open) return;
    reloading = true;
    location.reload();
  });
}
