/* GD Stat Maps — renders Instagram-style "country/state stats rated with
 * Geometry Dash difficulties" maps onto a canvas, with sequential reveal
 * animation, PNG export and WebM recording.
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('map-canvas');
  const ctx = canvas.getContext('2d');

  const MAP_CONFIGS = {
    us: {
      file: 'data/states-albers-10m.json',
      object: 'states',
      preprojected: true,
      exclude: [],
      iconFactor: 1,
      aliases: window.NAMES.STATE_ALIASES
    },
    world: {
      file: 'data/countries-110m.json',
      object: 'countries',
      preprojected: false,
      exclude: ['Antarctica', 'Fr. S. Antarctic Lands'],
      iconFactor: 0.72,
      aliases: window.NAMES.COUNTRY_ALIASES
    }
  };

  const SIZE_PRESETS = {
    story: [1080, 1920],
    square: [1350, 1350],
    landscape: [1920, 1080]
  };

  const BG_PRESETS = {
    sky: ['#8ec9f5', '#4a7fd4'],
    dusk: ['#f6b98a', '#7a4fb0'],
    dark: ['#3a4a63', '#131a28'],
    mint: ['#b8f0d8', '#4aa886']
  };

  // ---- state -------------------------------------------------------------

  const mapCache = {};
  let features = [];            // displayed features for current map
  let lookup = {};              // normalized name -> feature
  let rows = [];                // matched data rows
  let unmatched = [];
  let projection, geoPath, centroids, areaScale = {};
  let iconImgs = [];
  let animation = null;         // { start, order, interval } while playing
  let recorder = null;

  // ---- icon rasterization --------------------------------------------------

  function loadIcons() {
    return Promise.all(window.GD.TIERS.map(function (t) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () {
          // real GD face missing — fall back to the bundled SVG look-alike
          const fb = new Image();
          fb.onload = function () { resolve(fb); };
          fb.onerror = function () { resolve(fb); };
          fb.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t.svg);
        };
        img.src = 'icons/' + (t.file || t.key) + '.png';
      });
    })).then(function (imgs) { iconImgs = imgs; });
  }

  // ---- map loading ---------------------------------------------------------

  function loadMap(kind) {
    const cfg = MAP_CONFIGS[kind];
    const cached = mapCache[kind]
      ? Promise.resolve(mapCache[kind])
      : fetch(cfg.file).then(function (r) { return r.json(); }).then(function (topo) {
          mapCache[kind] = topo;
          return topo;
        });
    return cached.then(function (topo) {
      const fc = topojson.feature(topo, topo.objects[cfg.object]);
      features = fc.features.filter(function (f) {
        return cfg.exclude.indexOf(f.properties.name) === -1;
      });
      lookup = {};
      features.forEach(function (f) {
        lookup[window.NAMES.normalize(f.properties.name)] = f;
      });
      Object.keys(cfg.aliases).forEach(function (alias) {
        const canonical = cfg.aliases[alias];
        if (canonical === null) return;
        const f = lookup[window.NAMES.normalize(canonical)];
        if (f) lookup[window.NAMES.normalize(alias)] = f;
      });
    });
  }

  // ---- data parsing --------------------------------------------------------

  function parseData() {
    const text = $('data-input').value;
    rows = [];
    unmatched = [];
    const seen = {};
    text.split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) return;
      const parts = line.split(/\t|;|,/).map(function (s) { return s.trim().replace(/^"|"$/g, ''); });
      if (parts.length < 2) return;
      const rawName = parts[0];
      const rawValue = parts[1];
      const value = parseFloat(rawValue.replace(/[^0-9.eE+-]/g, ''));
      if (!rawName || !isFinite(value)) return;
      const feature = lookup[window.NAMES.normalize(rawName)];
      if (!feature) { unmatched.push(rawName); return; }
      const key = feature.properties.name;
      if (seen[key]) return;
      seen[key] = true;
      let override = null;
      if (parts[2]) {
        const k = parts[2].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (k in window.GD.TIER_LOOKUP) override = window.GD.TIER_LOOKUP[k];
      }
      rows.push({ name: key, feature: feature, value: value, display: rawValue, override: override });
    });
    const warn = $('unmatched');
    if (unmatched.length) {
      warn.style.display = 'block';
      warn.textContent = 'Not matched to the map (check spelling): ' + unmatched.join(', ');
    } else {
      warn.style.display = 'none';
    }
    $('row-count').textContent = rows.length + ' regions matched';
  }

  // ---- tier assignment -----------------------------------------------------

  function populateTierRange() {
    const best = $('tier-best'), worst = $('tier-worst');
    [best, worst].forEach(function (sel) {
      sel.innerHTML = '';
      window.GD.TIERS.forEach(function (t, i) {
        const o = document.createElement('option');
        o.value = i;
        o.textContent = t.name;
        sel.appendChild(o);
      });
    });
    best.value = 0;
    worst.value = window.GD.TIERS.length - 1;
  }

  function assignTiers() {
    if (!rows.length) return;
    let lo = parseInt($('tier-best').value, 10) || 0;
    let hi = parseInt($('tier-worst').value, 10);
    if (isNaN(hi)) hi = window.GD.TIERS.length - 1;
    if (lo > hi) { const t = lo; lo = hi; hi = t; }
    const tiers = [];
    for (let i = lo; i <= hi; i++) tiers.push(i);
    const n = tiers.length;
    const higherBetter = $('higher-better').checked;
    const method = $('tier-method').value;
    const values = rows.map(function (r) { return r.value; });
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);

    let badness; // per-row 0..1, 0 = best tier
    if (method === 'linear' || min === max) {
      badness = rows.map(function (r) {
        if (min === max) return 0;
        const good = (r.value - min) / (max - min);
        return higherBetter ? 1 - good : good;
      });
    } else {
      // ranked: distinct values spread evenly from best to worst, so tied
      // groups (e.g. every $7.25 state) share one tier and the extremes
      // always hit the best/worst faces
      const uniq = Array.from(new Set(values)).sort(function (a, b) {
        return higherBetter ? b - a : a - b; // best first
      });
      const denom = Math.max(uniq.length - 1, 1);
      const idx = {};
      uniq.forEach(function (v, i) { idx[v] = i; });
      badness = rows.map(function (r) { return idx[r.value] / denom; });
    }

    rows.forEach(function (r, i) {
      if (r.override !== null) { r.tier = r.override; return; }
      let bucket = Math.floor(badness[i] * n);
      if (bucket >= n) bucket = n - 1;
      r.tier = tiers[bucket];
    });
  }

  // ---- layout & drawing ------------------------------------------------------

  function layout() {
    const W = canvas.width, H = canvas.height;
    const portrait = H > W;
    const titleSize = portrait ? W * 0.082 : H * 0.075;
    return {
      W: W, H: H,
      emojiY: portrait ? H * 0.075 : H * 0.09,
      emojiSize: titleSize * 1.5,
      titleY: portrait ? H * 0.145 : H * 0.19,
      titleSize: titleSize,
      subY: portrait ? H * 0.185 : H * 0.265,
      subSize: titleSize * 0.58,
      mapTop: portrait ? H * 0.225 : H * 0.30,
      mapBottom: portrait ? H * 0.80 : H * 0.82,
      mapPad: W * 0.035,
      legendY: portrait ? H * 0.875 : H * 0.90,
      legendTile: Math.min(W * 0.062, H * 0.075)
    };
  }

  function rebuildProjection() {
    const cfg = MAP_CONFIGS[$('map-select').value];
    const L = layout();
    const extent = [[L.mapPad, L.mapTop], [L.W - L.mapPad, L.mapBottom]];
    const fc = { type: 'FeatureCollection', features: features };
    projection = cfg.preprojected
      ? d3.geoIdentity().fitExtent(extent, fc)
      : d3.geoNaturalEarth1().fitExtent(extent, fc);
    geoPath = d3.geoPath(projection, ctx);
    const measure = d3.geoPath(projection); // no context: for centroid/area math
    centroids = {};
    areaScale = {};
    const areas = [];
    features.forEach(function (f) {
      centroids[f.properties.name] = bestCentroid(f, measure);
      const a = Math.abs(measure.area(f));
      areas.push(a);
      areaScale[f.properties.name] = a;
    });
    areas.sort(function (a, b) { return a - b; });
    const median = areas[Math.floor(areas.length / 2)] || 1;
    Object.keys(areaScale).forEach(function (k) {
      const s = Math.pow(areaScale[k] / median, 0.3);
      areaScale[k] = Math.min(1.2, Math.max(0.55, s));
    });
  }

  // Centroid of the largest polygon, so France ~= mainland, USA ~= lower 48.
  function bestCentroid(f, measure) {
    const g = f.geometry;
    if (g.type !== 'MultiPolygon') return measure.centroid(f);
    let best = null, bestArea = -1;
    g.coordinates.forEach(function (poly) {
      const part = { type: 'Feature', geometry: { type: 'Polygon', coordinates: poly } };
      const a = Math.abs(measure.area(part));
      if (a > bestArea) { bestArea = a; best = part; }
    });
    return measure.centroid(best);
  }

  function outlinedText(text, x, y, size, fill, weightOutline) {
    ctx.font = '900 ' + size + 'px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = size * (weightOutline || 0.22);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  function fitText(text, maxWidth, size) {
    ctx.font = '900 ' + size + 'px "Arial Black", Arial, sans-serif';
    while (size > 12 && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      ctx.font = '900 ' + size + 'px "Arial Black", Arial, sans-serif';
    }
    return size;
  }

  function isDark(hex) {
    const v = parseInt(hex.slice(1), 16);
    const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 45;
  }

  function easeBackOut(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // revealState: null = show everything, or { count, popProgress[] }
  function draw(revealState) {
    const L = layout();
    ctx.clearRect(0, 0, L.W, L.H);

    // background
    const bg = BG_PRESETS[$('bg-select').value] || BG_PRESETS.sky;
    const grad = ctx.createLinearGradient(0, 0, 0, L.H);
    grad.addColorStop(0, bg[0]);
    grad.addColorStop(1, bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, L.W, L.H);

    // header
    const emoji = $('emoji-input').value.trim();
    if (emoji) {
      ctx.font = L.emojiSize + 'px "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, L.W / 2, L.emojiY);
    }
    const title = $('title-input').value.trim();
    if (title) {
      const size = fitText(title, L.W * 0.92, L.titleSize);
      outlinedText(title, L.W / 2, L.titleY, size, '#ffd84d');
    }
    const sub = $('subtitle-input').value.trim();
    if (sub) {
      const size = fitText(sub, L.W * 0.9, L.subSize);
      outlinedText(sub, L.W / 2, L.subY, size, '#ffffff');
    }

    const strokeW = Math.max(1.5, L.W / 550);

    // base map
    ctx.lineJoin = 'round';
    features.forEach(function (f) {
      ctx.beginPath();
      geoPath(f);
      ctx.fillStyle = 'rgba(235, 240, 248, 0.55)';
      ctx.fill();
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = strokeW;
      ctx.stroke();
    });

    // revealed fills
    const order = revealOrder();
    const shown = revealState ? revealState.count : order.length;
    for (let i = 0; i < shown; i++) {
      const r = order[i];
      const fill = window.GD.TIERS[r.tier].fill;
      ctx.beginPath();
      geoPath(r.feature);
      ctx.fillStyle = fill;
      ctx.fill();
      // near-black fills get a lighter border so neighbors stay separable
      ctx.strokeStyle = isDark(fill) ? '#4a4a4a' : '#141414';
      ctx.lineWidth = strokeW * 1.15;
      ctx.stroke();
    }

    // icons + labels on top
    const cfg = MAP_CONFIGS[$('map-select').value];
    const iconSize = parseFloat($('icon-size').value) / 100 * L.W * 0.085 * (cfg.iconFactor || 1);
    const labelSize = parseFloat($('label-size').value) / 100 * L.W * 0.032;
    for (let i = 0; i < shown; i++) {
      const r = order[i];
      const c = centroids[r.name];
      if (!c) continue;
      let pop = 1;
      if (revealState && revealState.popProgress) {
        pop = revealState.popProgress[i];
        if (pop <= 0) continue;
        pop = easeBackOut(Math.min(pop, 1));
      }
      const az = areaScale[r.name] || 1;
      const s = iconSize * az * pop;
      const img = iconImgs[r.tier];
      if (img && img.width) {
        const h = s * img.height / img.width; // demon faces are wider than tall
        ctx.drawImage(img, c[0] - s / 2, c[1] - h, s, h);
      }
      const lz = labelSize * Math.sqrt(az);
      if (lz > 2) {
        const label = $('label-prefix').value + r.display + $('label-suffix').value;
        outlinedText(label, c[0], c[1] + lz * 0.75 * pop, lz * pop, '#ffffff', 0.28);
      }
    }

    drawLegend(L);
  }

  function drawLegend(L) {
    if (!$('show-legend').checked) return;
    const n = window.GD.TIERS.length;
    const tile = L.legendTile;
    const gap = tile * 0.12;
    const total = n * tile + (n - 1) * gap;
    let x = (L.W - total) / 2;
    const y = L.legendY - tile / 2;
    window.GD.TIERS.forEach(function (t, i) {
      ctx.beginPath();
      const r = tile * 0.18;
      ctx.roundRect(x, y, tile, tile, r);
      ctx.fillStyle = t.fill;
      ctx.fill();
      ctx.strokeStyle = '#141414';
      ctx.lineWidth = Math.max(2, tile * 0.05);
      ctx.stroke();
      const img = iconImgs[i];
      if (img && img.width) {
        const box = tile - 2 * tile * 0.09;
        let w = box, h = box * img.height / img.width;
        if (h > box) { w = box * img.width / img.height; h = box; }
        ctx.drawImage(img, x + (tile - w) / 2, y + (tile - h) / 2, w, h);
      }
      x += tile + gap;
    });
  }

  function revealOrder() {
    const mode = $('order-select').value;
    const sorted = rows.slice();
    const higherBetter = $('higher-better').checked;
    if (mode === 'worst-first') {
      sorted.sort(function (a, b) { return higherBetter ? a.value - b.value : b.value - a.value; });
    } else if (mode === 'best-first') {
      sorted.sort(function (a, b) { return higherBetter ? b.value - a.value : a.value - b.value; });
    } else if (mode === 'alpha') {
      sorted.sort(function (a, b) { return a.name.localeCompare(b.name); });
    }
    return sorted;
  }

  // ---- animation -------------------------------------------------------------

  const POP_MS = 320;

  function stopAnimation() {
    if (animation && animation.raf) cancelAnimationFrame(animation.raf);
    animation = null;
  }

  function play(onDone) {
    stopAnimation();
    const order = revealOrder();
    if (!order.length) { if (onDone) onDone(); return; }
    const interval = parseInt($('speed-input').value, 10) || 350;
    const start = performance.now();
    animation = { onDone: onDone };

    function frame(now) {
      const t = now - start;
      const count = Math.min(order.length, Math.floor(t / interval) + 1);
      const popProgress = [];
      for (let i = 0; i < count; i++) {
        popProgress.push((t - i * interval) / POP_MS);
      }
      draw({ count: count, popProgress: popProgress });
      const finished = count === order.length && t > (order.length - 1) * interval + POP_MS;
      if (!finished && animation) {
        animation.raf = requestAnimationFrame(frame);
      } else {
        const done = animation && animation.onDone;
        animation = null;
        draw(null);
        if (done) done();
      }
    }
    animation.raf = requestAnimationFrame(frame);
  }

  // ---- export ------------------------------------------------------------------

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function exportPNG() {
    stopAnimation();
    draw(null);
    canvas.toBlob(function (blob) { download(blob, 'gd-stat-map.png'); }, 'image/png');
  }

  function recordWebM() {
    if (recorder) return;
    const btn = $('record-btn');
    btn.disabled = true;
    btn.textContent = 'Recording…';
    const stream = canvas.captureStream(30);
    let mime = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
    recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    recorder.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = function () {
      download(new Blob(chunks, { type: 'video/webm' }), 'gd-stat-map.webm');
      recorder = null;
      btn.disabled = false;
      btn.textContent = 'Record video (WebM)';
    };
    // brief hold on the empty map, then the reveal, then hold the final frame
    draw({ count: 0, popProgress: [] });
    recorder.start();
    setTimeout(function () {
      play(function () {
        setTimeout(function () { if (recorder) recorder.stop(); }, 1500);
      });
    }, 800);
  }

  // ---- refresh pipeline -----------------------------------------------------------

  function refresh() {
    stopAnimation();
    parseData();
    assignTiers();
    rebuildProjection();
    draw(null);
  }

  function setCanvasSize() {
    const preset = SIZE_PRESETS[$('size-select').value];
    canvas.width = preset[0];
    canvas.height = preset[1];
    canvas.style.aspectRatio = preset[0] + ' / ' + preset[1];
  }

  function switchMap() {
    loadMap($('map-select').value).then(refresh);
  }

  // ---- sample data -----------------------------------------------------------------

  const SAMPLE_US = [
    '# Sample data: state minimum hourly wage (approx, 2025)',
    'Washington, 16.66', 'California, 16.50', 'Connecticut, 16.35', 'New York, 15.50',
    'New Jersey, 15.49', 'Colorado, 14.81', 'Maryland, 15.00', 'Massachusetts, 15.00',
    'Rhode Island, 15.00', 'Delaware, 15.00', 'Illinois, 15.00', 'Hawaii, 14.00',
    'Arizona, 14.70', 'Maine, 14.65', 'Oregon, 14.70', 'Vermont, 14.01',
    'Missouri, 13.75', 'Nebraska, 13.50', 'Florida, 13.00', 'Alaska, 11.91',
    'Minnesota, 11.13', 'Virginia, 12.41', 'New Mexico, 12.00', 'Nevada, 12.00',
    'Michigan, 12.48', 'Ohio, 10.70', 'Arkansas, 11.00', 'Montana, 10.55',
    'South Dakota, 11.50', 'West Virginia, 8.75', 'Pennsylvania, 7.25', 'Texas, 7.25',
    'Georgia, 7.25', 'Idaho, 7.25', 'Indiana, 7.25', 'Iowa, 7.25', 'Kansas, 7.25',
    'Kentucky, 7.25', 'Louisiana, 7.25', 'Mississippi, 7.25', 'New Hampshire, 7.25',
    'North Carolina, 7.25', 'North Dakota, 7.25', 'Oklahoma, 7.25', 'South Carolina, 7.25',
    'Tennessee, 7.25', 'Utah, 7.25', 'Wisconsin, 7.25', 'Wyoming, 7.25', 'Alabama, 7.25'
  ].join('\n');

  const SAMPLE_WORLD = [
    '# Sample data: average life expectancy (approx years)',
    'Japan, 84.8', 'Switzerland, 84.0', 'Australia, 83.9', 'Spain, 83.7', 'Italy, 83.5',
    'Norway, 83.3', 'Sweden, 83.3', 'France, 83.2', 'Canada, 82.6', 'New Zealand, 82.5',
    'Netherlands, 82.2', 'Germany, 81.2', 'United Kingdom, 81.2', 'Chile, 81.0',
    'South Korea, 84.3', 'Portugal, 82.4', 'Greece, 81.9', 'Poland, 78.5',
    'USA, 79.3', 'China, 78.6', 'Argentina, 77.7', 'Turkey, 77.2', 'Brazil, 75.8',
    'Mexico, 75.0', 'Vietnam, 74.6', 'Thailand, 76.6', 'Russia, 73.2', 'Iran, 77.6',
    'Indonesia, 71.9', 'Egypt, 71.6', 'India, 72.0', 'Bolivia, 68.6',
    'Pakistan, 67.6', 'Ethiopia, 67.3', 'Kenya, 63.7', 'South Africa, 66.1',
    'Afghanistan, 66.0', 'Nigeria, 54.6', 'Somalia, 58.8', 'Chad, 55.1',
    'Central African Republic, 57.6', 'Lesotho, 57.4'
  ].join('\n');

  function loadSample(kind) {
    if (kind === 'us') {
      $('map-select').value = 'us';
      $('data-input').value = SAMPLE_US;
      $('title-input').value = 'Minimum hourly wage';
      $('subtitle-input').value = 'In each state';
      $('emoji-input').value = '💵';
      $('label-prefix').value = '$';
      $('label-suffix').value = '';
      $('higher-better').checked = true;
    } else {
      $('map-select').value = 'world';
      $('data-input').value = SAMPLE_WORLD;
      $('title-input').value = 'Life expectancy';
      $('subtitle-input').value = 'In each country';
      $('emoji-input').value = '❤️';
      $('label-prefix').value = '';
      $('label-suffix').value = '';
      $('higher-better').checked = true;
    }
    switchMap();
  }

  // ---- wiring --------------------------------------------------------------------------

  function init() {
    setCanvasSize();
    const rerender = ['title-input', 'subtitle-input', 'emoji-input', 'label-prefix',
      'label-suffix', 'bg-select', 'icon-size', 'label-size', 'show-legend'];
    rerender.forEach(function (id) {
      $(id).addEventListener('input', function () { stopAnimation(); draw(null); });
    });
    const recompute = ['data-input', 'higher-better', 'tier-method', 'tier-best', 'tier-worst', 'order-select'];
    recompute.forEach(function (id) {
      $(id).addEventListener('input', refresh);
    });
    $('map-select').addEventListener('input', switchMap);
    $('scale-select').addEventListener('input', function () {
      window.GD.setScale(this.value);
      populateTierRange();
      loadIcons().then(refresh);
    });
    $('size-select').addEventListener('input', function () { setCanvasSize(); refresh(); });
    $('play-btn').addEventListener('click', function () { play(); });
    $('final-btn').addEventListener('click', function () { stopAnimation(); draw(null); });
    $('png-btn').addEventListener('click', exportPNG);
    $('record-btn').addEventListener('click', recordWebM);
    $('sample-us').addEventListener('click', function () { loadSample('us'); });
    $('sample-world').addEventListener('click', function () { loadSample('world'); });

    populateTierRange();
    loadIcons().then(function () { loadSample('us'); });
  }

  init();
})();
