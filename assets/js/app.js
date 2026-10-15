/* Playbox hub — router, rendering, state. No dependencies. */
import * as sdk from './sdk.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main'), header = $('#header'), live = $('#live'), toastEl = $('#toast');
const detail = $('#detail'), settings = $('#settings');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (d, fill = 'none') => `<svg viewBox="0 0 24 24" width="24" height="24" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  heart: svg('<path d="M20.8 5.6a5.2 5.2 0 0 0-7.4 0L12 7l-1.4-1.4a5.2 5.2 0 0 0-7.4 7.4L12 21.8l8.8-8.8a5.2 5.2 0 0 0 0-7.4z"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  play: svg('<path d="M7 4.5v15l12-7.5z"/>'),
  soundOn: svg('<path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'),
  soundOff: svg('<path d="M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6"/>'),
  full: svg('<path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
};

const FILTERS = [['all', 'All'], ['1', '1 player'], ['2', '2 players'], ['online', 'Online'], ['fav', 'Favorites']];
const S = { games: [], q: '', filter: 'all', dirty: false };
let playing = null;

/* ---------- helpers ---------- */
const byId = (id) => S.games.find((g) => g.id === id);
const isReady = (g) => g.status === 'ready';
const fmt = (n) => (n == null ? '–' : Number(n).toLocaleString());
const players = (g) => (g.players === '1' ? '1 player' : g.players);
const go = (h) => { location.hash = h; };
const IMG = /\.(png|jpe?g|webp|avif|svg|gif)(\?.*)?$/i;
const icon = (g) => (String(g.icon).trim().startsWith('<svg') ? g.icon : `<span aria-hidden="true">${esc(g.icon)}</span>`);
const coverBg = (g) => (IMG.test(g.cover) ? `background:${esc(g.accentColor)}` : `background:${esc(g.cover)}`);
const coverImg = (g) => (IMG.test(g.cover) ? `<img class="card__img" src="${esc(g.cover)}" alt="" loading="lazy" decoding="async">` : '');
const vt = (fn) => (document.startViewTransition && !sdk.getSettings().reducedMotion ? document.startViewTransition(fn) : fn());

function announce(msg) {
  live.textContent = '';
  setTimeout(() => (live.textContent = msg), 50);
  document.title = msg === 'Home' ? 'Playbox — games hub' : `${msg} · Playbox`;
}
let toastT;
function toast(msg) {
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (toastEl.hidden = true), 3200);
}
function themeColor() {
  const m = $('meta[name="theme-color"]');
  m.removeAttribute('media');
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
}

/* ---------- home ---------- */
const favBtn = (g) => {
  const on = sdk.isFavorite(g.id);
  return `<button class="fav" data-fav="${esc(g.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove' : 'Add'} ${esc(g.title)} ${on ? 'from' : 'to'} favorites">${I.heart}</button>`;
};

function card(g, i) {
  const soon = !isReady(g);
  return `<article class="card${soon ? ' is-soon' : ''}" style="--accent:${esc(g.accentColor)};--i:${Math.min(i, 12)}">
    <div class="card__cover" style="${coverBg(g)}">${coverImg(g)}<span class="card__icon">${icon(g)}</span>${soon ? '<span class="badge">Coming soon</span>' : ''}</div>
    <div class="card__body">
      <div class="card__row"><h3 class="card__title"><a class="card__link" href="#/game/${esc(g.id)}">${esc(g.title)}</a></h3>${favBtn(g)}</div>
      <p class="card__tag">${esc(g.tagline)}</p>
      <div class="card__meta"><span class="chip chip--static">${esc(players(g))}</span>${soon ? '' : `<span class="best">Best <b>${fmt(sdk.getBest(g.id))}</b></span>`}</div>
    </div></article>`;
}

function hero(g) {
  return `<section class="hero" style="--accent:${esc(g.accentColor)}" aria-label="Featured game">
    <div class="hero__cover" style="${coverBg(g)}"><div class="hero__icon">${icon(g)}</div></div>
    <div class="hero__body"><span class="eyebrow">Featured</span><h2 class="hero__title">${esc(g.title)}</h2><p class="hero__tag">${esc(g.tagline)}</p>
      <div class="hero__actions">${isReady(g) ? `<a class="btn btn--primary btn--lg" href="#/game/${esc(g.id)}/play">${I.play} Play now</a>` : ''}<a class="btn btn--ghost btn--lg" href="#/game/${esc(g.id)}">Details</a></div>
    </div></section>`;
}

function renderHome() {
  const y = scrollY;
  const feat = S.games.find((g) => g.featured && isReady(g)) || S.games.find(isReady) || S.games[0];
  const recent = sdk.getRecent().map(byId).filter((g) => g && isReady(g)).slice(0, 6);
  main.innerHTML = `<div class="wrap stack"><h1 class="sr-only">Playbox games hub</h1>
    ${feat ? hero(feat) : ''}
    ${recent.length ? `<section aria-labelledby="h-cont"><h2 class="section-title" id="h-cont">Continue playing</h2><ul class="row">${recent.map((g) => `<li><a class="mini" style="--accent:${esc(g.accentColor)}" href="#/game/${esc(g.id)}/play"><span class="mini__icon">${icon(g)}</span><span><b>${esc(g.title)}</b><small>Best ${fmt(sdk.getBest(g.id))}</small></span></a></li>`).join('')}</ul></section>` : ''}
    <section aria-labelledby="h-all"><div class="section-head"><h2 id="h-all">All games</h2><span class="count" id="count" aria-live="polite"></span></div>
      <div class="toolbar"><label class="search"><span class="sr-only">Search games</span>${I.search}<input id="q" type="search" placeholder="Search games  ( / )" autocomplete="off" value="${esc(S.q)}"></label>
      <div class="chips" role="group" aria-label="Filter games">${FILTERS.map(([k, l]) => `<button class="chip" data-filter="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join('')}</div></div>
      <div class="grid" id="grid"></div></section></div>`;
  renderGrid();
  scrollTo(0, y);
}

function renderGrid() {
  const q = S.q.trim().toLowerCase();
  const list = S.games.filter((g) => {
    const f = S.filter;
    const okF = f === 'all' || (f === '1' && g.players === '1') || (f === '2' && g.players.startsWith('2')) || (f === 'online' && g.players === '2 online') || (f === 'fav' && sdk.isFavorite(g.id));
    return okF && (!q || [g.title, g.tagline, ...g.tags].join(' ').toLowerCase().includes(q));
  });
  $('#count').textContent = `${list.length} ${list.length === 1 ? 'game' : 'games'}`;
  $('#grid').innerHTML = list.length ? list.map(card).join('') : `<div class="empty"><div class="empty__art" aria-hidden="true">${S.filter === 'fav' && !S.q ? '♡' : '🔍'}</div>
    <h3>${S.filter === 'fav' && !S.q ? 'No favorites yet' : 'No games found'}</h3>
    <p>${S.filter === 'fav' && !S.q ? 'Tap the heart on any game to pin it here.' : 'Try a different search or filter.'}</p>
    <button class="btn" data-clear>Clear filters</button></div>`;
  document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === S.filter));
}

function ensureHome() {
  if (!$('#grid') || S.dirty) { renderHome(); S.dirty = false; }
}

/* ---------- dialogs ---------- */
function closeDialogs(keep) { [detail, settings].forEach((d) => d !== keep && d.open && d.close()); }
function showDialog(d) { closeDialogs(d); if (!d.open) d.showModal(); }
[detail, settings].forEach((d) => {
  d.addEventListener('cancel', (e) => { e.preventDefault(); go('#/'); });
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) go('#/'); });
});

function openDetail(g) {
  const soon = !isReady(g);
  detail.style.setProperty('--accent', g.accentColor);
  detail.setAttribute('aria-labelledby', 'd-title');
  const how = [].concat(g.howTo || []);
  detail.innerHTML = `<div class="sheet__grab" aria-hidden="true"></div>
    <div class="sheet__cover" style="${coverBg(g)}">${coverImg(g)}<span class="card__icon">${icon(g)}</span>
      <button class="icon-btn sheet__close" data-close aria-label="Close">${I.close}</button></div>
    <div class="sheet__body">
      <div><h2 class="sheet__title" id="d-title">${esc(g.title)}</h2><p class="sheet__tag">${esc(g.tagline)}</p></div>
      <div class="sheet__meta"><span class="chip chip--static">${esc(players(g))}</span>${g.tags.map((t) => `<span class="chip chip--static">${esc(t)}</span>`).join('')}${favBtn(g)}</div>
      <p>${esc(g.description)}</p>
      ${how.length ? `<div><h3>How to play</h3><ul>${how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}
      ${soon ? '' : `<div class="stat"><span>Personal best</span><b>${fmt(sdk.getBest(g.id))}</b></div>`}
    </div>
    <div class="sheet__actions">${soon ? '<span class="btn btn--primary btn--lg" aria-disabled="true" role="button">Coming soon</span>' : `<a class="btn btn--primary btn--lg" href="#/game/${esc(g.id)}/play" id="d-play">${I.play} Play</a>`}</div>`;
  showDialog(detail);
}

const toggleRow = (name, title, sub, on) => `<label class="toggle"><span class="toggle__text"><b>${title}</b><small>${sub}</small></span><input type="checkbox" role="switch" name="${name}" ${on ? 'checked' : ''}><span class="toggle__ui" aria-hidden="true"></span></label>`;

function openSettings() {
  const s = sdk.getSettings();
  settings.setAttribute('aria-labelledby', 's-title');
  settings.innerHTML = `<div class="sheet__grab" aria-hidden="true"></div>
    <div class="sheet__head"><h2 id="s-title">Settings</h2><button class="icon-btn" data-close aria-label="Close settings">${I.close}</button></div>
    <div class="sheet__body">
      <fieldset class="seg-wrap" style="border:0;padding:0"><legend class="sr-only">Theme</legend><b aria-hidden="true">Theme</b>
        <div class="seg">${['system', 'light', 'dark'].map((v) => `<label><input type="radio" name="theme" value="${v}" ${s.theme === v ? 'checked' : ''}><span>${v[0].toUpperCase() + v.slice(1)}</span></label>`).join('')}</div></fieldset>
      <div>${toggleRow('sound', 'Sound', 'Game sound effects', s.sound)}${toggleRow('haptics', 'Haptics', 'Vibration feedback on supported phones', s.haptics)}${toggleRow('reducedMotion', 'Reduce motion', 'Fewer animations and transitions', s.reducedMotion)}</div>
      <div class="danger"><button class="btn btn--danger btn--block" id="reset">Reset all data</button><p>Deletes scores, saves, favorites and settings on this device.</p></div>
    </div>`;
  showDialog(settings);
}

settings.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'theme') sdk.setSettings({ theme: t.value });
  else if (t.name) sdk.setSettings({ [t.name]: t.checked });
});
let resetT;
settings.addEventListener('click', (e) => {
  const b = e.target.closest('#reset');
  if (!b) return;
  if (!b.dataset.armed) {
    b.dataset.armed = 1; b.textContent = 'Tap again to confirm';
    resetT = setTimeout(() => { delete b.dataset.armed; b.textContent = 'Reset all data'; }, 3500);
    return;
  }
  clearTimeout(resetT); sdk.resetAll(); S.dirty = true; S.filter = 'all'; S.q = '';
  toast('All data cleared'); go('#/');
});

/* ---------- game view ---------- */
function gameError(P, msg) {
  P.el.querySelector('.play__state').innerHTML = `<div class="empty__art" aria-hidden="true">${navigator.onLine ? '⚠️' : '📡'}</div><h2>Couldn’t load ${esc(P.g.title)}</h2><p>${msg}</p>
    <div class="hero__actions"><button class="btn btn--primary" data-retry>Try again</button><a class="btn" href="#/">Back to hub</a></div>`;
}

async function loadGame(P) {
  P.el.querySelector('.play__state').innerHTML = '<div class="spinner" role="status" aria-label="Loading game"></div>';
  const url = `games/${P.g.id}/index.html?accent=${encodeURIComponent(P.g.accentColor)}&v=${encodeURIComponent(P.g.version || '1')}`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    if (playing !== P) return;
    const f = document.createElement('iframe');
    f.className = 'play__frame'; f.title = P.g.title; f.allow = 'fullscreen; autoplay; gamepad; accelerometer; gyroscope';
    f.addEventListener('load', () => { f.classList.add('is-ready'); P.el.querySelector('.play__state').hidden = true; f.focus(); });
    f.src = url; P.frame = f; P.el.prepend(f);
  } catch {
    if (playing === P) gameError(P, navigator.onLine ? 'The game files are missing or broken. Please try again.' : 'You’re offline and this game hasn’t been cached yet. Reconnect and try again.');
  }
}

function openPlay(g) {
  if (playing && playing.g.id === g.id) return;
  closePlay();
  sdk.markPlayed(g.id); S.dirty = true;
  main.inert = header.inert = true;
  const el = document.createElement('div');
  el.className = 'play'; el.style.setProperty('--accent', g.accentColor);
  el.innerHTML = `<div class="play__state" role="status"></div>
    <button class="play__grab" aria-label="Show controls"></button>
    <div class="bar" role="toolbar" aria-label="Game controls">
      <a class="icon-btn" href="#/" aria-label="Back to hub">${I.back}</a>
      <span class="bar__title">${esc(g.title)}</span>
      <button class="icon-btn" data-act="pause" aria-label="Pause">${I.pause}</button>
      <button class="icon-btn" data-act="sound" aria-label="Sound" aria-pressed="true"></button>
      <button class="icon-btn" data-act="full" aria-label="Fullscreen" ${document.fullscreenEnabled ? '' : 'hidden'}>${I.full}</button>
    </div>`;
  document.body.append(el);
  const P = (playing = { g, el, frame: null, paused: false, t: 0 });

  const show = () => {
    el.classList.remove('bar-hidden'); clearTimeout(P.t);
    if (!P.paused) P.t = setTimeout(() => { if (!$('.bar:hover, .bar:focus-within', el)) el.classList.add('bar-hidden'); else show(); }, 2800);
  };
  const syncSound = () => {
    const on = sdk.getSettings().sound, b = $('[data-act="sound"]', el);
    b.innerHTML = on ? I.soundOn : I.soundOff; b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
  };
  P.setPaused = (on) => {
    P.paused = on;
    P.frame?.contentWindow?.postMessage({ pb: on ? 'pause' : 'resume' }, location.origin);
    const b = $('[data-act="pause"]', el);
    b.innerHTML = on ? I.play : I.pause; b.setAttribute('aria-label', on ? 'Resume' : 'Pause');
    $('.pause', el)?.remove();
    if (on) {
      el.insertAdjacentHTML('beforeend', `<div class="pause" role="dialog" aria-label="Paused"><h2>Paused</h2><button class="btn btn--primary btn--lg" data-act="pause">${I.play} Resume</button><a class="btn btn--ghost" href="#/">Quit to hub</a></div>`);
      $('.pause .btn', el).focus();
    }
    show();
  };
  P.fs = () => { try { document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.(); } catch {} };
  P.show = show; P.syncSound = syncSound;

  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'pause') P.setPaused(!P.paused);
    else if (a === 'sound') { sdk.setSettings({ sound: !sdk.getSettings().sound }); sdk.haptic('select'); }
    else if (a === 'full') P.fs();
    else if (e.target.closest('.play__grab')) show();
    else if (e.target.closest('[data-retry]')) loadGame(P);
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && e.clientY < 80) show(); });
  el.addEventListener('focusin', show);
  syncSound(); show(); loadGame(P);
}

function closePlay() {
  if (!playing) return;
  clearTimeout(playing.t);
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  playing.el.remove(); playing = null;
  main.inert = header.inert = false;
}

addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || !playing || e.source !== playing.frame?.contentWindow) return;
  if (e.data.pb === 'exit') go('#/');
  if (e.data.pb === 'fullscreen') playing.fs();
});
sdk.onSettings(() => { themeColor(); playing?.syncSound(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && playing && !document.querySelector('dialog[open]')) playing.show();
  if (e.key === '/' && !playing && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && $('#q')) { e.preventDefault(); $('#q').focus(); }
  // Arrow-key navigation across cards
  if (e.key.startsWith('Arrow') && document.activeElement?.classList.contains('card__link')) {
    const grid = $('#grid'), links = [...grid.querySelectorAll('.card__link')], i = links.indexOf(document.activeElement);
    const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    const n = links[i + { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]];
    if (n) { e.preventDefault(); n.focus(); }
  }
});

/* ---------- global events ---------- */
document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const id = fav.dataset.fav, on = sdk.toggleFavorite(id), g = byId(id);
    document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', `${on ? 'Remove' : 'Add'} ${g.title} ${on ? 'from' : 'to'} favorites`);
    });
    sdk.haptic('select');
    if (S.filter === 'fav' && !on) renderGrid();
    return;
  }
  const f = e.target.closest('[data-filter]');
  if (f) { S.filter = f.dataset.filter; renderGrid(); return; }
  if (e.target.closest('[data-clear]')) { S.q = ''; S.filter = 'all'; const q = $('#q'); if (q) q.value = ''; renderGrid(); return; }
  if (e.target.closest('[data-reload]')) boot();
});
document.addEventListener('input', (e) => { if (e.target.id === 'q') { S.q = e.target.value; renderGrid(); } });
const net = $('#net');
const syncNet = () => { net.hidden = navigator.onLine; };
addEventListener('online', syncNet); addEventListener('offline', syncNet);

/* ---------- router ---------- */
function route() {
  const [a, b, c] = location.hash.replace(/^#\/?/, '').split('/');
  const g = a === 'game' ? byId(b) : null;
  if (a === 'game' && !g) { toast('That game doesn’t exist'); history.replaceState(null, '', '#/'); return route(); }
  if (g && c === 'play' && !isReady(g)) { history.replaceState(null, '', `#/game/${g.id}`); return route(); }

  if (g && c === 'play') {
    ensureHome();
    const apply = () => { closeDialogs(); openPlay(g); };
    playing ? apply() : vt(apply);
    return announce(`Playing ${g.title}`);
  }
  const wasPlaying = !!playing;
  const apply = () => {
    closePlay(); ensureHome();
    if (g) openDetail(g); else if (a === 'settings') openSettings(); else closeDialogs();
  };
  wasPlaying ? vt(apply) : apply();
  announce(g ? `${g.title} details` : a === 'settings' ? 'Settings' : 'Home');
}
addEventListener('hashchange', route);

/* ---------- boot ---------- */
async function boot() {
  try {
    const r = await fetch('games/games.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.games = (Array.isArray(j) ? j : j.games).map((g) => ({ accentColor: '#4f46e5', players: '1', tags: [], status: 'soon', icon: '🎮', cover: '', description: '', tagline: '', ...g }));
    route();
  } catch {
    main.innerHTML = `<div class="wrap"><div class="empty"><div class="empty__art" aria-hidden="true">${navigator.onLine ? '⚠️' : '📡'}</div><h2>${navigator.onLine ? 'Couldn’t load the games' : 'You’re offline'}</h2>
      <p>${navigator.onLine ? 'Something went wrong fetching the game list.' : 'Reconnect to load the game list for the first time.'}</p><button class="btn btn--primary" data-reload>Try again</button></div></div>`;
  }
}
sdk.applySettings(); themeColor(); syncNet(); boot();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
