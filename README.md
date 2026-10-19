# edwardkhouyly.com

A static photo gallery: favourite photos grouped by year and month, with a full-screen viewer. Plain HTML, CSS and JavaScript, no build tools.

## Adding photos

1. Put photos in `photos/<year>/<month>/`, named with the date taken, e.g. `photos/2026/10/2026-10-04_lake.jpg` (month as two digits). The date puts each photo under its week of the year (ISO weeks, Monday to Sunday).
2. Optionally add `captions.json` in that month folder:
   ```json
   { "title": "Autumn walks", "photos": { "2026-10-04_lake.jpg": "Morning on the lake" } }
   ```
3. Run `node scripts/build-manifest.mjs` to refresh `photos/manifest.json`.

Resize photos to about 3000px on the long edge, and put a ~1000px copy at the same path under `thumbs/` for the grid, so the site stays fast.

## Previewing locally

`python3 -m http.server` in this folder, then open http://localhost:8000.

## Hosting

Works as-is on GitHub Pages, Netlify or Vercel. Once the domain is set up, add it under Settings → Pages → Custom domain.
