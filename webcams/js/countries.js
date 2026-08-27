/* Country assignment + geometry helpers for the webcam hub.
 *
 * Cameras arrive as (lat, lon) points from many providers. Rather than trust
 * each provider's country field, we bucket every camera into a country by
 * testing which world-atlas polygon contains it (d3.geoContains), with a cheap
 * bounding-box prefilter so thousands of points stay fast. Country identity is
 * the atlas feature name — the same key the D3 map draws with.
 */
(function () {
  'use strict';

  var index = [];        // [{ name, feature, bounds:[[w,s],[e,n]], centroid:[lon,lat] }]
  var byName = {};       // name -> index entry

  function build(features) {
    index = [];
    byName = {};
    features.forEach(function (f) {
      var name = f.properties && f.properties.name;
      if (!name) return;
      var b, c;
      try {
        b = d3.geoBounds(f);            // [[west, south], [east, north]]
        c = d3.geoCentroid(f);          // [lon, lat]
      } catch (e) {
        return;
      }
      var entry = { name: name, feature: f, bounds: b, centroid: c };
      index.push(entry);
      byName[name] = entry;
    });
    return index.length;
  }

  function inBounds(entry, lon, lat) {
    var b = entry.bounds;
    var w = b[0][0], s = b[0][1], e = b[1][0], n = b[1][1];
    if (lat < s - 0.5 || lat > n + 0.5) return false;
    // Handle polygons whose bbox crosses the antimeridian (west > east).
    if (w <= e) return lon >= w - 0.5 && lon <= e + 0.5;
    return lon >= w - 0.5 || lon <= e + 0.5;
  }

  // Return the atlas country name containing (lat, lon), or null.
  function assign(lat, lon) {
    if (typeof lat !== 'number' || typeof lon !== 'number' ||
        isNaN(lat) || isNaN(lon)) return null;
    var candidates = [];
    for (var i = 0; i < index.length; i++) {
      if (inBounds(index[i], lon, lat)) candidates.push(index[i]);
    }
    // Exact test only against the bbox survivors.
    for (var j = 0; j < candidates.length; j++) {
      try {
        if (d3.geoContains(candidates[j].feature, [lon, lat])) {
          return candidates[j].name;
        }
      } catch (e) { /* skip malformed geometry */ }
    }
    return null;
  }

  function centroid(name) {
    var e = byName[name];
    return e ? e.centroid : null;
  }

  function feature(name) {
    var e = byName[name];
    return e ? e.feature : null;
  }

  function names() {
    return index.map(function (e) { return e.name; });
  }

  window.WCGeo = {
    build: build,
    assign: assign,
    centroid: centroid,
    feature: feature,
    names: names
  };
})();
