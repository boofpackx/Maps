# Public webcam sources

A categorized directory of **public-facing** webcam feeds — cameras that an
operator publishes deliberately for anyone to watch (traffic and transit
cameras, weather and coastal cams, scenic/tourism cams, park and wildlife
streams). These are the sources the hub aggregates.

Everything here is either an **official government/operator portal** or a
**documented public API** with published terms. Where a key is needed it is a
free developer key from the operator. Always read each provider's terms and
attribution requirements before redistributing frames.

## What is in scope vs. out of scope

**In scope — cameras meant to be seen.** Public agencies and businesses run
these on purpose: a DOT streams its highway cameras so drivers can check
traffic; a city streams a harbor cam for tourism; a park streams a wildlife
feed for the public. Redistributing them (with attribution) is the intended use.

**Out of scope — private cameras that were never meant to be public.** This
project deliberately does **not** include, link to, or scrape:

- Unsecured IP cameras / DVRs exposed to the internet by default passwords or
  misconfiguration (e.g. Insecam-style aggregators).
- Forums, pastes, or channels that share access to strangers' security cameras,
  nanny cams, doorbells, or workplace CCTV.
- Any feed obtained by guessing credentials, exploiting a device, or otherwise
  accessing a camera the owner did not publish for public viewing.

Those are people's homes and businesses. Aggregating them is a privacy
violation and, in most jurisdictions, unauthorized-access crime — regardless of
whether the stream is technically reachable. The adapters in this repo only talk
to the allow-listed public providers below.

---

## Global, multi-country

| Source | What | Access |
| --- | --- | --- |
| [Windy Webcams API](https://api.windy.com/webcams/docs) | 70,000+ categorized public webcams worldwide (landscape, city, traffic, beach, harbor, mountain). The single best global source. | Free API key (`x-windy-api-key`). |
| [Windy.com Webcams](https://www.windy.com/webcams) | Browse the same database on a map. | Open (browse). |
| [Skyline Webcams](https://www.skylinewebcams.com/) | Curated live cams — cities, beaches, nature, wildlife. | Open (browse / embed). |
| [WebcamTaxi](https://www.webcamtaxi.com/) | Curated public live streams (mostly official YouTube feeds). | Open (browse). |
| [EarthCam](https://www.earthcam.com/) | Large public webcam network, cities and landmarks. | Open (browse / embed). |

## Traffic & transport (official DOT / transit)

| Source | Region | Access |
| --- | --- | --- |
| [TfL JamCams](https://api-portal.tfl.gov.uk/) | London, UK (~900 cams) | Open data; free key optional. Keyless-friendly + CORS — the hub's default live source. |
| [WSDOT Traveler Info API](https://wsdot.wa.gov/traffic/api/) | Washington, US | Free access code. |
| [Caltrans QuickMap / CCTV](https://quickmap.dot.ca.gov/) | California, US | Public. |
| [511NY](https://511ny.org/developers/help) | New York, US | Free key. |
| [FL511](https://fl511.com/) | Florida, US | Public / key. |
| [Ontario 511](https://511on.ca/) | Ontario, CA | Public / key. |
| [DriveBC](https://www.drivebc.ca/) | British Columbia, CA | Public snapshots. |
| [Transport for NSW Live Traffic](https://opendata.transport.nsw.gov.au/) | NSW, Australia | Free Open Data key. |
| [Rijkswaterstaat / NDW](https://www.ndw.nu/) | Netherlands | Open data. |

> Aggregating many 511 systems means one integration per jurisdiction (each has
> its own key/format). The `custom511` adapter and the build tool are built for
> exactly this field-mapping job. Third-party normalizers like
> [Road511](https://road511.com/) unify ~65 US/CA jurisdictions behind one
> GeoJSON schema (their key) if you'd rather not wire each one.

## Weather, coast & environment

| Source | What | Access |
| --- | --- | --- |
| [NOAA NDBC](https://www.ndbc.noaa.gov/) | Coastal/buoy cams & imagery | Public. |
| [USGS Volcano Cams](https://www.usgs.gov/programs/VHP/volcano-webcams) | Volcano monitoring cameras | Public. |
| [Windy.com](https://www.windy.com/webcams) | Weather-tagged public cams | Key (see above). |

## Nature, parks & wildlife

| Source | What | Access |
| --- | --- | --- |
| [US National Park Service API](https://www.nps.gov/subjects/developer/api-documentation.htm) | Park webcams (streaming + snapshot) | Free NPS key. |
| [Explore.org Live Cams](https://explore.org/livecams) | Wildlife & nature livestreams | Open (browse / YouTube). |
| [YouTube Live](https://developers.google.com/youtube/v3) | City / harbor / beach / wildlife public streams | YouTube Data API key, or channel `live_stream` embed. |

## City & scenic

Covered by Windy, Skyline, WebcamTaxi, EarthCam, and YouTube Live above — these
are where most tourism/landmark/harbor cams live.

---

## How the hub uses these

- **Live, in-browser (`js/providers.js`)** — TfL loads keyless by default;
  Windy / WSDOT / NPS / a custom 511 feed load when you paste that provider's
  free key into the Sources panel. Fetching happens in your browser, so keys
  stay local to your session.
- **Bulk / offline (`tools/build-catalog.mjs`)** — the same adapters run under
  Node with keys from environment variables to build a large static
  `catalog.json` you can commit and serve without any runtime API calls. This is
  the path to a "mass" hub of tens of thousands of cameras.

See `README.md` for setup and keys.
