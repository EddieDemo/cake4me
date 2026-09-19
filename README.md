# Cake — v0.24

Eight fixes from the phone test.

## 1. Vertical balance across tiers
The camera aimed at a fixed height that suited the Classic and nothing else. It now aims at the
cake's **volume-weighted centre of mass** per tier (≈0.80 / 1.07 / 1.30) and frames from the cake's
real size, so a taller cake also pulls back a little. Camera Y now rises with the tier count.

## 2. Low resolution on iPhone Pro — a real bug since v0.15
The adaptive pixel ratio climbed when the *frame interval* averaged under 12.5ms. But
`requestAnimationFrame` is locked to the display: on a 60Hz screen every frame reports ~16.7ms
however cheap it was to draw. It could never climb, so every iPhone has been rendering at 2 on a
3× panel. It now measures the frame's **own work** (update + render) and counts **late frames**
against the display's learned cadence, climbing when both are comfortably under budget.

## 3. Chip order
Occasion · Message · **Cake · Candles** · Colours.

## 4. Pop-up wording
Now describes what actually happens: the event on the real date, with a nudge three days before.

## 5. "The event doesn't appear"
It does — but iOS shows the `.ics` in a preview first, and the event is only added when you tap
**"Add To Calendar"** at the bottom. The tick in the corner just closes the preview. The pop-up now
says so after "Yes". Also new: **"Use Google Calendar instead"**, a plain link that opens the event
pre-filled with yearly recurrence and no file download, for Android and for iPhone users who live
in Google Calendar. Choosing it still records the date in the birthday book.

## 6. Whole cake appearing on the slice page — the one headless couldn't see
When the Pacifico font finished loading, the app rebuilt the entire scene so the message used the
right typeface. On a phone the font arrives *after* the slice page has set itself up, so the rebuild
put the whole cake back, candles and all. Headless had the font cached before routing. The refresh
now redraws only the message texture and never touches the scene. Verified by throttling the font
2s behind the page: the slice page stays a slice.

## 7. No candle on a slice
The candles went when the cake was cut; a slice that sprouted a new one contradicted that. The slice
page is now: header, the wedge to spin, a small burst of confetti, the message, the call to action.

## 8. The end of the cake is no longer a dead end
Giving away all eight is the most generous moment in the flow, so it hands straight back into the
loop. **"You shared the whole cake 🎉"**, then a recap — *"8 slices, shared with Eddie, Nan and 6
more — Eddie's cake went a long way"* — then **Send one back to Eddie** (hidden if already done),
**Remind me for Eddie's birthday**, and **Send someone a cake**. Names are remembered per cake in
`localStorage`. The contact shadow shrinks to nothing, since there's nothing left to cast it.

## docs/
Growth doc updated with the calendar findings; feel spec updated for the candle-free slice.
