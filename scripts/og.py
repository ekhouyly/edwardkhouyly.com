"""Picks a random wide photo for the link preview image (og.jpg) and updates its link in index.html."""
import random, re, time
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "scripts" / "fonts"

wide = []
for f in sorted((ROOT / "large").rglob("*.jpg")):
    with Image.open(f) as im:
        if im.width >= im.height * 1.3:
            wide.append(f)
src = random.choice(wide)

im = ImageOps.fit(Image.open(src).convert("RGB"), (1200, 630), Image.LANCZOS)
shade = Image.new("L", (1, 630))
for y in range(630):
    shade.putpixel((0, y), int(max(0, (y - 250) / 380) ** 1.3 * 185))
im.paste((0, 0, 0), mask=shade.resize((1200, 630)))
d = ImageDraw.Draw(im)
small = ImageFont.truetype(str(FONTS / "fraunces.ttf"), 22)
x = 66
for ch in "PHOTOGRAPHS":
    d.text((x, 392), ch, font=small, fill=(235, 235, 235))
    x += small.getlength(ch) + 4
d.text((64, 428), "Edward", font=ImageFont.truetype(str(FONTS / "fraunces.ttf"), 92), fill="white")
d.text((64, 512), "Khouy-Ly", font=ImageFont.truetype(str(FONTS / "fraunces-i.ttf"), 92), fill="white")
im.save(ROOT / "og.jpg", quality=88)

# A new address each time, so apps that cache previews pick up the new photo.
index = ROOT / "index.html"
html = re.sub(r'(og\.jpg)(\?v=\d+)?"', rf'\1?v={int(time.time())}"', index.read_text())
index.write_text(html)
print(f"og.jpg now uses {src.relative_to(ROOT)}")
