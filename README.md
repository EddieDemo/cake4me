# Cake — v0.1 (Phase 0)

A rotating cake on a plate. That's it.

## Run it locally
Open the folder in VS Code and click **Go Live** (Live Server). Or just double-click `index.html`; this build works from disk too.

## Test on your phone
1. Drag the contents of this folder into your GitHub repo in the browser (files and the `vendor/` folder together) and commit.
2. Repo → Settings → Pages → Source: "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
3. After a minute, open `https://<your-username>.github.io/<repo-name>/` on your phone.
4. If you don't see a change after an update, add `?v=2` (any number) to the URL to skip the cache.

## Files
- `index.html` — the page
- `style.css` — layout and background
- `app.js` — the scene
- `vendor/three.min.js` — three.js r128 (MIT), plain script build. Don't replace with a newer version; newer builds are module-only.
- `assets/` — empty for now (fonts, sounds, sprites go here)

## Done when
Rotating cake, no console errors, smooth on your phone.
