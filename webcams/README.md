# 📷 Public Webcam Hub

A hub of **live public webcams** — traffic, transit, scenic, parks, and weather
cameras — aggregated from official feeds and organized by country on a world
map, with category filters, search, and a click-to-watch grid.

Public feeds only. This project does **not** include or link to private or
unsecured security cameras — see [`SOURCES.md`](SOURCES.md) for the scope line
and the full source directory.

| | |
| --- | --- |
| **Runs** | static page, no build step (part of the `Maps` repo) |
| **Default data** | Transport for London JamCams (~900 cams, no key) loads on open |
| **Scale up** | add free API keys in the UI, or bulk-build a catalog offline |
| **Map** | reuses the repo's world TopoJSON; countries assigned by lat/lon |

## Run it

From the repo root (the app fetches map data at runtime, so it needs a server):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/webcams/
```

On open it loads the keyless **TfL JamCams** feed, so you immediately see
hundreds of real London traffic cameras plotted on the UK. Click a country to
filter, use the category chips, or search by name/place. Click any camera to
watch its live image / video.

### Offline preview (no server, no keys)

`webcams/preview.html` is a single self-contained file that runs the whole hub
in **embed mode** with 36 sample cameras across 18 countries (placeholder tiles,
not live frames) — open it straight from disk to see the layout and
interactions. Regenerate it after UI changes with:

```sh
node webcams/tools/make-preview.mjs
```

Embed mode (`window.WC_EMBED = { topo, seed, cameras }`) also lets you ship a
fully offline build with your own prebuilt catalog inlined.

## Add more sources (live, in-browser)

Open the **Sources** panel and paste a provider's free key, then hit **Load**:

| Provider | Key | Coverage |
| --- | --- | --- |
| Transport for London | none (optional) | London traffic (~900) |
| [Windy Webcams](https://api.windy.com/webcams/docs) | `x-windy-api-key` | Global, 70k+ (all categories) |
| [WSDOT](https://wsdot.wa.gov/traffic/api/) | access code | Washington State traffic |
| [US National Park Service](https://www.nps.gov/subjects/developer/api-documentation.htm) | developer key | US national parks |
| Custom 511 / DOT | per-service | any JSON/GeoJSON camera feed (field-mapped) |

Keys are stored only in your browser's `localStorage` and sent straight to the
provider.

**CORS:** some government REST endpoints (Windy, WSDOT) don't send CORS headers,
so a browser fetch can be blocked even though the data is public. Two options:

1. Set a **CORS proxy base** in Sources ▸ Advanced (`proxyBase + encodedURL`).
2. Better for scale — build a static catalog offline (below).

### Custom 511 / DOT feeds

Any feed exposing name + lat/lon + image URL can be mapped in. In the Sources
panel paste a JSON config, e.g.:

```json
{
  "url": "https://511ny.org/api/getcameras?key=YOUR_KEY&format=json",
  "arrayPath": "",
  "source": "511ny",
  "sourceName": "511NY",
  "countryHint": "United States of America",
  "category": "traffic",
  "mapping": { "id": "ID", "name": "Name", "lat": "Latitude", "lon": "Longitude", "image": "Url" }
}
```

`mapping` values are dotted paths into each row (`geometry.coordinates.0` works
for GeoJSON).

## Build a big catalog offline (the "mass" path)

`tools/build-catalog.mjs` runs the same adapters under Node (18+), assigns each
camera to a country (it decodes the TopoJSON and does point-in-polygon inline —
no npm install), and writes `data/catalog.json`. The site auto-loads that file
when present, so you get thousands of cameras with **zero runtime API calls**.

```sh
# from the repo root
WINDY_API_KEY=xxx WSDOT_KEY=xxx NPS_KEY=xxx \
  node webcams/tools/build-catalog.mjs \
    --providers tfl,windy,wsdot,nps --limit 5000

# custom 511/DOT feeds (see tools/feeds.example.json)
N511_KEY=xxx node webcams/tools/build-catalog.mjs \
  --providers custom --config webcams/tools/feeds.example.json
```

Flags: `--providers` (comma list), `--limit` (max per provider), `--out`
(default `webcams/data/catalog.json`), `--config` (custom feeds file). Keys come
from env vars: `WINDY_API_KEY`, `WSDOT_KEY`, `NPS_KEY`, `TFL_KEY` (optional),
and whatever `keyEnv` your custom feeds reference.

Re-run on a schedule (cron / CI) to keep the catalog fresh, commit the JSON, and
the hub serves a mass, country-organized camera map statically.

## Files

```
webcams/
  index.html              the hub UI
  js/countries.js         country assignment (point-in-polygon on the atlas)
  js/providers.js         live client-side provider adapters
  js/hub.js               app: map, filters, search, grid, modal
  data/catalog.seed.json  source directory (providers + browse links)
  data/catalog.json       optional prebuilt catalog (from build-catalog.mjs)
  tools/build-catalog.mjs Node bulk ingestion CLI
  tools/feeds.example.json sample custom-feed configs
  SOURCES.md              categorized directory of public webcam sources + scope
```

Reuses `../vendor/d3.min.js`, `../vendor/topojson-client.min.js`, and
`../data/countries-110m.json` from the parent `Maps` project.

## Adding a new provider

1. Add an adapter to `js/providers.js` (`adapters.myprovider`) returning
   `normalize(...)`'d cameras.
2. Mirror it in `tools/build-catalog.mjs` so the bulk path gets it too.
3. Add a `providers[]` entry to `data/catalog.seed.json` so it shows in the UI.

Keep it to sources that publish cameras for public viewing.
