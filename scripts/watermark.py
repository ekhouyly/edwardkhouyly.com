"""Stamp "@eklphotos" in the bottom-right corner of every photo and thumbnail.

Reads clean copies from MASTERS (same layout as the repo) and writes the
stamped versions into photos/ and thumbs/, so it is safe to run again.

    python3 scripts/watermark.py /path/to/originals
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

TEXT = "@eklphotos"
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf"
masters = Path(sys.argv[1])
repo = Path(__file__).resolve().parent.parent


def stamp(src, dst):
    im = Image.open(src)
    icc = im.info.get("icc_profile")
    im = im.convert("RGB")
    w, h = im.size
    size = max(14, round(min(w, h) * 0.028))
    font = ImageFont.truetype(FONT, size)
    margin = round(min(w, h) * 0.035)
    l, t, r, b = font.getbbox(TEXT)
    x, y = w - margin - r, h - margin - b
    shadow = Image.new("L", im.size, 0)
    ImageDraw.Draw(shadow).text((x, y), TEXT, font=font, fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.18))
    im.paste((0, 0, 0), mask=shadow)
    mark = Image.new("L", im.size, 0)
    ImageDraw.Draw(mark).text((x, y), TEXT, font=font, fill=225)
    im.paste((255, 255, 255), mask=mark)
    quality = 82 if "thumbs" in src.parts else 92
    im.save(dst, quality=quality, optimize=True, progressive=True, icc_profile=icc)


count = 0
for src in sorted(masters.glob("*/*/*/*.jpg")):
    rel = src.relative_to(masters)
    if rel.parts[0] in ("photos", "thumbs") and (repo / rel).exists():
        stamp(src, repo / rel)
        count += 1
print(f"stamped {count} images")
