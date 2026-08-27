/* Public Webcam Hub — main app.
 *
 * Loads cameras from the live provider adapters (js/providers.js), buckets each
 * into a country by lat/lon (js/countries.js), and renders a by-country world
 * map + a filterable/searchable grid of live feeds. Only public providers.
 */
(function () {
  'use strict';

  var A = WCProviders.adapters;
  var CATS = WCProviders.CATEGORIES;

  var state = {
    byId: new Map(),        // id -> camera
    counts: new Map(),      // country name -> count
    total: 0,
    filters: { country: null, category: 'all', query: '' },
    keys: loadKeys(),
    seed: null,
    page: 0,
    pageSize: 240,
    loading: new Set(),
    embed: false
  };

  var map = { svg: null, g: null, path: null, projection: null, features: null };

  /* ---------------- init ---------------- */
  function init() {
    wireStaticControls();
    // Embed mode: everything is inlined (no fetch) — used by the standalone
    // preview and by fully-offline deployments. window.WC_EMBED carries the
    // topojson, the source directory, and a prebuilt camera list.
    if (window.WC_EMBED) {
      state.embed = true;
      buildMap(WC_EMBED.topo);
      state.seed = WC_EMBED.seed || { providers: [], directory: [] };
      renderSourcesPanel();
      renderDirectory();
      ingestCameras(WC_EMBED.cameras || [], 'sample data');
      return;
    }
    Promise.all([
      fetch('../data/countries-110m.json').then(function (r) { return r.json(); }),
      fetch('./data/catalog.seed.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      buildMap(res[0]);
      state.seed = res[1];
      renderSourcesPanel();
      renderDirectory();
      // A prebuilt catalog (webcams/data/catalog.json from tools/build-catalog.mjs)
      // is used when present; otherwise fall back to the keyless live default.
      loadStaticCatalog().then(function (n) {
        if (!n) loadProvider('tfl', { key: state.keys.tfl || '', proxyBase: state.keys.proxyBase || '' });
      });
    }).catch(function (e) {
      status('Failed to load base data: ' + e.message, true);
    });
  }

  /* ---------------- map ---------------- */
  function buildMap(topo) {
    var fc = topojson.feature(topo, topo.objects.countries);
    map.features = fc.features;
    WCGeo.build(fc.features);

    var W = 960, H = 500;
    map.svg = d3.select('#map').attr('viewBox', '0 0 ' + W + ' ' + H);
    map.projection = d3.geoNaturalEarth1().fitSize([W, H - 8], { type: 'Sphere' });
    map.path = d3.geoPath(map.projection);

    map.g = map.svg.append('g');
    map.g.append('path')
      .attr('class', 'sphere')
      .attr('d', map.path({ type: 'Sphere' }));
    map.g.append('path')
      .datum(d3.geoGraticule10())
      .attr('class', 'graticule')
      .attr('d', map.path);

    map.g.selectAll('path.country')
      .data(fc.features)
      .join('path')
      .attr('class', 'country')
      .attr('fill', '#26324a')
      .attr('d', map.path)
      .on('click', function (ev, d) {
        var n = d.properties.name;
        setFilter('country', state.filters.country === n ? null : n);
      })
      .on('mousemove', function (ev, d) { showTip(ev, d.properties.name); })
      .on('mouseleave', hideTip);

    var zoom = d3.zoom().scaleExtent([1, 9]).on('zoom', function (ev) {
      map.g.attr('transform', ev.transform);
      map.g.selectAll('path').attr('stroke-width', 0.7 / ev.transform.k);
    });
    map.svg.call(zoom);
  }

  function paintMap() {
    if (!map.g) return;
    var max = 0;
    state.counts.forEach(function (v, k) { if (k !== 'Unknown' && v > max) max = v; });
    // Dim base -> blue -> bright yellow, clamped so even a single camera is
    // clearly brighter than the no-data base and reads well on the dark map.
    var color = d3.scaleLinear()
      .domain([1, Math.max(2, max)])
      .range(['#3f7fb3', '#ffd84d'])
      .interpolate(d3.interpolateRgb)
      .clamp(true);
    map.g.selectAll('path.country')
      .attr('fill', function (d) {
        var c = state.counts.get(d.properties.name) || 0;
        return c ? color(c) : '#26324a';
      })
      .classed('selected', function (d) {
        return d.properties.name === state.filters.country;
      });
    updateLegend(max);
  }

  function updateLegend(max) {
    var el = document.getElementById('map-legend');
    if (!el) return;
    if (!max) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = '<span>fewer</span><span class="bar"></span>' +
      '<span>more</span><span class="mx">' + fmt(max) + ' max</span>';
  }

  var tip = null;
  function showTip(ev, name) {
    if (!tip) tip = document.getElementById('map-tip');
    var c = state.counts.get(name) || 0;
    tip.innerHTML = '<b>' + esc(name) + '</b><br>' + c + (c === 1 ? ' camera' : ' cameras');
    tip.style.display = 'block';
    tip.style.left = (ev.offsetX + 14) + 'px';
    tip.style.top = (ev.offsetY + 14) + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }

  /* ---------------- providers ---------------- */
  function loadProvider(id, opts) {
    var adapter = A[id];
    if (!adapter) return;
    state.loading.add(id);
    reflectProviderRow(id);
    status('Loading ' + id + '…');
    adapter(opts || {}).then(function (cams) {
      // Replace any existing cameras from this source.
      var stale = [];
      state.byId.forEach(function (c, key) { if (c.source === id) stale.push(key); });
      stale.forEach(function (k) { state.byId.delete(k); });
      cams.forEach(function (c) {
        c.country = WCGeo.assign(c.lat, c.lon) || c.countryHint || 'Unknown';
        state.byId.set(c.id, c);
      });
      state.loading.delete(id);
      recompute();
      renderAll();
      status(fmt(cams.length) + ' cameras from ' + id + ' · ' + fmt(state.total) + ' total');
      reflectProviderRow(id);
    }).catch(function (e) {
      state.loading.delete(id);
      reflectProviderRow(id);
      var msg = e.message || String(e);
      if (/Failed to fetch|NetworkError|CORS/i.test(msg)) {
        msg += ' — likely CORS. Try a proxy base (Sources ▸ Advanced) or use the build tool.';
      }
      status(id + ': ' + msg, true);
    });
  }

  // Merge a batch of already-normalized cameras (from a prebuilt catalog or
  // embedded sample data) into state and re-render.
  function ingestCameras(cams, label) {
    if (!cams || !cams.length) return 0;
    cams.forEach(function (c) {
      if (!c.country) c.country = WCGeo.assign(c.lat, c.lon) || c.countryHint || 'Unknown';
      state.byId.set(c.id, c);
    });
    recompute();
    renderAll();
    (state.seed.providers || []).forEach(function (p) { reflectProviderRow(p.id); });
    status('Loaded ' + fmt(cams.length) + ' cameras from ' + (label || 'catalog') +
      ' · ' + fmt(state.total) + ' total');
    return cams.length;
  }

  // Load a prebuilt static catalog if one has been generated. Returns a
  // promise of how many cameras were ingested (0 if none / not present).
  function loadStaticCatalog() {
    return fetch('./data/catalog.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) return 0;
      return r.json().then(function (data) {
        var cams = Array.isArray(data) ? data : (data.cameras || []);
        return ingestCameras(cams, 'prebuilt catalog');
      });
    }).catch(function () { return 0; });
  }

  function recompute() {
    state.counts = new Map();
    state.byId.forEach(function (c) {
      state.counts.set(c.country, (state.counts.get(c.country) || 0) + 1);
    });
    state.total = state.byId.size;
  }

  /* ---------------- filtering ---------------- */
  function filtered() {
    var f = state.filters, q = f.query.trim().toLowerCase();
    var out = [];
    state.byId.forEach(function (c) {
      if (f.country && c.country !== f.country) return;
      if (f.category !== 'all' && c.category !== f.category) return;
      if (q && (c.name || '').toLowerCase().indexOf(q) < 0 &&
               (c.country || '').toLowerCase().indexOf(q) < 0) return;
      out.push(c);
    });
    out.sort(function (a, b) {
      return (a.country || '').localeCompare(b.country || '') ||
             (a.name || '').localeCompare(b.name || '');
    });
    return out;
  }

  function setFilter(kind, value) {
    state.filters[kind] = value;
    state.page = 0;
    renderAll();
  }

  /* ---------------- rendering ---------------- */
  function renderAll() {
    paintMap();
    renderStats();
    renderCategoryChips();
    renderCountrySelect();
    renderGrid();
  }

  function renderStats() {
    var countries = 0;
    state.counts.forEach(function (v, k) { if (k !== 'Unknown' && v) countries++; });
    document.getElementById('stats').innerHTML =
      '<div class="stat"><b>' + fmt(state.total) + '</b><span>cameras</span></div>' +
      '<div class="stat"><b>' + fmt(countries) + '</b><span>countries</span></div>' +
      '<div class="stat"><b>' + fmt(filtered().length) + '</b><span>shown</span></div>';
  }

  function renderCategoryChips() {
    var perCat = {}; CATS.forEach(function (c) { perCat[c] = 0; });
    state.byId.forEach(function (c) { perCat[c.category] = (perCat[c.category] || 0) + 1; });
    var wrap = document.getElementById('category-filter');
    var chips = [chip('all', 'All', state.total, state.filters.category === 'all')];
    CATS.forEach(function (c) {
      if (perCat[c]) chips.push(chip(c, cap(c), perCat[c], state.filters.category === c));
    });
    wrap.innerHTML = chips.join('');
    Array.prototype.forEach.call(wrap.querySelectorAll('.chip'), function (b) {
      b.onclick = function () { setFilter('category', b.dataset.v); };
    });
  }

  function chip(v, label, n, active) {
    return '<button class="chip' + (active ? ' active' : '') + '" data-v="' + v + '">' +
      esc(label) + ' <span>' + fmt(n) + '</span></button>';
  }

  function renderCountrySelect() {
    var sel = document.getElementById('country-filter');
    var entries = [];
    state.counts.forEach(function (v, k) { entries.push([k, v]); });
    entries.sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    var opts = ['<option value="">All countries (' + fmt(state.total) + ')</option>'];
    entries.forEach(function (e) {
      opts.push('<option value="' + esc(e[0]) + '">' + esc(e[0]) + ' (' + fmt(e[1]) + ')</option>');
    });
    sel.innerHTML = opts.join('');
    sel.value = state.filters.country || '';
  }

  function renderGrid() {
    var list = filtered();
    var head = document.getElementById('grid-head');
    var loc = state.filters.country ? ' in ' + esc(state.filters.country) : '';
    var cat = state.filters.category !== 'all' ? ' · ' + esc(cap(state.filters.category)) : '';
    head.innerHTML = '<span>' + fmt(list.length) + ' cameras' + loc + cat + '</span>' +
      (state.filters.country || state.filters.category !== 'all' || state.filters.query ?
        '<button id="clear-filters">Clear filters</button>' : '');
    var cf = document.getElementById('clear-filters');
    if (cf) cf.onclick = function () {
      state.filters = { country: null, category: 'all', query: '' };
      document.getElementById('search').value = '';
      state.page = 0; renderAll();
    };

    var grid = document.getElementById('grid');
    var show = list.slice(0, (state.page + 1) * state.pageSize);
    grid.innerHTML = show.map(cardHTML).join('') ||
      '<p class="empty">No cameras match. Load a provider or widen the filter.</p>';
    Array.prototype.forEach.call(grid.querySelectorAll('.cam'), function (fig) {
      fig.onclick = function () { openModal(state.byId.get(fig.dataset.id)); };
    });
    observeThumbs(grid);

    var more = document.getElementById('grid-more');
    if (show.length < list.length) {
      more.innerHTML = '<button id="more-btn">Show more (' +
        fmt(list.length - show.length) + ' remaining)</button>';
      document.getElementById('more-btn').onclick = function () {
        state.page++; renderGrid();
      };
    } else more.innerHTML = '';
  }

  function cardHTML(c) {
    var thumb = c.image ?
      '<img class="thumb" loading="lazy" alt="" data-base="' + esc(c.image) +
        '" data-refresh="' + c.refreshSec + '" src="' + esc(c.image) + '">' :
      '<div class="thumb noimg"><span>▶ live</span></div>';
    return '<figure class="cam" data-id="' + esc(c.id) + '">' + thumb +
      '<figcaption><span class="c-name">' + esc(c.name) + '</span>' +
      '<span class="c-meta">' + esc(c.country) + ' · ' + esc(cap(c.category)) +
      '</span></figcaption><span class="c-src">' + esc(c.source) + '</span></figure>';
  }

  /* refresh visible thumbnails on their own cadence */
  var io = null;
  function observeThumbs(grid) {
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        en.target._visible = en.isIntersecting;
      });
    }, { rootMargin: '200px' });
    Array.prototype.forEach.call(grid.querySelectorAll('img.thumb'), function (img) {
      img._visible = true; img._last = Date.now(); io.observe(img);
    });
  }
  setInterval(function () {
    var now = Date.now();
    Array.prototype.forEach.call(document.querySelectorAll('#grid img.thumb'), function (img) {
      if (!img._visible) return;
      var every = (parseInt(img.dataset.refresh, 10) || 120) * 1000;
      if (now - (img._last || 0) < every) return;
      img._last = now;
      img.src = bust(img.dataset.base, now);
    });
  }, 15000);

  // Add a cache-buster so a snapshot image reloads — but never mangle a data:
  // URI (or other non-http source), which has no query string to append to.
  function bust(url, t) {
    if (!url || /^data:/i.test(url)) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + '_=' + (t || Date.now());
  }

  /* ---------------- modal ---------------- */
  function openModal(c) {
    if (!c) return;
    var body;
    if (c.stream && /\.(mp4|webm)(\?|$)/i.test(c.stream)) {
      body = '<video src="' + esc(c.stream) + '" autoplay muted loop controls playsinline></video>';
    } else if (c.embed) {
      body = '<iframe src="' + esc(c.embed) + '" allow="autoplay; fullscreen" allowfullscreen></iframe>';
    } else if (c.stream) {
      body = '<video src="' + esc(c.stream) + '" autoplay muted loop controls playsinline></video>';
    } else if (c.image) {
      body = '<img id="modal-img" data-base="' + esc(c.image) + '" src="' +
        esc(bust(c.image)) + '" alt="">';
    } else {
      body = '<p class="empty">No viewable stream for this camera.</p>';
    }
    var links = [];
    if (c.page) links.push('<a href="' + esc(c.page) + '" target="_blank" rel="noopener">Open source ↗</a>');
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-title').textContent = c.name;
    document.getElementById('modal-sub').innerHTML =
      esc(c.country) + ' · ' + esc(cap(c.category)) + ' · ' + esc(c.sourceName) +
      (links.length ? ' · ' + links.join(' ') : '') +
      (c.attribution ? '<span class="attrib">' + esc(c.attribution) + '</span>' : '');
    document.getElementById('modal').classList.remove('hidden');
  }
  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    document.getElementById('modal-body').innerHTML = '';   // stop playback
  }

  /* ---------------- sources panel ---------------- */
  function renderSourcesPanel() {
    var wrap = document.getElementById('sources-panel');
    if (state.embed) {
      wrap.innerHTML = '<p class="src-note" style="color:var(--accent)">Preview — showing ' +
        'sample cameras with placeholder tiles. In the full app this panel loads ' +
        'live feeds (TfL keyless by default; Windy / WSDOT / NPS with a free key).</p>';
      return;
    }
    var html = state.seed.providers.map(function (p) {
      var loaded = false; state.byId.forEach(function (c) { if (c.source === p.id) loaded = true; });
      var needsKey = !p.keyless;
      var keyRow = needsKey || p.id === 'tfl' || p.id === 'custom511' ?
        '<div class="key-row" data-for="' + p.id + '">' + keyInputs(p) + '</div>' : '';
      return '<div class="src" data-src="' + p.id + '">' +
        '<div class="src-head">' +
          '<button class="src-load" data-id="' + p.id + '">' +
            (p.keyless ? 'Load' : 'Load') + '</button>' +
          '<div class="src-info"><b>' + esc(p.name) + '</b>' +
          '<span>' + esc(p.scope) + ' · ' + esc(String(p.count)) + ' · ' +
          (p.keyless ? 'no key' : 'free key') + '</span></div>' +
          '<span class="src-state" data-state="' + p.id + '"></span>' +
        '</div>' + keyRow + '</div>';
    }).join('');
    wrap.innerHTML = html;

    Array.prototype.forEach.call(wrap.querySelectorAll('.src-load'), function (b) {
      b.onclick = function () { loadFromPanel(b.dataset.id); };
    });
  }

  function keyInputs(p) {
    if (p.id === 'tfl') {
      return input('tfl', 'Optional free key (raises rate limit)', state.keys.tfl);
    }
    if (p.id === 'windy') {
      return input('windy', 'Windy API key (x-windy-api-key)', state.keys.windy) +
        note('Browser CORS may block Windy — set a proxy base below or use the build tool.');
    }
    if (p.id === 'wsdot') return input('wsdot', 'WSDOT access code', state.keys.wsdot);
    if (p.id === 'nps') return input('nps', 'NPS developer key', state.keys.nps);
    if (p.id === 'custom511') {
      return '<textarea class="cfg" data-id="custom511" rows="5" placeholder=' +
        '\'{"url":"https://511ny.org/api/getcameras?key=KEY","arrayPath":"","source":"511ny",' +
        '"sourceName":"511NY","countryHint":"United States of America","category":"traffic",' +
        '"mapping":{"id":"ID","name":"Name","lat":"Latitude","lon":"Longitude","image":"Url"}}\'>' +
        esc(state.keys.custom511 || '') + '</textarea>' +
        note('Paste a JSON config: feed url + field mapping. See README.');
    }
    return '';
  }

  function input(id, ph, val) {
    return '<input class="key" data-id="' + id + '" type="text" placeholder="' +
      esc(ph) + '" value="' + esc(val || '') + '">';
  }
  function note(t) { return '<p class="src-note">' + esc(t) + '</p>'; }

  function loadFromPanel(id) {
    var opts = { proxyBase: state.keys.proxyBase || '' };
    if (id === 'custom511') {
      var ta = document.querySelector('textarea.cfg[data-id="custom511"]');
      var raw = ta ? ta.value.trim() : '';
      state.keys.custom511 = raw; saveKeys();
      if (!raw) { status('Paste a custom511 JSON config first.', true); return; }
      try { Object.assign(opts, JSON.parse(raw)); }
      catch (e) { status('custom511 config is not valid JSON: ' + e.message, true); return; }
    } else {
      var inp = document.querySelector('input.key[data-id="' + id + '"]');
      var val = inp ? inp.value.trim() : '';
      state.keys[id] = val; saveKeys();
      opts.key = val;
    }
    loadProvider(id, opts);
  }

  function reflectProviderRow(id) {
    var s = document.querySelector('.src-state[data-state="' + id + '"]');
    if (!s) return;
    if (state.loading.has(id)) { s.textContent = '…'; s.className = 'src-state busy'; return; }
    var n = 0; state.byId.forEach(function (c) { if (c.source === id) n++; });
    s.textContent = n ? '✓ ' + fmt(n) : '';
    s.className = 'src-state' + (n ? ' ok' : '');
  }

  function renderDirectory() {
    var wrap = document.getElementById('directory');
    wrap.innerHTML = state.seed.directory.map(function (d) {
      return '<a class="dir" href="' + esc(d.url) + '" target="_blank" rel="noopener">' +
        '<b>' + esc(d.name) + '</b><span>' + esc(d.scope) + ' · ' + esc(cap(d.category)) +
        '</span></a>';
    }).join('');
  }

  /* ---------------- static wiring ---------------- */
  function wireStaticControls() {
    document.getElementById('search').addEventListener('input', function (e) {
      state.filters.query = e.target.value; state.page = 0; renderGrid(); renderStats();
    });
    document.getElementById('country-filter').addEventListener('change', function (e) {
      setFilter('country', e.target.value || null);
    });
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', function (e) {
      if (e.target.id === 'modal') closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
    var adv = document.getElementById('proxy-input');
    adv.value = state.keys.proxyBase || '';
    adv.addEventListener('change', function () {
      state.keys.proxyBase = adv.value.trim(); saveKeys();
    });
  }

  /* ---------------- helpers ---------------- */
  function status(msg, isErr) {
    var el = document.getElementById('status');
    el.textContent = msg;
    el.className = isErr ? 'err' : '';
  }
  function loadKeys() {
    try { return JSON.parse(localStorage.getItem('wchub.keys') || '{}'); }
    catch (e) { return {}; }
  }
  function saveKeys() {
    try { localStorage.setItem('wchub.keys', JSON.stringify(state.keys)); } catch (e) {}
  }
  function fmt(n) { return (n || 0).toLocaleString('en-US'); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})();
