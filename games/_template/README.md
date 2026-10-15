# Game template

1. Copy this folder: `cp -r games/_template games/my-game`
2. Set `GAME_ID` in `games/my-game/index.html` to the same value (`my-game`) and change `<title>`.
3. Register it in `games/games.json` (the only file you edit outside your folder).
4. Open `#/game/my-game` in the hub.

## Contract

- A game is a self-contained folder; its entry point is `index.html`. Use **relative paths only**.
- The hub loads it in a same-origin iframe: `games/<id>/index.html?accent=%23rrggbb&v=<version>`.
- Link `../../assets/css/tokens.css` (and optionally `base.css`) so you inherit colors, type, radii and light/dark themes.
- `import * as sdk from '../../assets/js/sdk.js'`:

| API | Purpose |
| --- | --- |
| `getSettings()` | `{ sound, haptics, theme, reducedMotion }` |
| `onSettings(cb)` | React to settings changes (returns unsubscribe) |
| `saveScore(id, score, {lowerIsBetter})` | Keep best score → `{ best, isNew }` |
| `getBest(id)` | Best score or `null` (the hub card shows it) |
| `save(id, data)` / `load(id, fallback)` | Namespaced JSON save slot |
| `haptic(type)` | `select`, `light`, `medium`, `heavy`, `success`, `error` |
| `tone(freq, dur, type, vol)` | Tiny beep that respects the sound setting |
| `onPause(cb)` / `onResume(cb)` | Tab hidden or hub pause overlay |
| `fullscreen()` | Toggle fullscreen via the hub |
| `exit()` | Back to the hub |

## Checklist

- Pause your loop in `onPause`, resume in `onResume` (and reset your timestamp).
- Resize on `ResizeObserver`; draw in CSS pixels; cap DPR at 2.
- Keep touch targets ≥ 48px and respect `env(safe-area-inset-*)` for UI near edges (the hub bar floats at the top).
- Check `getSettings().reducedMotion` before screen shake and particles.
