/* Playbox SDK — imported by the hub and by every game.
   import * as sdk from '../../assets/js/sdk.js';
   Everything is namespaced under "pb:" in localStorage and works standalone (outside the hub) too. */

const NS = 'pb:';
const origin = location.origin;
const inFrame = window.parent !== window;

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(NS + k); } catch {} },
};

/* ---------- settings ---------- */
const listeners = new Set();
const defaults = () => ({
  sound: true,
  haptics: true,
  theme: 'system', // 'system' | 'light' | 'dark'
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
});

/** { sound, haptics, theme, reducedMotion } */
export const getSettings = () => ({ ...defaults(), ...store.get('settings', {}) });

export function applySettings(s = getSettings()) {
  const r = document.documentElement;
  if (s.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', s.theme);
  r.setAttribute('data-motion', s.reducedMotion ? 'reduce' : 'full');
}

export function setSettings(patch) {
  const s = { ...getSettings(), ...patch };
  store.set('settings', s);
  applySettings(s);
  listeners.forEach((f) => f(s));
  return s;
}

/** Subscribe to settings changes (also fires when the hub changes them while your game runs). */
export const onSettings = (cb) => (listeners.add(cb), () => listeners.delete(cb));

/* ---------- scores & saves ---------- */
/** Best score for a game, or null. */
export const getBest = (id) => store.get('best:' + id, null);

/** Keeps the best only. Returns { best, isNew }. Pass { lowerIsBetter: true } for time-based games. */
export function saveScore(id, score, { lowerIsBetter = false } = {}) {
  const cur = getBest(id);
  const isNew = cur == null || (lowerIsBetter ? score < cur : score > cur);
  if (isNew) store.set('best:' + id, score);
  return { best: isNew ? score : cur, isNew };
}

/** Per-game JSON save slot. */
export const save = (id, data) => store.set('data:' + id, data);
export const load = (id, fallback = null) => store.get('data:' + id, fallback);

/* ---------- hub-level data (favorites, recents) ---------- */
export const getFavorites = () => store.get('favs', []);
export const isFavorite = (id) => getFavorites().includes(id);
export function toggleFavorite(id) {
  const f = getFavorites(), on = !f.includes(id);
  store.set('favs', on ? [...f, id] : f.filter((x) => x !== id));
  return on;
}
export const getRecent = () => store.get('recent', []);
export const markPlayed = (id) => store.set('recent', [id, ...getRecent().filter((x) => x !== id)].slice(0, 8));

/** Wipes everything Playbox stored (scores, saves, favorites, settings). */
export function resetAll() {
  try { Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k)); } catch {}
  applySettings();
  listeners.forEach((f) => f(getSettings()));
}

/* ---------- feedback ---------- */
const PATTERNS = { select: 8, light: 12, medium: 24, heavy: [40, 30, 40], success: [14, 40, 22], error: [50, 40, 50] };
/** type: 'select' | 'light' | 'medium' | 'heavy' | 'success' | 'error' — no-op if haptics are off/unsupported. */
export function haptic(type = 'light') {
  if (!getSettings().haptics || !navigator.vibrate) return;
  try { navigator.vibrate(PATTERNS[type] ?? PATTERNS.light); } catch {}
}

let actx;
/** Tiny synth beep that respects the sound setting. */
export function tone(freq = 440, dur = 0.08, type = 'sine', vol = 0.06) {
  if (!getSettings().sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch {}
}

/* ---------- hub bridge ---------- */
const post = (pb, extra) => { try { window.parent.postMessage({ pb, ...extra }, origin); } catch {} };

/** Back to the hub. */
export function exit() {
  if (inFrame) post('exit'); else location.href = new URL('../../#/', import.meta.url).href;
}

/** Toggle fullscreen (the hub owns it when embedded). */
export function fullscreen() {
  if (inFrame) return post('fullscreen');
  const d = document;
  if (d.fullscreenElement) d.exitFullscreen?.(); else d.documentElement.requestFullscreen?.().catch(() => {});
}

/* ---------- pause / resume ---------- */
const reasons = new Set(), pauseCbs = new Set(), resumeCbs = new Set();
function setReason(r, on) {
  const was = reasons.size > 0;
  on ? reasons.add(r) : reasons.delete(r);
  const now = reasons.size > 0;
  if (was !== now) (now ? pauseCbs : resumeCbs).forEach((f) => f());
}
/** Fires when the tab is hidden or the hub shows its pause overlay. Returns an unsubscribe fn. */
export const onPause = (cb) => (pauseCbs.add(cb), () => pauseCbs.delete(cb));
export const onResume = (cb) => (resumeCbs.add(cb), () => resumeCbs.delete(cb));
export const isPaused = () => reasons.size > 0;

document.addEventListener('visibilitychange', () => setReason('hidden', document.hidden));
addEventListener('message', (e) => {
  if (e.origin !== origin || !e.data || !e.data.pb) return;
  if (e.data.pb === 'pause') setReason('hub', true);
  if (e.data.pb === 'resume') setReason('hub', false);
});
// Hub changed settings in another document (storage events only fire cross-document)
addEventListener('storage', (e) => {
  if (e.key === NS + 'settings') { const s = getSettings(); applySettings(s); listeners.forEach((f) => f(s)); }
});

/* ---------- auto-init ---------- */
applySettings();
export const accent = new URLSearchParams(location.search).get('accent');
if (accent && /^#[0-9a-f]{3,8}$/i.test(accent)) document.documentElement.style.setProperty('--accent', accent);
if (inFrame) {
  // Games feel native: no pull-to-refresh, no double-tap zoom, no text selection or callouts.
  const st = document.createElement('style');
  st.textContent = 'html,body{overscroll-behavior:none;touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;margin:0;padding:0;height:100%;overflow:hidden}';
  document.head.append(st);
  post('ready');
}
