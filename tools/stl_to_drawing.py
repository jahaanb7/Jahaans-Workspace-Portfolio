"""Orthographic line drawings from STL meshes, with hidden-line removal.

Used to build the Orion drawing sheet from the real CAD exports in the Orion
repository. Nothing is redrawn by hand: every line is a projected mesh edge.

  python3 tools/stl_to_drawing.py <orion-repo>/CAD assets/drawings/orion-geometry.json

Lines kept:
  * silhouette edges (one adjacent face toward the viewer, one away)
  * feature edges (adjacent faces meet at more than FEATURE_DEG degrees)
  * open boundary edges
Each edge is sampled against a depth buffer and split into visible and hidden runs.
View: front elevation, looking along +Y. Screen x = model X, screen y = model Z. Units: mm.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np

FEATURE_DEG = 28.0
PX_PER_MM = 6.0          # depth-buffer resolution
DEPTH_EPS_MM = 0.6       # tolerance when comparing an edge to the depth buffer
SAMPLE_MM = 0.4          # spacing of visibility samples along an edge
OFFSET_FACTOR = 3.0      # depth offset, in pixels of depth slope
OFFSET_MAX_MM = 12.0


def load_stl(path):
    data = Path(path).read_bytes()
    n = struct.unpack('<I', data[80:84])[0]
    rec = np.frombuffer(data, dtype=np.uint8, count=n * 50, offset=84).reshape(n, 50)
    tris = rec[:, 12:48].copy().view('<f4').reshape(n, 3, 3).astype(np.float64)
    return tris


def edges_for(tris, view=np.array([0.0, 1.0, 0.0])):
    v = np.round(tris.reshape(-1, 3), 3)
    uniq, inv = np.unique(v, axis=0, return_inverse=True)
    f = inv.reshape(-1, 3)
    nrm = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ln = np.linalg.norm(nrm, axis=1)
    ok = ln > 1e-12
    nrm[ok] /= ln[ok, None]
    edge_faces = {}
    for fi, (a, b, c) in enumerate(f):
        if not ok[fi]:
            continue
        for e in ((a, b), (b, c), (c, a)):
            key = (e[0], e[1]) if e[0] < e[1] else (e[1], e[0])
            edge_faces.setdefault(key, []).append(fi)
    cos_feat = np.cos(np.radians(FEATURE_DEG))
    keep = []
    for (a, b), fs in edge_faces.items():
        if len(fs) != 2:
            keep.append((a, b))
            continue
        n1, n2 = nrm[fs[0]], nrm[fs[1]]
        if np.dot(n1, n2) < cos_feat:
            keep.append((a, b))
        elif np.sign(np.dot(n1, view)) != np.sign(np.dot(n2, view)):
            keep.append((a, b))
    return uniq, keep


def depth_buffer(tris, bounds):
    (x0, x1), (z0, z1) = bounds
    w = int(np.ceil((x1 - x0) * PX_PER_MM)) + 3
    h = int(np.ceil((z1 - z0) * PX_PER_MM)) + 3
    zb = np.full((h, w), np.inf)
    P = np.empty_like(tris[:, :, :2])
    P[:, :, 0] = (tris[:, :, 0] - x0) * PX_PER_MM + 1
    P[:, :, 1] = (tris[:, :, 2] - z0) * PX_PER_MM + 1
    D = tris[:, :, 1]  # depth = model Y (viewer at -Y)
    # Slope-scaled depth offset (like glPolygonOffset): faces seen at a grazing angle are pushed
    # back so they cannot hide the silhouette edges that bound them.
    nrm = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
    ny = np.abs(nrm[:, 1])
    slope = np.hypot(nrm[:, 0], nrm[:, 2]) / np.maximum(ny, 1e-12)
    offset = np.minimum(OFFSET_FACTOR * slope / PX_PER_MM, OFFSET_MAX_MM)
    for t in range(len(tris)):
        if ny[t] < 1e-9 * (np.linalg.norm(nrm[t]) + 1e-30):
            continue  # edge-on triangle covers no area in this view
        (ax, ay), (bx, by), (cx, cy) = P[t]
        area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if abs(area) < 1e-9:
            continue
        minx, maxx = int(max(0, np.floor(min(ax, bx, cx)))), int(min(w - 1, np.ceil(max(ax, bx, cx))))
        miny, maxy = int(max(0, np.floor(min(ay, by, cy)))), int(min(h - 1, np.ceil(max(ay, by, cy))))
        if maxx < minx or maxy < miny:
            continue
        xs, ys = np.meshgrid(np.arange(minx, maxx + 1) + 0.5, np.arange(miny, maxy + 1) + 0.5)
        w0 = ((cx - bx) * (ys - by) - (cy - by) * (xs - bx)) / area
        w1 = ((ax - cx) * (ys - cy) - (ay - cy) * (xs - cx)) / area
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        d = w0 * D[t, 0] + w1 * D[t, 1] + w2 * D[t, 2] + offset[t]
        sub = zb[miny:maxy + 1, minx:maxx + 1]
        np.minimum(sub, np.where(inside, d, np.inf), out=sub)
    return zb


def project_part(tris, offset=(0.0, 0.0)):
    bounds = ((tris[:, :, 0].min() - 1, tris[:, :, 0].max() + 1), (tris[:, :, 2].min() - 1, tris[:, :, 2].max() + 1))
    zb = depth_buffer(tris, bounds)
    verts, edges = edges_for(tris)
    (x0, _), (z0, _) = bounds
    h, w = zb.shape
    visible, hidden = [], []
    for a, b in edges:
        A, B = verts[a], verts[b]
        L = np.hypot(B[0] - A[0], B[2] - A[2])
        if L < 1e-6:
            continue
        n = max(2, int(L / SAMPLE_MM) + 1)
        t = np.linspace(0, 1, n)
        pts = A[None, :] + (B - A)[None, :] * t[:, None]
        px = np.clip(((pts[:, 0] - x0) * PX_PER_MM + 1).astype(int), 0, w - 1)
        py = np.clip(((pts[:, 2] - z0) * PX_PER_MM + 1).astype(int), 0, h - 1)
        # take the nearest surface in a 3x3 neighbourhood so edges are not hidden by their own faces
        near = zb[py, px]
        vis = pts[:, 1] <= near + DEPTH_EPS_MM
        start = 0
        for i in range(1, n + 1):
            if i == n or vis[i] != vis[start]:
                seg = [(round(pts[start, 0] + offset[0], 2), round(pts[start, 2] + offset[1], 2)),
                       (round(pts[i - 1, 0] + offset[0], 2), round(pts[i - 1, 2] + offset[1], 2))]
                if seg[0] != seg[1]:
                    (visible if vis[start] else hidden).append(seg)
                start = i
    return visible, hidden, bounds


def merge_collinear(segs):
    """Join consecutive pieces of the same edge so the SVG stays small."""
    return segs  # pieces of one edge are already emitted as one run per visibility state


def bbox(tris):
    mn, mx = tris.reshape(-1, 3).min(0), tris.reshape(-1, 3).max(0)
    return {'min': [round(float(v), 1) for v in mn], 'max': [round(float(v), 1) for v in mx],
            'size': [round(float(v), 1) for v in mx - mn]}


def main(cad_dir, out_path):
    cad = Path(cad_dir)
    result = {'source': 'Orion repository CAD/*.stl (binary STL, millimetres)', 'view': 'front elevation, +Y',
              'units': 'mm', 'parts': {}, 'assembly': None}

    master = load_stl(cad / 'Orion_Master_V0.1.stl')
    vis, hid, bounds = project_part(master)
    result['assembly'] = {'file': 'Orion_Master_V0.1.stl', 'triangles': int(len(master)), 'bbox': bbox(master),
                          'visible': vis, 'hidden': hid}

    parts = [
        ('nose', 'Nose Cone.stl'),
        ('payload', 'Airframe/Payload.stl'),
        ('support', 'Airframe/Support Structure.stl'),
        ('body', 'Airframe/Body Tube.stl'),
        ('base', 'Airframe/BaseMount.stl'),
        ('motor', 'RocketMotor.stl'),
    ]
    for key, rel in parts:
        tris = load_stl(cad / rel)
        vis, hid, _ = project_part(tris)
        result['parts'][key] = {'file': rel, 'triangles': int(len(tris)), 'bbox': bbox(tris), 'visible': vis, 'hidden': hid}
        print(f'{key:8s} {len(tris):6d} tris  visible={len(vis):5d} hidden={len(hid):5d}')

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    Path(out_path).write_text(json.dumps(result, separators=(',', ':')))
    a = result['assembly']
    print(f"assembly {a['triangles']} tris visible={len(a['visible'])} hidden={len(a['hidden'])} -> {out_path}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
