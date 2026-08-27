/* Live client-side provider adapters.
 *
 * Each adapter fetches from ONE public webcam source and returns an array of
 * cameras in a single normalized shape (see `normalize`). Country is left for
 * the hub to assign from lat/lon via WCGeo; `countryHint` is only a fallback
 * for cameras that ship without coordinates.
 *
 * Only allow-listed public providers live here. No private/unsecured cameras.
 *
 * CORS note: some government REST endpoints don't send CORS headers, so a
 * browser fetch can be blocked even though the data is public. Every adapter
 * accepts `opts.proxyBase`; when set, the request becomes
 *   proxyBase + encodeURIComponent(targetUrl)
 * so you can front it with your own CORS proxy. The Node build tool
 * (tools/build-catalog.mjs) has no CORS limits and is the better path for bulk.
 */
(function () {
  'use strict';

  var CATEGORIES = ['traffic', 'city', 'scenic', 'nature', 'weather',
                    'harbor', 'beach', 'mountain', 'airport', 'transit', 'other'];

  function normalize(p) {
    return {
      id: p.id,
      source: p.source,
      sourceName: p.sourceName || p.source,
      name: p.name || 'Untitled camera',
      country: null,                 // filled by the hub from lat/lon
      countryHint: p.countryHint || null,
      category: CATEGORIES.indexOf(p.category) >= 0 ? p.category : 'other',
      lat: numOrNull(p.lat),
      lon: numOrNull(p.lon),
      image: p.image || null,        // still image (auto-refreshable)
      stream: p.stream || null,      // direct video (mp4 / hls)
      embed: p.embed || null,        // iframe embed (e.g. YouTube / Windy player)
      page: p.page || null,          // official source page
      attribution: p.attribution || '',
      refreshSec: p.refreshSec || 60
    };
  }

  function numOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isNaN(n) ? null : n;
  }

  function withProxy(url, opts) {
    if (opts && opts.proxyBase) return opts.proxyBase + encodeURIComponent(url);
    return url;
  }

  function fetchJSON(url, headers) {
    return fetch(url, { headers: headers || {} }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + hostOf(url));
      return r.json();
    });
  }

  function hostOf(url) {
    try { return new URL(url).host; } catch (e) { return url; }
  }

  function prop(place, key) {
    // TfL additionalProperties: [{ key, value }]
    var a = place.additionalProperties || [];
    for (var i = 0; i < a.length; i++) if (a[i].key === key) return a[i].value;
    return null;
  }

  function get(obj, path) {
    // dotted path getter, supports numeric indices: "a.b.0.c"
    var cur = obj, parts = String(path).split('.');
    for (var i = 0; i < parts.length && cur != null; i++) cur = cur[parts[i]];
    return cur == null ? null : cur;
  }

  /* ---- Transport for London: JamCams (keyless-friendly, CORS) ---------- */
  function tfl(opts) {
    opts = opts || {};
    var url = 'https://api.tfl.gov.uk/Place/Type/JamCam';
    if (opts.key) url += '?app_key=' + encodeURIComponent(opts.key);
    return fetchJSON(withProxy(url, opts)).then(function (arr) {
      return (arr || []).map(function (pl) {
        return normalize({
          id: 'tfl:' + pl.id,
          source: 'tfl',
          sourceName: 'Transport for London — JamCams',
          name: pl.commonName,
          lat: pl.lat, lon: pl.lon,
          category: 'traffic',
          countryHint: 'United Kingdom',
          image: prop(pl, 'imageUrl'),
          stream: prop(pl, 'videoUrl'),
          page: 'https://www.tfl.gov.uk/traffic/status',
          attribution: 'Powered by TfL Open Data',
          refreshSec: 180
        });
      }).filter(function (c) { return c.image || c.stream; });
    });
  }

  /* ---- Windy Webcams API v3 (global, key, paginated) ------------------- */
  function windy(opts) {
    opts = opts || {};
    if (!opts.key) return Promise.reject(new Error('Windy needs a free API key'));
    var want = Math.min(opts.limit || 300, 1000);
    var pageSize = 50;
    var headers = { 'x-windy-api-key': opts.key };
    var out = [];

    function page(offset) {
      if (out.length >= want) return Promise.resolve();
      var url = 'https://api.windy.com/webcams/api/v3/webcams' +
        '?limit=' + pageSize + '&offset=' + offset +
        '&include=images,location,player,urls,categories';
      if (opts.category) url += '&categories=' + encodeURIComponent(opts.category);
      return fetchJSON(withProxy(url, opts), headers).then(function (data) {
        var cams = (data && data.webcams) || [];
        cams.forEach(function (w) {
          var loc = w.location || {};
          var cat = (w.categories && w.categories[0] && w.categories[0].id) || 'scenic';
          out.push(normalize({
            id: 'windy:' + w.webcamId,
            source: 'windy',
            sourceName: 'Windy Webcams',
            name: w.title,
            lat: loc.latitude, lon: loc.longitude,
            countryHint: loc.country,
            category: mapWindyCat(cat),
            image: get(w, 'images.current.preview') || get(w, 'images.current.icon'),
            embed: get(w, 'player.live.embed') || get(w, 'player.day.embed'),
            page: get(w, 'urls.detail'),
            attribution: 'Webcams provided by Windy.com',
            refreshSec: 300
          }));
        });
        if (cams.length < pageSize || out.length >= want) return;
        return page(offset + pageSize);
      });
    }
    return page(0).then(function () { return out; });
  }

  function mapWindyCat(c) {
    var map = {
      traffic: 'traffic', city: 'city', square: 'city', building: 'city',
      beach: 'beach', harbor: 'harbor', port: 'harbor',
      mountain: 'mountain', ski: 'mountain', lake: 'nature', river: 'nature',
      park: 'nature', forest: 'nature', wildlife: 'nature',
      airport: 'airport', landscape: 'scenic', weather: 'weather'
    };
    return map[String(c).toLowerCase()] || 'scenic';
  }

  /* ---- WSDOT Highway Cameras (Washington State, free key) -------------- */
  function wsdot(opts) {
    opts = opts || {};
    if (!opts.key) return Promise.reject(new Error('WSDOT needs a free access code'));
    var url = 'https://wsdot.wa.gov/traffic/api/HighwayCameras/HighwayCamerasREST.svc' +
      '/GetCamerasAsJson?AccessCode=' + encodeURIComponent(opts.key);
    return fetchJSON(withProxy(url, opts)).then(function (arr) {
      return (arr || []).map(function (c) {
        var loc = c.CameraLocation || {};
        return normalize({
          id: 'wsdot:' + c.CameraID,
          source: 'wsdot',
          sourceName: 'WSDOT Highway Cameras',
          name: c.Title || loc.Description || ('Camera ' + c.CameraID),
          lat: loc.Latitude, lon: loc.Longitude,
          category: 'traffic',
          countryHint: 'United States of America',
          image: c.ImageURL,
          page: 'https://wsdot.com/travel/real-time/map',
          attribution: 'Data courtesy of WSDOT',
          refreshSec: 90
        });
      }).filter(function (c) { return c.image; });
    });
  }

  /* ---- US National Park Service webcams (free key) -------------------- */
  function nps(opts) {
    opts = opts || {};
    if (!opts.key) return Promise.reject(new Error('NPS needs a free developer key'));
    var url = 'https://developer.nps.gov/api/v1/webcams?limit=500&api_key=' +
      encodeURIComponent(opts.key);
    return fetchJSON(withProxy(url, opts)).then(function (data) {
      return ((data && data.data) || []).map(function (w) {
        var img = (w.images && w.images[0] && w.images[0].url) || null;
        var park = (w.relatedParks && w.relatedParks[0]) || {};
        return normalize({
          id: 'nps:' + w.id,
          source: 'nps',
          sourceName: 'US National Park Service',
          name: w.title + (park.fullName ? ' — ' + park.fullName : ''),
          lat: w.latitude, lon: w.longitude,
          category: 'nature',
          countryHint: 'United States of America',
          image: img,
          embed: w.isStreaming && w.streamUrl ? w.streamUrl : null,
          page: w.url,
          attribution: 'Courtesy of the U.S. National Park Service',
          refreshSec: 120
        });
      }).filter(function (c) { return c.image || c.embed; });
    });
  }

  /* ---- Generic 511 / DOT JSON feed (field-mapped) --------------------- */
  /* opts: { url, arrayPath, key, keyParam, mapping:{id,name,lat,lon,image,stream,page},
   *         category, countryHint, sourceName } */
  function custom511(opts) {
    opts = opts || {};
    if (!opts.url) return Promise.reject(new Error('custom511 needs a feed url'));
    var url = opts.url;
    if (opts.key && opts.keyParam) {
      url += (url.indexOf('?') >= 0 ? '&' : '?') +
        opts.keyParam + '=' + encodeURIComponent(opts.key);
    }
    var m = opts.mapping || {};
    return fetchJSON(withProxy(url, opts)).then(function (data) {
      var arr = opts.arrayPath ? get(data, opts.arrayPath) : data;
      if (!Array.isArray(arr)) throw new Error('feed did not resolve to an array');
      return arr.map(function (row, i) {
        return normalize({
          id: (opts.source || 'custom') + ':' + (m.id ? get(row, m.id) : i),
          source: opts.source || 'custom511',
          sourceName: opts.sourceName || 'Custom 511 feed',
          name: m.name ? get(row, m.name) : ('Camera ' + i),
          lat: m.lat ? get(row, m.lat) : null,
          lon: m.lon ? get(row, m.lon) : null,
          category: opts.category || 'traffic',
          countryHint: opts.countryHint || null,
          image: m.image ? get(row, m.image) : null,
          stream: m.stream ? get(row, m.stream) : null,
          page: m.page ? get(row, m.page) : opts.page || null,
          attribution: opts.attribution || '',
          refreshSec: opts.refreshSec || 120
        });
      }).filter(function (c) { return c.image || c.stream || c.embed; });
    });
  }

  window.WCProviders = {
    CATEGORIES: CATEGORIES,
    normalize: normalize,
    adapters: {
      tfl: tfl,
      windy: windy,
      wsdot: wsdot,
      nps: nps,
      custom511: custom511
    }
  };
})();
