'use strict';

const KEY = 'so-chi.v1';
const OTHER = 'Khác';
const DEFAULT_CATS = ['Ăn uống', 'Cà phê', 'Đi chợ', 'Đi lại', 'Nhà cửa', 'Điện nước', 'Mua sắm', 'Sức khỏe', 'Giải trí', 'Gia đình', 'Hiếu hỉ', OTHER];
const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const MAX_AMOUNT = 999999999999;
const BACKUP_REMIND_DAYS = 30;
const BACKUP_REMIND_ENTRIES = 20;

const $ = (id) => document.getElementById(id);

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
const ui = { view: 'book', ym: currentYm(), filter: null };

/* ---------- Queries ---------- */
const inMonth = (ym) => db.expenses.filter((e) => e.date.startsWith(ym));
const sum = (list) => list.reduce((t, e) => t + e.amount, 0);
const newestFirst = (a, b) => (b.date.localeCompare(a.date)) || (b.createdAt - a.createdAt);

/* ---------- Shared header ---------- */
function monthNav() {
  const atNow = ui.ym >= currentYm();
  return `<div class="month-nav">
    <button type="button" data-act="month" data-step="-1" aria-label="Tháng trước">&#8249;</button>
    <h1>${monthTitle(ui.ym)}</h1>
    <button type="button" data-act="month" data-step="1" aria-label="Tháng sau" ${atNow ? 'disabled' : ''}>&#8250;</button>
  </div>`;
}

function bookHero(spent) {
  const budget = db.budget;
  if (!budget) {
    return {
      over: false,
      html: `<p class="hero-label">Đã chi</p>
        <p class="hero-amount">${moneyHtml(spent)}</p>
        <button type="button" class="band-action" data-act="set-budget">Đặt ngân sách tháng</button>`,
    };
  }
  const remaining = budget - spent;
  const over = remaining < 0;
  const pct = Math.round((spent / budget) * 100);
  const near = !over && pct >= 85;
  const isNow = ui.ym === currentYm();
  const label = over ? 'Đã vượt ngân sách' : isNow ? 'Còn lại' : 'Còn dư';
  const lines = [`Đã chi <strong>${money(spent)}</strong> trên ${money(budget)} (${pct}%)`];
  if (isNow && !over) {
    const daysLeft = daysInMonth(ui.ym) - new Date().getDate() + 1;
    const perDay = Math.floor(remaining / daysLeft / 1000) * 1000;
    if (daysLeft === 1) lines.push('Hôm nay là ngày cuối tháng.');
    else if (perDay > 0) lines.push(`Còn ${daysLeft} ngày, mỗi ngày tiêu được khoảng <strong>${money(perDay)}</strong>.`);
  }
  return {
    over,
    html: `<p class="hero-label">${label}</p>
      <p class="hero-amount">${moneyHtml(Math.abs(remaining))}</p>
      <div class="meter ${near ? 'near' : ''}" aria-hidden="true"><i style="width:${Math.min(pct, 100)}%"></i></div>
      ${lines.map((l) => `<p class="hero-sub">${l}</p>`).join('')}`,
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
      <div class="group">${d.items.map((e) => `<button type="button" class="row" data-act="edit" data-id="${esc(e.id)}">
        <span><span class="row-cat">${esc(e.cat)}</span>${e.note ? `<span class="row-note">${esc(e.note)}</span>` : ''}</span>
        <span class="row-amount">${money(e.amount)}</span>
      </button>`).join('')}</div>
    </section>`).join('');
  } else if (ui.filter) {
    list = `<div class="empty"><strong>Không có khoản nào thuộc ${esc(ui.filter)}</strong>Tháng ${monthNum(ui.ym)} chưa ghi khoản chi nào cho danh mục này.</div>`;
  } else {
    list = `<div class="empty"><strong>Tháng ${monthNum(ui.ym)} chưa có khoản chi nào</strong>Bấm Ghi khoản chi để thêm khoản đầu tiên.</div>`;
  }

  return `<header class="band ${hero.over ? 'over' : ''}"><div class="band-inner">${monthNav()}${hero.html}</div></header>
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
      <span class="cat-name">${esc(cat)}<small>${Math.round((value / total) * 100)}%</small></span>
      <span class="cat-value">${money(value)}</span>
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
  return `<header class="band"><div class="band-inner">${monthNav()}
      <p class="hero-label">Đã chi</p>
      <p class="hero-amount">${moneyHtml(sum(month))}</p>
      ${compare ? `<p class="hero-sub">${compare}</p>` : ''}
    </div></header>
    <main class="content">${renderCategories(month)}${renderMonths()}</main>`;
}

/* ---------- Settings view ---------- */
function backupStatus() {
  if (!db.lastBackup) return 'Bạn chưa sao lưu lần nào.';
  const d = new Date(db.lastBackup);
  return `Sao lưu gần nhất: ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}.`;
}

function renderSettings() {
  return `<header class="band"><div class="band-inner"><h1 class="page-title">Cài đặt</h1></div></header>
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
        <h2>Danh mục</h2>
        <div class="card">
          <div class="chips">${db.cats.map((c) => c === OTHER
            ? `<span class="chip-del chip-fixed">${esc(c)}</span>`
            : `<button type="button" class="chip-del" data-act="del-cat" data-cat="${esc(c)}" aria-label="Xóa danh mục ${esc(c)}">${esc(c)}<b aria-hidden="true">&times;</b></button>`).join('')}</div>
          <form class="inline-form" id="add-cat">
            <input id="new-cat" type="text" maxlength="24" placeholder="Tên danh mục mới" aria-label="Tên danh mục mới" autocomplete="off">
            <button type="submit" class="secondary">Thêm</button>
          </form>
          <p>Xóa danh mục không làm mất các khoản đã ghi.</p>
        </div>
      </section>

      <section class="section">
        <h2>Sao lưu</h2>
        <div class="card">
          <p>Dữ liệu chỉ nằm trên điện thoại này. Nếu xóa app hoặc đổi máy mà chưa sao lưu, dữ liệu sẽ mất. ${backupStatus()}</p>
          <div class="stack">
            <button type="button" class="primary" data-act="backup">Sao lưu vào Tệp hoặc iCloud</button>
            <button type="button" class="secondary" data-act="restore">Khôi phục từ file sao lưu</button>
            <button type="button" class="secondary" data-act="csv">Xuất file CSV để mở bằng Excel</button>
          </div>
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
function render() {
  const html = ui.view === 'book' ? renderBook() : ui.view === 'stats' ? renderStats() : renderSettings();
  $('app').innerHTML = html;
  $('fab').hidden = ui.view === 'settings';
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.view === ui.view) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function goTo(view) {
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
const sheetState = { id: null, digits: '', cat: '' };

function drawAmount() {
  const out = $('sheet-amount');
  const value = Number(sheetState.digits) || 0;
  out.textContent = money(value);
  out.classList.toggle('zero', value === 0);
  $('sheet-save').disabled = value === 0;
}

function drawCats() {
  const names = db.cats.includes(sheetState.cat) ? db.cats : [sheetState.cat, ...db.cats];
  $('sheet-cats').innerHTML = names.map((c) => `<button type="button" data-act="pick-cat" data-cat="${esc(c)}" aria-pressed="${c === sheetState.cat}">${esc(c)}</button>`).join('');
  const chosen = $('sheet-cats').querySelector('[aria-pressed="true"]');
  if (chosen && chosen.scrollIntoView) chosen.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function openSheet(entry) {
  sheetState.id = entry ? entry.id : null;
  sheetState.digits = entry ? String(entry.amount) : '';
  sheetState.cat = entry ? entry.cat : (db.cats.includes(db.lastCat) ? db.lastCat : db.cats[0]);
  $('sheet-title').textContent = entry ? 'Sửa khoản chi' : 'Khoản chi mới';
  $('sheet-delete').hidden = !entry;
  $('sheet-date').max = today();
  $('sheet-date').value = entry ? entry.date : defaultEntryDate();
  $('sheet-note').value = entry ? entry.note : '';
  $('sheet').classList.remove('typing');
  document.body.classList.add('locked');
  $('sheet').showModal();
  drawAmount();
  drawCats();
}

// A new entry goes on today, or on the last day of the past month being viewed.
function defaultEntryDate() {
  if (ui.ym >= currentYm()) return today();
  return `${ui.ym}-${pad(daysInMonth(ui.ym))}`;
}

function closeSheet() {
  $('sheet').close();
  $('sheet').style.bottom = '';
  document.body.classList.remove('locked');
}

function pressKey(key) {
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
  if (existing) {
    Object.assign(existing, { amount, date, note, cat: sheetState.cat });
  } else {
    db.expenses.push({ id: newId(), amount, date, note, cat: sheetState.cat, createdAt: Date.now() });
    db.lastCat = sheetState.cat;
  }
  const saved = save();
  closeSheet();
  ui.ym = date.slice(0, 7);
  if (ui.filter && ui.filter !== sheetState.cat) ui.filter = null;
  ui.view = 'book';
  render();
  if (saved) toast(`${existing ? 'Đã sửa' : 'Đã ghi'} ${money(amount)}, ${sheetState.cat}`);
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
  'hide-install': () => { setFlag('hideInstall'); render(); },
  'sheet-cancel': closeSheet,
  'sheet-save': saveSheet,
  'sheet-delete': deleteFromSheet,
  'pick-cat': (el) => { sheetState.cat = el.dataset.cat; drawCats(); },
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

document.addEventListener('input', (e) => {
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
    toast(`Danh mục ${name} đã có sẵn.`);
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

/* ---------- Start ---------- */
render();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
