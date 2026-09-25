# Cake — v1.27 (the sky is drawn, so the line through the flames is gone)

The tag reads **v1.27**.

**The line through the flames.** On the iPhone a horizontal line swept through each flame as the
camera tilted: below it the flame had its soft halo, above it the halo was gone. The line was the
far edge of the floor. The camera sees 100 units; the floor is 400 wide, so it's cut off there,
just below eye level. The fog paints the far floor the sky's colour, so the edge was invisible —
but below it the canvas was opaque floor and above it the canvas was EMPTY, with the CSS sky
showing through. The halo adds light without recording coverage, so above the edge it left
"colour on an empty pixel", which WebGL leaves undefined: Chrome (and the test harness) added it
over the page anyway; iPhone Safari threw it away. Hence a line only the phone could see, and why
`?backdrop=0` (no floor: empty canvas everywhere) made the flame look the same at every angle.

**The fix.** The sky is now the canvas's clear colour: the same measured colour the fog uses, in
screen values, at full opacity (`stage.js`). Every pixel is opaque, the flame and halo blend onto
a real sky in WebGL, and every browser draws the same picture. The flame now looks like its
below-the-line self (soft halo) at every angle. The sparklers' glow and sparks had the same
problem above the floor's edge; they're fixed by the same change.

- `?sky=0` puts the old transparent canvas back, for comparison.
- With `?backdrop=0` the sky is still drawn (no floor or fog, but no empty canvas either).

**Also:** the refactor's rename had leaked into text people see — "Tap a V.slice to V.cut it",
"Send a V.slice back to…", and the slice share titles. Now "slice" and "cut" again (plus the same
slip in a few code comments).

Changed files: `stage.js`, `scene.js`, `debug.js`, `app.js`, `cut.js`, `index.html`, `README.md`,
`tools/README.md`.
