// Scans photos/YYYY/MM/ and writes photos/manifest.json, which the site reads.
// Run after adding or removing photos:  node scripts/build-manifest.mjs
// Optional per-month captions: photos/YYYY/MM/captions.json
//   { "title": "Summer in Lisbon", "photos": { "IMG_0412.jpg": "Alfama at dusk" } }
// Optional trips with map pins: photos/trips.json (photos are named by the part after the date, e.g. "img_0136").
// Smaller copies (small/, large/) and placeholder colours come from: python3 scripts/derive.py
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const ROOT = new URL("../photos/", import.meta.url).pathname;
const THUMBS = new URL("../thumbs/", import.meta.url).pathname;
const IMAGE = /\.(jpe?g|png|webp|avif|gif)$/i;
const REPO = new URL("../", import.meta.url).pathname;
const colors = existsSync(join(ROOT, "colors.json")) ? JSON.parse(readFileSync(join(ROOT, "colors.json"), "utf8")) : {};
const copy = (dir, rel) => (existsSync(join(REPO, dir, rel)) ? `${dir}/${rel}` : undefined);

// Reads width/height from the file header so the gallery can reserve space before images load.
function dimensions(file) {
  const b = readFileSync(file);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return { w: 3, h: 2 }; // unknown format: assume landscape
}

// Photos are named YYYY-MM-DD_name.jpg (the date taken), which gives each one its week of the year.
// Weeks follow ISO 8601: they start on Monday, and week 1 is the week with the year's first Thursday.
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7)));
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round((d - firstThursday) / 864e5 / 7 - 3 / 7 + ((firstThursday.getUTCDay() + 6) % 7) / 7);
}

function dateOf(file) {
  const m = file.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return {};
  const date = new Date(Date.UTC(+m[1], m[2] - 1, +m[3]));
  return { date: m.slice(1, 4).join("-"), week: isoWeek(date) };
}

const dirs = (p) => readdirSync(p).filter((n) => /^\d+$/.test(n) && statSync(join(p, n)).isDirectory());

const years = dirs(ROOT).sort((a, b) => b - a).map((year) => ({
  year: Number(year),
  months: dirs(join(ROOT, year)).sort((a, b) => b - a).map((month) => {
    const dir = join(ROOT, year, month);
    const meta = existsSync(join(dir, "captions.json")) ? JSON.parse(readFileSync(join(dir, "captions.json"), "utf8")) : {};
    const photos = readdirSync(dir).filter((f) => IMAGE.test(f)).sort().reverse().map((f) => ({
      src: `photos/${year}/${month}/${f}`,
      // smaller copy for the grid, if one exists under thumbs/YYYY/MM/
      thumb: existsSync(join(THUMBS, year, month, f)) ? `thumbs/${year}/${month}/${f}` : `photos/${year}/${month}/${f}`,
      small: copy("small", `${year}/${month}/${f}`),
      large: copy("large", `${year}/${month}/${f}`),
      bg: colors[f],
      caption: meta.photos?.[f] ?? "",
      ...dateOf(f),
      ...dimensions(join(dir, f)),
    }));
    return { month: Number(month), title: meta.title ?? "", photos };
  }).filter((m) => m.photos.length),
})).filter((y) => y.months.length);

// photos/more/ holds photos without a known date; they're shown after the dated years.
const moreDir = join(ROOT, "more");
const more = existsSync(moreDir) ? readdirSync(moreDir).filter((f) => IMAGE.test(f)).sort().map((f) => ({
  src: `photos/more/${f}`,
  thumb: existsSync(join(THUMBS, "more", f)) ? `thumbs/more/${f}` : `photos/more/${f}`,
  caption: "",
  ...dimensions(join(moreDir, f)),
})) : [];

const trips = existsSync(join(ROOT, "trips.json")) ? JSON.parse(readFileSync(join(ROOT, "trips.json"), "utf8")) : [];
const known = new Set(years.flatMap((y) => y.months.flatMap((m) => m.photos.map((p) => p.src.match(/_([^/]+)\.\w+$/)[1]))));
for (const t of trips) {
  for (const id of [...(t.photos || []), ...t.places.flatMap((p) => p.photos)]) if (!known.has(id)) console.warn(`trips.json: ${t.id} lists ${id}, which is not on the site`);
}

writeFileSync(join(ROOT, "manifest.json"), JSON.stringify({ years, more, trips }, null, 2) + "\n");
const count = years.reduce((n, y) => n + y.months.reduce((k, m) => k + m.photos.length, 0), 0) + more.length;
console.log(`manifest.json: ${count} photos across ${years.length} years`);

// Stamp index.html's links to app.js and styles.css with a hash of their contents,
// so browsers fetch the new code after each change instead of a cached copy.
const site = join(ROOT, "..");
let html = readFileSync(join(site, "index.html"), "utf8");
for (const f of ["app.js", "styles.css"]) {
  const v = createHash("sha1").update(readFileSync(join(site, f))).digest("hex").slice(0, 8);
  html = html.replace(new RegExp(`${f.replace(".", "\\.")}(\\?v=\\w+)?"`), `${f}?v=${v}"`);
}
writeFileSync(join(site, "index.html"), html);
