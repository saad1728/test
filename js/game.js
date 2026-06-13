'use strict';
/* Bus Jam — main game engine. */

// ───────────────────────── i18n ─────────────────────────
const T = {
  ar: {
    title: 'زحمة الباصات',
    play: 'العب',
    level: 'مرحلة',
    left: 'متبقي',
    win: 'أحسنت! 🎉',
    winMsg: 'أنهيت المرحلة',
    lose: 'انتهت المواقف! 😅',
    loseMsg: 'امتلأت المواقف ولا يوجد راكب مطابق',
    next: 'المرحلة التالية',
    retry: 'إعادة المحاولة',
    home: 'الرئيسية',
    continueAd: '📺 شاهد إعلان وتابع (+موقف إضافي)',
    continueCoins: 'تابع مقابل {0} 🪙',
    refresh: 'خلط',
    clear: 'شفط',
    sort: 'ترتيب',
    slotsFull: 'المواقف ممتلئة!',
    blockedMsg: 'الطريق مسدود!',
    getBooster: 'احصل على المساعدة',
    watchAd: '📺 شاهد إعلان',
    buyCoins: 'اشترِ بـ {0} 🪙',
    notEnoughCoins: 'لا تملك عملات كافية',
    cancel: 'إلغاء',
    pickBus: 'اختر باصاً لشفطه',
    freeGift: 'هدية مجانية!',
    giftMsg: 'شاهد إعلاناً واحصل على {0} 🪙',
    settings: 'الإعدادات',
    sound: 'الصوت 🔊',
    language: 'English',
    resetProgress: 'تصفير التقدم',
    resetConfirm: 'متأكد؟ سيتم حذف كل تقدمك!',
    howTitle: 'طريقة اللعب',
    how1: 'اضغط على الباص ليتحرك باتجاه السهم',
    how2: 'الباص الخارج يقف في المواقف بالأعلى',
    how3: 'الركاب يركبون الباص المطابق للونهم',
    how4: 'لا تدع المواقف تمتلئ بباصات لا أحد يريدها!',
    unlockSlot: 'موقف إضافي',
    adFail: 'لم يكتمل الإعلان',
    rewardCoins: 'حصلت على {0} 🪙',
    rewardBooster: 'حصلت على المساعدة!',
  },
  en: {
    title: 'Bus Jam',
    play: 'PLAY',
    level: 'LEVEL',
    left: 'Left',
    win: 'Great! 🎉',
    winMsg: 'Level complete',
    lose: 'Slots are full! 😅',
    loseMsg: 'All slots are full and no passenger matches',
    next: 'Next level',
    retry: 'Retry',
    home: 'Home',
    continueAd: '📺 Watch ad to continue (+1 slot)',
    continueCoins: 'Continue for {0} 🪙',
    refresh: 'Shuffle',
    clear: 'Vacuum',
    sort: 'Sort',
    slotsFull: 'Slots are full!',
    blockedMsg: 'Blocked!',
    getBooster: 'Get booster',
    watchAd: '📺 Watch ad',
    buyCoins: 'Buy for {0} 🪙',
    notEnoughCoins: 'Not enough coins',
    cancel: 'Cancel',
    pickBus: 'Pick a bus to vacuum',
    freeGift: 'Free gift!',
    giftMsg: 'Watch an ad and get {0} 🪙',
    settings: 'Settings',
    sound: 'Sound 🔊',
    language: 'العربية',
    resetProgress: 'Reset progress',
    resetConfirm: 'Sure? All progress will be lost!',
    howTitle: 'How to play',
    how1: 'Tap a bus to drive it in its arrow direction',
    how2: 'Exited buses park in the slots above',
    how3: 'Passengers board the bus matching their color',
    how4: "Don't let the slots fill with unwanted buses!",
    unlockSlot: 'Extra slot',
    adFail: 'Ad was not completed',
    rewardCoins: 'You got {0} 🪙',
    rewardBooster: 'Booster received!',
  },
};
function t(key, ...args) {
  let s = (T[S.lang] && T[S.lang][key]) || T.ar[key] || key;
  args.forEach((a, i) => { s = s.replace('{' + i + '}', a); });
  return s;
}

// ───────────────────────── persistence ─────────────────────────
const SAVE_KEY = 'busjam.save.v1';
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (d && typeof d === 'object') return d;
  } catch (e) { /* ignore */ }
  return {};
}
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level: S.level, coins: S.coins, sound: S.sound, lang: S.lang, boosters: S.boosters,
    }));
  } catch (e) { /* ignore */ }
}

// ───────────────────────── state ─────────────────────────
const saved = loadSave();
const S = {
  screen: 'home',
  level: saved.level || 1,
  coins: saved.coins != null ? saved.coins : 300,
  sound: saved.sound !== false,
  lang: saved.lang || 'ar',
  boosters: Object.assign({ refresh: 2, clear: 1, sort: 2 }, saved.boosters || {}),
  // per-level runtime
  rows: 0, cols: 0, grid: null,
  vehicles: new Map(),    // id -> vehicle on the grid
  queue: [],
  parked: [],             // {id,color,cap,remaining,arrived}
  baseSlots: 5,
  extraSlots: 0,
  totalPassengers: 0,
  rngPlay: Math.random,
  anims: [],              // visual animations {type,veh,start,dur,...}
  selectMode: null,       // 'clear' while vacuum booster is choosing
  over: false,
};
const BOOSTER_COST = { refresh: 150, clear: 250, sort: 100 };
const CONTINUE_COST = 400;
const GIFT_COINS = 250;

// ───────────────────────── DOM helpers ─────────────────────────
const $ = (id) => document.getElementById(id);
let canvas, ctx2d, cell = 40, boardW = 0, boardH = 0;

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1400);
}

function setScreen(name) {
  S.screen = name;
  $('screen-home').classList.toggle('hidden', name !== 'home');
  $('screen-game').classList.toggle('hidden', name !== 'playing');
}

// ───────────────────────── home / settings ─────────────────────────
function renderHome() {
  $('home-title').textContent = t('title');
  $('btn-play').innerHTML = '<span class="play-word">' + t('play') + '</span><span class="play-level">' + t('level') + ' ' + S.level + '</span>';
  $('home-coins').textContent = S.coins;
  $('how-title').textContent = t('howTitle');
  $('how-list').innerHTML = ['how1', 'how2', 'how3', 'how4'].map(k => '<li>' + t(k) + '</li>').join('');
  document.documentElement.lang = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
}

function openSettings() {
  $('modal-title').textContent = t('settings');
  $('modal-body').innerHTML = '';
  $('modal-buttons').innerHTML = '';
  addModalBtn(t('sound') + ' ' + (S.sound ? 'ON' : 'OFF'), 'btn-soft', () => {
    S.sound = !S.sound; Sfx.setMuted(!S.sound); persist(); openSettings();
  });
  addModalBtn(t('language'), 'btn-soft', () => {
    S.lang = S.lang === 'ar' ? 'en' : 'ar'; persist(); renderHome(); refreshGameTexts(); openSettings();
  });
  addModalBtn(t('resetProgress'), 'btn-danger', () => {
    if (confirm(t('resetConfirm'))) {
      localStorage.removeItem(SAVE_KEY); location.reload();
    }
  });
  addModalBtn(t('cancel'), 'btn-soft', closeModal);
  showModal();
}

// ───────────────────────── generic modal ─────────────────────────
function showModal() { $('modal').classList.remove('hidden'); }
function closeModal() { $('modal').classList.add('hidden'); }
function addModalBtn(label, cls, fn) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.innerHTML = label;
  b.addEventListener('click', fn);
  $('modal-buttons').appendChild(b);
  return b;
}

// ───────────────────────── level lifecycle ─────────────────────────
function startLevel(n) {
  const data = generateLevel(n);
  S.rows = data.cfg.rows;
  S.cols = data.cfg.cols;
  S.baseSlots = data.cfg.slots;
  S.extraSlots = 0;
  S.grid = emptyGrid(S.rows, S.cols);
  S.vehicles = new Map();
  for (const v of data.vehicles) {
    S.vehicles.set(v.id, v);
    stampVehicle(S.grid, v, v.id);
  }
  S.queue = data.queue.slice();
  S.totalPassengers = S.queue.length;
  S.parked = [];
  S.anims = [];
  S.selectMode = null;
  S.over = false;
  S.rngPlay = mulberry32(Date.now() & 0xffffffff);
  setScreen('playing');
  sizeCanvas();
  refreshGameTexts();
  renderQueue();
  renderSlots();
  updateHud();
}

function refreshGameTexts() {
  if (!$('hud-level')) return;
  $('hud-level').textContent = t('level') + ' ' + S.level;
  $('b-refresh').querySelector('.b-label').textContent = t('refresh');
  $('b-clear').querySelector('.b-label').textContent = t('clear');
  $('b-sort').querySelector('.b-label').textContent = t('sort');
  $('cancel-select').textContent = t('cancel');
  updateBoosterBadges();
}

function updateHud() {
  $('hud-coins').textContent = S.coins;
  $('home-coins').textContent = S.coins;
  $('hud-left').textContent = S.queue.length;
  $('hud-left-label').textContent = t('left');
}

function activeSlots() { return S.baseSlots + S.extraSlots; }

// ───────────────────────── canvas ─────────────────────────
function sizeCanvas() {
  canvas = $('board');
  ctx2d = canvas.getContext('2d');
  const holder = $('board-holder');
  const w = holder.clientWidth;
  const h = holder.clientHeight;
  cell = Math.floor(Math.min(w / S.cols, h / S.rows));
  boardW = cell * S.cols;
  boardH = cell * S.rows;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = boardW * dpr;
  canvas.height = boardH * dpr;
  canvas.style.width = boardW + 'px';
  canvas.style.height = boardH + 'px';
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function dirVec(dir) {
  return dir === 'up' ? [0, -1] : dir === 'down' ? [0, 1] : dir === 'left' ? [-1, 0] : [1, 0];
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawArrow(c, cx, cy, dir, size, color) {
  const [dx, dy] = dirVec(dir);
  c.save();
  c.translate(cx, cy);
  c.rotate(Math.atan2(dy, dx));
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(size * 0.55, 0);
  c.lineTo(-size * 0.25, -size * 0.45);
  c.lineTo(-size * 0.25, -size * 0.16);
  c.lineTo(-size * 0.55, -size * 0.16);
  c.lineTo(-size * 0.55, size * 0.16);
  c.lineTo(-size * 0.25, size * 0.16);
  c.lineTo(-size * 0.25, size * 0.45);
  c.closePath();
  c.fill();
  c.restore();
}

function drawVehicle(c, v, ox, oy, alpha) {
  const pal = PALETTE[v.color];
  const w = (v.orient === 'h' ? v.len : 1) * cell;
  const h = (v.orient === 'v' ? v.len : 1) * cell;
  const x = v.x * cell + ox;
  const y = v.y * cell + oy;
  const pad = Math.max(2, cell * 0.07);
  c.save();
  if (alpha != null) c.globalAlpha = alpha;
  // shadow
  roundRect(c, x + pad, y + pad + 2.5, w - pad * 2, h - pad * 2, cell * 0.26);
  c.fillStyle = 'rgba(0,0,0,0.22)';
  c.fill();
  // body
  roundRect(c, x + pad, y + pad, w - pad * 2, h - pad * 2, cell * 0.26);
  const grad = c.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, pal.light);
  grad.addColorStop(0.35, pal.main);
  grad.addColorStop(1, pal.dark);
  c.fillStyle = grad;
  c.fill();
  c.lineWidth = Math.max(1.5, cell * 0.05);
  c.strokeStyle = pal.dark;
  c.stroke();
  // windshield at the front
  const [dx, dy] = dirVec(v.dir);
  const fw = Math.min(w, h) * 0.55;
  const fcx = x + w / 2 + dx * (w / 2 - cell * 0.32);
  const fcy = y + h / 2 + dy * (h / 2 - cell * 0.32);
  roundRect(c, fcx - fw / 2, fcy - fw * 0.22, fw, fw * 0.44, fw * 0.18);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  c.fill();
  // arrows along the body
  const nArrows = v.len === 3 ? 2 : 1;
  for (let i = 0; i < nArrows; i++) {
    const f = nArrows === 1 ? 0.5 : (i === 0 ? 0.32 : 0.68);
    const acx = v.orient === 'h' ? x + w * f : x + w / 2;
    const acy = v.orient === 'v' ? y + h * f : y + h / 2;
    drawArrow(c, acx, acy, v.dir, cell * 0.42, 'rgba(255,255,255,0.95)');
    drawArrow(c, acx, acy, v.dir, cell * 0.34, pal.dark);
  }
  c.restore();
}

function drawBoard(now) {
  if (!ctx2d || S.screen !== 'playing') return;
  const c = ctx2d;
  c.clearRect(0, 0, boardW, boardH);
  // asphalt background
  c.fillStyle = '#4b5563';
  roundRect(c, 0, 0, boardW, boardH, 14);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.07)';
  c.lineWidth = 1;
  for (let x = 1; x < S.cols; x++) { c.beginPath(); c.moveTo(x * cell, 4); c.lineTo(x * cell, boardH - 4); c.stroke(); }
  for (let y = 1; y < S.rows; y++) { c.beginPath(); c.moveTo(4, y * cell); c.lineTo(boardW - 4, y * cell); c.stroke(); }

  const animByVeh = new Map();
  S.anims = S.anims.filter(a => now - a.start < a.dur);
  for (const a of S.anims) animByVeh.set(a.veh.id, a);

  // vehicles still on the grid
  for (const v of S.vehicles.values()) {
    const a = animByVeh.get(v.id);
    let ox = 0, oy = 0;
    if (a && a.type === 'bump') {
      const p = (now - a.start) / a.dur;
      const k = Math.sin(p * Math.PI) * 0.16 * cell;
      ox = a.vec[0] * k; oy = a.vec[1] * k;
    }
    if (S.selectMode === 'clear') {
      // dim everything slightly; selection handled on tap
    }
    drawVehicle(c, v, ox, oy, null);
  }
  // exiting / vacuumed ghosts
  for (const a of S.anims) {
    if (a.type === 'exit') {
      const p = Math.min(1, (now - a.start) / a.dur);
      const ease = p * p;
      const ox = a.vec[0] * a.dist * cell * ease;
      const oy = a.vec[1] * a.dist * cell * ease;
      drawVehicle(c, a.veh, ox, oy, 1 - p * 0.25);
    } else if (a.type === 'vacuum') {
      const p = Math.min(1, (now - a.start) / a.dur);
      drawVehicle(c, a.veh, 0, -p * cell * 3, 1 - p);
    }
  }
  if (S.selectMode === 'clear') {
    c.fillStyle = 'rgba(255,255,255,0.0)';
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.setLineDash([8, 6]);
    c.lineWidth = 3;
    roundRect(c, 2, 2, boardW - 4, boardH - 4, 14);
    c.stroke();
    c.setLineDash([]);
  }
}

function loop(now) {
  drawBoard(now);
  requestAnimationFrame(loop);
}

// ───────────────────────── input ─────────────────────────
function vehicleAt(px, py) {
  const x = Math.floor(px / cell);
  const y = Math.floor(py / cell);
  if (x < 0 || y < 0 || x >= S.cols || y >= S.rows) return null;
  const id = S.grid[y][x];
  return id ? S.vehicles.get(id) : null;
}

function pathClear(v) {
  if (v.dir === 'up') { for (let y = v.y - 1; y >= 0; y--) if (S.grid[y][v.x]) return false; }
  else if (v.dir === 'down') { for (let y = v.y + v.len; y < S.rows; y++) if (S.grid[y][v.x]) return false; }
  else if (v.dir === 'left') { for (let x = v.x - 1; x >= 0; x--) if (S.grid[v.y][x]) return false; }
  else { for (let x = v.x + v.len; x < S.cols; x++) if (S.grid[v.y][x]) return false; }
  return true;
}

function unstamp(v) {
  for (let i = 0; i < v.len; i++) {
    const x = v.orient === 'h' ? v.x + i : v.x;
    const y = v.orient === 'v' ? v.y + i : v.y;
    S.grid[y][x] = 0;
  }
}

function onBoardTap(ev) {
  if (S.screen !== 'playing' || S.over) return;
  const rect = canvas.getBoundingClientRect();
  const px = ev.clientX - rect.left;
  const py = ev.clientY - rect.top;
  const v = vehicleAt(px, py);
  if (!v) return;
  Sfx.unlock();
  if (S.selectMode === 'clear') { doVacuum(v); return; }
  tryMove(v);
}

function tryMove(v) {
  if (S.parked.length >= activeSlots()) {
    toast(t('slotsFull'));
    Sfx.blocked();
    checkLose();
    return;
  }
  if (!pathClear(v)) {
    S.anims.push({ type: 'bump', veh: v, vec: dirVec(v.dir), start: performance.now(), dur: 260 });
    Sfx.blocked();
    return;
  }
  // exits the board
  unstamp(v);
  S.vehicles.delete(v.id);
  const vec = dirVec(v.dir);
  let dist;
  if (v.dir === 'up') dist = v.y + v.len + 1;
  else if (v.dir === 'down') dist = S.rows - v.y + 1;
  else if (v.dir === 'left') dist = v.x + v.len + 1;
  else dist = S.cols - v.x + 1;
  const dur = Math.min(700, 120 + dist * 55);
  S.anims.push({ type: 'exit', veh: Object.assign({}, v), vec, dist, start: performance.now(), dur });
  Sfx.exit();
  const slot = { id: v.id, color: v.color, cap: capacityOf(v.len), remaining: capacityOf(v.len), arrived: false };
  S.parked.push(slot);
  renderSlots();
  setTimeout(() => { slot.arrived = true; renderSlots(); }, dur);
}

// ───────────────────────── slots & queue UI ─────────────────────────
function renderSlots() {
  const box = $('slots');
  box.innerHTML = '';
  const n = activeSlots();
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'slot';
    const p = S.parked[i];
    if (p) {
      const pal = PALETTE[p.color];
      d.classList.add('full');
      if (!p.arrived) d.classList.add('arriving');
      d.innerHTML = '<div class="slot-bus" style="background:linear-gradient(180deg,' + pal.light + ',' + pal.main + ' 40%,' + pal.dark + ')">🚌<span class="slot-count">' + p.remaining + '</span></div>';
    }
    box.appendChild(d);
  }
  // locked extra slot (rewarded ad)
  if (S.extraSlots === 0) {
    const d = document.createElement('div');
    d.className = 'slot locked';
    d.innerHTML = '<span class="slot-ad">📺</span>';
    d.title = t('unlockSlot');
    d.addEventListener('click', () => {
      Ads.rewarded('extra_slot', ok => {
        if (ok) { S.extraSlots = 1; Sfx.boost(); renderSlots(); toast(t('unlockSlot') + ' ✓'); }
        else toast(t('adFail'));
      });
    });
    box.appendChild(d);
  }
}

function renderQueue() {
  const box = $('queue');
  box.innerHTML = '';
  const maxShow = 12;
  const show = S.queue.slice(0, maxShow);
  show.forEach((colorIdx, i) => {
    const pal = PALETTE[colorIdx];
    const d = document.createElement('div');
    d.className = 'person' + (i === 0 ? ' front' : '');
    d.style.background = 'linear-gradient(180deg,' + pal.light + ',' + pal.main + ')';
    d.style.borderColor = pal.dark;
    box.appendChild(d);
  });
  if (S.queue.length > maxShow) {
    const d = document.createElement('div');
    d.className = 'person more';
    d.textContent = '+' + (S.queue.length - maxShow);
    box.appendChild(d);
  }
}

// ───────────────────────── boarding pump ─────────────────────────
setInterval(() => {
  if (S.screen !== 'playing' || S.over) return;
  if (!S.queue.length) { checkWin(); return; }
  const c = S.queue[0];
  const bus = S.parked.find(b => b.arrived && b.remaining > 0 && b.color === c);
  if (bus) {
    S.queue.shift();
    bus.remaining--;
    Sfx.board();
    if (bus.remaining === 0) departBus(bus);
    renderQueue();
    renderSlots();
    updateHud();
    if (!S.queue.length) checkWin();
  } else {
    checkLose();
  }
}, 150);

function departBus(bus) {
  Sfx.depart();
  const i = S.parked.indexOf(bus);
  if (i >= 0) S.parked.splice(i, 1);
}

// ───────────────────────── win / lose ─────────────────────────
function hasExitAnims() {
  const now = performance.now();
  return S.anims.some(a => a.type === 'exit' && now - a.start < a.dur);
}

function checkWin() {
  if (S.over || S.queue.length) return;
  S.over = true;
  S.parked = [];
  renderSlots();
  const reward = 100 + Math.min(100, S.level * 3);
  S.coins += reward;
  S.level++;
  persist();
  updateHud();
  Sfx.win();
  $('modal-title').textContent = t('win');
  $('modal-body').innerHTML = '<div class="win-emoji">🚌💨</div><p>' + t('winMsg') + '</p><p class="reward">+' + reward + ' 🪙</p>';
  $('modal-buttons').innerHTML = '';
  addModalBtn(t('next') + ' ▶', 'btn-primary', () => {
    closeModal();
    // interstitial between levels
    Ads.interstitial('next_level', () => startLevel(S.level));
  });
  addModalBtn(t('home'), 'btn-soft', () => { closeModal(); goHome(); });
  showModal();
}

function checkLose() {
  if (S.over) return;
  if (S.parked.length < activeSlots()) return;
  if (!S.parked.every(b => b.arrived)) return;
  if (hasExitAnims()) return;
  const front = S.queue[0];
  if (front != null && S.parked.some(b => b.remaining > 0 && b.color === front)) return;
  S.over = true;
  Sfx.lose();
  $('modal-title').textContent = t('lose');
  $('modal-body').innerHTML = '<div class="win-emoji">🚧</div><p>' + t('loseMsg') + '</p>';
  $('modal-buttons').innerHTML = '';
  addModalBtn(t('continueAd'), 'btn-primary', () => {
    Ads.rewarded('continue', ok => {
      if (ok) reviveWithExtraSlot();
      else toast(t('adFail'));
    });
  });
  addModalBtn(t('continueCoins', CONTINUE_COST), 'btn-soft', () => {
    if (S.coins < CONTINUE_COST) { toast(t('notEnoughCoins')); return; }
    S.coins -= CONTINUE_COST;
    persist();
    reviveWithExtraSlot();
  });
  addModalBtn(t('retry'), 'btn-soft', () => { closeModal(); startLevel(S.level); });
  addModalBtn(t('home'), 'btn-soft', () => { closeModal(); goHome(); });
  showModal();
}

function reviveWithExtraSlot() {
  closeModal();
  S.over = false;
  S.extraSlots++;
  Sfx.boost();
  renderSlots();
  updateHud();
}

function goHome() {
  setScreen('home');
  renderHome();
  updateHud();
}

// ───────────────────────── boosters ─────────────────────────
function updateBoosterBadges() {
  for (const k of ['refresh', 'clear', 'sort']) {
    const badge = $('b-' + k).querySelector('.b-badge');
    const n = S.boosters[k];
    badge.textContent = n > 0 ? n : '+';
    badge.classList.toggle('plus', n <= 0);
  }
}

function useBooster(kind) {
  if (S.screen !== 'playing' || S.over) return;
  if (S.boosters[kind] > 0) {
    S.boosters[kind]--;
    persist();
    updateBoosterBadges();
    runBooster(kind);
    return;
  }
  // out of stock: watch an ad or buy with coins
  $('modal-title').textContent = t('getBooster');
  $('modal-body').innerHTML = '<div class="win-emoji">' + ({ refresh: '🔄', clear: '🧹', sort: '🧲' }[kind]) + '</div><p>' + t(kind) + '</p>';
  $('modal-buttons').innerHTML = '';
  addModalBtn(t('watchAd'), 'btn-primary', () => {
    closeModal();
    Ads.rewarded('booster_' + kind, ok => {
      if (ok) { toast(t('rewardBooster')); Sfx.boost(); runBooster(kind); }
      else toast(t('adFail'));
    });
  });
  addModalBtn(t('buyCoins', BOOSTER_COST[kind]), 'btn-soft', () => {
    if (S.coins < BOOSTER_COST[kind]) { toast(t('notEnoughCoins')); return; }
    S.coins -= BOOSTER_COST[kind];
    persist();
    updateHud();
    closeModal();
    runBooster(kind);
  });
  addModalBtn(t('cancel'), 'btn-soft', closeModal);
  showModal();
}

function runBooster(kind) {
  if (kind === 'refresh') {
    const vehs = Array.from(S.vehicles.values());
    if (!vehs.length) return;
    const placed = reshuffleVehicles(vehs, S.rows, S.cols, S.rngPlay);
    if (!placed) { toast('!'); return; }
    S.grid = emptyGrid(S.rows, S.cols);
    S.vehicles = new Map();
    for (const v of placed) {
      S.vehicles.set(v.id, v);
      stampVehicle(S.grid, v, v.id);
    }
    Sfx.boost();
  } else if (kind === 'clear') {
    if (!S.vehicles.size) return;
    S.selectMode = 'clear';
    $('select-hint').classList.remove('hidden');
    $('select-hint-text').textContent = t('pickBus');
  } else if (kind === 'sort') {
    // bring passengers matching parked buses (with capacity) to the front
    const need = {};
    for (const b of S.parked) {
      if (b.remaining > 0) need[b.color] = (need[b.color] || 0) + b.remaining;
    }
    const front = [];
    const rest = [];
    for (const c of S.queue) {
      if (need[c] > 0) { need[c]--; front.push(c); }
      else rest.push(c);
    }
    S.queue = front.concat(rest);
    renderQueue();
    Sfx.boost();
  }
}

function doVacuum(v) {
  S.selectMode = null;
  $('select-hint').classList.add('hidden');
  unstamp(v);
  S.vehicles.delete(v.id);
  S.anims.push({ type: 'vacuum', veh: Object.assign({}, v), start: performance.now(), dur: 450 });
  // remove this bus's passengers from the BACK of the queue (keeps the level
  // winnable: total passengers of each color still equals total seats)
  let toRemove = capacityOf(v.len);
  for (let i = S.queue.length - 1; i >= 0 && toRemove > 0; i--) {
    if (S.queue[i] === v.color) { S.queue.splice(i, 1); toRemove--; }
  }
  Sfx.boost();
  renderQueue();
  updateHud();
  if (!S.queue.length) checkWin();
}

function cancelSelect() {
  if (S.selectMode) {
    S.selectMode = null;
    $('select-hint').classList.add('hidden');
    S.boosters.clear++; // give it back, nothing was used
    persist();
    updateBoosterBadges();
  }
}

// ───────────────────────── free gift (rewarded) ─────────────────────────
function openGift() {
  $('modal-title').textContent = t('freeGift');
  $('modal-body').innerHTML = '<div class="win-emoji">🎁</div><p>' + t('giftMsg', GIFT_COINS) + '</p>';
  $('modal-buttons').innerHTML = '';
  addModalBtn(t('watchAd'), 'btn-primary', () => {
    closeModal();
    Ads.rewarded('gift_coins', ok => {
      if (ok) {
        S.coins += GIFT_COINS;
        persist();
        updateHud();
        Sfx.coin();
        toast(t('rewardCoins', GIFT_COINS));
      } else toast(t('adFail'));
    });
  });
  addModalBtn(t('cancel'), 'btn-soft', closeModal);
  showModal();
}

// ───────────────────────── boot ─────────────────────────
window.addEventListener('load', () => {
  Sfx.setMuted(!S.sound);
  Ads.init();
  renderHome();
  updateHud();
  $('btn-play').addEventListener('click', () => { Sfx.unlock(); Sfx.tap(); startLevel(S.level); });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-settings-game').addEventListener('click', openSettings);
  $('btn-gift').addEventListener('click', openGift);
  $('btn-home').addEventListener('click', goHome);
  $('b-refresh').addEventListener('click', () => useBooster('refresh'));
  $('b-clear').addEventListener('click', () => useBooster('clear'));
  $('b-sort').addEventListener('click', () => useBooster('sort'));
  $('cancel-select').addEventListener('click', cancelSelect);
  $('board').addEventListener('pointerdown', onBoardTap);
  window.addEventListener('resize', () => { if (S.screen === 'playing') sizeCanvas(); });
  requestAnimationFrame(loop);
});
