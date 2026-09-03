#!/usr/bin/env python3
"""Generate the Steal extension icons (16/48/128) as RGBA PNGs.

Motif: a pointer cursor snatching a code angle-bracket pair, with a motion
streak trailing behind it. Pure standard library, 4x supersampled for clean
edges. Re-run after tweaking geometry or COLOR.
"""
import struct
import zlib
import os

COLOR = (124, 58, 237)      # #7c3aed violet
SS = 4                       # supersampling factor
OUT_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "icons")

# All geometry in a 0..1 unit square, y pointing down.

# The "loot": two chevrons < >  (the element being lifted).
CHEVRONS = [
    [(0.34, 0.12), (0.17, 0.29), (0.34, 0.46)],   # <
    [(0.44, 0.12), (0.61, 0.29), (0.44, 0.46)],   # >
]
CHEVRON_W = 0.085

# Motion streak: clean parallel diagonals trailing the cursor to lower-right.
STREAKS = [
    ((0.66, 0.60), (0.82, 0.44)),
    ((0.73, 0.67), (0.89, 0.51)),
    ((0.80, 0.74), (0.96, 0.58)),
]
STREAK_W = 0.05

# Pointer cursor, canonical arrow (tip at local 0,0, pointing up-left),
# scaled by 0.52 and placed with its tip on the lower chevron.
_ARROW = [
    (0.00, 0.00), (0.00, 0.70), (0.17, 0.53), (0.28, 0.80),
    (0.40, 0.75), (0.29, 0.48), (0.53, 0.48),
]
CURSOR_SCALE = 0.52
CURSOR_TIP = (0.40, 0.42)
CURSOR = [(x * CURSOR_SCALE + CURSOR_TIP[0], y * CURSOR_SCALE + CURSOR_TIP[1])
          for (x, y) in _ARROW]

# Transparent halo punched around the cursor so it reads as a separate shape.
HALO = 0.028


def _dist_point_seg(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5


def _point_in_poly(px, py, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > py) != (yj > py):
            xcross = (xj - xi) * (py - yi) / (yj - yi) + xi
            if px < xcross:
                inside = not inside
        j = i
    return inside


def _polyline_dist(px, py, pts):
    return min(_dist_point_seg(px, py, pts[k][0], pts[k][1],
                               pts[k + 1][0], pts[k + 1][1])
              for k in range(len(pts) - 1))


def _coverage(u, v):
    """Alpha 0..1 for the icon at unit coords (u, v)."""
    # Cursor (drawn on top) and its halo.
    cursor_d = 0.0 if _point_in_poly(u, v, CURSOR) else _polyline_dist(u, v, CURSOR + CURSOR[:1])
    if cursor_d <= 0.0:
        return 1.0
    if cursor_d < HALO:
        return 0.0  # transparent gap around the cursor

    # Loot + streaks behind it.
    for ch in CHEVRONS:
        if _polyline_dist(u, v, ch) <= CHEVRON_W / 2:
            return 1.0
    for (a, b) in STREAKS:
        if _dist_point_seg(u, v, a[0], a[1], b[0], b[1]) <= STREAK_W / 2:
            return 1.0
    return 0.0


def make_pixels(size):
    hi = size * SS
    # Render coverage at hi-res, then box-downsample to size.
    cov = [[0.0] * hi for _ in range(hi)]
    for y in range(hi):
        v = (y + 0.5) / hi
        row = cov[y]
        for x in range(hi):
            u = (x + 0.5) / hi
            row[x] = _coverage(u, v)

    px = bytearray()
    for y in range(size):
        for x in range(size):
            s = 0.0
            for dy in range(SS):
                for dx in range(SS):
                    s += cov[y * SS + dy][x * SS + dx]
            a = int(round(255 * s / (SS * SS)))
            px += bytes((COLOR[0], COLOR[1], COLOR[2], a))
    return bytes(px)


def write_png(path, size):
    raw = make_pixels(size)
    stride = size * 4
    scan = bytearray()
    for y in range(size):
        scan.append(0)
        scan += raw[y * stride:(y + 1) * stride]

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(scan), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for s in (16, 48, 128):
        p = os.path.join(OUT_DIR, f"icon{s}.png")
        write_png(p, s)
        print("wrote", os.path.relpath(p))


if __name__ == "__main__":
    main()
