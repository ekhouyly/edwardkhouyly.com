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

The map uses Leaflet (kept in `vendor/leaflet/`) with CARTO map tiles.

## Previewing locally

`python3 -m http.server` in this folder, then open http://localhost:8000.

## Hosting

Works as-is on GitHub Pages, Netlify or Vercel. Once the domain is set up, add it under Settings → Pages → Custom domain.
