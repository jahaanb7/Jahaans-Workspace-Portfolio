"""Builds assets/drawings/orion-airframe.svg from the projected STL geometry.

  python3 tools/stl_to_drawing.py <orion-repo>/CAD tools/data/orion-geometry.json
  python3 tools/make_orion_sheet.py tools/data/orion-geometry.json assets/drawings/orion-airframe.svg

Every outline comes from the STL files. Every dimension is measured from the STL
bounding boxes. Nothing is added by hand except labels and leader lines.
The rocket is drawn horizontally: drawing x = model Z (nose to the right), drawing y = model X.
"""
import json
import sys

GAP = 26.0            # spacing between parts in the separated view (mm)
ROW1_Y = 120.0        # centreline of the assembly view
ROW2_Y = 330.0        # centreline of the separated view
LEFT = 60.0
MIN_SEG = 0.9         # drop hidden segments shorter than this (mm)


def merge(segs, min_len=0.0):
    """Join segments that continue each other in a straight line; drop tiny ones."""
    out = []
    for (x1, y1), (x2, y2) in segs:
        if out:
            (ax, ay), (bx, by) = out[-1]
            if abs(bx - x1) < 0.05 and abs(by - y1) < 0.05:
                # collinear?
                cr = (bx - ax) * (y2 - ay) - (by - ay) * (x2 - ax)
                if abs(cr) < 0.05:
                    out[-1] = ((ax, ay), (x2, y2))
                    continue
        out.append(((x1, y1), (x2, y2)))
    return [s for s in out if ((s[1][0] - s[0][0]) ** 2 + (s[1][1] - s[0][1]) ** 2) ** 0.5 >= min_len]


def to_d(segs, dx, dy):
    # model (x, z) -> drawing (z + dx, x + dy)
    parts = []
    for (x1, z1), (x2, z2) in segs:
        parts.append(f'M{z1 + dx:.1f} {x1 + dy:.1f}L{z2 + dx:.1f} {x2 + dy:.1f}')
    return ''.join(parts)


def dim_h(x1, x2, y, label, ext_from=None, cls='dim'):
    """Horizontal dimension with arrowheads and extension lines."""
    s = []
    if ext_from is not None:
        s.append(f'<path class="{cls}-ext" d="M{x1:.1f} {ext_from[0]:.1f}V{y + 4:.1f}M{x2:.1f} {ext_from[1]:.1f}V{y + 4:.1f}"/>')
    s.append(f'<path class="{cls}" d="M{x1:.1f} {y:.1f}H{x2:.1f}" marker-start="url(#arrow)" marker-end="url(#arrow)"/>')
    s.append(f'<text class="dim-t" x="{(x1 + x2) / 2:.1f}" y="{y - 4:.1f}" text-anchor="middle">{label}</text>')
    return ''.join(s)


def dim_v(x, y1, y2, label, ext_x=None, cls='dim'):
    s = []
    if ext_x is not None:
        s.append(f'<path class="{cls}-ext" d="M{ext_x:.1f} {y1:.1f}H{x - 4:.1f}M{ext_x:.1f} {y2:.1f}H{x - 4:.1f}"/>')
    s.append(f'<path class="{cls}" d="M{x:.1f} {y1:.1f}V{y2:.1f}" marker-start="url(#arrow)" marker-end="url(#arrow)"/>')
    s.append(f'<text class="dim-t" x="{x - 5:.1f}" y="{(y1 + y2) / 2:.1f}" text-anchor="end" dominant-baseline="middle">{label}</text>')
    return ''.join(s)


def main(src, out):
    g = json.load(open(src))
    A = g['assembly']
    zmin, zmax = A['bbox']['min'][2], A['bbox']['max'][2]
    length = zmax - zmin
    dx1 = LEFT - zmin
    svg = []
    order_keys = ['motor', 'base', 'body', 'support', 'payload', 'nose']
    parts_len = sum(g['parts'][k]['bbox']['size'][2] for k in order_keys) + GAP * (len(order_keys) - 1)
    W, H = LEFT + max(length, parts_len) + 50, 530
    svg.append(f'<svg class="drawing orion-sheet" viewBox="0 0 {W:.0f} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="orion-svg-title orion-svg-desc">')
    svg.append('<title id="orion-svg-title">Orion airframe V0.1, orthographic drawing projected from the CAD files</title>')
    svg.append(f'<desc id="orion-svg-desc">Top: the full assembly, {length:.0f} millimetres long and 75 millimetres in diameter, nose to the right, with hidden edges dashed. '
               'Bottom: the same parts separated: motor, base mount, body tube, support ring, payload section and nose cone, each labelled with its measured size.</desc>')
    svg.append('<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1L10 5L0 9z" class="arrowhead"/></marker></defs>')

    # Row 1: assembly
    svg.append(f'<g class="row row-assembly">')
    svg.append(f'<path class="centre" d="M{LEFT - 20:.1f} {ROW1_Y}H{LEFT + length + 20:.1f}"/>')
    svg.append(f'<path class="h" d="{to_d(merge(A["hidden"], MIN_SEG), dx1, ROW1_Y)}"/>')
    svg.append(f'<path class="v" pathLength="1" d="{to_d(merge(A["visible"]), dx1, ROW1_Y)}"/>')
    r = 37.5
    svg.append(dim_h(LEFT, LEFT + length, ROW1_Y - r - 26, f'{length:.0f}', ext_from=(ROW1_Y - 16, ROW1_Y - r - 2)))
    nose = g['parts']['nose']['bbox']
    nz0 = nose['min'][2] + dx1
    svg.append(dim_h(nz0, LEFT + length, ROW1_Y + r + 22, f'{nose["size"][2]:.0f}', ext_from=(ROW1_Y + r + 2, ROW1_Y + 2)))
    svg.append(dim_v(LEFT - 26, ROW1_Y - r, ROW1_Y + r, 'Ø75', ext_x=LEFT + 40))
    svg.append(f'<text class="view-t" x="{LEFT - 20:.1f}" y="{ROW1_Y - r - 50:.1f}">A  ASSEMBLY · FRONT ELEVATION</text>')
    svg.append('</g>')

    # Row 2: separated parts, in assembly order from tail to nose
    order = [('motor', 'Motor'), ('base', 'Base mount'), ('body', 'Body tube'),
             ('support', 'Support ring'), ('payload', 'Payload section'), ('nose', 'Nose cone')]
    x = LEFT
    svg.append('<g class="row row-parts">')
    svg.append(f'<text class="view-t" x="{LEFT - 20:.1f}" y="{ROW2_Y - 95:.1f}">B  PARTS SEPARATED ALONG THE AXIS</text>')
    svg.append(f'<path class="centre" d="M{LEFT - 20:.1f} {ROW2_Y}H{W - 30:.1f}"/>')
    callouts = []
    for i, (key, name) in enumerate(order):
        p = g['parts'][key]
        bz0 = p['bbox']['min'][2]
        dx = x - bz0
        vis = merge(p['visible'])
        hid = merge(p['hidden'], MIN_SEG)
        svg.append(f'<g class="part" data-part="{key}">')
        svg.append(f'<path class="h" d="{to_d(hid, dx, ROW2_Y)}"/>')
        svg.append(f'<path class="v" pathLength="1" d="{to_d(vis, dx, ROW2_Y)}"/>')
        svg.append('</g>')
        size = p['bbox']['size']
        cx = x + size[2] / 2
        dia = max(size[0], size[1])
        label = f'Ø{dia:.0f} × {size[2]:.0f}'
        above = i % 2 == 0
        ty = ROW2_Y - 62 if above else ROW2_Y + 74
        ly = ROW2_Y - dia / 2 - 2 if above else ROW2_Y + dia / 2 + 2
        callouts.append(f'<g class="callout"><path class="leader" d="M{cx:.1f} {ly:.1f}L{cx:.1f} {ty + (6 if above else -16):.1f}"/>'
                        f'<circle class="leader-dot" cx="{cx:.1f}" cy="{ly:.1f}" r="1.6"/>'
                        f'<text class="call-t" x="{cx:.1f}" y="{ty - 6 if above else ty:.1f}" text-anchor="middle">{i + 1}  {name}</text>'
                        f'<text class="call-s" x="{cx:.1f}" y="{ty + 8 if above else ty + 14:.1f}" text-anchor="middle">{label}</text></g>')
        x += size[2] + GAP
    svg.extend(callouts)
    svg.append('</g>')

    # Title block
    tb_w, tb_h = 450, 64
    tx, ty = W - tb_w - 20, H - tb_h - 14
    svg.append(f'<g class="title-block"><rect x="{tx}" y="{ty}" width="{tb_w}" height="{tb_h}"/>'
               f'<path d="M{tx} {ty + 22}H{tx + tb_w}M{tx + 280} {ty + 22}V{ty + tb_h}"/>'
               f'<text class="tb-big" x="{tx + 8}" y="{ty + 16}">ORION · AIRFRAME V0.1</text>'
               f'<text class="tb" x="{tx + 8}" y="{ty + 36}">Projected from Orion_Master_V0.1.stl</text>'
               f'<text class="tb" x="{tx + 8}" y="{ty + 49}">and part STLs · {A["triangles"]:,} triangles</text>'
               f'<text class="tb" x="{tx + 290}" y="{ty + 36}">Units: mm</text>'
               f'<text class="tb" x="{tx + 290}" y="{ty + 49}">Status: design only</text></g>')
    svg.append('</svg>')
    open(out, 'w').write(''.join(svg))
    print(f'{out}: {len("".join(svg)) / 1024:.0f} KB, length {length:.0f} mm')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
