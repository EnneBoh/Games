# Playbox — games hub

A static, build-free container for small browser games. Vanilla HTML/CSS/ES modules, hash routing, installable PWA.

**Run:** `npx serve .` (any static host works: GitHub Pages, Cloudflare Pages, nginx — all paths are relative).

**Add a game**
1. `cp -r games/_template games/<id>` and build it (see `games/_template/README.md`).
2. Add an entry to `games/games.json` (`id` = folder name, `status: "ready"`).
3. Bump `version` when you ship changes (busts the cache for that game).
4. Deploy. Nothing else in the hub changes.
