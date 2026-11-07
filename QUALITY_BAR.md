# Quality bar

The standing bar that applies to every page, every popup, every empty state,
every piece of copy. One doc, not per-feature. Written by Claude, checked by
Claude before any surface is called "done." The user tests visually and gives
feedback; this doc is what Claude measures against before the user ever sees
the result.

Written 2026-11-07 after the first user test flopped and five patterns were
identified in `REFLECTION_2026_11_07.md`. If any of these bar items drift,
something has gone wrong with how work is being done, not just the output.

## The bar

### Copy

1. **No placeholder text.** If a string was written to be replaced later ("coming soon", "Phase 3 feeds arrive here", lorem ipsum, hard-coded test values), it does not ship. Searching the shipped build for the word "Phase" followed by a digit should return zero hits outside `/debug`. Same for "TODO", "FIXME", "XXX", "placeholder" inside any user-visible string.
2. **No confident-wrong copy.** If the app says "X is true" and we don't actually know X is true, the copy is wrong. "The airline hasn't published this yet" when we failed to fetch is confident-wrong. "Punctuality data is unavailable" when we never built the ingest is confident-wrong. Honest copy names the real reason: "We tried and failed", "We're not polling yet", "No public feed available."
3. **No raw source codes or internal labels rendered to users.** Strings like `EUROCONTROL`, `pending`, `unavailable`, raw status codes, or any internal enum values do not appear in the UI without a human sentence wrapping them.

### Empty and error states

4. **Every empty state names a real reason.** Not "no data" — the actual reason there's no data, in language the user understands. If there are multiple reasons something could be missing, distinguish between them.
5. **Every failure has a visible next action.** A refresh button, a retry link, a "contact support" line, or at minimum an honest "come back later and we'll have tried again." Dead ends are not acceptable.
6. **If we don't know whether something worked, say so.** Don't guess. Don't assume success. Don't assume failure.

### Interactive surfaces

7. **Every button, panel, or interactive surface has a visible purpose.** A new user landing on the page with no context should be able to tell what each thing is for. If a surface requires explanation, that explanation sits next to the surface (not in a tooltip, not in docs, not somewhere else).
8. **Primary actions are visually primary.** If there's one most important thing a user should do on a page, it is the biggest, most visible, highest-contrast element.
9. **"Start/Stop"-style controls explain what they start and stop.** Not just the verb. The reader should know what happens if they press it.

### Data presentation

10. **Status gets colour semantics.** Green on-time/landed. Amber delayed/warning. Red cancelled/error. Sky airborne/active. Slate unknown/scheduled. Not plain text where a chip would help.
11. **Time-sensitive data shows the time dimension visibly.** "Departs in 2h 14m" beats "Scheduled departure 14:15". Countdowns update at human cadence (per minute, not per second).
12. **Popups and detail views match what a comparable product shows.** For a flight tracker, the implicit benchmark is Flightradar24's popup — operator, route, status, equipment, photo. A popup that shows less than the obvious benchmark will feel incomplete.

### Visual

13. **No surface ships on flat default colour.** The app shell has a deliberate background treatment that is identical across all signed-in pages.
14. **No surface renders raw user data (email, user_id, tokens) in the chrome without a reason.** Use initials, avatars, or menus.

### Process (not UI, but necessary)

15. **No feature dies in a code comment.** When a user ask doesn't fit the current plan, it goes into `OPEN_DECISIONS.md` with a visible decision needed from the user — never into a `-- TODO: future feature here` line that only Claude will ever see.
16. **Nothing is "done" that Claude can't describe in user-visible terms.** "The file exists" is not done. "You can click X and see Y" is done.
17. **When the plan says X but reality looks wrong, Claude raises it — in chat and in `OPEN_DECISIONS.md` — before continuing.** Silent deviation is a quality failure.

## Checking against this bar

Before saying any surface is shipped:

1. Open the page as if you've never seen it before. What's the first thing a user would be confused by?
2. Grep the shipped output for `Phase ` followed by a digit, `TODO`, `FIXME`, and any internal enum values the UI shouldn't render raw.
3. Read every empty-state and error string aloud. Does each one name a real reason? Give a next action?
4. Is there a comparable product the user will implicitly benchmark against? Would our surface feel thin next to it?
5. If anything was quietly deferred during the build, did it land in `OPEN_DECISIONS.md`?

If any answer is no, the surface is not ready.
