/* 2048 for Playbox. Sections: LOGIC (pure, exported, testable) · UI (DOM rendering) · INPUT · BOOT. */
import * as sdk from '../../assets/js/sdk.js';

const ID = '2048', N = 4, WIN = 2048, SLIDE = 120;
export const DIRS = ['up', 'right', 'down', 'left'];

/* ============================ LOGIC (pure) ============================ */
/** Cell index of the k-th cell (from the leading edge) of line i when moving in direction d. */
const cell = (d, i, k) => (d === 0 ? k : d === 2 ? N - 1 - k : i) * N + (d === 3 ? k : d === 1 ? N - 1 - k : i);

export const spawn = (g, rnd = Math.random) => {
  const e = []; g.forEach((v, i) => v || e.push(i));
  if (!e.length) return null;
  const idx = e[Math.floor(rnd() * e.length)], v = rnd() < 0.9 ? 2 : 4, grid = g.slice();
  grid[idx] = v;
  return { grid, idx, v };
};
export const startGrid = (rnd) => spawn(spawn(Array(16).fill(0), rnd).grid, rnd).grid;

/** Slide + merge. Each tile merges at most once per move. trace: one {from,to,merged} per moved tile (for animation). */
export function move(g, d) {
  const grid = Array(16).fill(0), trace = [];
  let score = 0;
  for (let i = 0; i < N; i++) {
    const out = [];
    for (let k = 0; k < N; k++) {
      const s = cell(d, i, k), v = g[s];
      if (!v) continue;
      const l = out[out.length - 1];
      if (l && l.v === v && !l.m) { l.v *= 2; l.m = 1; l.s.push(s); score += l.v; } else out.push({ v, m: 0, s: [s] });
    }
    out.forEach((t, j) => { const to = cell(d, i, j); grid[to] = t.v; t.s.forEach((from) => trace.push({ from, to, merged: !!t.m })); });
  }
  return { grid, score, moved: grid.some((v, i) => v !== g[i]), trace };
}

export const canMove = (g) => g.includes(0) || g.some((v, i) => (i % N < N - 1 && v === g[i + 1]) || (i < 12 && v === g[i + N]));

/** A full turn: move, then spawn one tile only if the move changed something. */
export function step(g, d, rnd) {
  const m = move(g, d);
  if (!m.moved) return { ...m, slid: m.grid, spawn: null };
  const sp = spawn(m.grid, rnd);
  return { ...m, slid: m.grid, grid: sp.grid, spawn: { idx: sp.idx, v: sp.v } };
}

/** Run with ?test or `__selfTest()` in the console. */
export function selfTest() {
  const seq = (...a) => { let i = 0; return () => a[i++ % a.length]; };
  const pad = (row) => [...row, ...Array(12).fill(0)];
  const r1 = move(pad([2, 2, 2, 2]), 3), r2 = move(pad([2, 2, 4, 0]), 3);
  const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
  const noop = step(pad([2, 4, 8, 16]), 3, seq(0.5)), valid = step(pad([0, 2, 0, 0]), 3, seq(0.5, 0.5));
  const cases = [
    ['merges once per move: [2,2,2,2] ← → [4,4,0,0], +8', r1.grid.slice(0, 4).join() === '4,4,0,0' && r1.score === 8],
    ['no double merge: [2,2,4,0] ← → [4,4,0,0], +4', r2.grid.slice(0, 4).join() === '4,4,0,0' && r2.score === 4],
    ['full grid with no merges is game over', !canMove(full) && canMove(pad([2, 2]))],
    ['no-op move is ignored (moved=false, no score)', !noop.moved && noop.score === 0],
    ['spawn only on valid move', noop.spawn === null && valid.moved && valid.spawn !== null && valid.grid.filter(Boolean).length === 2],
  ];
  cases.forEach(([n, ok]) => console[ok ? 'log' : 'error'](`${ok ? '✓' : '✗'} ${n}`));
  const pass = cases.filter((c) => c[1]).length;
  console.log(`2048 self-test: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}
window.__selfTest = selfTest;
if (location.search.includes('test')) selfTest();

/* ============================ UI ============================ */
const $ = (s) => document.querySelector(s);
const [board, tilesEl, scoreEl, bestEl, live, ov, undoBtn] = ['#board', '#tiles', '#score', '#best', '#live', '#ov', '#undo'].map($);
const fmt = (n) => n.toLocaleString();
const reduced = () => sdk.getSettings().reducedMotion;
const tone = (f, d, t, v) => sdk.tone(f, d, t, v);

let st, best = sdk.getBest(ID) || 0, tiles = Array(16).fill(null), paused = false, busy = false, queued = null, ovKind = null;

const say = (m) => { live.textContent = ''; setTimeout(() => (live.textContent = m), 30); };
const pos = (el, i) => { el.style.setProperty('--r', i >> 2); el.style.setProperty('--c', i & 3); };
function place(el, i, v) {
  pos(el, i);
  el.dataset.v = v; el.dataset.d = String(v).length; el.classList.toggle('hi', v >= 128);
  el.style.setProperty('--t', Math.min(Math.log2(v) - 1, 12));
  el.setAttribute('aria-label', `${v}, row ${(i >> 2) + 1}, column ${(i & 3) + 1}`);
  el.setAttribute('aria-rowindex', (i >> 2) + 1); el.setAttribute('aria-colindex', (i & 3) + 1);
}
function mk(i, v, cls = '') {
  const el = document.createElement('div'), t = document.createElement('div');
  el.className = 'tile ' + cls; el.setAttribute('role', 'gridcell'); t.className = 'tile__in'; t.textContent = v;
  el.append(t); place(el, i, v); tilesEl.append(el);
  return el;
}
function renderAll() {
  tiles.forEach((t) => t && t.remove());
  tiles = st.grid.map((v, i) => (v ? mk(i, v) : null));
}
function hud() {
  best = Math.max(best, st.score);
  scoreEl.textContent = fmt(st.score); bestEl.textContent = fmt(best);
  undoBtn.disabled = !st.prev || busy;
}
function float(n) {
  if (reduced()) return;
  const s = document.createElement('span'); s.className = 'float'; s.textContent = '+' + fmt(n);
  scoreEl.parentElement.append(s); setTimeout(() => s.remove(), 750);
}
const persist = () => sdk.save(ID, { grid: st.grid, score: st.score, prev: st.prev, keep: st.keep, over: st.over });
const pitch = (v) => 260 + Math.log2(v) * 48;

/* ---------- overlays ---------- */
function showOv(kind, isNew) {
  ovKind = kind;
  const c = {
    win: ['You reached 2048!', `Score ${fmt(st.score)}`, [['Keep going', 'keep', 1], ['New game', 'new']]],
    over: ['Game over', `Best ${fmt(best)}`, [['Try again', 'new', 1], ['Back to hub', 'exit']]],
    confirm: ['Start a new game?', 'Your current game will be lost.', [['New game', 'new', 1], ['Cancel', 'close']]],
  }[kind];
  ov.innerHTML = `<h2 id="ov-title">${c[0]}</h2>${kind === 'over' ? `${isNew ? '<span class="badge">New best!</span>' : ''}<div class="big">${fmt(st.score)}</div>` : ''}<p>${c[1]}</p>
    <div class="row">${c[2].map(([l, a, p]) => `<button class="btn${p ? ' btn--primary' : ''}" data-a="${a}">${l}</button>`).join('')}</div>`;
  ov.hidden = false; ov.querySelector('button').focus();
  say(kind === 'over' ? `Game over. Score ${fmt(st.score)}` : c[0]);
}
function hideOv() { ovKind = null; ov.hidden = true; board.focus({ preventScroll: true }); }
ov.addEventListener('click', (e) => {
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'exit') return leave();
  hideOv();
  if (a === 'keep') { st.keep = true; persist(); }
  if (a === 'new') newGame();
});

/* ---------- game flow ---------- */
function newGame() {
  st = { grid: startGrid(), score: 0, prev: null, keep: false, over: false };
  busy = false; queued = null;
  renderAll(); hud(); persist(); say('New game');
}
const askNew = () => (st.score === 0 || st.over ? newGame() : showOv('confirm'));

function undo() {
  if (busy || paused || ovKind || !st.prev) return;
  st.grid = st.prev.grid; st.score = st.prev.score; st.prev = null; st.over = false;
  renderAll(); hud(); persist(); sdk.haptic('light'); tone(300, 0.06); say(`Undone, score ${fmt(st.score)}`);
}

function gameOver() {
  st.over = true; persist();
  const r = sdk.saveScore(ID, st.score);
  best = Math.max(best, r.best);
  sdk.haptic('heavy'); [330, 247, 185].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle'), i * 140));
  showOv('over', r.isNew && st.score > 0); hud();
}

function doMove(d) {
  if (paused || ovKind || st.over) return;
  if (busy) { queued = d; return; }
  const r = step(st.grid, d);
  if (!r.moved) return;
  busy = true;
  st.prev = { grid: st.grid, score: st.score };
  st.grid = r.grid; st.score += r.score;
  const next = Array(16).fill(null), groups = {};
  r.trace.forEach(({ from, to, merged }) => { const el = tiles[from]; pos(el, to); merged ? (groups[to] ||= []).push(el) : (next[to] = el); });

  const fin = () => {
    let top = 0;
    for (const to in groups) { groups[to].forEach((e) => e.remove()); next[to] = mk(+to, r.slid[to], 'merge'); top = Math.max(top, r.slid[to]); }
    next[r.spawn.idx] = mk(r.spawn.idx, r.spawn.v, 'new');
    next.forEach((e, i) => e && place(e, i, st.grid[i]));
    tiles = next; busy = false;
    hud(); persist();
    if (r.score) { float(r.score); sdk.haptic('medium'); tone(pitch(top), 0.1, 'triangle'); } else { sdk.haptic('light'); tone(200, 0.04, 'sine', 0.035); }
    say(`Moved ${DIRS[d]}, score ${fmt(st.score)}`);
    if (top >= WIN && !st.keep) {
      sdk.haptic('heavy'); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle'), i * 100));
      persist(); showOv('win');
    } else if (!canMove(st.grid)) gameOver();
    else if (queued != null) { const q = queued; queued = null; doMove(q); }
  };
  reduced() ? fin() : setTimeout(fin, SLIDE);
}

function leave() {
  if (st.score > 0) sdk.saveScore(ID, st.score);
  sdk.exit();
}

/* ============================ INPUT ============================ */
const KEYS = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 };
let unlocked = false;
const unlock = () => { if (!unlocked) { unlocked = true; tone(200, 0.001, 'sine', 0.0001); } }; // creates/resumes AudioContext inside a user gesture

addEventListener('keydown', (e) => {
  unlock();
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'Escape') { e.preventDefault(); return ovKind === 'confirm' ? hideOv() : leave(); }
  if (ovKind) return;
  if (k in KEYS) { e.preventDefault(); doMove(KEYS[k]); }
  else if (k === 'z') undo();
  else if (k === 'r') askNew();
});

let p = null; // swipe: Pointer Events, fires once the dominant axis passes 24px
addEventListener('pointerdown', (e) => { unlock(); if (!e.target.closest('button, #ov')) p = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
addEventListener('pointermove', (e) => {
  if (!p || e.pointerId !== p.id) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  p = null; doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0);
});
['pointerup', 'pointercancel'].forEach((t) => addEventListener(t, () => (p = null)));

$('#back').onclick = leave;
$('#new').onclick = askNew;
undoBtn.onclick = undo;
sdk.onPause(() => { paused = true; queued = null; document.body.classList.add('is-paused'); });
sdk.onResume(() => { paused = false; document.body.classList.remove('is-paused'); });
addEventListener('pagehide', () => st && st.score > 0 && sdk.saveScore(ID, st.score));

/* ============================ BOOT ============================ */
const saved = sdk.load(ID);
if (saved && Array.isArray(saved.grid) && saved.grid.length === 16 && saved.grid.every(Number.isInteger) && !saved.over && canMove(saved.grid)) {
  st = { grid: saved.grid, score: saved.score | 0, prev: saved.prev || null, keep: !!saved.keep, over: false };
  renderAll(); hud();
  const t = $('#toast'); t.textContent = 'Resumed your game'; t.hidden = false; setTimeout(() => (t.hidden = true), 2200);
  say(`Resumed your game, score ${fmt(st.score)}`);
} else newGame();
board.focus({ preventScroll: true });
