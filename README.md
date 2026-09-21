# Cake — v0.72 (MVP Phase 1)

## Feature flags
One `FEATURES` block at the top of `app.js`, all off for the MVP:
- `occasion` — the Occasion chip and tray are hidden; new cakes are silently **Birthday**, so the
  reminder, calendar and opening copy stay right. The builder now opens on **Message**.
- `buttercream` — the Frosting chip is hidden; **Fondant** remains (off = a naked sponge).
- `tier3` — the Showstopper card is hidden; the Tiers tray shows Classic (£4.49) and Two-tier (£9.99)
  side by side.
They limit what a *sender* can choose, never what a recipient sees: links carrying an occasion,
buttercream or a third tier still decode and render as sent (verified: an old Showstopper link with
30 candles opens as a Showstopper with 30). The builder clamps a pre-filled old cake (reminder,
"send one back") to its own limits — two tiers, 20 candles — keeping the bottom tiers as they were.
Flip a flag to `true` to bring a feature back.

## Remember tier settings
Switching the tier count no longer resets the shape. The builder remembers every tier's shape,
fondant and colours; 2 → 1 → 2 brings the top tier back as it was, re-clamped if the bottom has
narrowed. A tier that's never existed starts from the classic shape and the bottom tier's colours.
Ribbons were already kept per tier.

## Candles max 20
The builder slider is 0–20 (`BUILDER_MAX_CANDLES`). Links may still carry up to 100.

## Grab and spin
- A finger down **catches** the cake: dead stop, and it follows the thumb 1:1 while held (no
  momentum or ambient turn underneath).
- Release: held still or a tap → stays stopped (the viewer's ambient turn waits ~2s before
  resuming). A flick **the same way** it was going → speed **builds** on what it had. A flick the
  other way → it simply goes the new way.
- Capped at 12 rad/s (~2 turns/s); constant friction so it always settles.
Verified: one flick 6.3 rad/s, a second same-way flick 12 (the cap); held → 0; right-then-left →
negative.

## Not in this build
Slice parity is Phase 2 — please resend the screenshot of the red plate ring, it didn't come
through.
