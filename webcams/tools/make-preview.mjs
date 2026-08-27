#!/usr/bin/env node
/* Generate webcams/preview.html — a self-contained, open-anywhere demo of the
 * hub running in "embed mode" (window.WC_EMBED) with sample cameras and
 * generated SVG placeholder tiles. No server, no keys, no network: everything
 * (d3, topojson-client, the world atlas, the app scripts, and the sample data)
 * is inlined into one HTML file.
 *
 *   node webcams/tools/make-preview.mjs
 *
 * The tiles are clearly-labelled sample art, NOT real camera frames — the
 * preview exists to show the layout and interactions. The real app loads live
 * public feeds (see README.md).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const R = p => readFileSync(resolve(ROOT, p), 'utf8');

const CAT = {
  traffic:  { a: '#f2b134', b: '#6e4a0e' }, city:     { a: '#5ba7f7', b: '#153556' },
  scenic:   { a: '#8a6cff', b: '#271c55' }, nature:   { a: '#3fbf7f', b: '#123c2b' },
  weather:  { a: '#56ccf2', b: '#103848' }, harbor:   { a: '#4a90d9', b: '#122b46' },
  beach:    { a: '#f2a65a', b: '#6e3d19' }, mountain: { a: '#9fb2cc', b: '#26334c' },
  airport:  { a: '#b06cf0', b: '#341b4e' }, transit:  { a: '#4fd6bd', b: '#11433b' }
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function thumb(name, cat) {
  const c = CAT[cat] || CAT.city;
  const svg =
`<svg xmlns='http://www.w3.org/2000/svg' width='320' height='200' viewBox='0 0 320 200' font-family='Arial, sans-serif'>
<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
<stop offset='0' stop-color='${c.a}'/><stop offset='1' stop-color='${c.b}'/></linearGradient>
<radialGradient id='v' cx='0.5' cy='0.42' r='0.8'>
<stop offset='0.5' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='0.5'/></radialGradient></defs>
<rect width='320' height='200' fill='url(#g)'/>
<g opacity='0.12' stroke='#000' stroke-width='1'>
<path d='M0 50 H320 M0 100 H320 M0 150 H320 M80 0 V200 M160 0 V200 M240 0 V200'/></g>
<rect width='320' height='200' fill='url(#v)'/>
<g fill='none' stroke='#fff' stroke-width='3' opacity='0.55'>
<path d='M18 40 V22 H36'/><path d='M284 22 H302 V40'/><path d='M302 160 V178 H284'/><path d='M36 178 H18 V160'/></g>
<text x='160' y='108' text-anchor='middle' font-size='30' font-weight='bold' fill='#ffffff' opacity='0.92' letter-spacing='3'>${esc(cat.toUpperCase())}</text>
<text x='160' y='130' text-anchor='middle' font-size='11' fill='#ffffffcc' letter-spacing='2'>LIVE PUBLIC CAMERA</text>
<circle cx='22' cy='24' r='5' fill='#ff4b4b'/><text x='34' y='29' font-weight='bold' font-size='13' fill='#fff'>LIVE</text>
<text x='16' y='183' font-weight='bold' font-size='15' fill='#fff'>${esc(name)}</text>
<rect x='0.5' y='0.5' width='319' height='199' fill='none' stroke='#ffffff33'/>
</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\n/g, ''));
}

const RAW = [
  ['A2 New Cross Road','United Kingdom',51.476,-0.036,'traffic','tfl','TfL JamCams'],
  ['A40 Westway','United Kingdom',51.517,-0.213,'traffic','tfl','TfL JamCams'],
  ['Tower Bridge Approach','United Kingdom',51.505,-0.075,'city','tfl','TfL JamCams'],
  ['I-5 @ Seattle CBD','United States of America',47.606,-122.332,'traffic','wsdot','WSDOT'],
  ['SR-520 Floating Bridge','United States of America',47.640,-122.260,'traffic','wsdot','WSDOT'],
  ['Times Square','United States of America',40.758,-73.985,'city','earthcam','EarthCam'],
  ['Golden Gate Overlook','United States of America',37.807,-122.475,'harbor','windy','Windy Webcams'],
  ['Miami South Beach','United States of America',25.782,-80.130,'beach','windy','Windy Webcams'],
  ['Old Faithful, Yellowstone','United States of America',44.460,-110.828,'nature','nps','US National Park Service'],
  ['Denver Intl Airport','United States of America',39.850,-104.673,'airport','windy','Windy Webcams'],
  ['CN Tower / Gardiner','Canada',43.642,-79.387,'traffic','on511','511 Ontario'],
  ['Banff — Bow Valley','Canada',51.178,-115.571,'mountain','windy','Windy Webcams'],
  ['Niagara Falls','Canada',43.083,-79.075,'nature','windy','Windy Webcams'],
  ['Sydney Harbour Bridge','Australia',-33.852,151.211,'harbor','windy','Windy Webcams'],
  ['Bondi Beach','Australia',-33.891,151.277,'beach','windy','Windy Webcams'],
  ['Great Ocean Road','Australia',-38.665,143.104,'scenic','windy','Windy Webcams'],
  ['A10 Amsterdam Ring','Netherlands',52.345,4.878,'traffic','ndw','NDW'],
  ['Eiffel Tower / Trocadéro','France',48.861,2.288,'city','windy','Windy Webcams'],
  ['Promenade des Anglais','France',43.695,7.265,'beach','windy','Windy Webcams'],
  ['Chamonix — Mont Blanc','France',45.923,6.869,'mountain','windy','Windy Webcams'],
  ['Shibuya Crossing','Japan',35.659,139.700,'city','windy','Windy Webcams'],
  ['Colosseum','Italy',41.890,12.492,'scenic','skyline','Skyline Webcams'],
  ['Venice — Grand Canal','Italy',45.440,12.335,'scenic','skyline','Skyline Webcams'],
  ['La Rambla, Barcelona','Spain',41.380,2.173,'city','windy','Windy Webcams'],
  ['Copacabana','Brazil',-22.971,-43.183,'beach','windy','Windy Webcams'],
  ['Table Bay, Cape Town','South Africa',-33.905,18.421,'harbor','windy','Windy Webcams'],
  ['Table Mountain Cableway','South Africa',-33.957,18.403,'nature','windy','Windy Webcams'],
  ['Burj Khalifa / Downtown','United Arab Emirates',25.197,55.274,'city','windy','Windy Webcams'],
  ['Santorini — Oia Caldera','Greece',36.461,25.376,'scenic','skyline','Skyline Webcams'],
  ['Zermatt — Matterhorn','Switzerland',46.020,7.749,'mountain','windy','Windy Webcams'],
  ['Queenstown Bay','New Zealand',-45.031,168.662,'mountain','windy','Windy Webcams'],
  ['Reykjavík Harbour','Iceland',64.152,-21.941,'weather','windy','Windy Webcams'],
  ['Frankfurt Airport A3','Germany',50.048,8.573,'airport','windy','Windy Webcams'],
  ['Brandenburg Gate','Germany',52.516,13.378,'city','windy','Windy Webcams'],
  ['Oslo Central Station','Norway',59.911,10.750,'transit','windy','Windy Webcams'],
  ['Grand Canyon South Rim','United States of America',36.061,-112.108,'nature','nps','US National Park Service']
];
const REFRESH = { tfl: 180, wsdot: 90, windy: 300, nps: 120, skyline: 300, earthcam: 300, on511: 120, ndw: 120 };

const cameras = RAW.map(([name, country, lat, lon, category, source, sourceName], i) => ({
  id: source + ':' + i, source, sourceName, name, country, countryHint: country,
  category, lat, lon, image: thumb(name, category), stream: null, embed: null, page: null,
  attribution: 'Sample tile — preview only', refreshSec: REFRESH[source] || 120
}));

const topo = JSON.parse(R('data/countries-110m.json'));
const seed = JSON.parse(R('webcams/data/catalog.seed.json'));
const atlas = new Set(topo.objects.countries.geometries.map(g => g.properties.name));
const missing = [...new Set(cameras.map(c => c.country))].filter(n => !atlas.has(n));
if (missing.length) { console.error('MISSING atlas countries:', missing); process.exit(1); }

const s = t => '<script>' + R(t) + '</scr' + 'ipt>\n';
const embed = '<script>window.WC_EMBED=' + JSON.stringify({ topo, seed, cameras }) + ';</scr' + 'ipt>\n';
const INLINE =
  s('vendor/d3.min.js') + s('vendor/topojson-client.min.js') + embed +
  s('webcams/js/countries.js') + s('webcams/js/providers.js') + s('webcams/js/hub.js');

const index = R('webcams/index.html');
const MARK = '<script src="../vendor/d3.min.js"></script>';
const html = index.slice(0, index.indexOf(MARK)) + INLINE + '</body>\n</html>\n';
writeFileSync(resolve(ROOT, 'webcams/preview.html'), html);

console.log(`preview.html: ${cameras.length} cameras, ` +
  `${new Set(cameras.map(c => c.country)).size} countries, ${(html.length / 1024 | 0)}KB`);
