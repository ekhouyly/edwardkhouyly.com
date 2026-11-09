# edwardkhouyly.com

A static photo gallery: favourite photos grouped by year and month, with a full-screen viewer. Plain HTML, CSS and JavaScript, no build tools.

## Adding photos

1. Put photos in `photos/<year>/<month>/`, named with the date taken, e.g. `photos/2026/10/2026-10-04_lake.jpg` (month as two digits). The date puts each photo under its week of the year (ISO weeks, Monday to Sunday).
2. Optionally add `captions.json` in that month folder:
   ```json
   { "title": "Autumn walks", "photos": { "2026-10-04_lake.jpg": "Morning on the lake" } }
   ```
3. Keep a clean copy (no watermark) of the 3000px photo and its ~1000px thumbnail at the same paths under the originals folder, then run:
   ```sh
   python3 scripts/watermark.py /path/to/originals   # stamps @eklphotos into photos/ and thumbs/
   python3 scripts/derive.py                         # small/ and large/ copies, placeholder colours
   node scripts/build-manifest.mjs                   # refreshes photos/manifest.json
   ```

## Trips

`photos/trips.json` lists each trip, its places on the map (with coordinates) and which photos belong to each place. Photos are named by the part of the filename after the date, e.g. `img_0136`, so changing a photo's date doesn't break the trip. `build-manifest.mjs` warns about names it can't find.

The map uses Leaflet (kept in `vendor/leaflet/`) with a drawn outline map instead of street tiles. After changing `trips.json`, run `node scripts/build-maps.mjs` to rebuild `photos/maps/<trip>.json` from the Natural Earth coastlines in `scripts/data/` (world-atlas and topojson-client, both ISC licensed).

## Selling prints

`photos/prints.json` connects the site to the Etsy shop:

```json
{
  "shop": "https://www.etsy.com/shop/YourShopName",
  "listings": { "dscf1478": "https://www.etsy.com/listing/1234567890" }
}
```

When `shop` is set, a "Prints" button appears next to Instagram at the bottom of the page. Each photo named in `listings` (its filename without the date, as in its `#photo/` link) gets a "Buy print" button in the viewer that opens its Etsy listing. No rebuild needed; just commit the file.

## Previewing locally

`python3 -m http.server` in this folder, then open http://localhost:8000.

## Hosting

Works as-is on GitHub Pages, Netlify or Vercel. Once the domain is set up, add it under Settings → Pages → Custom domain.

## Photo links

Opening a photo puts it in the address, e.g. `#photo/dscf1478` (or `#trip/korea/dscf1478` inside a trip), so any photo can be shared and the phone's Back button closes the viewer. The name is the part of the filename after the date, so links survive a date change but break if a photo is renamed or removed.

The viewer's share button links to `p/<name>.html` instead, a small page that `build-manifest.mjs` writes for every photo. Its link preview (WhatsApp, iMessage, Discord and so on) shows that photo, and it sends visitors straight on to the photo in the gallery. A copied `#photo/...` address still works, but its preview is the site's usual `og.jpg`. Update `SITE` in `build-manifest.mjs` when the custom domain goes live.

## Search engines

`build-manifest.mjs` also writes a plain list of every photo into `index.html` (between the `noscript` markers) for search engines and browsers without JavaScript. `robots.txt`, `sitemap.xml` and the canonical link in `index.html` use the github.io address; update all three when the custom domain goes live.

## Fonts

Fraunces and Instrument Sans (both SIL Open Font License) are served from `fonts/` instead of Google Fonts, and their `@font-face` rules sit at the top of `styles.css`. Each font comes in latin, latin-ext and vietnamese parts, and browsers download only the parts a page uses.

## Link preview

`og.jpg` is the image shown when the link is shared. A GitHub Action (`.github/workflows/link-preview.yml`) runs `scripts/og.py` every morning to pick a new random wide photo; run it by hand from the Actions tab, or locally with `python3 scripts/og.py`.

A trip's card uses its first portrait photo unless the trip sets `"cover": "<photo name>"`. `"country"` picks the flag from `vendor/flags/` (from flag-icons, MIT). Cards run newest to oldest.
