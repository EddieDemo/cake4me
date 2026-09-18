# Birthday Cake — Build Plan

Working title: **Cake** (rename later). Started 13 Sept 2026.

A single-page browser gift. Sender configures a 3D cake and gets a link. Recipient blows out the candles, reads the message, cuts the cake into slices and sends slices to other people. Vanilla HTML/CSS/JS + three.js. No server, no database, no build step.

Each phase ends with something you can open on your phone and show someone. Don't start the next phase until the current one passes its "done when".

Companions: `cake-business-plan.md` (what and why, tiers, MVP definition in section 12) and `cake-feel-spec.md` (easings, timings, sounds for the four moments; used in the feel passes below).

**MVP = launch.** Phases 0–6 are the MVP. Cut the catalogue, never the moment: birthday only, two tiers, three colour choices, but the recipient's ten seconds finished to the feel spec. Everything in "Deliberately not in v1" ships into the live product afterwards, in that order.

---

## Ground rules

- **One folder, one `index.html`**, plus `style.css`, `app.js`, `vendor/` (three.js) and `assets/`. Versioned folders (`Cake-v0.1`, `Cake-v0.2`…) so any version can be reopened.
- **three.js via a plain `<script>` tag**, not ES modules. Recent three.js releases are module-only, and module imports are blocked when you open a file by double-click. Use the UMD build (r128 is fine for this) so `index.html` opens straight from disk. **Download `three.min.js` once and keep it in `vendor/`** rather than loading from a CDN: no install, no admin rights, works offline and on a locked-down work machine, and the deployed site doesn't depend on a third party. Don't upgrade three.js mid-project.
- **Workflow: Live Server locally, GitHub drag-and-drop to test on the phone.**
  - *Local:* open the folder in VS Code, click Go Live. You get an `http://127.0.0.1:5500` page that reloads on save, and the mic works on the desktop for tuning blow detection. (Double-clicking `index.html` also works for layout, since the three.js build is plain script.)
  - *Phone:* a GitHub repo with Pages enabled (Settings → Pages → deploy from `main`, root). Drag the folder's contents into the repo in the browser, commit, wait a minute, open `https://<user>.github.io/<repo>/` on the iPhone. Mic access and Web Share need this real `https://` URL, so from Phase 3 on this is the only test that counts.
  - *Drag-and-drop gotchas:* drop the files and the `vendor/` folder together so paths stay intact; uploading a file with the same name overwrites it, but deleting a file has to be done by hand in the repo; iOS Safari caches hard, so add `?v=<anything>` to the URL after each upload; the repo must be public for free Pages. Push a change, don't rebuild the repo.
  - *Later:* the final domain can point at Pages via a `CNAME` file, or the same repo can feed your existing Firebase auto-deploy. Not needed until Phase 7.
- **All state lives in the URL.** The cake is fully described by the link. Nothing to store, nothing to break, links work forever.
- **Fixed camera.** No OrbitControls. The cake rotates slowly; the user never has to learn a 3D control.
- **Links are versioned from the first commit** (`"v": 1`). Once launched, every change must still render every old link. Add fields, never rename or remove them.
- **Feel is a pass per moment, not a phase at the end.** Get each interaction working plainly, then tune it against `cake-feel-spec.md` while it's fresh. Each phase below has a feel-pass step.
- **Mobile-first, one hand.** Portrait, cake top ~55%, primary action in the bottom third, `100dvh`, `touch-action: none` on the canvas, `devicePixelRatio` capped at 2. Details in the feel spec's mobile constraints.

---

## Phase 0 — Skeleton (today)

**Goal:** a cake-shaped object on screen, on your phone, with the workflow proven end to end.

The starter (`Cake-v0.1`) already contains the scene, so Phase 0 is mostly plumbing:

- [ ] Unzip `Cake-v0.1`, open the folder in VS Code, Go Live. Rotating cake on a plate, no console errors.
- [ ] Read `app.js` top to bottom. It's ~120 lines. Change a colour, save, watch it reload. This is the file you'll live in.
- [ ] Create the GitHub repo (public), enable Pages, drag the folder contents in, commit.
- [ ] Open the Pages URL on your iPhone in Safari, then paste it into WhatsApp to yourself and open it from there. Same cake, smooth rotation, canvas fills the top ~58% of the screen with no scrolling.
- [ ] Rotate the phone to landscape and back; the canvas resizes without stretching.

What's in the starter and why:
- `vendor/three.min.js` is r128, the plain-script build (~600KB). It's the version to freeze on.
- `renderer` is transparent over a CSS gradient, so backgrounds are CSS, not three.js.
- The cake is a `THREE.Group` so candles (Phase 1) and wedges (Phase 4) attach to it without touching the plate or camera.
- `devicePixelRatio` is capped at 2 and `prefers-reduced-motion` stops the rotation; both are ground rules, not polish.
- `window.cake` is exposed so you can poke it from the console (`cake.rotation.y = 0`).

**Done when:** the Pages URL opens from a WhatsApp message on your phone and shows a smooth rotating cake.

---

## Phase 1 — The cake looks like a gift (day 1–2)

**Goal:** something you'd actually be happy to send.

### 1a. Candles
- [ ] A candle = thin cylinder + small emissive sphere/sprite flame. Build one, then place N copies.
- [ ] Layout: fill the top face in **concentric rings** from the outside in. Ring capacity ≈ `floor(2π·r / spacing)`. Keep a clear central disc for the message. 100 candles must fit without overlapping.
- [ ] Flame flicker: per-candle random phase, scale ±10% and slight sway. Use a **shared geometry and material** for all candles so 100 of them is cheap.
- [ ] Candle colour: from the candle palette (1c), slight per-candle hue variation.

### 1b. Message on the cake
- [ ] Render the message text to an offscreen 2D `<canvas>` in Pacifico (vendored, SIL OFL) with a piped shadow/highlight, and use it as a `CanvasTexture` on the **reverse side of the biggest tier** (v0.7: it lives at theta = π permanently and is found by spinning the cake, not revealed) (decided in v0.2: from the 25° camera the side reads far better than the top, it never competes with the candles, and it works the same on both tiers). Frosting colour is baked into the canvas so light ink stays light on dark frosting.
- [ ] Auto-size: shrink font until the text fits a ~120° arc, max 3 lines
- [ ] Handle empty message (plain frosting)
- [ ] Later: a second, fancier typeface option for the sender

### 1c. Colours and tiers (no skins yet)
There is one birthday skin. Personalisation at launch is three colours and a tier.
- [ ] **Frosting colour** (curated palette of ~8), **candle colour** (~6), **filling colour** (~8 plus "rainbow layers"). Materials are plain colours, no textures. Every combination from the palettes must look good; that's a design job, do it in the palette, not in code.
- [ ] **Filling** is only visible on cut faces (Phase 4). In the builder, changing it briefly shows a translucent cut-away for ~700ms so the sender sees what they've hidden. Nowhere else.
- [ ] **Tiers:** `Classic` (single, 8 slices) and `Two-tier` (a second, smaller cylinder stacked on top with a ribbon band, 16 slices). Switching drops the second tier in from above with a small squash on landing. Showstopper and Absurd are post-launch.
- [ ] Background as a soft vertical gradient in CSS behind a transparent canvas; gradient shifts slightly with the frosting colour

**Done when:** you type a tier, three colours, a message and `100` candles into `app.js` by hand and it looks like something you'd screenshot.

---

## Phase 2 — Sender builder + links (day 2–3)

**Goal:** two modes in one page. No hash = builder. Hash present = viewer.

### 2a. URL schema
Encode a config object as JSON → `encodeURIComponent` → base64url, in the hash:

```
https://yourdomain/#c=<base64url>
```

Config (keep keys short, this ends up in a WhatsApp message):

```json
{
  "v": 1,
  "to": "Hollie",
  "from": "Eddie",
  "m": "Happy 30th, love you",
  "n": 30,
  "t": 1,
  "fc": 3,
  "ic": 5,
  "cc": 2
}
```

`t` = tier (1 Classic, 2 Two-tier; 3 and 4 reserved). `fc`/`ic`/`cc` = frosting, inside (filling), candle colour as palette indices. Occasion (`o`) and decorations (`d`, an array of small ints) are added later without breaking v1 links.

- [ ] `encodeConfig(obj)` / `decodeConfig(hash)` with validation: cap `n` at 100, cap `m` at 80 chars, clamp colour indices and tier to known values, reject anything else gracefully (show a plain cake, never a broken page)
- [ ] Log link length. If it's ugly, drop JSON for a `|`-separated string; fields are fixed anyway.

### 2b. Builder UI
A card over the live cake preview. Every change updates the cake immediately.
- [ ] To (name), From (name), Message, Candles (number input + slider, 0–100), Tier (two cards with prices), three colour swatch rows
- [ ] Every control gives its micro-reward per the feel spec (name pipes on letter by letter, candles pop in one at a time, tier drops in)
- [ ] "Get link" button → builds URL, shows it, **Copy** and **Share** (Web Share API if present, else copy)
- [ ] Mobile-first layout: cake in the top ~55% of the screen, controls below, no scrolling required

### 2c. Viewer
- [ ] If hash decodes: hide builder, render the cake, show "Happy Birthday, {to}" and "from {from}" chrome
- [ ] Candles are lit and the message is **not yet visible** (it's revealed after the candles go out)

**Done when:** you build a cake, paste the link into WhatsApp to yourself, open it on your phone, and see the right cake, tier and colours.

*Status: v0.3 (13 Sept) implements 2a and 2c; v0.4 adds the link-ready ceremony, candle pop-in and tier drop-in (2b + moment-1 feel pass). Phase 2 complete pending the WhatsApp test.*

**Feel pass (moment 1):** the link-ready ceremony (box, lid, ribbon, label, share) from the feel spec. Skippable by tap.

---

## Phase 3 — Blow out the candles (day 3–4)

**Goal:** the moment people film.

Deploy first. Push to GitHub Pages so you have an `https://` URL on your phone.

### 3a. The gate
- [ ] Viewer opens on a closed box with a ribbon and one button: **Open**. That tap unlocks the AudioContext and is the only place the mic is offered (small text link under the button, never a modal).
- [ ] Open sequence: ribbon drops, lid lifts, cake rises and settles, candles light in a ripple, header fades in. Timings in the feel spec.

### 3b. Guaranteed path: spin
- [ ] A hint: "Spin the cake to blow them out"
- [ ] Drag-to-spin with momentum (see the feel spec): the cake tracks the finger, coasts on release, decays to the ambient spin. Spin speed above a threshold extinguishes candles in waves from the leading edge. No separate swipe-to-blow gesture.
- [ ] Extinguish = flame scales to 0, a small smoke wisp (a fading sprite drifting up) for a second

### 3c. Bonus path: microphone
- [ ] A "Use microphone" button (needs a tap; never auto-request)
- [ ] `getUserMedia({audio:true})` → `AnalyserNode`, sample every frame
- [ ] Blow detection: RMS over the low band (roughly 0–400 Hz) above a threshold for ≥150ms. Calibrate against silence for the first 500ms after permission to set the threshold relative to room noise.
- [ ] Flames **lean away** from the breath (or the swipe direction) before going out; the lean is the magic, not the extinguishing.
- [ ] While blowing: extinguish candles in proportion to loudness and duration. A long hard blow gets all 100.
- [ ] If permission denied or `getUserMedia` missing (in-app browsers): hide the button silently. Swipe still works. **No error messages.**

### 3d. The reveal
- [ ] Last candle out → **500ms of nothing** (don't shorten it) → confetti (2D canvas overlay, not three.js, paper not glitter) → cake tilts 8° toward camera → message pipes itself onto the frosting letter by letter
- [ ] "Cut the cake" button appears; "Relight the candles" text link (reverse ripple) so they can film it again

**Done when:** three people open it from WhatsApp on their own phones and all three get the candles out, at least one by blowing, none by asking you how.

**Feel pass (moment 2):** run the feel-spec checklist on gate → open → idle → blow → beat → reveal. Film a 10-second clip; does the peak read?

*Status: v0.5 (13 Sept) implements 3a–3d end to end. v0.6 replaces swipe-to-blow with the spin model, removes the plate in favour of a contact shadow, raises the camera to 36°, and drops the reveal tilt. Mic confirmed working on iPhone. Still needs the three-friends WhatsApp test.*

---

## Phase 4 — Cut the cake and send slices (day 4–6)

**Goal:** the loop.

### 4a. Slicing
- [ ] Classic has **8 slices**; Two-tier has 16 (8 per tier, top tier first). Replace each cylinder with wedge geometries (build one wedge as a `CylinderGeometry` with `thetaLength = π/4`, clone and rotate). Candles and message texture stay on top; check they don't visibly seam.
- [ ] **Filling reveal:** the wedge's two inner faces and the exposed faces of the remaining cake use the filling colour (or striped layers for "rainbow"). This is the second reveal and the sender's secret; it must look delicious, not like the inside of a cylinder.
- [ ] Tap a wedge → it lifts out with a small wobble, slides toward the camera, frosting side up, onto a small plate that slides in. Empty gap remains in the cake.
- [ ] Slice count and which wedges are gone persist in `localStorage` keyed by the config hash, so refreshing doesn't refill the cake.

### 4b. Sending a slice
- [ ] Lifted slice shows "Send this slice to someone" + a name field (optional)
- [ ] Slice link = the same config plus `"sl": {"to": "Nan", "from": "Hollie", "i": 3}` where `i` is the wedge index
- [ ] Share via Web Share API, fall back to copy
- [ ] Viewer in slice mode: renders **only the wedge** on a plate with one lit candle, filling visible on the cut faces, header "Hollie sent you a slice of her birthday cake 🎂". The slice recipient blows out their one candle (swipe or mic, small confetti), then the original message pipes onto the frosting, then one clear CTA: **"Send someone a cake"** → the builder, with "Cakes from £4.49" underneath. Nothing else on the page.
- [ ] Slice recipients cannot slice further.

### 4c. Scarcity copy
- [ ] "7 slices left" counter. When it hits 0: "You gave away the whole cake ❤️" and the empty plate.

**Done when:** you receive a slice link from a test cake on a different phone, open it, and it makes you want to send a cake.

**Feel pass (moments 3 and 4):** cut and lift per the feel spec; slice arrival as its own small ceremony. The slice page carries the business, so it gets the same care as the cake.

*Status: v0.23 (18 Sept) implements Phase 4 end to end — wedges per tier (top tier cut first), tap-to-cut with raycasting, lift onto a plate toward the viewer, filling reveal on the cut faces, the message band carried across wedges by per-wedge texture offsets, slice links (`&s=&b=&n=&sb=`), `localStorage` persistence of gone slices, the slice recipient page with one candle and the blow mechanic, and the **slice-back-to-sender acknowledgement** (first suggestion; the sender's page reads "They blew out the candles — your cake landed" and offers next year's reminder). Decisions: tap-a-wedge rather than a knife drag for v1; the message shown as text on the slice page; spent candles vanish when cutting begins. Knife drag and the moment-3/4 feel pass still to do.*

---

## Phase 5 — Polish and share surface (day 6–8)

- [ ] **Snapshot button**: render the current frame to PNG (`renderer.domElement.toDataURL`, with `preserveDrawingBuffer: true` or a manual render before capture), share via Web Share with file, fallback download. Overlay the small wordmark on the image.
- [ ] Sound: the core cues from the feel spec (`lid`, `puff`, `hush`, `confetti`, `knife`, `plate`, `bow`, `pipe`). Muted by default, one toggle, unlocked on the Open tap, decoded once. The full palette can wait.
- [ ] Loading state: gradient + flat CSS cake silhouette instantly (no spinner); crossfade to the 3D scene when ready; if load exceeds ~1.5s, candles light on the silhouette as progress
- [ ] Bad-link page: friendly, offers the builder
- [ ] Open Graph tags so the link previews nicely in WhatsApp/iMessage (a static image of a cake; per-cake previews need a server, skip)
- [ ] Performance pass on an older iPhone if you can borrow one: 100 candles + Two-tier slicing must stay at 60fps. Instanced mesh for candles if it isn't.
- [ ] `prefers-reduced-motion` mode per the feel spec
- [ ] "Report this cake" link on every viewer (mailto with the hash); `blocklist.json` in the repo checked on load

**Done when:** you'd put the link on your own website.

---

## Phase 6 — Payment (day 8–9)

Keep it soft. Anyone technical can bypass this at $5 and that's fine.

- [ ] Merchant-of-record checkout (Lemon Squeezy, or Stripe Managed Payments if available to UK sellers): one product per tier. Builder "Get my link" → checkout with the cake config carried in the success URL's hash → success page runs the link-ready ceremony and offers Share/Copy
- [ ] Free preview: builder always shows the live cake; only the shareable link is behind payment. No sendable free cake, ever.
- [ ] Prices: Classic £4.49 / $5.99 / €5.49, Two-tier £9.99 / $12.99 / €11.99. A `/prices` page so recipients can look it up. The price never appears on the cake.
- [ ] Slice links are always free. They're the marketing.
- [ ] Analytics: privacy-friendly (Plausible/Fathom or none), one UTM on the slice CTA (`?src=slice`) so slice-to-cake conversion is measurable from day one

**Done when:** you pay yourself £4.49 and £9.99 and receive two working cake links.

---

## Phase 7 — Launch (week 2)

- [ ] Domain: a short one for this, not eddiedemo.com. Link length matters in chat apps.
- [ ] Ten screen recordings of the blow-out and the slice moment, 10–15s each, vertical. Post daily for a month. This is the spark the loop needs; recipients carry it after that.
- [ ] A "send a cake" link in your own email signature and on your site
- [ ] Watch: how many slice recipients tap "Send someone a cake". That single number tells you whether the loop works. If it's under ~5%, fix the slice page before anything else.

---

## Deliberately not in v1 (ships into the live product, in this order)

1. Christmas cake skin (mid-November)
2. Showstopper (3 tiers, sparklers, 24 slices, £24.99) and The Absurd (5 tiers, fireworks, 48 slices, £99), each launched with its own video
3. The decorator: curated decorations placed from a set, zone colours, "decorated by Hollie" line; then premium decorations
4. **Personalisation set** (the sender's palette of choices; candle colour already shipped in v0.2):
   - **Candle style** — plain, striped, spiral, tapered, birthday-number candles ("4" + "7"), sparklers for the upper tiers. One or two ints in the link; geometry/texture swap per style.
   - **Confetti colour** — currently derived from the cake's own palette. Let the sender pick, or offer themed sets (gold, pastel, monochrome, single-colour).
   - ~~**Background colour**~~ — **shipped in v0.16**: 9 options including three dark backdrops, plus "Match the cake" (index 0) which preserves the old derived-from-frosting behaviour for links sent before it existed.
   - **Lighting strength** — an ambient slider from daylight to near-dark.
   - **Candlelight as the real light source** — at low ambient the flames light the cake. The point light already tracks the lit count, so the scene dims progressively as candles go out, the last one leaves the cake nearly dark (which finally gives the 500ms beat something to be), and relighting brightens it back up. Nearly free; needs a dark background to mean anything, and the message on the side may need a lift so it doesn't vanish into shadow.
   - **Spotlights** — presets from single hard key to warm three-point to slowly sweeping film-premiere searchlights. Note before building: a `SpotLight` is invisible in air, so the visible beam needs its own additive cone mesh.
   - Full write-up of all three in `cakeAesthetics.md` (Tier B+).
   - More skins per occasion, full sound palette
5. Bundles (3 and 10 Classics), office occasions, Tray Bake square tier (12-square grid slicing)
6. Anything needing a server: photos on the frosting, voice notes, scheduled delivery, signed links

Never: orbit/pinch controls, accounts, a sent-cakes history, per-cake link previews, ads, a free sendable cake.

## Open questions to answer by building, not deciding

- Does 100 candles look funny or ridiculous? (Try it before capping lower.)
- Does the message belong on the cake or in a card beside it once revealed?
- Is 8 slices right for the Classic, or does 12 feel more generous?
- Does the filling reveal read clearly on a phone, or does it need striped layers by default?
- Two-tier: do people expect to cut the top tier first?
