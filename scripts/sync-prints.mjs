// Reads the Etsy shop's public listing feed and fills in photos/prints.json,
// so each listed photo gets its "Buy print" button without anyone pasting links.
//
// A listing is matched to a photo by a line in its title or description such as
//   Ref: DSCF7417
// where the code is the photo's link name on the site (#photo/dscf7417).
//
// Usage: node scripts/sync-prints.mjs [--dry-run] [feed.xml]
// Listings already in prints.json are kept; the feed only adds to or updates them.

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(site, "photos", "prints.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const local = args.find((a) => !a.startsWith("--"));

const prints = JSON.parse(readFileSync(file, "utf8"));
prints.listings ??= {};
prints.titles ??= {};
const shop = prints.shop?.match(/etsy\.com\/(?:[a-z]{2}\/)?shop\/([\w-]+)/i)?.[1];
if (!shop) { console.log("No Etsy shop set in photos/prints.json; nothing to do."); process.exit(0); }

// Every photo's link name, e.g. "dscf7417", as the site derives it from the filename.
const manifest = JSON.parse(readFileSync(join(site, "photos", "manifest.json"), "utf8"));
const photoIds = new Set();
for (const y of manifest.years) for (const m of y.months) for (const p of m.photos) photoIds.add(idOf(p.src));
for (const p of manifest.more || []) photoIds.add(idOf(p.src));
function idOf(src) { return src.split("/").pop().replace(/\.\w+$/, "").replace(/^\d{4}-\d{2}-\d{2}_/, "").toLowerCase(); }

let xml;
if (local) xml = readFileSync(local, "utf8");
else {
  const url = `https://www.etsy.com/shop/${shop}/rss`;
  const res = await fetch(url, { headers: {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "en-CA,en;q=0.9",
  } });
  xml = await res.text();
  if (!res.ok || !/<rss|<feed/i.test(xml)) {
    console.error(`Could not read ${url}: HTTP ${res.status}. Etsy may be blocking automated requests.`);
    process.exit(1);
  }
}

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (item, name) => decode(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "").trim();

const items = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || [];
let changed = 0;
const unmatched = [];
for (const item of items) {
  const title = tag(item, "title");
  // keep only etsy.com/listing/<number>/<name>: no country prefix, no tracking
  const link = tag(item, "link").match(/etsy\.com\/(?:[a-z]{2}\/)?(listing\/\d+(?:\/[\w-]+)?)/i)?.[1];
  if (!link) continue;
  const url = `https://www.etsy.com/${link}`;
  const text = `${title}\n${decode(tag(item, "description")).replace(/<[^>]+>/g, " ")}`;
  const ref = text.match(/\bref(?:erence)?\s*[:#]\s*([\w-]+)/i)?.[1].toLowerCase();
  if (!ref || !photoIds.has(ref)) { unmatched.push(`${title}${ref ? ` (Ref "${ref}" is not a photo on the site)` : " (no Ref: line)"}`); continue; }
  if (prints.listings[ref] !== url) { prints.listings[ref] = url; changed++; console.log(`${ref} -> ${url}`); }
  // "Centre Island Toronto Ferry Photo Print, Summer Ferry Ride, ..." -> "Centre Island Toronto Ferry"
  const name = title.split(/\s*[,|]\s*|\s+[–—-]\s+/)[0].replace(/\s+(photo(graphy)?\s+)?(print|poster|wall art)$/i, "").trim();
  if (name && prints.titles[ref] !== name) { prints.titles[ref] = name; changed++; }
}

console.log(`${items.length} listings in the feed, ${changed} new or updated, ${unmatched.length} not matched.`);
for (const u of unmatched) console.log(`  not matched: ${u}`);
if (changed && !dryRun) writeFileSync(file, JSON.stringify(prints, null, 2) + "\n");
