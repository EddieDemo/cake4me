# Cake — v0.13

## 1. Zoom range
`ZOOM` is **0.64 – 2.4** (v0.12 was 0.45 – 1.7). Smaller is closer.

0.64 sits halfway between the old too-close 0.45 and the 0.82 first tried here: the cake overfills
the frame enough to read the frosting and the message clearly, without being inside it. 2.4 pulls
back noticeably further than before.

## 2. Two-finger rotate was inverted
Left thumb up, right thumb down is a clockwise twist of the hand, and it was turning the cake
anticlockwise. Sign flipped. The cause is worth remembering for anything else on this axis:
**rolling the camera one way makes the scene appear to roll the other**, so the intuitive mapping
is the opposite of the one that looks right in the code.

## 3. The coast wasn't clamped — the decay was eating it
There was no speed limit. What made a hard flick feel capped was **exponential decay**
(`SPIN.drag` 2.1/s): it sheds the biggest speeds fastest, so a 15 rad/s flick was down to 1.8
within a second. You never saw the speed you'd put in.

That's now **constant friction** (`SPIN.friction`, 1.4 rad/s²), which is how a real turntable
behaves: it loses the same 1.4 rad/s every second regardless of how fast it's going. So twice
the flick spins for twice as long. A 10 rad/s flick coasts for about seven seconds before
settling back to the ambient orbit; a gentle nudge still settles in under a second.

`flingGain` also went 0.35 → 0.5, so more of the gesture survives the release. Tracking while
your thumb is down is unchanged (`pxPerTurn` still 1600), so the cake is no twitchier to drag.

One number to tune if it's still not right: **`SPIN.friction`**. Lower spins longer.

## Console
`cake.debug()` now reports `twist` (the raw held value) alongside `roll` (what the camera is
actually doing). They're the same number a frame apart — useful when a gesture appears to do
nothing and you want to know whether the input or the output is at fault.

## docs/
Business plan, build plan, feel spec, aesthetics notes, serverless mitigations.
