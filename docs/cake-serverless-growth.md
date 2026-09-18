# Cake — Serverless Growth

Everything that arms a future purchase **without a server**, the occasion taxonomy that makes reminders honest, and the slice-back acknowledgement loop. Written 16 Sept 2026. The revenue reasoning is in `cake-revenue-strategy.md`; this is the list of things to build, in the order they earn.

Status key: ✅ built (v0.21) · 🔜 next · 💡 later

---

## 1. The principle

Moonpig's reminders drive ~40% of its orders and need a 107-million-row database and an email operation. Most of that effect is available with no backend at all, because the sender's own phone can hold the date and their own calendar can do the reminding. Everything below follows the same pattern: **put the future purchase somewhere that isn't our server** — the calendar, the chat thread, `localStorage`, the link itself.

---

## 2. Occasions: which ones come back, and how

A reminder is only honest if the app knows whether the occasion recurs. So every cake now carries an occasion (`o`, appended to the link schema; older links decode as Birthday). From v0.22 it's the **first question**: its own chip at the front of the bar, a grid of all sixteen, opened automatically on arrival, nothing pre-selected. Picking one advances straight to the message. If a sender never picks, the cake is sent as *Just because* — which makes no recurrence claim, so the reminder asks for a birthday instead of inventing an anniversary. The occasion also becomes the seed for Quick-build suggestions later (`cake-builder-spec.md` §2).

| Occasion | Recurs? | Rule | Reminder offered |
|---|---|---|---|
| Birthday | yearly | date the sender enters | "Remind you next year?" |
| Anniversary | yearly | date entered | same |
| Christmas | yearly, everyone | 25 Dec | "Remind you next Christmas?" (no date asked) |
| Valentine's | yearly, everyone | 14 Feb | same |
| Halloween | yearly, everyone | 31 Oct | same |
| New Year | yearly, everyone | 1 Jan | same |
| Father's Day | yearly, movable but expressible | 3rd Sunday of June (UK/US/CA) | same, via `BYMONTH=6;BYDAY=3SU` |
| **New baby** | **one-off that becomes yearly** | birth date → first birthday, then every year | "Remind you for Hollie's first birthday?" |
| **Wedding** | **one-off that becomes yearly** | wedding date → anniversary | "Remind you for their anniversary?" |
| Mother's Day | movable, not expressible | UK is Lent-based; US is 2nd Sunday of May | no occasion reminder; birthday capture instead |
| Easter | movable, not expressible | — | same |
| Get well · Congratulations · Thank you · Just because · Graduation · Leaving | one-off | — | **"When's Hollie's birthday?"** — every one-off cake is a chance to capture the recurring one |

The "becomes" type is the interesting one: a new-baby cake sent this week is a first-birthday cake next year, and every year after. That's a customer for eighteen years from one send.

---

## 3. The list — things that arm a future purchase without a server

### ✅ 3.1 The reminder pop-up (sender)
Right after the link is ready — the moment of highest satisfaction — a centre-screen pop-up: big **"Yes, remind me"**, quiet **"Maybe next time"** as text. Copy and date field adapt to the occasion (§2). Yes produces a `.ics` file: an all-day event three days before the date, `RRULE:FREQ=YEARLY`, titled *"Send Hollie a cake 🎂"*, with a link that opens the builder **pre-filled with this exact cake**. The phone's calendar does the reminding. Nothing runs on our side, ever.

### ✅ 3.2 Pre-filled edit links (`#edit=`)
A link that opens the *builder* with a cake already in it, rather than the viewer. Used by reminders ("last year's cake, ready to tweak"), by "Send one back", and later by "Send this again to someone else". The link is consumed on load so it can't be accidentally re-shared as a gift.

### ✅ 3.3 Reciprocity, pre-filled (recipient)
The recipient's call to action is **"Send one back to Eddie"**, not "send someone a cake". It opens the builder with the names swapped and the same cake as a starting point. Specific beats generic; pre-filled beats empty.

### ✅ 3.4 The birthday question (recipient)
Under it: **"Remind me for Eddie's birthday"** → the same pop-up, date field, `.ics`. Asked at maximum warmth, the recipient leaves with the sender's birthday in their calendar and a pre-filled cake waiting behind the alert. The recipient becomes a sender with a date.

### ✅ 3.5 The birthday book (`localStorage`)
Every date the sender tells us is kept on their phone — name, occasion, month, day. No account. 🔜 Surface it: on each visit, "Coming up: Nan's birthday, 12 days" with a one-tap start; export the whole book as one `.ics`.

### 🔜 3.6 Slices, free, and the slice back to the sender — the serverless acknowledgement loop
Slices stay free: they are the advertising. But the **first slice suggestion should be "Send a slice back to Eddie"**. The slice link carries the cake's state (candles out, which slice), so when Eddie opens it he sees his own cake, candles blown, confetti settled: *"Hollie sent you a slice — she blew out the candles."*

That is the acknowledgement loop from the revenue doc, delivered by the chat thread instead of by an email server. It closes the emotional circuit a physical gift closes automatically, costs nothing, and lands in the same conversation the cake was sent in. The email version (backend) can come later and adds nothing this doesn't, except reaching a sender who wasn't sent a slice.

### 🔜 3.7 Occasion-aware defaults
Choosing the occasion first (now the first thing in the message tray) should drive the Quick build: a Christmas cake starts as a Christmas cake, a new-baby cake in pastels, an anniversary with two tiers suggested. Zero backend; it's a table.

### 🔜 3.8 Date-aware home page
In early December the Christmas cake is first; in the week before Valentine's, the heart. Same table, plus today's date.

### 🔜 3.9 Attach at checkout
On the success page: *"Add a cake for someone else, 30% off"*. One screen. And premium objects (+£1) in the builder once the object library exists.

### 🔜 3.10 Credit packs by code
3 for £11.99, 10 for £34.99, redeemed by a code checked client-side against a hashed list in the repo. Prepay is a promise to come back nine more times, and one merchant-of-record fee instead of ten.

### 🔜 3.11 Seasonal drops
Toppers and skins that exist for a month. A date check in the object list. Scarcity and a reason to return.

### 💡 3.12 "Send this again"
On any cake the sender made (from the birthday book or the collection), a one-tap **"Send this to someone else"** that opens the pre-filled builder with the recipient cleared. The cake they were proud of becomes a template for the next person.

### 💡 3.13 The collection
"Cakes you've sent" in `localStorage`, with occasion badges and seasonal ones. Not a score; a history. Unlock a topper set after five sends — encourages the next send without gating the product.

### 💡 3.14 Share assets that carry the link
Video export from the replay (`cake-builder-spec.md` §3) with a small wordmark, only after paying to send. The recipient's export too. Every share is an advert with a return address.

### 💡 3.15 Open Graph preview
The link's preview card in WhatsApp/iMessage is the first thing a recipient sees. One static image now; a per-occasion image is a cheap upgrade (still static, chosen by a query parameter the sharing platform can read).

### 💡 3.16 Pre-filled slices for group sends
A cake sent to a family chat: the slice page's suggestions can be the *other* names the sender typed ("Send a slice to Nan"). Names are in the link; no server.

---

## 4. What still needs a server, for the record

- Knowing a cake was opened when the recipient *didn't* send a slice back (the email acknowledgement).
- Reminders that fire without the sender having accepted a calendar file.
- Credits that can't be forged, a global slice count, subscription entitlements, collaborative cakes.
All in `cake-backend-options.md`; none needed for anything in §3.

---

## 5. Build order

1. ✅ **v0.21:** occasion field and chips; reminder pop-up with `.ics`; pre-filled `#edit=` route; "Send one back to Eddie"; "Remind me for Eddie's birthday"; birthday book saved.
2. 🔜 Surface the birthday book; occasion-aware defaults; date-aware home; attach on success.
3. 🔜 Slices (Phase 4) with "send a slice back to Eddie" first and cake state in the slice link.
4. 🔜 Credit packs; seasonal drop mechanism.
5. 💡 The rest as the builder spec lands.

---

## 6. Notes on the `.ics` approach

- iOS Safari opens a downloaded `.ics` in a preview with "Add All"; Android hands it to the calendar app; desktop opens it in whatever owns `.ics`. In-app browsers (Instagram, Facebook) may block downloads — the pop-up should degrade to "open this in Safari to add the reminder" rather than fail silently. **Test this on the phone.**
- **The event sits on the real date**, titled as the occasion ("Hollie's anniversary 🎂"), and recurs yearly by `RRULE` (Father's Day via `BYMONTH`/`BYDAY`). The early nudge is an **alarm** on that event, not a shifted event — a shifted event would show the wrong date in the month view. Two alarms: three days before at 09:00 (`TRIGGER:-P2DT15H`, because all-day alarms are relative to midnight) and on the day at 09:00 (`TRIGGER:PT9H`). Both say "Send Hollie a cake 🎂".
- The reminder's link is the *builder* pre-filled, never the viewer, so a sender can't mistake it for the gift.
- Dates in the birthday book are month/day only. We don't store the year, and we don't need it.
