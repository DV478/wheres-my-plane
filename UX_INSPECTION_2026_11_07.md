# UX Inspection — Where's My Plane
**Date:** 2026-11-07  
**Reviewer:** UI/UX inspection agent  
**Scope:** All app routes, component library, map popup, flight detail  
**Source:** Code-only review — no live browser. Screenshots described in `FEEDBACK_2026_11_07.md`.

---

## 1. Overall First Impressions

A new user who lands cold on `https://wheres-my-plane.pages.dev` sees a landing page that promises quite a lot — aircraft history, voice alerts, photo spotter — and then opens a dashboard that delivers almost none of it. The brand copy outruns the actual product by roughly two phases. This gap is the first and most damaging impression: the app oversells on the homepage and undersells in every subsequent screen.

Inside the app the visual treatment is consistent but inert. Every page shares the same flat dark-navy, `max-w-4xl` body, and sparse white/opacity text hierarchy. It reads as a Tailwind boilerplate left in its default state rather than a product with a visual identity. There is nothing that communicates "aviation" — no movement, no sense of altitude or speed, no airline-brand colours, no maps bleeding edge-to-edge. The map page is the one exception where the product feels alive, but the moment you click an aircraft the popup makes clear the data layer is thin.

The dashboard is the first thing a signed-in user sees and it is functionally a dead-end: a Start/Stop button with no explanation, two nav links, and a roadmap of features that do not exist yet. A new user has no obvious first action. The flight-detail page, which should be the emotional payoff of the whole product, currently shows two stale placeholder strings as live data. That is what the user noticed, and they are right: it does not feel like a finished product.

---

## 2. Specific Issues (Ranked by Severity)

---

### 2.1 Stale placeholder string displayed as live data
**Severity:** CRITICAL  
**File:** `src/lib/server/flights/otp.ts`, line 86–89  
**What's wrong:** The `pickOtp` function returns `label: 'Punctuality feeds arrive in Phase 3.'` as a fallback when no OTP data row is found. Phase 3 is shipped and running. The `OtpBadge` component renders this string verbatim on the flight-detail page. A user who added a real flight today (QR4, LHR→DOH) sees that message in a styled badge and reasonably concludes the app is broken or lying to them.  
**What better looks like:** The fallback label should read "No punctuality data for this route yet" (or suppress the badge entirely) — anything that does not reference an internal phase name that has already passed.

---

### 2.2 Aircraft card silently fails and blames the airline
**Severity:** CRITICAL  
**File:** `src/routes/app/flights/[id]/+page.svelte`, lines 74–81  
**What's wrong:** When `data.aircraft` is null the detail page shows "Aircraft not yet assigned — Airlines often publish the tail number only on the day of travel." This is presented as confident product copy, not an error state. For QR4 on 7 Nov (day of travel), FR24 showed tail A7-API and equipment A388. The app failed to fetch it and blamed the airline. The user noticed immediately and rightly called it out.  
**What better looks like:** The fallback card should distinguish between "not yet assigned by the airline" and "we failed to look it up" — with an honest "couldn't retrieve aircraft data" message and a manual refresh trigger instead of presenting a known-false explanation.

---

### 2.3 Scheduler panel has no onboarding copy
**Severity:** MAJOR  
**File:** `src/routes/app/+page.svelte`, lines 77–98  
**What's wrong:** The dashboard opens with a panel titled "Scheduler" containing a single Start/Stop toggle and a status line that reads "Idle". There is no explanation of what starting does, what it monitors, how often it runs, whether it costs API calls, or what the user should expect. The toggle being green/red — with no tooltip, no inline description, no first-run hint — leaves a cold user with no confidence about what they are activating.  
**What better looks like:** A one-sentence description beneath the heading explaining the purpose ("Keeps your flights up to date and sends Telegram alerts when status changes — runs every 2 minutes while this tab is open") would eliminate the confusion entirely.

---

### 2.4 Map popup shows raw instrument data, not flight context
**Severity:** MAJOR  
**File:** `src/routes/app/map/+page.svelte`, lines 162–196  
**What's wrong:** Clicking an aircraft opens a card showing tail reg, callsign/type code, altitude, speed, and heading. These are transponder fields — useful to an ATC controller, not to someone trying to understand if a plane is their flight. There is no flight number, no origin/destination, no airline, no status, and no connection to whether this aircraft matches any saved flight. The "Look up in my flights" link sends the user away from the map rather than showing the match in-context.  
**What better looks like:** The popup should show flight number and route (e.g. "QR4 · LHR → DOH") when that data is available from ADSB, and an inline "matched to your saved flight" badge when the hex correlates — keeping the user on the map rather than bouncing them to a different page.

---

### 2.5 Flight detail page has no visual status hierarchy
**Severity:** MAJOR  
**File:** `src/routes/app/flights/[id]/+page.svelte`, lines 25–68  
**What's wrong:** Status is rendered as one item in an identical `<dl>` grid tile alongside departure and arrival times. The word "boarding" in plain white medium-weight text has no colour, no visual weight, and no urgency relative to its surrounding elements. There is no prominent status treatment at the top of the page. A user glancing at this page cannot tell at a moment's notice whether their flight is on time, boarding, delayed, or airborne.  
**What better looks like:** A full-width status banner or a prominently coloured chip at the top of the page — not buried in a grid of equal-weight tiles — with colour semantics (green = on time/landed, amber = delayed, red = cancelled, sky = airborne).

---

### 2.6 Dashboard "What's next" roadmap is user-visible
**Severity:** MAJOR  
**File:** `src/routes/app/+page.svelte`, lines 113–122  
**What's wrong:** The dashboard contains a "What's next" panel listing "Phase 3 — Scheduled agent + Telegram alerts", "Phase 4 — Voice Q&A", etc. Phase 3 is already shipped. This internal planning artefact is now live in a user-facing UI. It communicates incompleteness rather than aspiration, and it lists as "coming" a feature that already exists.  
**What better looks like:** Remove or replace the panel entirely. If a roadmap hint belongs at all, it should describe user value ("Voice alerts — coming soon") not internal phase numbers.

---

### 2.7 Landing page advertises features that do not exist
**Severity:** MAJOR  
**File:** `src/routes/+page.svelte`, lines 1–44  
**What's wrong:** The four feature tiles include "Ask by voice" and "Photo spotter" — Phases 4 and 5, explicitly deferred. A user who signs up expecting voice Q&A will be confused when the product has no such feature. This is a trust problem: the landing page sets expectations the product cannot currently meet.  
**What better looks like:** Feature tiles should reflect only what ships today. Deferred features can be referenced in a "coming soon" section clearly separated from current functionality.

---

### 2.8 OtpBadge displays source code as label
**Severity:** MAJOR  
**File:** `src/lib/components/OtpBadge.svelte`, lines 20–29  
**What's wrong:** The badge renders `line.source` directly as the visible heading — so a user sees "EUROCONTROL", "BTS", "CAA", "pending", or "unavailable" as the first thing they read. These are internal data-source identifiers, not human labels. "pending" especially reads as a system status rather than user communication.  
**What better looks like:** Map source identifiers to readable labels ("Historical punctuality (EUROCONTROL)", "No data available") before rendering; never expose internal source enums to the UI layer.

---

### 2.9 Status field in flight list and detail renders raw DB value
**Severity:** MAJOR  
**File:** `src/lib/components/FlightRow.svelte` line 64; `src/routes/app/flights/[id]/+page.svelte` line 55  
**What's wrong:** Both locations use `capitalize` CSS transform on the raw DB status string. This works for "boarding", "airborne", "landed" but will break visually the moment a multi-word or underscored status value appears (e.g. "gate_change", "on_ground"). More importantly, the status has no colour in the detail page — `FlightRow` has `statusColor` logic but the detail view does not.  
**What better looks like:** A shared status display utility that maps every known status to a human label and a consistent colour token, used in both the row and the detail view.

---

### 2.10 Background is flat, unbranded, anonymous
**Severity:** MINOR (but high emotional impact)  
**File:** `src/routes/+layout.svelte` (body), `app.css`  
**What's wrong:** Every page has an identical flat dark-navy background. The design has no visual identity linking it to aviation, travel, or geography. There is no texture, no gradient, nothing that places the user mentally in an airport or aircraft. Compared to any mature flight-tracking product this reads as a default Tailwind scaffold.  
**What better looks like:** Even a subtle radial gradient on the app shell, or a faint airport-grid SVG pattern, or a hero image on the landing page would create distinctiveness. The map page already proves the dark treatment works — the flat shell pages need similar atmosphere.

---

### 2.11 Nav exposes user email address verbatim in every header
**Severity:** MINOR  
**File:** `src/routes/+layout.svelte`, line 16  
**What's wrong:** `{data.user.email}` is rendered as plain `<span>` text in the header on every page. It is non-interactive, adds visual noise, and leaks email to shoulder-surfing. It serves no navigational function.  
**What better looks like:** Replace with an avatar initial or account icon that opens a user menu on click, keeping the email accessible (e.g. in the menu) but not constantly displayed.

---

### 2.12 "Add a flight" form: natural language mode has no example output
**Severity:** MINOR  
**File:** `src/routes/app/flights/new/+page.svelte`, lines 47–57  
**What's wrong:** The natural-language input mode shows only a placeholder ("BA456 tomorrow") with no feedback loop, no "parsed as:" preview, and no indication of what formats work. If parsing fails, the user gets a generic form error but no sense of why or how to rephrase.  
**What better looks like:** After submission, show what the system parsed ("Interpreted: BA456, 2026-11-08") before confirming the add, so the user can verify or correct.

---

### 2.13 Map toggle controls use ✓ / · as state indicators
**Severity:** MINOR  
**File:** `src/routes/app/map/+page.svelte`, lines 140–149  
**What's wrong:** The Traffic and My flights toggle buttons use `✓` and `·` characters to show on/off state. These are semantically ambiguous (is `·` "off" or "loading"?) and inaccessible (no `aria-pressed`, no colour difference beyond opacity). The active state relies solely on `opacity-50` dimming.  
**What better looks like:** Standard toggle buttons with `aria-pressed`, distinct active/inactive background colours, and labels that change between "Show Traffic" / "Hide Traffic" to make state unambiguous.

---

### 2.14 Timezone input is a free-text field
**Severity:** MINOR  
**File:** `src/routes/app/settings/+page.svelte`, lines 99–103  
**What's wrong:** The home timezone field is a plain `<input type="text">` with a monospaced font. Users are expected to know their IANA timezone string ("Europe/London"). There is validation on submit but no suggestion mechanism. This will produce errors for anyone who types "GMT", "UTC+1", or "London".  
**What better looks like:** A `<select>` or combobox pre-populated with common IANA zones (pre-selecting the browser-detected zone) would eliminate bad inputs almost entirely.

---

### 2.15 "Look up in my flights" link on map panel is a dead end
**Severity:** MINOR  
**File:** `src/routes/app/map/+page.svelte`, line 190–195  
**What's wrong:** The link navigates to `/app/flights?hex=<hex>`. That page (`/app/flights`) does not appear to handle a `hex` query parameter (there is no such logic in `flights/+page.svelte`). The link likely loads the flights list with no filtering, leaving the user to scan manually.  
**What better looks like:** Either implement the hex-based lookup server-side so the link resolves to the matched flight, or remove the link entirely until it works.

---

## 3. Comparison-to-Benchmark Gaps

The FR24 popup for QR4 on 7 Nov contained: a large hero photo of the specific aircraft (A7-API Qatar Airways A380), scheduled departure and arrival times with both local and UTC, a human-readable status string with an action verb ("Estimated departure 2:15 PM"), equipment code (A388) alongside the actual tail number (A7-API), callsign (QTR4E), flight number (QR4), and airline name with implied logo. That is eight discrete pieces of information, all sourced from live data.

Our popup for a comparable aircraft contained four: tail reg, callsign/type, altitude, speed. Here is what a mature flight-tracker UI provides that ours does not:

**Data gaps:**
- Flight number and airline on the map popup (ours shows only callsign, which is IATA-flight-code-adjacent but not user-readable)
- Origin and destination on the map popup
- Scheduled departure/arrival on the map popup
- Real-time status with human action language ("Boarding", "Estimated departure 14:15") not just a status string
- Actual tail number on the flight detail page on day-of-travel
- Aircraft operator (airline) linked to the flight, not just the registration database

**Visual/UX elements:**
- Hero photo of the specific aircraft on the flight detail page — `AircraftCard` supports a photo but only when `data.aircraft` is non-null; when the lookup fails (the common case on day-of-travel), there is no photo at all
- Airline logo or brand colour on any surface
- Status chip with colour semantics (green = on time, amber = delay, red = cancelled) — currently status is plain text in a grid tile
- Countdown or elapsed-time display ("Departs in 2h 14m") — we render absolute schedule times only
- Route visualisation on the detail page — no mini arc map, no origin→destination graphic

**Information architecture:**
- FR24's popup is self-contained and actionable; ours links away and delivers less information at the destination
- FR24 surfaces the most time-sensitive item (status/departure time) first; ours buries status in a grid with equal-weight tiles

---

## 4. Low-Hanging Fruit vs Deep Fixes

### Can be fixed in a few hours

- Remove "Punctuality feeds arrive in Phase 3." fallback string; replace with honest "No data for this route" (`src/lib/server/flights/otp.ts` line 87)
- Remove or reword the "What's next" dashboard panel so Phase 3 does not appear as upcoming
- Replace OtpBadge source identifier rendering with human-readable labels
- Add a one-sentence description to the Scheduler panel
- Remove the user email from the header; replace with an avatar initial
- Add `aria-pressed` and colour distinction to the map toggle buttons
- Add colour to the status display on the flight-detail page (the colour logic already exists in `FlightRow.svelte` — extract it to a shared util)
- Change the aircraft "not yet assigned" fallback copy to not blame the airline

### Needs more thought

- Replace the natural-language input with a parsed-preview flow (requires a server round-trip or debounced client call before final submit)
- Design a visual identity — colour palette, type ramp, any background treatment that feels like aviation rather than a generic dark dashboard
- Richer map popup: requires either enriching the ADSB feed with schedule data at fetch time, or a secondary lookup from the hex to a live schedule API
- Aircraft lookup reliability: the fetch pipeline is failing on day-of-travel for real flights; this is a data-pipeline problem, not a UI problem
- Status chip with countdown ("departs in 2h 14m"): requires the detail page to compute and reactively update a time-to-event
- Timezone selector: a full IANA zone picker is a small but non-trivial combobox UI
- Airport disruption monitor: an entirely new data surface; not a UI polish task
- Landing page alignment with actual shipped features: needs a content decision about what to promise

---

## 5. Recommended Ordering of UX Fixes

Ordered by user-impact-per-hour-of-work:

1. **Kill the stale "Phase 3" string in OtpBadge.** One-line change. Removes the most jarring evidence that the product is half-finished.

2. **Fix the aircraft fallback copy.** Reword "Airlines often publish the tail number only on the day of travel" — it is factually wrong in the QR4 case and erodes trust more than saying nothing.

3. **Add a description line to the Scheduler panel.** One sentence of copy. Answers the "what am I supposed to do here?" question without any design work.

4. **Remove the "What's next" roadmap panel from the dashboard.** Delete eight lines of Svelte. Stops the product from advertising its own incompleteness.

5. **Add colour and prominence to flight status on the detail page.** Extract the `statusColor` logic from `FlightRow`, apply it to a full-width chip at the top of the detail view. Instant legibility improvement.

6. **Fix the OtpBadge to display human labels instead of source identifiers.** Small string-mapping table. Makes the punctuality section readable rather than technical.

7. **Remove user email from the nav header.** Replace with an initial avatar. Reduces visual noise on every page.

8. **Update landing page feature tiles to reflect only shipped features.** Voice and Photo spotter should move to a clearly-labelled "coming soon" section.

9. **Add flight number and route to the map popup.** Requires enriching the Aircraft interface with callsign-to-flight-number lookup. Medium effort; high impact — this is the most visible gap versus FR24.

10. **Fix "Look up in my flights" link to either implement hex-based flight matching or be removed.** Currently navigates to an unfiltered list, which is a broken interaction.

11. **Add a status countdown ("departs in X") to the flight detail page.** The schedule times are already present; a reactive derived that computes time-to-event would be a meaningful UX upgrade on day-of-travel.

12. **Investigate and fix the aircraft-assignment lookup failure.** Not a UI problem — but until it works, the AircraftCard (including its photo) never renders for the most important use case (day-of-travel).
