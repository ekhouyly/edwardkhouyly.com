// Builds a small outline map for each trip in photos/trips.json: photos/maps/<trip id>.json.
// Coastlines come from Natural Earth via world-atlas (scripts/data/countries-10m.json),
// clipped to the area around the trip's places so each file stays small.
// Run after changing trips.json: node scripts/build-maps.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const topojson = require("./data/topojson-client.js");
const DATA = new URL("./data/", import.meta.url);
const PHOTOS = new URL("../photos/", import.meta.url);

// The country each trip is in, by ISO 3166 numeric code, so it can be tinted on the map.
const HOME = { kr: "410", jp: "392", ca: "124", mx: "484" };

const world = JSON.parse(readFileSync(new URL("countries-10m.json", DATA)));
const countries = topojson.feature(world, world.objects.countries).features;
const trips = JSON.parse(readFileSync(new URL("trips.json", PHOTOS)));
mkdirSync(new URL("maps/", PHOTOS), { recursive: true });

for (const trip of trips) {
  const lats = trip.places.map((p) => p.lat);
  const lngs = trip.places.map((p) => p.lng);
  // Leave room around the places, and make the area wide like the map on the page.
  const pad = Math.max(1.2, (Math.max(...lats) - Math.min(...lats)) * 0.6, (Math.max(...lngs) - Math.min(...lngs)) * 0.35);
  const mid = [(Math.min(...lats) + Math.max(...lats)) / 2, (Math.min(...lngs) + Math.max(...lngs)) / 2];
  let h = (Math.max(...lats) - Math.min(...lats)) / 2 + pad;
  let w = (Math.max(...lngs) - Math.min(...lngs)) / 2 + pad;
  w = Math.max(w, h * 1.9);
  h = Math.max(h, w / 1.9);
  const box = [mid[1] - w * 1.6, mid[0] - h * 1.6, mid[1] + w * 1.6, mid[0] + h * 1.6]; // extra margin for panning

  const features = [];
  for (const c of countries) {
    if (!c.geometry) continue;
    const polys = c.geometry.type === "Polygon" ? [c.geometry.coordinates] : c.geometry.coordinates;
    const kept = polys.map((poly) => poly.map((ring) => simplify(clip(ring, box))).filter((r) => r.length >= 4)).filter((p) => p.length);
    if (!kept.length) continue;
    features.push({
      type: "Feature",
      properties: { name: c.properties.name, home: c.id === HOME[trip.country] },
      geometry: { type: "MultiPolygon", coordinates: kept },
    });
  }
  const out = { type: "FeatureCollection", bounds: [[mid[0] - h * 1.6, mid[1] - w * 1.6], [mid[0] + h * 1.6, mid[1] + w * 1.6]], features };
  const file = new URL(`maps/${trip.id}.json`, PHOTOS);
  writeFileSync(file, JSON.stringify(out));
  console.log(`maps/${trip.id}.json: ${features.length} countries, ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
}

// Sutherland–Hodgman: clip a ring of [lng, lat] points to the box [west, south, east, north].
function clip(ring, [w, s, e, n]) {
  const edges = [
    [(p) => p[0] >= w, (a, b) => cut(a, b, 0, w)],
    [(p) => p[0] <= e, (a, b) => cut(a, b, 0, e)],
    [(p) => p[1] >= s, (a, b) => cut(a, b, 1, s)],
    [(p) => p[1] <= n, (a, b) => cut(a, b, 1, n)],
  ];
  let pts = ring.slice(0, -1);
  for (const [inside, cross] of edges) {
    if (!pts.length) break;
    const next = [];
    pts.forEach((cur, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) {
        if (!inside(prev)) next.push(cross(prev, cur));
        next.push(cur);
      } else if (inside(prev)) next.push(cross(prev, cur));
    });
    pts = next;
  }
  return pts.length ? [...pts, pts[0]] : [];
}

function cut(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return axis === 0 ? [v, a[1] + t * (b[1] - a[1])] : [a[0] + t * (b[0] - a[0]), v];
}

// Round to about 100 m and drop points that land on the same spot.
function simplify(ring) {
  const out = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000];
    const last = out.at(-1);
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}
