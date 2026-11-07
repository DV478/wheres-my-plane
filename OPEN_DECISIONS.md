# Open decisions

Where things go when Claude is tempted to silently defer them. If an item lives
here, the user can see it. If an item lives in a code comment, only Claude can
see it — that's the pattern we're trying to kill.

Three sections. Claude writes; user decides. Nothing moves on until an item
here gets a decision.

Started 2026-11-07 as part of the quality recovery (see `QUALITY_RECOVERY_PLAN.md` §4 W7).

---

## 1. User-asked, not in current plan

Things the user has explicitly asked for that don't fit the active phase goal.
Instead of burying in a schema comment, they go here with a proposed next step.

_None open as of 2026-11-07. The airport disruption monitor was previously lost
to a schema comment; it now has a dedicated Fix 5 in the quality recovery plan._

---

## 2. Plan says X but reality looks wrong

Places where the plan prescribes something but on inspection the right move
looks different. Claude raises here before deviating.

_None open as of 2026-11-07._

---

## 3. Plan says X but it feels like busywork now

Defensive code, cooldowns, retry logic, telemetry, tests — the stuff that's
tempting to skip because nothing is failing today. If Claude is tempted to
skip it, it goes here instead so the user can choose.

_None open as of 2026-11-07._

The last time this pattern fired was 2026-11-06 with the AeroDataBox cooldown:
the plan said write it, nothing was failing, Claude skipped. Result: QR4 failed
day-of-travel because the cooldown wasn't there to move to the next API. That's
the failure mode this section exists to prevent recurring.

---

## How this file works

- **When Claude writes here:** before continuing past the point where the
  mismatch was noticed. The file is the mechanism. If Claude writes an item here
  and keeps going without waiting for a decision, that's a separate failure.
- **When the user reads here:** whenever they want. Not an obligation. The user
  can also ignore items and Claude has to then raise again in chat.
- **When items close:** when the user gives a decision, the item is either
  deleted (decision applied immediately) or moved into the plan with a note
  (decision requires more work). No zombie items.
