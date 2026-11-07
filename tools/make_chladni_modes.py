"""Computed Chladni nodal lines for an idealised square plate.

  python3 tools/make_chladni_modes.py assets/sketches/chladni-modes.svg

Uses the textbook approximation for a free square plate,
    f(x, y) = cos(n·πx)·cos(m·πy) − cos(m·πx)·cos(n·πy),  x, y in [0, 1],
and draws the zero contour, which is where sand collects. These are computed
patterns, not measurements of the Chladni plate project (which is design only).
The same formula drives the interactive sand figure in js/chladni.js.
"""
import sys
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

MODES = [(1, 2), (2, 3), (1, 4), (3, 5)]
N, SIZE, GAP, PAD = 400, 150, 30, 10


def f(n, m, x, y):
    return np.cos(n * np.pi * x) * np.cos(m * np.pi * y) - np.cos(m * np.pi * x) * np.cos(n * np.pi * y)


def main(out):
    xs = np.linspace(0, 1, N)
    X, Y = np.meshgrid(xs, xs)
    W = PAD * 2 + len(MODES) * SIZE + (len(MODES) - 1) * GAP
    H = PAD + SIZE + 34
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" class="sketch chladni-modes" role="img" aria-labelledby="cm-t cm-d">',
             '<title id="cm-t">Computed nodal lines for four modes of a square plate</title>',
             '<desc id="cm-d">Zero contours of cos(nπx)cos(mπy) − cos(mπx)cos(nπy) for (n, m) = ' +
             ', '.join(f'({n}, {m})' for n, m in MODES) + '. Computed, not observed.</desc>']
    for i, (n, m) in enumerate(MODES):
        ox = PAD + i * (SIZE + GAP)
        cs = plt.contour(X, Y, f(n, m, X, Y), levels=[0])
        d = []
        for seg in cs.allsegs[0]:
            if len(seg) < 2:
                continue
            seg = seg[::3] if len(seg) > 6 else seg
            d.append('M' + 'L'.join(f'{ox + px * SIZE:.1f} {PAD + (1 - py) * SIZE:.1f}' for px, py in seg))
        plt.close('all')
        parts.append(f'<rect class="sk sk-light" x="{ox}" y="{PAD}" width="{SIZE}" height="{SIZE}" fill="none"/>')
        parts.append(f'<path class="sk nodal" fill="none" d="{"".join(d)}"/>')
        parts.append(f'<text class="sk-num" x="{ox + SIZE / 2}" y="{PAD + SIZE + 24}" text-anchor="middle">n = {n}, m = {m}</text>')
    parts.append('</svg>')
    open(out, 'w').write('\n'.join(parts))
    print(out, sum(len(p) for p in parts) // 1024, 'KB')


if __name__ == '__main__':
    main(sys.argv[1])
