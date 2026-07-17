#!/usr/bin/env node
/* Build a static webcam catalog from the public provider APIs.
 *
 * This is the "mass hub" path: run it with API keys (env vars) and it fetches
 * from each allow-listed public provider, buckets every camera into a country
 * by point-in-polygon against the repo's world TopoJSON, and writes a single
 * webcams/data/catalog.json the static site can serve with zero runtime API
 * calls. Dependency-free — decodes TopoJSON and does point-in-polygon inline.
 *
 * Usage:
 *   WINDY_API_KEY=... WSDOT_KEY=... NPS_KEY=... TFL_KEY=... \
 *     node webcams/tools/build-catalog.mjs \
 *       --providers tfl,windy,wsdot,nps --limit 3000
 *
 *   # custom 511/DOT feeds (array of adapter configs, same shape as the UI):
 *   node webcams/tools/build-catalog.mjs --providers custom --config webcams/tools/feeds.json
 *
 * Only public providers. No private/unsecured cameras.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');            // repo root
const TOPO = resolve(ROOT, 'data', 'countries-110m.json');
const OUT_DEFAULT = resolve(__dirname, '..', 'data', 'catalog.json');

/* ---------------- CLI ---------------- */
function parseArgs(argv) {
  const a = { providers: ['tfl'], limit: 3000, out: OUT_DEFAULT, config: null };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--providers') a.providers = argv[++i].split(',').map(s => s.trim());
    else if (k === '--limit') a.limit = parseInt(argv[++i], 10) || a.limit;
    else if (k === '--out') a.out = resolve(process.cwd(), argv[++i]);
    else if (k === '--config') a.config = resolve(process.cwd(), argv[++i]);
  }
  return a;
}

/* ---------------- normalize (mirrors js/providers.js) ---------------- */
const CATS = ['traffic', 'city', 'scenic', 'nature', 'weather', 'harbor',
              'beach', 'mountain', 'airport', 'transit', 'other'];
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : n;
}
function normalize(p) {
  return {
    id: p.id, source: p.source, sourceName: p.sourceName || p.source,
    name: p.name || 'Untitled camera', country: null, countryHint: p.countryHint || null,
    category: CATS.includes(p.category) ? p.category : 'other',
    lat: numOrNull(p.lat), lon: numOrNull(p.lon),
    image: p.image || null, stream: p.stream || null, embed: p.embed || null,
    page: p.page || null, attribution: p.attribution || '', refreshSec: p.refreshSec || 60
  };
}
function get(obj, path) {
  let cur = obj; for (const part of String(path).split('.')) { if (cur == null) break; cur = cur[part]; }
  return cur == null ? null : cur;
}

/* ---------------- providers (Node fetch) ---------------- */
async function fetchJSON(url, headers) {
  const r = await fetch(url, { headers: headers || {} });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.json();
}

const adapters = {
  async tfl() {
    let url = 'https://api.tfl.gov.uk/Place/Type/JamCam';
    if (process.env.TFL_KEY) url += '?app_key=' + encodeURIComponent(process.env.TFL_KEY);
    const arr = await fetchJSON(url);
    const prop = (pl, key) => (pl.additionalProperties || []).find(p => p.key === key)?.value ?? null;
    return arr.map(pl => normalize({
      id: 'tfl:' + pl.id, source: 'tfl', sourceName: 'Transport for London — JamCams',
      name: pl.commonName, lat: pl.lat, lon: pl.lon, category: 'traffic',
      countryHint: 'United Kingdom', image: prop(pl, 'imageUrl'), stream: prop(pl, 'videoUrl'),
      page: 'https://www.tfl.gov.uk/traffic/status', attribution: 'Powered by TfL Open Data', refreshSec: 180
    })).filter(c => c.image || c.stream);
  },

  async windy({ limit }) {
    const key = process.env.WINDY_API_KEY;
    if (!key) throw new Error('WINDY_API_KEY not set');
    const want = Math.min(limit, 10000), pageSize = 50, out = [];
    for (let offset = 0; out.length < want; offset += pageSize) {
      const url = `https://api.windy.com/webcams/api/v3/webcams?limit=${pageSize}&offset=${offset}` +
        '&include=images,location,player,urls,categories';
      const data = await fetchJSON(url, { 'x-windy-api-key': key });
      const cams = data.webcams || [];
      for (const w of cams) {
        const loc = w.location || {};
        const cat = (w.categories && w.categories[0] && w.categories[0].id) || 'scenic';
        out.push(normalize({
          id: 'windy:' + w.webcamId, source: 'windy', sourceName: 'Windy Webcams',
          name: w.title, lat: loc.latitude, lon: loc.longitude, countryHint: loc.country,
          category: mapWindyCat(cat), image: get(w, 'images.current.preview'),
          embed: get(w, 'player.live.embed') || get(w, 'player.day.embed'),
          page: get(w, 'urls.detail'), attribution: 'Webcams provided by Windy.com', refreshSec: 300
        }));
      }
      if (cams.length < pageSize) break;
    }
    return out;
  },

  async wsdot() {
    const key = process.env.WSDOT_KEY;
    if (!key) throw new Error('WSDOT_KEY not set');
    const url = 'https://wsdot.wa.gov/traffic/api/HighwayCameras/HighwayCamerasREST.svc' +
      '/GetCamerasAsJson?AccessCode=' + encodeURIComponent(key);
    const arr = await fetchJSON(url);
    return arr.map(c => {
      const loc = c.CameraLocation || {};
      return normalize({
        id: 'wsdot:' + c.CameraID, source: 'wsdot', sourceName: 'WSDOT Highway Cameras',
        name: c.Title || loc.Description || ('Camera ' + c.CameraID),
        lat: loc.Latitude, lon: loc.Longitude, category: 'traffic',
        countryHint: 'United States of America', image: c.ImageURL,
        page: 'https://wsdot.com/travel/real-time/map', attribution: 'Data courtesy of WSDOT', refreshSec: 90
      });
    }).filter(c => c.image);
  },

  async nps() {
    const key = process.env.NPS_KEY;
    if (!key) throw new Error('NPS_KEY not set');
    const data = await fetchJSON('https://developer.nps.gov/api/v1/webcams?limit=500&api_key=' +
      encodeURIComponent(key));
    return (data.data || []).map(w => {
      const park = (w.relatedParks && w.relatedParks[0]) || {};
      return normalize({
        id: 'nps:' + w.id, source: 'nps', sourceName: 'US National Park Service',
        name: w.title + (park.fullName ? ' — ' + park.fullName : ''),
        lat: w.latitude, lon: w.longitude, category: 'nature',
        countryHint: 'United States of America', image: (w.images && w.images[0] && w.images[0].url) || null,
        embed: w.isStreaming && w.streamUrl ? w.streamUrl : null, page: w.url,
        attribution: 'Courtesy of the U.S. National Park Service', refreshSec: 120
      });
    }).filter(c => c.image || c.embed);
  },

  // Runs every config in the --config file (array of custom511 adapter configs).
  async custom({ configs }) {
    const out = [];
    for (const cfg of configs || []) {
      let url = cfg.url;
      const key = cfg.keyEnv ? process.env[cfg.keyEnv] : cfg.key;
      if (key && cfg.keyParam) url += (url.includes('?') ? '&' : '?') + cfg.keyParam + '=' + encodeURIComponent(key);
      const m = cfg.mapping || {};
      try {
        const data = await fetchJSON(url);
        const arr = cfg.arrayPath ? get(data, cfg.arrayPath) : data;
        if (!Array.isArray(arr)) { console.warn(`  ! ${cfg.source}: feed is not an array`); continue; }
        arr.forEach((row, i) => out.push(normalize({
          id: (cfg.source || 'custom') + ':' + (m.id ? get(row, m.id) : i),
          source: cfg.source || 'custom', sourceName: cfg.sourceName || 'Custom feed',
          name: m.name ? get(row, m.name) : 'Camera ' + i,
          lat: m.lat ? get(row, m.lat) : null, lon: m.lon ? get(row, m.lon) : null,
          category: cfg.category || 'traffic', countryHint: cfg.countryHint || null,
          image: m.image ? get(row, m.image) : null, stream: m.stream ? get(row, m.stream) : null,
          page: m.page ? get(row, m.page) : cfg.page || null,
          attribution: cfg.attribution || '', refreshSec: cfg.refreshSec || 120
        })));
      } catch (e) { console.warn(`  ! ${cfg.source}: ${e.message}`); }
    }
    return out;
  }
};

function mapWindyCat(c) {
  const map = {
    traffic: 'traffic', city: 'city', square: 'city', building: 'city', beach: 'beach',
    harbor: 'harbor', port: 'harbor', mountain: 'mountain', ski: 'mountain', lake: 'nature',
    river: 'nature', park: 'nature', forest: 'nature', wildlife: 'nature',
    airport: 'airport', landscape: 'scenic', weather: 'weather'
  };
  return map[String(c).toLowerCase()] || 'scenic';
}

/* ---------------- TopoJSON decode + point-in-polygon ---------------- */
function buildCountryIndex(topo) {
  const { scale, translate } = topo.transform || { scale: [1, 1], translate: [0, 0] };
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx; y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  const ring = (idxs) => {
    const pts = [];
    for (const idx of idxs) {
      const a = idx < 0 ? arcs[~idx].slice().reverse() : arcs[idx];
      for (let i = pts.length ? 1 : 0; i < a.length; i++) pts.push(a[i]);
    }
    return pts;
  };
  const polys = (geom) => {
    if (geom.type === 'Polygon') return [geom.arcs.map(ring)];
    if (geom.type === 'MultiPolygon') return geom.arcs.map(p => p.map(ring));
    return [];
  };
  return topo.objects.countries.geometries.map(g => {
    const polygons = polys(g);
    let w = 180, s = 90, e = -180, n = -90;
    for (const poly of polygons) for (const r of poly) for (const [x, y] of r) {
      if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
    }
    return { name: g.properties?.name, polygons, bounds: [w, s, e, n] };
  }).filter(c => c.name);
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function pointInCountry(lon, lat, c) {
  const [w, s, e, n] = c.bounds;
  if (lat < s || lat > n || lon < w || lon > e) return false;
  for (const poly of c.polygons) {          // poly = [outerRing, ...holes]
    let crossings = 0;
    for (const r of poly) if (pointInRing(lon, lat, r)) crossings++;
    if (crossings % 2 === 1) return true;    // even-odd: outer minus holes
  }
  return false;
}
function assignCountry(index, lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return null;
  for (const c of index) if (pointInCountry(lon, lat, c)) return c.name;
  return null;
}

/* ---------------- main ---------------- */
async function main() {
  const args = parseArgs(process.argv);
  const topo = JSON.parse(readFileSync(TOPO, 'utf8'));
  const index = buildCountryIndex(topo);
  console.log(`Loaded ${index.length} countries from atlas.`);

  let configs = [];
  if (args.config) configs = JSON.parse(readFileSync(args.config, 'utf8'));

  const byId = new Map();
  for (const id of args.providers) {
    const fn = adapters[id];
    if (!fn) { console.warn(`Unknown provider: ${id}`); continue; }
    process.stdout.write(`Fetching ${id}… `);
    try {
      const cams = await fn({ limit: args.limit, configs });
      let placed = 0;
      for (const c of cams) {
        c.country = assignCountry(index, c.lat, c.lon) || c.countryHint || 'Unknown';
        if (c.country !== 'Unknown') placed++;
        byId.set(c.id, c);
      }
      console.log(`${cams.length} cameras (${placed} geo-placed).`);
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
  }

  const cams = [...byId.values()];
  const byCountry = {};
  for (const c of cams) byCountry[c.country] = (byCountry[c.country] || 0) + 1;
  const catalog = {
    generated: new Date().toISOString(),
    providers: args.providers,
    total: cams.length,
    countries: Object.keys(byCountry).filter(k => k !== 'Unknown').length,
    byCountry,
    cameras: cams
  };
  writeFileSync(args.out, JSON.stringify(catalog));
  console.log(`\nWrote ${cams.length} cameras across ${catalog.countries} countries -> ${args.out}`);
}

export { buildCountryIndex, assignCountry, normalize, TOPO };

// Only run when invoked directly (not when imported by a test).
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
