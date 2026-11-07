# CLAUDE.md

Project-specific instructions for Claude working on Where's My Plane. Loaded
every session.

## The rule that matters most

**When the plan says X but the product looks thin, wrong, or you've been
asked for something outside scope — raise it, don't silently decide.**

Silent deferral and silent interpretation are both failures. They are what
caused the 2026-11-07 quality recovery to be needed in the first place. See
`REFLECTION_2026_11_07.md` for the specific incidents.

The mechanism:
1. Write the mismatch in `OPEN_DECISIONS.md` in the appropriate section.
2. Raise it in chat the next time you message the user.
3. Do not continue past the point of mismatch until the user has decided.

If you're tempted to skip boring-but-necessary code because nothing is failing
today — that's section 3 of `OPEN_DECISIONS.md`, not a silent skip.

If the plan prescribes thin content and you suspect a reasonable user would
expect more — that's section 2, not a shipped thin version.

If the user has asked for something and it doesn't fit the current phase —
that's section 1, not a `-- TODO: future` comment in the schema.

## The standing quality bar

Every surface must clear `QUALITY_BAR.md` before being called done. Claude
writes the bar once (it's standing, not per-feature); Claude checks against it
before each ship. The user never writes acceptance criteria per task.

Before reporting any work as shipped, describe it in user-visible terms the
user could check at a glance ("I added QR4 and the tail showed up"), not in
implementation terms ("the KV key exists"). If you can't describe a
user-visible result, you haven't built enough.

## Decision-making defaults

- Opus plans. Sonnet executes. See `C:\Users\DV\.claude\projects\c--Users-DV-OneDrive-Desktop-Claude-Aviation\memory\feedback_opus_plan_sonnet_execute.md`.
- Explain tradeoffs for architecture choices. Don't hand down a single answer.
- Plain language, not jargon. Say what the thing does, not what it is in the abstract.
- No per-task acceptance criteria written by the user. Quality lives on Claude's side.
- No DevTools QA checklists for the user. "Open the page and tell me if X works" — one line.

## Deferred (don't touch during quality recovery)

- Phase 4 Voice Q&A
- Phase 5 Photo spotter
- Phase 6 Price monitoring
- Phase 7 PWA + push
- Three ingest workflows (EUROCONTROL / BTS / CAA) — keep punctuality honest-blank

## Current state

- Live at https://wheres-my-plane.pages.dev.
- On-demand cron shipped 2026-11-07 (Start/Stop panel on `/app`, 2-min cadence).
- Quality recovery plan at `QUALITY_RECOVERY_PLAN.md`; start-here at `NEXT_SESSION_TODO.md`.
- Working tree should be clean after each fix lands.
