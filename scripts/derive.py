"""Make the smaller copies the site loads first, and a colour for each photo's placeholder.

    small/  600px on the long side, for the grid on phones
    large/  1800px on the long side, for the full-screen viewer on phones and laptops
    photos/colors.json  top and bottom colour of each photo, shown while it loads

Run after watermark.py and before build-manifest.mjs. Copies of photos that no longer
exist are deleted, so renaming a photo is safe.
"""
import json
from pathlib import Path
from PIL import Image

repo = Path(__file__).resolve().parent.parent
SIZES = {"small": (600, 78), "large": (1800, 85)}

sources = sorted(p for p in (repo / "photos").glob("*/*/*.jpg"))
wanted = {p.relative_to(repo / "photos") for p in sources}

for name, (size, quality) in SIZES.items():
    root = repo / name
    for old in root.glob("*/*/*.jpg"):
        if old.relative_to(root) not in wanted:
            old.unlink()
    for src in sources:
        dst = root / src.relative_to(repo / "photos")
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src)
        icc = im.info.get("icc_profile")
        im = im.convert("RGB")
        im.thumbnail((size, size), Image.LANCZOS)
        im.save(dst, quality=quality, optimize=True, progressive=True, icc_profile=icc)
    for d in sorted(root.glob("*/*"), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()


def hexcolor(im):
    r, g, b = im.resize((1, 1), Image.BOX).getpixel((0, 0))
    return f"#{r:02x}{g:02x}{b:02x}"


colors = {}
for src in sources:
    im = Image.open(repo / "small" / src.relative_to(repo / "photos")).convert("RGB")
    w, h = im.size
    colors[src.name] = [hexcolor(im.crop((0, 0, w, h // 2))), hexcolor(im.crop((0, h // 2, w, h)))]
(repo / "photos" / "colors.json").write_text(json.dumps(colors, indent=0, sort_keys=True) + "\n")
print(f"derived copies for {len(sources)} photos")
