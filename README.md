# edwardkhouyly.com

A static photo gallery: favourite photos grouped by year and month, with a full-screen viewer. Plain HTML, CSS and JavaScript, no build tools.

## Adding photos

1. Put photos in `photos/<year>/<month>/`, e.g. `photos/2026/10/lake.jpg` (month as two digits).
2. Optionally add `captions.json` in that month folder:
   ```json
   { "title": "Autumn walks", "photos": { "lake.jpg": "Morning on the lake" } }
   ```
3. Run `node scripts/build-manifest.mjs` to refresh `photos/manifest.json`.

Resize photos to about 2000px on the long edge before adding them so the site stays fast.

## Previewing locally

`python3 -m http.server` in this folder, then open http://localhost:8000.

## Hosting

Works as-is on GitHub Pages, Netlify or Vercel. Once the domain is set up, add it under Settings → Pages → Custom domain.
