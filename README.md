# Cake — v0.26 (the roll pivots on the cake)

## The bug
Two-finger roll was applied as a rotation about the camera's view axis *after* aiming — and since
v0.19 the camera has been aiming at a point **below** the cake, so the cake lands higher on screen.
Rolling therefore pivoted on the screen centre, and the cake, sitting above it, swung in an arc.
The elevation orbit had the same flaw in a milder form: it circled the ground origin, not the cake.

## The fix
The camera now orbits **around** the cake's centre of mass and aims **at** it, so spin, tilt and
roll all pivot on the cake and pinch zooms toward it. The on-screen positioning that the free-area
layout needs is done with a **projection offset** (`camera.setViewOffset`) — a shift lens — instead
of by aiming elsewhere. Same perspective, verticals stay vertical, and the pivot stays on the cake.

Measured: the cake's centre drifts **0.5px** on screen under a full roll and **0.8px** under a
quarter-turn of spin. Previously it drifted by roughly its distance above the screen centre.

## docs/
Feel spec updated under "Handling".
