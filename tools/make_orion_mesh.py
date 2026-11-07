"""Orion parts for the opening: real STLs from the Orion repository, simplified for a live
software rasterizer.

    python3 tools/make_orion_mesh.py <Orion repo>

Writes assets/mesh/orion-parts.json. Each part keeps its assembly position (the STLs share one
coordinate frame), is simplified by vertex clustering, and is stored as integer tenths of a
millimetre. Lengths in the labels are measured from the meshes, nothing is inferred.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from stl_to_drawing import load_stl  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# stack order from the bottom; the explode offset grows with distance from the middle
PARTS = [
    ('motor', 'Motor', 'RocketMotor.stl', 2.2),
    ('base', 'Base mount', 'Airframe/BaseMount.stl', 2.8),
    ('body', 'Body tube', 'Airframe/Body Tube.stl', 3.0),
    ('ring', 'Support ring', 'Airframe/Support Structure.stl', 3.2),
    ('payload', 'Payload bay', 'Airframe/Payload.stl', 2.5),
    ('nose', 'Nose cone', 'Nose Cone.stl', 5.0),
]


def cluster(tris, cell):
    """Vertex clustering: snap vertices to a grid, average each cell, drop collapsed faces."""
    v = tris.reshape(-1, 3)
    key = np.floor(v / cell).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    inv = inv.reshape(-1)
    sums = np.zeros((len(uniq), 3))
    np.add.at(sums, inv, v)
    cnt = np.bincount(inv, minlength=len(uniq))[:, None]
    verts = sums / cnt
    f = inv.reshape(-1, 3)
    ok = (f[:, 0] != f[:, 1]) & (f[:, 1] != f[:, 2]) & (f[:, 0] != f[:, 2])
    f = f[ok]
    # drop duplicate faces (same three vertices in any order)
    s = np.sort(f, axis=1)
    _, first = np.unique(s, axis=0, return_index=True)
    f = f[np.sort(first)]
    # keep only referenced vertices
    used, remap = np.unique(f.reshape(-1), return_inverse=True)
    return verts[used], remap.reshape(-1, 3)


def main(repo):
    cad = Path(repo) / 'CAD'
    out, total = [], 0
    for pid, name, file, cell in PARTS:
        tris = load_stl(cad / file)
        v, f = cluster(tris, cell)
        mn, mx = tris.reshape(-1, 3).min(0), tris.reshape(-1, 3).max(0)
        out.append({
            'id': pid, 'name': name, 'source': f'Orion/CAD/{file}',
            'lengthMm': round(float(mx[2] - mn[2])), 'diameterMm': round(float(max(mx[0] - mn[0], mx[1] - mn[1]))),
            'z': [round(float(mn[2]), 1), round(float(mx[2]), 1)],
            'v': np.round(v * 10).astype(int).reshape(-1).tolist(),
            'f': f.reshape(-1).tolist(),
        })
        total += len(f)
        print(f'{name:13s} {len(tris):6d} -> {len(f):5d} triangles')
    data = {'units': '0.1 mm', 'axis': 'z up', 'triangles': total, 'parts': out}
    path = ROOT / 'assets/mesh/orion-parts.json'
    path.write_text(json.dumps(data, separators=(',', ':')))
    print(f'total {total} triangles, {path.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main(sys.argv[1])
