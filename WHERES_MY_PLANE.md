# Where's My Plane: product narrative

This file describes what we are building and why. It is the reference for product decisions. Technical design, schemas and code structure are left to the build, as long as they respect the constraints and principles below.

## What it is

Where's My Plane is a personal flight companion with an always-on agent behind it. It works for any commercial flight worldwide. You tell it a flight you have booked, for example BA456 tomorrow, SQ322 next week or QF1 in March. From that point it works on its own. It finds out which aircraft will operate the flight, what type it is, where that aircraft flies before your departure, and how punctual the route and airports have been. On the day of travel it watches the inbound aircraft and tells you, by voice, when something changes. At any point you can ask "where's my plane?" and get a spoken answer built from live data.

Alongside the personal view sits a global disruption map: a navigable, map-first dashboard showing aircraft in the air worldwide, airports coloured by delay, weather at airports, and your own aircraft's path for the day.

A second capability, the photo spotter, lets anyone upload a photo of an aircraft taken anywhere in the world. The app reads the registration painted on the fuselage and returns the aircraft's story: its age, type, when it was delivered, and which airlines flew it before.

## Why build it

This is a personal showcase project. It should demonstrate four things working together in one product: an agent that acts on a schedule without being prompted, voice in and out, computer vision on user photos, and a rich interactive map. It also has to be useful. The test is whether I would open it before my own next flight, wherever that flight is.

## Hard constraints

- Budget is about £20 a month for the coding tool and £5 to £10 a month for APIs. Nothing else is paid.
- No GPU rental and no hardware rental. GPU work runs on free tiers only (Kaggle, Colab T4).
- Open-source tools and public data only. No budget to buy data.
- Free API tiers are the default. Every external call must be cached, because free quotas are small (AeroDataBox's free plan is roughly 600 requests a month).
- Scraping public pages is allowed by the owner's decision. Scrapers must be polite: low frequency, cached, identifiable user agent, and they must back off on errors.
- "Always-on" means scheduled and event-driven jobs on free compute. There is no server running 24/7.
- Non-commercial personal project. Several sources (OpenSky, LiveATC, CAA, EUROCONTROL) restrict commercial use, resale or modification.

## Global first, regional depth where it exists

The core experience must work for any flight on any continent, using sources with worldwide coverage: a flight data API for schedules and tail numbers, community ADS-B networks for live positions, a global aircraft database for airframe history, and global airport weather.

Some regions publish richer official data. Europe (EUROCONTROL), the United States (FAA and the Bureau of Transportation Statistics) and the United Kingdom (CAA) publish punctuality, delay and registry data for free. The product uses these as enrichments when a flight touches those regions, never as the only path. Where no official data exists, the product computes its own punctuality from logged ADS-B movements against schedules.

## The experience

### 1. Adding a flight

I type or say "I'm on BA456 tomorrow." The agent confirms the route and scheduled times, then tells me the usual aircraft type and how the route and airports have performed recently. The punctuality figure comes from the best available source for that route, and the answer names the source:

| Route touches | Punctuality source |
|---|---|
| A EUROCONTROL-area airport | EUROCONTROL airport punctuality (OTP15, monthly) and daily airport delay data |
| A US airport on a US carrier | Bureau of Transportation Statistics flight-level on-time data (monthly) |
| A UK airport | CAA route and airline punctuality (monthly) |
| Anywhere else | Flight data API delay statistics where the quota allows, then the product's own logged history |

If the specific aircraft is not yet assigned, the agent says so plainly and tells me when it will check again. Airlines often assign the tail number late, sometimes only on the morning of departure, so the experience must handle "aircraft not yet known" as a normal state.

### 2. Meeting my aircraft

Once a registration is assigned, the app shows an aircraft card: registration, type, age, delivery date, previous operators and registrations, and a photo with photographer credit. The map draws the aircraft's flights for the day as arcs, so I can see that my aircraft starts in Singapore, flies to Sydney, then comes back for my flight.

An important detail for the build: the flight number (BA456) and the ATC callsign broadcast by the aircraft are often different. The Mode-S hex code returned by the flight data API is the reliable key for tracking the aircraft live on any ADS-B network.

### 3. Travel day monitoring

On the day of travel, from about six hours before departure (longer for long-haul inbound aircraft), the agent checks every 15 to 30 minutes. It compares the inbound aircraft's expected landing time plus the airline's minimum turnaround with my scheduled departure. All times are shown in the local time of the relevant airport, with my home time alongside when they differ.

It stays quiet while nothing changes. It sends an alert to my phone (Telegram, as text plus a short voice note) only when the predicted delay crosses a threshold or something material happens: a tail swap, a diversion, a gate change, or a cancellation.

Outside travel days the agent does nothing for my flights, which protects the API quota.

### 4. Asking "where's my plane?"

Two hours before departure I ask, by voice in the browser or in Telegram. A good answer sounds like this (illustrative):

> "Your aircraft is over the Bay of Bengal, due to land in Singapore at 21:10 local time. Allowing 90 minutes to turn around, expect pushback around 22:40, about 15 minutes after your scheduled time. Singapore departures are running on time this evening."

Spoken answers lead with the answer, use local times, give numbers rather than adjectives, and stay under about 20 seconds. Follow-up questions should work: "Where was it this morning?", "How old is it?", "Is the weather at Changi a problem?"

When the inbound aircraft is over an ocean or a region with sparse ADS-B coverage, the answer says when it was last seen and where it is expected to be, rather than presenting an estimate as a live position.

### 5. The global disruption map

The dashboard is map-first and fully navigable: pan and zoom from the whole world down to a single airport, and click any aircraft or airport for detail. Layers can be toggled:

| Layer | What it shows |
|---|---|
| Live traffic | Aircraft positions worldwide, thinned to dots at world zoom and full icons when zoomed in |
| My aircraft | Today's flights as arcs, current or last-known position highlighted |
| Airport delays | Major airports worldwide coloured by current delay, using official feeds where they exist and ADS-B-derived movement rates elsewhere |
| Airport weather | Current conditions and forecasts at airports on my route and at major hubs |
| Coverage | Where ADS-B reception is sparse, so gaps are not read as missing aircraft |
| Disruption feed | A side panel listing what the agent has noticed, newest first |

Live traffic refreshes only for the visible area and only while the page is open, to stay inside the free limits of the ADS-B networks.

### 6. Photo spotter

Anyone can upload a photo of an aircraft, taken anywhere: at an airport, from a terminal window or from the ground. The app:

1. Reads the registration from the fuselage or tail using a vision model or open-source OCR.
2. Checks it against national registration formats by prefix (G- for the UK, N for the US, 9V- for Singapore, VH- for Australia, A6- for the UAE, and so on) and against the global aircraft database.
3. Returns a story card. Illustrative example: "9V-XXX is a Boeing 777-300ER, 14 years old. It first flew in 2012, was delivered new to its current operator, and is currently on the ground in Singapore."
4. If no registration is readable, it uses the photo's timestamp and location (when present) to suggest which aircraft were near that spot at that time, using ADS-B history, and asks the user to confirm.

Photo handling rules: photos are processed and not kept beyond the session, location metadata is stripped before anything is stored or shared, and any third-party aircraft photo shown back to the user carries its photographer credit and link as the source requires.

### 7. After the flight

The agent records actual departure and arrival times against the schedule. Over weeks this builds my own punctuality history, which later feeds the predictor and fills the gaps where no official punctuality data exists.

## How the predictor should behave

Version 1 is rule-based: inbound landing time, minimum turnaround for the aircraft type and airport, route and airport history from the best available source, and current airport delays. It outputs a delay range (for example "10 to 20 minutes late") and labels it as an estimate. It does not show percentages or confidence scores, because there is no calibration data yet.

Version 2 trains a model on free Kaggle GPUs. Training data can come from the product's own logs and from open historical ADS-B archives, matched against schedules. Probabilities appear only after the model's calibration has been checked against logged outcomes, and calibration is checked separately by region because data quality differs.

## Data sources

### Global core

| Source | What it gives us | Access and limits | Link |
|---|---|---|---|
| AeroDataBox (via RapidAPI) | Worldwide flight status by flight number and date, tail number, aircraft model, ATC callsign, Mode-S hex, flights by registration, registration history, airport delays, flight delay statistics, a beta image recognition endpoint | Free plan about 600 requests a month with roughly 365 days of history. Endpoints are tiered (Tier 1 to 4); delay statistics, global airport delays and image recognition are Tier 3 and may sit outside the free plan | [aerodatabox.com](https://aerodatabox.com), [RapidAPI listing](https://rapidapi.com/aedbx-aedbx/api/aerodatabox), [endpoint reference](https://pub.dev/documentation/aerodatabox/latest), [free tier note](https://github.com/mbriney/Travel) |
| AirLabs | Backup for worldwide live flights and flight info: registration, aircraft type, hex, delays, gates | Free plan with no credit card, sized for prototyping | [Docs](https://airlabs.co/docs/), [developer guide](https://airlabs.co/travel-apis-for-developers) |
| aviationstack | Second backup for flight status | 100 free requests a month | [Pricing](https://aviationstack.com/pricing) |
| adsb.lol | Worldwide live aircraft positions, unfiltered, plus daily historical archives | Free API; data under the ODbL licence (attribution, share-alike). The API may require a key in future, obtainable by feeding data. Contact the operator before relying on it heavily | [API spec](https://api.adsb.lol/api/openapi.json), [project](https://github.com/adsblol), [historical data example](https://project-awesome.org/r/adsblol-globe_history) |
| OpenSky Network live API | Second source for live positions by hex or bounding box | Free for non-commercial use with daily request limits; commercial use needs written permission | [API docs](https://openskynetwork.github.io/opensky-api) |
| OpenSky aircraft database | Global airframe records: registration, type, operator, owner, build date, first flight date, previous and next registration, keyed by Mode-S hex | Free download, refreshed periodically | [Aircraft database](https://opensky-network.org/aircraft-database), [field list example](https://gitlab.com/whitebox-aero/whitebox/-/issues/413) |
| adsbdb | Routes and aircraft details by callsign or hex | Free API | [adsbdb](https://www.adsbdb.com) |
| airfleets.net | Operator history per airframe, first flight date, age, for airliners worldwide | Public pages; scraping is the owner's decision, keep it light and cached | [airfleets.net](https://www.airfleets.net) |
| airport-data.com | Aircraft records with delivery date and other registrations | Public pages; same scraping rules | [airport-data.com](https://airport-data.com) |
| Planespotters.net photo API | One photo per aircraft by registration or hex | Free with no key. Each photo must credit the photographer next to the image and link to its Planespotters page; photos cannot be a paid or member-only feature; requests must send an identifying user agent | [Photo API and terms](https://planespotters.net/photo/api) |
| aviationweather.gov | METAR and TAF weather for airports worldwide | Free public API | [Data API](https://aviationweather.gov/data/api/) |

### Regional enrichments

| Region | Source | What it gives us | Link |
|---|---|---|---|
| Europe | EUROCONTROL Aviation Intelligence Portal | Departure and arrival punctuality (OTP15) by state and main airport, daily airport ATFM delays, turnaround times. Airport punctuality is reported monthly and typically lands two months after the month of operation. Data may be copied with the copyright notice and disclaimer but not modified without permission | [Punctuality](https://ansperformance.eu/punctuality/), [data downloads](https://www.ansperformance.eu/data/) |
| United States | Bureau of Transportation Statistics | Flight-level on-time data for US carriers, monthly | [TranStats](https://www.transtats.bts.gov/) |
| United States | FAA National Airspace System status | Current ground stops and delay programmes at US airports | [NAS Status](https://nasstatus.faa.gov/) |
| United States | FAA Releasable Aircraft Database | Registry of US (N-) aircraft as a downloadable archive refreshed each federal working day | [Download page](https://www.faa.gov/licenses_certificates/aircraft_certification/aircraft_registry/releasable_aircraft_download/) |
| United Kingdom | CAA punctuality statistics | Monthly punctuality by UK airport, route and airline. Must be credited to the CAA and cannot be sold | [Statistics (2024 example page)](https://caa.co.uk/data-and-analysis/uk-aviation-market/flight-punctuality/uk-flight-punctuality-statistics/2024), [guide](https://www.caa.co.uk/data-and-analysis/uk-aviation-market/flight-punctuality/statistics-guide/) |
| United Kingdom | CAA G-INFO register | Current and historical registration details for UK (G-) aircraft. Not a register of legal ownership | [G-INFO](https://www.caa.co.uk/aircraft-register/g-info), [field definitions](https://caa.co.uk/aircraft-register/g-info/what-do-the-data-fields-mean) |
| Any major airport | Airport departure boards | Current delays, gates, cancellations | Per airport; scrape every 15 to 30 minutes at most, starting with the top 50 hubs |

### Sources deliberately not used

| Source | Reason | Link |
|---|---|---|
| Amadeus Self-Service | Shut down on 17 July 2026; only Enterprise contracts remain | [PhocusWire report](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) |
| LiveATC audio | Terms prohibit third-party use of its live streams | [LiveATC terms](https://liveatc.net/legal) |
| Live air traffic control audio | Laws on receiving ATC radio vary by country, and in the UK unauthorised reception is an offence under section 48 of the Wireless Telegraphy Act 2006 | [Ofcom guidance summary](https://www.icqpodcast.com/news/2015/12/13/receive-only-radio-scanners-guidance) |

## Preferred building blocks

These are preferences, not requirements. Swap any of them if something free does the job better.

| Need | Preferred option | Link |
|---|---|---|
| Scheduled agent runs and Python jobs | GitHub Actions in a public repo (free on standard runners; scheduled workflows pause after 60 days without repo activity) | [Limits and billing](https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration) |
| Frequent polling, API and voice endpoint | Cloudflare Workers with cron triggers, free tier | [Workers](https://developers.cloudflare.com/workers/) |
| Map rendering | MapLibre GL JS with free vector tiles, deck.gl for arcs and dense aircraft layers | [MapLibre](https://maplibre.org), [deck.gl](https://deck.gl) |
| Speech in the browser | Web Speech API | [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) |
| Spoken briefings for Telegram | Kokoro text-to-speech on CPU | [Kokoro](https://github.com/hexgrad/kokoro) |
| Speech-to-text for Telegram voice notes | faster-whisper on CPU | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) |
| Free GPU for model training | Kaggle notebooks (about 30 GPU hours a week) | [Kaggle](https://www.kaggle.com/code) |
| LLM for answering questions | A small model via API for routine answers, within the £5 to £10 budget | |

## Known limits

- Tail assignment can arrive late, so the aircraft card may show the expected type for most of the day before travel.
- Free flight data quotas cover roughly 30 tracked trips a month if each trip uses about 15 calls. The global map must lean on ADS-B networks, scraped boards and weather data rather than the paid-tier flight APIs.
- ADS-B coverage is dense over Europe, North America and much of Asia, and thin over oceans, polar routes and parts of Africa, Central Asia and South America. Long-haul inbound aircraft will disappear from the map for hours at a time.
- Official punctuality data is monthly, lags by one to two months, and exists only for Europe, the US and the UK among the sources above. Elsewhere the product depends on its own logged history, which starts empty.
- Scrapers will break when sites change. Each scraper should fail quietly and the product should degrade rather than stop.
- Photo recognition will fail on distant, angled or night shots, and on registrations in non-Latin scripts. The fallback flow (timestamp and location) must be clear about its uncertainty.

## What done looks like for version 1

- I can add any commercial flight worldwide by text or voice and see its aircraft (or expected type), punctuality from the best available source with that source named, and the aircraft's day on the map.
- On a real travel day the agent runs unattended from six hours before departure and sends at least one accurate status briefing to my phone.
- Asking "where's my plane?" returns a correct spoken answer within about five seconds, including when the aircraft is outside ADS-B coverage.
- The disruption map loads on a phone, zooms from world view to a single airport, and shows at least live traffic, airport delays and my aircraft.
- The photo spotter correctly identifies the registration from a clear photo of an aircraft from any country and returns age, type and previous operators.
- The product is tested on at least three flights in different regions: one within Europe, one within or to the US, and one entirely outside both.
- Monthly running cost stays within £10 for APIs.
