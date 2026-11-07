"""Writes assets/textures/paper-crumple.jpg: a lightly crumpled sheet of paper for the scratchbook.

The height field is a sum of creases (each a soft V along a random straight line), the way a sheet
that was balled up once and flattened again keeps straight folds and flat facets. It is lit from the
upper left and remapped so that flat paper stays white and only the creases' shaded sides darken,
because the page multiplies it over the paper colour. Fixed seed: the output is reproducible.
"""
import numpy as np
from PIL import Image, ImageFilter
from pathlib import Path

W, H = 1400, 900
rng = np.random.default_rng(7)
y, x = np.mgrid[0:H, 0:W].astype(np.float32)

h = np.zeros((H, W), np.float32)
for _ in range(160):
    ang = rng.uniform(0, np.pi)
    nx, ny = np.cos(ang), np.sin(ang)
    px, py = rng.uniform(-0.05, 1.05) * W, rng.uniform(-0.05, 1.05) * H
    d = (x - px) * nx + (y - py) * ny            # across the crease
    t = -(x - px) * ny + (y - py) * nx           # along it
    half = rng.uniform(90, 380)                  # creases are segments, fading out at their ends
    along = np.clip(1 - (np.abs(t) / half) ** 2, 0, 1)
    if not along.any():
        continue
    amp = rng.uniform(0.3, 1.0) * (1 if rng.random() < 0.5 else -1)
    reach = rng.uniform(40, 160)                 # how far the crease bends the paper either side
    soft = rng.uniform(0.8, 2.5)                 # sharpness of the fold itself
    v = np.sqrt(d * d + soft * soft)
    h += amp * along * np.minimum(v, reach)
# a little fine tooth so the facets are not glassy
tooth = rng.standard_normal((H // 4, W // 4)).astype(np.float32)
tooth = np.array(Image.fromarray(tooth).resize((W, H), Image.BICUBIC))
h += tooth * 0.9

gy, gx = np.gradient(h)
k = 0.09
nz = 1.0 / np.sqrt(1 + (k * gx) ** 2 + (k * gy) ** 2)
lx, ly, lz = -0.55, -0.55, 0.63           # light from the upper left
lam = (-(k * gx) * lx - (k * gy) * ly + lz) * nz / np.sqrt(lx * lx + ly * ly + lz * lz)
flat = lz / np.sqrt(lx * lx + ly * ly + lz * lz)
shade = np.clip(lam / flat, 0, 1.2)        # 1 = flat paper
val = 1.0 - 0.11 * np.clip(1 - shade, 0, 1) + 0.02 * np.clip(shade - 1, 0, 0.2) / 0.2
val = np.clip(val, 0, 1)
img = Image.fromarray((val * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
out = Path(__file__).resolve().parent.parent / 'assets' / 'textures' / 'paper-crumple.jpg'
img.save(out, quality=84, optimize=True)
print(out, out.stat().st_size)
