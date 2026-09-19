# Cake — v0.33 (resolution is the last thing to sacrifice)

## What went wrong
The look pass added the first real per-frame costs — a shadow depth pass plus VSM blur, up to 150
flame sprites — and on a heavy moment (switching to the Showstopper rebuilds the cake *and* its
shadow map) enough frames ran late that the adaptive system stepped the pixel ratio down. It then
never climbed back, because I'd made climbing require the frame's CPU cost under 8ms, which shadows
keep it above. One hitch cost 3× permanently. Two design mistakes: reacting to a spike rather than
sustained lateness, and treating sharpness as the first thing to give up.

## What changed
**A quality ladder, resolution last.** Before the pixel ratio moves, the effects step down in this
order, each cheaper to lose than sharpness on a phone:
1. shadow map 1024 → 512
2. halo on every other candle
3. VSM → plain PCF (loses the soft penumbra)
4. halos off
5. shadows off
6. only now: pixel ratio − 0.5, and never below **1.5**

Recovery runs the other way: sharpness first, then the effects back in reverse order.

**Sustained evidence only.** Two consecutive bad windows (>20% late frames) to step down; three
consecutive good ones (<4% late) to step up. A single hitch never counts.

**Rebuilds don't count.** Anything that rebuilds the scene — a tier switch, a cut, a slice page —
marks a grace period, so the spike it causes isn't read as evidence. Windows with too few frames
(tab hidden, keyboard up) are ignored too.

Verified under the slow software renderer: the ladder walked all five effect rungs over 22s with
the ratio pinned at 3 the whole time, then recovered in reverse when frames were fast again.

## On the phone
`cake.quality()` now shows the ratio, the late-frame fraction, which rungs are currently stepped
down, and a log of the last eight moves — so if it ever looks soft you can see exactly what it did
and why. If your phone can't hold shadows *and* 3×, it'll drop shadow quality first and tell you.
