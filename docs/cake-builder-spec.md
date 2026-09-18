# Cake — Builder Spec: Quick and Detailed

The next stage of Cake4.me: a **Quick** cake generator (seed-placed decoration, two minutes) and a **Detailed** builder (hand-piped, hand-placed, an afternoon if they want it). Written 16 Sept 2026 from Eddie's notes plus discussion. Companion to `cake-build-plan.md` (phases 0–7, the sending product) and `cake-feel-spec.md`.

The goal, in Eddie's words: a cake builder that beats the competition on craft and juice, and that uses gift-giving psychology — people value thoughtful hand-made gifts, value what they made themselves, and share what they've made and what they've been given.

---

## 1. The one decision everything hangs off

**Quick and Detailed are the same cake.** One object model, one renderer, one file format. A Quick cake is a Detailed cake whose decorations were placed by a seed instead of a thumb.

This gives:
- **One codebase.** Every object, every material, every effect is built once.
- **"Adjust it."** Any Quick cake opens in Detailed. That's the upsell path, and it kills the blank-canvas problem: nobody ever starts Detailed from nothing.
- **Quick stays in the URL.** Seed + a dozen small choices is tiny. Detailed needs storage (§8).
- **The replay works for both** (§3).

Everything else in this document assumes this.

---

## 2. What the sender does

### Quick (today's builder, grown)
1. Occasion, tier, colours, message, candles — as now.
2. A **style direction** (e.g. *rustic drip / minimal / maximalist / kids' party / elegant*). This drives which objects are recommended and how they're arranged.
3. **Shuffle.** Reseeds the placement. Same objects, new arrangement. Cheap, delightful, and the feel-spec's "every control gives a micro-reward" applies: things pop in as the seed changes.
4. Optional: **Adjust it →** opens the same cake in Detailed.
5. Pay, get link.

Two minutes. Never slower than today.

### Detailed
Starts from the Quick cake the sender was just looking at. Then:
- Place, rotate, scale and remove any object from the full library.
- Pipe by hand, with symmetry.
- Paint buttercream.
- Pour sprinkles.
- Dial tier widths and heights.
- Hand-place candles.
- Sign it.

Pay, get link. Same price as Quick for the same tier (§7).

---

## 3. The feature that isn't on the list: the replay

Every action in Detailed — stroke, placement, pour, colour change, dial move — is recorded as an **event in a log**. It's needed for undo anyway. The log is the cake.

When the recipient opens the box, **they watch the cake being made**: piping appears line by line, strawberries land, sprinkles pour, at ~20× speed, before it settles and they can spin it. Quick cakes get a short generated equivalent (objects popping in in seed order), so both modes have a reveal.

Why this is the most important thing in the document:
- **It makes effort legible.** A finished cake looks the same whether it took two minutes or two hours. Effort only counts as a gift if the recipient can see it. The replay is the effort, shown.
- **It's the reveal** the feel spec was looking for after the message moved to the back of the cake.
- **It's the share asset.** A 15-second vertical video of a cake being decorated, exported straight from the browser via `MediaRecorder` on the canvas. Two share loops from one recording: the sender's "look what I made" and the recipient's "look what I got".

Design the object model for this from the first line (§6). Retrofitting a replay onto a state-snapshot model is miserable.

---

## 4. Psychology → features

| Principle | What it means here | Feature |
|---|---|---|
| **Costly signal (money)** | A gift that cost something means more than a free one | Already the model. Tiers. No free sendable cake. |
| **Costly signal (effort)** | Time spent is the second currency | Detailed builder; the replay; the effort label on the tag |
| **IKEA effect** | People value what they made — *if they're proud of it* | Every constraint in §5. If the tool lets them make something ugly, the effect reverses into frustration and they don't send. |
| **Legibility of effort** | Effort the recipient can't see doesn't count | Replay; tag wording: **"Decorated by hand by Hollie"** (Detailed) vs **"Made for you by Hollie"** (Quick). Both true, differently weighted. |
| **Sharing what you made** | Makers show their work | Video export; downloadable stills. **Only after paying to send** (§7). |
| **Sharing what you were given** | Receivers show their gifts | The recipient's replay + spin is the screenshot; export the same video for them. |
| **Reciprocity** | Getting something makes you want to give | The slice loop, already built. A hand-decorated cake is more worth cutting and sharing. |
| **Ownership** | A signature makes it theirs | Finger-drawn signature as piping, first-class element |
| **Scarcity** | Rare things feel valuable | Seasonal topper drops that exist for a month |

---

## 5. Ugly-proofing (the IKEA effect's ceiling)

Every ugly cake goes out with our name on it, and a sender who makes something ugly doesn't send it. The whole Detailed builder is **constrained creativity**: it should be hard to make something bad and easy to make something that looks professional.

- **Symmetry / radial repeat.** Draw one piped scallop, it repeats around the edge. A slider sets the repeat count (range roughly 1–24, defaults 6 or 8). This is how an amateur produces a professional border. Applies to placed objects too: place one strawberry, repeat 12×.
- **Snap to surface.** Objects sit on the frosting, never float, never sink. Normals align to the surface.
- **Curated palettes only.** No free colour picker. Frosting, filling, candles, ribbon, text, background, buttercream paint — all from lists that were designed to go together.
- **Objects that always look good.** Procedural, tinted from the palette, sensible default scale ranges (a strawberry can't be bigger than the cake).
- **Collision rules.** Things don't intersect candles or each other beyond a tolerance; placement nudges to the nearest clear spot.
- **"Tidy up" button.** Evens spacing, aligns rotations, snaps near-symmetric arrangements to symmetric. For people who placed things roughly and want it to look considered.
- **Undo, always.** Per stroke, per placement.
- **Sensible bounds on dials.** A top tier can never be wider than the one below it.

---

## 6. Object model

Designed for the replay, the backend and undo at once.

```
cake = {
  v: 2,                          // schema version; v1 = today's URL cakes
  base:  { tiers: [{r,h}], shape: 'round'|'square', frosting, filling, topColour, ribbon, text, bg },
  meta:  { to, from, occasion, style, mode: 'quick'|'detailed', seed },
  log:   [ event, event, ... ]   // the decorations, in the order they happened
}

event = { t: <ms from start>, op: 'place'|'move'|'rotate'|'scale'|'remove'|'stroke'|'pour'|'paint'|'dial'|'sign', ... }
```

- **Placed objects** reference the library by id (`'strawberry-half'`), with position in **surface coordinates** (which face; for the top, polar `(r, θ)`; for a side, `(θ, y)`), rotation about the surface normal, scale.
- **Strokes** are polylines in surface coordinates, quantised, with nozzle id, colour, and a repeat count. Bead thickness from finger speed, stored per point.
- **Pours** are just a seed and a duration at a position; sprinkle landing is deterministic from that, so the log stays small.
- **Paint** is stored as strokes too, rasterised into the texture on load.
- Rendering rebuilds the cake by **replaying the log**. Fast-forward for display, real time for the reveal.
- Quick cakes: the log is *generated* from the seed at load, so it needn't be stored — the seed is the log.

Size: a heavily decorated Detailed cake is a few KB to a few tens of KB. Far past any URL. See §8.

---

## 7. Monetisation stance

**Sending is the product. The builder is how you make the thing you send.** It is not a game and it's not framed as one.

- No free-play mode. Nobody "plays" Detailed; they decorate the cake they're sending.
- Photos and video of a cake are **downloadable only once the cake has been paid for and sent.** That's when they become "the cake I made for Hollie" rather than a free toy.
- Detailed costs the same as Quick for the same tier. The sender's effort is their contribution, not something we charge for; charging for it would make thoughtfulness feel like an add-on.
- Premium **objects** are the upsell if one is ever needed (gold leaf, a rare topper), not the act of decorating.
- The replay, the reveal, the slices, the tag: all part of "sent", none available on an unsent cake.

---

## 8. Backend: needed, and doable without installing anything

Detailed cakes don't fit in a link. Strokes and placements with rotation and scale run to kilobytes; links need to stay under ~100 characters for chat. So: **store the cake, return a short ID**, and the link becomes `cake4.me/#id=abc123`. Quick cakes stay URL-only, exactly as now.

The constraint: no terminal, no npm, no admin on the work machine. Three paths that respect it, in order of how little there is to learn.

### Path 1 — No server code at all: a database the page writes to directly
Firebase Firestore or Supabase, using their **browser SDK loaded from a CDN** `<script>` tag. The static page writes the cake document and gets an ID back. Access rules (who can write, size limits, no reads of other people's cakes except by ID) are set in the provider's web console.

- Everything is configured in a browser. No CLI. Firebase's console is already familiar from eddiedemo.com's hosting.
- Enough for: save cake → get ID → load cake by ID. Which is the whole requirement.
- Payment gating stays soft (the write happens on the checkout success page), which is the same trade-off as today's URL cakes.
- Firestore free tier is generous for this: a cake is one document; reads are one per open.

**Recommended for the first Detailed release.** It's the least new stuff.

### Path 2 — Real server code, built and deployed by someone else's computer
Cloudflare Workers can be connected to a GitHub repository from the dashboard, after which every push to the repo builds and deploys the Worker automatically — the deploy command runs on Cloudflare's build machines, not yours. Drag files into the repo in the browser, exactly as the site is deployed now. The dashboard's "get started" flow will even create the repo for you.

- D1 (the database), KV, secrets: all bound and configured in the dashboard.
- This is what's needed for anything the client can't be trusted to do: verifying a payment webhook before saving, a global slice ledger, signed links. See `cake-serverless-mitigations.md`.
- Small Workers can also be edited directly in the Cloudflare dashboard.

**Recommended when payment verification or collaborative cakes arrive.**

### Path 3 — GitHub Actions as a computer in the cloud
Already used once (the crawler). An Action can run a build, run `wrangler deploy`, or run any script on a schedule — from a YAML file committed via the browser. It's a general escape hatch for "I need to run something and can't run it here."

### What this means for the roadmap
- Detailed v1 → **Path 1.** Static page + Firestore/Supabase. No new deployment pipeline.
- Payment verification, slice ledger, collaborative cakes → **Path 2.**
- Never: anything that needs to run on the work machine.

---

## 9. Feature notes

Per item on the list, with what's easy and what isn't.

**Cake box: round or square.** Box shape follows cake shape. A round box is a lathe; the ribbon still works. Cheap.

**Square cakes.** Bigger than it looks: tiers become boxes, the message band becomes flat faces, and **slicing becomes a grid** (9 or 12 squares) with a different lift animation. Its own phase. Worth it, later.

**Toppers.** Occasion-specific (numbers, letters, "30", a star, a heart, a car, a mortarboard). Cheapest craft win per hour spent. Numbers double as the "birthday-number candle" feature.

**Sugar objects** — flowers, roses, cherries, strawberries (halves and whole), lemon slices, shells, macarons, hearts. All **procedural**: a rose from spiralled petals, a strawberry from a lofted profile with instanced seeds, a macaron from two lathed domes and a filling disc. No asset files, fits vendored-everything, and every object can be tinted from the palette so nothing clashes. Build each with two or three size variants and a slight per-instance jitter so a dozen strawberries don't look stamped.

**No auto-rotation in Detailed.** Only user-input. Quick keeps the idle turn until the sender touches it.

**Hand piping.** The marquee feature and the hardest.
- Raycast the finger onto the cake. Record the hit in surface coordinates.
- Smooth with Catmull-Rom; render as a tube along the curve with a **nozzle cross-section**: round, star, leaf, petal. Three or four nozzles, no more.
- Bead thickness from finger speed: slower is fatter, like real piping.
- **Symmetry slider** (§5): repeat count 1–24 around the tier's axis. Preview the ghosts while drawing.
- Merge all strokes of one nozzle/colour into one geometry after each stroke completes, so 200 strokes is a handful of draw calls.
- Undo per stroke.

**Place / rotate / set.** Tap the library, tap the cake to place; drag to slide along the surface; two-finger rotate about the surface normal; pinch to scale within bounds; tap-hold to remove. Ghost preview before commit.

**Paint with buttercream.** Texture painting onto the frosting's canvas texture, one canvas per face. Soft round brush, palette colours only, a **watercolour-blend** look (multiply/soft-light) rather than opaque, because that's what buttercream painting actually looks like and it's forgiving of a shaky thumb.

**Pour your own sprinkles.** The confetti system at a tenth the scale. Hold to pour from the finger position; pieces fall with the existing physics and **stick where they land**, piling under the finger. Store the pour as position + seed + duration; replay is deterministic. Nothing new to build, and it's the most tactile thing in the app.

**Tier width and height dials.** Tiers are already parametric. Two dials per tier, clamped so a tier can never be wider than the one below. Candle layout, message band and box size all already derive from tier geometry, so they follow for free.

**Hand-place candles.** Same placement mechanic as objects, constrained to tier tops. Quick placement stays the ring layout.

**Different colour icing on top.** Split the cap material from the body material. Trivial.

**Sugar flowers with scale/rotate.** Covered by place/rotate/set; roses are the first procedural object worth doing well.

### Further ideas, from discussion
- **Signature** as piping: a first-class "sign it" tool that draws with the round nozzle onto the top or a side. Their handwriting on the cake.
- **Tidy up** button (§5).
- **Collaborative cakes**: several people each add something before it's sent. Office birthdays. Needs Path 2 and a share-to-edit link. Big, later.
- **Seasonal drops**: toppers that exist for a month. Scarcity, and a reason to come back.
- **Filling design**: cutting reveals a pattern they chose. Extends the existing filling reveal.
- **AR on a real table** via WebXR / `model-viewer`. Later; needs a glTF export of the cake, which the procedural approach makes possible.

---

## 10. Performance budget (phones)

- Every object type is an `InstancedMesh`; a dozen strawberries is one draw call.
- Piping merges to one geometry per nozzle/colour.
- Sprinkles reuse the confetti pool.
- Textures: painting canvases at 1024 per face, rebuilt only on stroke end.
- Replay fast-forward: build in one pass, don't animate every event.
- Keep the adaptive pixel ratio; expect it to drop to 2 on a heavily decorated Showstopper and be fine with that.

---

## 11. Build order

Sequenced so each step ships into the live product and validates the next.

1. **Object library, in Quick.** Procedural objects (start: strawberry, cherry, rose, macaron, heart, a number topper) + style directions + seeded placement + Shuffle. Small step from today, delivers most of the visual leap, validates every object before any hand-placement exists. **Ship this.**
2. **Place / rotate / scale**, with surface snapping, collision nudge and the symmetry repeat. This is the minimum Detailed. Still URL-only if the log is small — cap it, and prompt "save to keep going" past the cap.
3. **Sprinkles.** Nearly free from the confetti work.
4. **Piping**, with nozzles and the symmetry slider. Then the signature tool, which is piping with a different entry point.
5. **Replay and video export**, the moment there's something worth replaying. Reveal for both modes.
6. **Backend, Path 1.** Store Detailed cakes, short IDs. Downloads unlock on send.
7. **Buttercream painting.**
8. **Tier dials, top-colour split.**
9. **Square cakes** (own phase: geometry, slicing grid, box shape).
10. **Collaborative cakes**, seasonal drops, Path 2 backend.

Each step gets its own feel pass. Steps 1–3 are weeks, not months; 4 and 5 are the big ones.

---

## 12. Open questions

- **Detailed on a phone**: design phone-first, but expect desktop usage to grow for Detailed and don't fight it. Does the chip-bar UI extend, or does Detailed get its own tool palette?
- **Log cap for URL-only Detailed** in step 2: how many placements before storage is required? (Guess: ~12.)
- **Style directions**: which five to launch with, and how much they constrain the object set.
- **Replay length**: cap at ~15s of playback regardless of how long the cake took; compress time non-linearly so the last strokes are visible.
- **Tag wording** when a Quick cake was adjusted in Detailed: "Decorated by hand" needs a threshold (e.g. any stroke, or ≥3 hand placements).
