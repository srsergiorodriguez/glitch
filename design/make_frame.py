"""Genera un frame 'ya glitcheado' para el mockup de la interfaz.

No es parte de la app: es material de referencia visual. Produce
design/frame.jpg y design/frame-thumb.jpg.
"""

import math

from PIL import Image, ImageChops, ImageDraw, ImageFilter

W = H = 560

# ── escena base: atardecer sintético, con contraste suficiente para
#    que sobreviva al posterizado y a los cortes ─────────────────────────
img = Image.new("RGB", (W, H), (0, 0, 0))
d = ImageDraw.Draw(img)

for y in range(H):
    t = (y / H) ** 2.1
    r = int(8 + 236 * t)
    g = int(12 + 126 * t)
    b = int(30 + 46 * t)
    d.line([(0, y), (W, y)], fill=(r, g, b))

sun = Image.new("RGB", (W, H), (0, 0, 0))
ds = ImageDraw.Draw(sun)
ds.ellipse([W * 0.63, H * 0.40, W * 0.63 + 74, H * 0.40 + 74], fill=(255, 246, 224))
glow = sun.filter(ImageFilter.GaussianBlur(26))
img = ImageChops.add(img, glow, scale=1.0, offset=0)
img = ImageChops.add(img, sun)

for layer, (base, shade) in enumerate(
    [(0.63, (58, 46, 52)), (0.70, (32, 27, 34)), (0.79, (14, 13, 18))]
):
    pts = [(0, H)]
    for x in range(0, W + 8, 6):
        y = (
            H * base
            + 40 * math.sin(x / 120 + layer * 2.1)
            + 16 * math.sin(x / 43 + layer * 1.4)
        )
        pts.append((x, y))
    pts.append((W, H))
    d.polygon(pts, fill=shade)

d.rectangle([0, H * 0.89, W, H], fill=(20, 17, 15))

# torre con ventana encendida y un bloque a la derecha
d.rectangle([W * 0.24, H * 0.60, W * 0.295, H * 0.945], fill=(9, 9, 12))
d.rectangle([W * 0.256, H * 0.715, W * 0.279, H * 0.755], fill=(255, 226, 158))
d.rectangle([W * 0.70, H * 0.575, W * 0.775, H * 0.945], fill=(7, 7, 9))
d.rectangle([W * 0.717, H * 0.615, W * 0.758, H * 0.652], fill=(120, 176, 226))

img = img.filter(ImageFilter.GaussianBlur(0.4))

# ── corrupción: cortes desplazados, canales desfasados, posterizado ───────
out = img.copy()

tears = [
    (0.225, 0.300, 36),
    (0.392, 0.404, -26),
    (0.505, 0.575, 52),
    (0.632, 0.648, -14),
    (0.735, 0.772, 22),
    (0.845, 0.858, -30),
]

for top, bottom, dx in tears:
    y0, y1 = int(top * H), int(bottom * H)
    out.paste(img.crop((0, y0, W, y1)), (dx, y0))

band = out.crop((0, int(0.505 * H), W, int(0.575 * H)))
r, g, b = band.split()
out.paste(Image.merge("RGB", (g, b, r)), (11, int(0.505 * H)))

out = Image.eval(out, lambda v: min(255, (v // 51) * 51))

px = out.load()
for top, bottom, _ in tears:
    for y, tint in ((int(top * H), (110, 40, 0)), (int(bottom * H), (0, 60, 110))):
        if 0 <= y < H:
            for x in range(W):
                r, g, b = px[x, y]
                px[x, y] = (
                    min(255, r + tint[0]),
                    min(255, g + tint[1] // 2),
                    min(255, b + tint[2]),
                )

# scanlines suaves (cada 3 filas, poco contraste)
lines = Image.new("RGB", (W, H), (255, 255, 255))
dl = ImageDraw.Draw(lines)
for y in range(H):
    k = 232 if y % 3 else 208
    dl.line([(0, y), (W, y)], fill=(k, k, k))
out = ImageChops.multiply(out, lines)

out.save("design/frame.jpg", quality=90, optimize=True)
out.crop((30, 70, W - 30, H - 90)).resize((240, 150)).save(
    "design/frame-thumb.jpg", quality=88, optimize=True
)

print("ok")
