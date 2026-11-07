"""Chladni plate enclosure: plan and front elevation from the repository STLs.

  python3 tools/make_chladni_sheet.py <ChladniPlate-repo>/production assets/drawings/chladni-enclosure.svg

Every line is a projected mesh edge (see stl_to_drawing.py). The only numbers on
the sheet are overall extents measured from the meshes. Design only: nothing here
has been printed or assembled.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from stl_to_drawing import load_stl, project_part  # noqa: E402

S = 1.6  # px per mm on the sheet


def plan(tris):
    # look down from +Z: screen x = X, screen y = Y, depth = -Z
    return np.stack([tris[:, :, 0], -tris[:, :, 2], tris[:, :, 1]], axis=2)


def path(segs, ox, oy, flip=True):
    out = []
    for (x0, y0), (x1, y1) in segs:
        if flip:
            y0, y1 = -y0, -y1
        out.append(f"M{ox + x0 * S:.1f} {oy + y0 * S:.1f}L{ox + x1 * S:.1f} {oy + y1 * S:.1f}")
    return ''.join(out)


def main(prod, out):
    body = load_stl(Path(prod) / 'enclosure_V2.stl')
    cap = load_stl(Path(prod) / 'enclosure_cap.stl')
    both = np.concatenate([body, cap])
    mn, mx = both.reshape(-1, 3).min(0), both.reshape(-1, 3).max(0)
    size = mx - mn

    pv, ph, _ = project_part(plan(both))
    fv, fh, _ = project_part(both)

    W, H = 820, 760
    # plan view origin so the model min x / max y sit at the margins (y flipped)
    px, py = 60 - mn[0] * S, 70 + mx[1] * S
    # front elevation below the plan, aligned in x (third-angle style: front under plan)
    fy = py - mn[1] * S + 70 + mx[2] * S
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="chl-t chl-d" class="drawing">',
        '<title id="chl-t">Chladni plate enclosure, plan and front elevation</title>',
        f'<desc id="chl-d">Line projection of enclosure_V2 and enclosure_cap from the ChladniPlate repository. Overall {size[0]:.0f} by {size[1]:.0f} by {size[2]:.0f} millimetres, measured from the meshes. Design only.</desc>',
        f'<path class="h" d="{path(ph, px, py)}"/>',
        f'<path class="v" d="{path(pv, px, py)}"/>',
        f'<path class="h" d="{path(fh, px, fy)}"/>',
        f'<path class="v" d="{path(fv, px, fy)}"/>',
    ]
    # overall dimensions (blue)
    x0, x1 = px + mn[0] * S, px + mx[0] * S
    ytop = py - mx[1] * S
    ybot = py - mn[1] * S
    dy = ybot + 26
    parts.append(f'<g class="dim"><path d="M{x0:.1f} {ybot + 6:.1f}V{dy + 6:.1f}M{x1:.1f} {ybot + 6:.1f}V{dy + 6:.1f}M{x0:.1f} {dy:.1f}H{x1:.1f}"/>'
                 f'<text x="{(x0 + x1) / 2:.1f}" y="{dy - 6:.1f}" text-anchor="middle">{size[0]:.1f}</text></g>')
    dx = x1 + 26
    parts.append(f'<g class="dim"><path d="M{x1 + 6:.1f} {ytop:.1f}H{dx + 6:.1f}M{x1 + 6:.1f} {ybot:.1f}H{dx + 6:.1f}M{dx:.1f} {ytop:.1f}V{ybot:.1f}"/>'
                 f'<text x="{dx + 8:.1f}" y="{(ytop + ybot) / 2:.1f}" transform="rotate(90 {dx + 8:.1f} {(ytop + ybot) / 2:.1f})" text-anchor="middle">{size[1]:.1f}</text></g>')
    ftop, fbot = fy - mx[2] * S, fy - mn[2] * S
    parts.append(f'<g class="dim"><path d="M{x1 + 6:.1f} {ftop:.1f}H{dx + 6:.1f}M{x1 + 6:.1f} {fbot:.1f}H{dx + 6:.1f}M{dx:.1f} {ftop:.1f}V{fbot:.1f}"/>'
                 f'<text x="{dx + 8:.1f}" y="{(ftop + fbot) / 2:.1f}" transform="rotate(90 {dx + 8:.1f} {(ftop + fbot) / 2:.1f})" text-anchor="middle">{size[2]:.1f}</text></g>')
    parts.append(f'<g class="labels"><text class="view-label" x="{x0:.1f}" y="{ytop - 18:.1f}">PLAN</text>'
                 f'<text class="view-label" x="{x0:.1f}" y="{ftop - 18:.1f}">FRONT</text></g>')
    parts.append('</svg>')
    W = int(dx + 40)
    parts[0] = parts[0].replace(f'viewBox="0 0 820 {H}"', f'viewBox="0 0 {W} {int(fbot + 20)}"')
    Path(out).write_text('\n'.join(parts))
    print(out, f'{size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f} mm', len(pv) + len(fv), 'visible segs', f'height used {fbot:.0f}/{H}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
