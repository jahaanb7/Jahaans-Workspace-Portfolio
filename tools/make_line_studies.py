"""Line studies for the Workbench cards, projected straight from the repository meshes.

    python3 tools/make_line_studies.py <Orion repo> <ChladniPlate repo>

Writes assets/drawings/orion-study.svg and assets/drawings/chladni-study.svg. Each view is the
mesh rotated, then projected with hidden-line removal (stl_to_drawing.project_part). Views use
their own scale, so the sheets carry no dimensions: they show the geometry, nothing inferred.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import stl_to_drawing as std  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def rot(tris, az=0.0, el=0.0):
    """Turn about Z by az, then tilt about X by el (degrees) so the top faces the viewer at -Y."""
    a, e = np.radians(az), np.radians(el)
    rz = np.array([[np.cos(a), -np.sin(a), 0], [np.sin(a), np.cos(a), 0], [0, 0, 1]])
    rx = np.array([[1, 0, 0], [0, np.cos(e), -np.sin(e)], [0, np.sin(e), np.cos(e)]])
    return tris @ (rx @ rz).T


def plan(tris):
    # look down from +Z: screen x = X, screen y = Y, depth = -Z
    return np.stack([tris[:, :, 0], -tris[:, :, 2], tris[:, :, 1]], axis=2)


def view(tris, box, flip=True):
    """Project, then fit the result into box = (x, y, w, h). Returns (visible d, hidden d, placed box)."""
    vis, hid, _ = std.project_part(tris)
    pts = np.array([p for s in vis for p in s])
    x0, y0 = pts.min(0)
    x1, y1 = pts.max(0)
    bx, by, bw, bh = box
    s = min(bw / (x1 - x0), bh / (y1 - y0))
    ox = bx + (bw - (x1 - x0) * s) / 2
    oy = by + (bh - (y1 - y0) * s) / 2

    def d(segs):
        # place, drop sub-pixel pieces, then chain pieces that share an end point into polylines
        pts = []
        for (ax, ay), (cx, cy) in segs:
            if flip:
                ay, cy = y1 - ay + y0, y1 - cy + y0
            a = (round(ox + (ax - x0) * s, 1), round(oy + (ay - y0) * s, 1))
            c = (round(ox + (cx - x0) * s, 1), round(oy + (cy - y0) * s, 1))
            if abs(a[0] - c[0]) + abs(a[1] - c[1]) >= 0.4:
                pts.append((a, c))
        out, last = [], None
        for a, c in pts:
            if last is None or abs(last[0] - a[0]) + abs(last[1] - a[1]) > 0.15:
                out.append(f"M{a[0]:g} {a[1]:g}")
            out.append(f"L{c[0]:g} {c[1]:g}")
            last = c
        return ''.join(out)

    placed = (ox, oy, (x1 - x0) * s, (y1 - y0) * s)
    return d(vis), d(hid), placed


def sheet(name, title, desc, W, H, views):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" '
           f'aria-labelledby="{name}-t {name}-d" class="drawing study">',
           f'<title id="{name}-t">{title}</title>', f'<desc id="{name}-d">{desc}</desc>']
    for i, (label, vd, hd, (x, y, w, h), lx, ly) in enumerate(views):
        out.append(f'<g class="study-view" style="--v:{i}">')
        if hd:
            out.append(f'<path class="h" d="{hd}"/>')
        out.append(f'<path class="v" d="{vd}"/>')
        out.append('</g>')
    out.append('</svg>')
    return '\n'.join(out) + '\n'


def orion(repo):
    std.PX_PER_MM = 3.0
    tris = std.load_stl(Path(repo) / 'CAD' / 'Orion_Master_V0.1.stl')
    W, H = 560, 600
    ev, eh, eb = view(tris, (40, 36, 60, 500))
    ov, oh, ob = view(rot(tris, az=28, el=22), (150, 36, 150, 500))
    pv, ph, pb = view(plan(tris), (350, 330, 170, 170))
    return sheet('orion-study', 'Orion line study: elevation, oblique and plan projections',
                 'Projected from Orion_Master_V0.1.stl in the Orion repository, with hidden lines '
                 'removed. Design only; nothing has been built.', W, H, [
                     ('01 / elevation', ev, eh, eb, 40, 566),
                     ('02 / oblique projection', ov, oh, ob, 170, 566),
                     ('03 / plan projection', pv, ph, pb, 350, 530),
                 ])


def chladni(repo):
    std.PX_PER_MM = 4.0
    prod = Path(repo) / 'production'
    tris = np.concatenate([std.load_stl(prod / 'enclosure_V2.stl'), std.load_stl(prod / 'enclosure_cap.stl')])
    W, H = 560, 600
    ov, oh, ob = view(rot(tris, az=-35, el=32), (40, 30, 480, 300))
    pv, ph, pb = view(plan(tris), (150, 380, 260, 160))
    return sheet('chladni-study', 'Chladni plate enclosure: oblique and plan projections',
                 'Projected from enclosure_V2.stl and enclosure_cap.stl in the ChladniPlate '
                 'repository, with hidden lines removed. Design only; nothing has been built.', W, H, [
                     ('01 / oblique projection', ov, oh, ob, 40, 350),
                     ('02 / plan projection', pv, ph, pb, 150, 572),
                 ])


if __name__ == '__main__':
    orion_repo, chladni_repo = sys.argv[1], sys.argv[2]
    (ROOT / 'assets/drawings/orion-study.svg').write_text(orion(orion_repo))
    (ROOT / 'assets/drawings/chladni-study.svg').write_text(chladni(chladni_repo))
    print('wrote orion-study.svg, chladni-study.svg')


def shaded(tris, out, px=1100, az=-35, el=32, edges=True):
    """Flat-shaded CAD view (z-buffer, Lambert + ambient) with the projected visible edges on top."""
    from PIL import Image, ImageDraw
    r = rot(tris, az, el)
    xs, zs = r[:, :, 0], r[:, :, 2]
    x0, x1, z0, z1 = xs.min(), xs.max(), zs.min(), zs.max()
    pad = 0.04
    s = px * (1 - 2 * pad) / max(x1 - x0, z1 - z0)
    W, H = int((x1 - x0) * s + px * 2 * pad), int((z1 - z0) * s + px * 2 * pad)
    P = np.empty_like(r[:, :, :2])
    P[:, :, 0] = (xs - x0) * s + px * pad
    P[:, :, 1] = (z1 - zs) * s + px * pad
    D = r[:, :, 1]
    nrm = np.cross(r[:, 1] - r[:, 0], r[:, 2] - r[:, 0])
    nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-12)
    nrm[nrm[:, 1] > 0] *= -1  # face the viewer (mesh winding is not trusted)
    light = np.array([-0.45, -0.75, 0.5]); light /= np.linalg.norm(light)
    shade = 0.58 + 0.42 * np.clip(nrm @ light, 0, 1)
    zb = np.full((H, W), np.inf); img = np.zeros((H, W, 4))
    base = np.array([0.80, 0.80, 0.78])
    for t in range(len(r)):
        (ax, ay), (bx, by), (cx, cy) = P[t]
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if abs(area) < 1e-9:
            continue
        mnx, mxx = int(max(0, np.floor(min(ax, bx, cx)))), int(min(W - 1, np.ceil(max(ax, bx, cx))))
        mny, mxy = int(max(0, np.floor(min(ay, by, cy)))), int(min(H - 1, np.ceil(max(ay, by, cy))))
        if mxx < mnx or mxy < mny:
            continue
        X, Y = np.meshgrid(np.arange(mnx, mxx + 1) + 0.5, np.arange(mny, mxy + 1) + 0.5)
        w0 = ((cx - bx) * (Y - by) - (cy - by) * (X - bx)) / area
        w1 = ((ax - cx) * (Y - cy) - (ay - cy) * (X - cx)) / area
        w2 = 1 - w0 - w1
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        d = w0 * D[t, 0] + w1 * D[t, 1] + w2 * D[t, 2]
        sub = zb[mny:mxy + 1, mnx:mxx + 1]
        win = inside & (d < sub)
        sub[win] = d[win]
        im = img[mny:mxy + 1, mnx:mxx + 1]
        im[win] = np.append(base * shade[t], 1.0)
    rgba = (img * 255).astype(np.uint8)
    pic = Image.fromarray(rgba, 'RGBA')
    if edges:
        std.PX_PER_MM = 4.0
        vis, _, _ = std.project_part(r)
        dr = ImageDraw.Draw(pic)
        for (ax, az_), (cx, cz) in vis:
            dr.line([((ax - x0) * s + px * pad, (z1 - az_) * s + px * pad),
                     ((cx - x0) * s + px * pad, (z1 - cz) * s + px * pad)], fill=(40, 42, 46, 255), width=2)
    pic.save(out, 'WEBP', quality=86, method=6)
    return pic.size


if __name__ == '__main__' and len(sys.argv) > 3 and sys.argv[3] == '--cad':
    prod = Path(sys.argv[2]) / 'production'
    tris = np.concatenate([std.load_stl(prod / 'enclosure_V2.stl'), std.load_stl(prod / 'enclosure_cap.stl')])
    print('chladni-cad.webp', shaded(tris, ROOT / 'assets/images/chladni-cad.webp'))
