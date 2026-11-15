"""
Orbit's planet surface maps (the Action overhaul's materials pass, 15 Nov 2026; display only, never read by the sim).

Writes six equirectangular surface maps to public/orbit/planets/<name>.webp (512 x 256; greyscale height/brightness maps
the renderer tints with each planet's seeded colour, except the ocean world, which carries its own colours) and
src/lib/arcade/orbitPlanetMaps.data.ts (each map's URL with a content hash). Deterministic: the same bytes every run.

    python3 scripts/orbit-planet-maps.py [--check]
"""
import hashlib
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image

W, H = 512, 256
OUT = Path("public/orbit/planets")
DATA = Path("src/lib/arcade/orbitPlanetMaps.data.ts")


def rng(seed):
    return np.random.default_rng(seed)


def periodic_noise(seed, octaves, base=4, persistence=0.55):
    """fBm value noise, seamless left to right (the longitude wraps)."""
    r = rng(seed)
    out = np.zeros((H, W))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        fx = base * (2 ** o)
        fy = max(2, fx // 2)
        grid = r.random((fy + 1, fx))
        ys = np.linspace(0, fy, H, endpoint=False)
        xs = np.linspace(0, fx, W, endpoint=False)
        y0 = np.floor(ys).astype(int)
        x0 = np.floor(xs).astype(int)
        ty = (ys - y0)[:, None]
        tx = (xs - x0)[None, :]
        ty = ty * ty * (3 - 2 * ty)
        tx = tx * tx * (3 - 2 * tx)
        x1 = (x0 + 1) % fx
        y1 = np.minimum(y0 + 1, fy)
        a = grid[y0][:, x0]
        b = grid[y0][:, x1]
        c = grid[y1][:, x0]
        d = grid[y1][:, x1]
        out += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty)
        total += amp
        amp *= persistence
    return out / total


def norm(a):
    a = a - a.min()
    return a / max(1e-9, a.max())


lat = np.linspace(-np.pi / 2, np.pi / 2, H)[:, None] * np.ones((1, W))
lon = np.linspace(0, 2 * np.pi, W, endpoint=False)[None, :] * np.ones((H, 1))


def gas(seed, bands, turb):
    n = periodic_noise(seed, 5, base=3)
    warp = (n - 0.5) * turb
    shift = np.sin(lat * 2.3 + seed) * 1.4 + np.sin(lat * 5.7 + seed * 2) * 0.7
    y = np.sin(lat * bands + shift + warp * 3.0)
    fine = periodic_noise(seed + 7, 6, base=8) - 0.5
    tone = np.sin(lat * bands * 0.37 + seed) * 0.16
    v = 0.5 + 0.3 * y + tone + 0.16 * np.sin(lat * bands * 2.7 + warp * 9) + 0.26 * fine
    # A storm: an oval of darker, swirled cloud.
    cy, cx = H * (0.62 if seed % 2 else 0.36), W * ((seed * 0.37) % 1)
    yy, xx = np.mgrid[0:H, 0:W]
    dx = np.minimum(np.abs(xx - cx), W - np.abs(xx - cx))
    d = np.sqrt((dx / 26) ** 2 + ((yy - cy) / 12) ** 2)
    swirl = np.clip(1 - d, 0, 1)
    v = v * (1 - 0.45 * swirl) + 0.25 * swirl * np.sin(d * 9)
    return norm(v)


def craters(v, seed, count, rmin, rmax, depth):
    r = rng(seed)
    yy, xx = np.mgrid[0:H, 0:W]
    for _ in range(count):
        cy = r.uniform(H * 0.12, H * 0.88)
        cx = r.uniform(0, W)
        rad = r.uniform(rmin, rmax)
        # Wider in longitude near the poles (the map's stretch), so craters look round on the sphere.
        stretch = 1 / max(0.25, np.cos((cy / H - 0.5) * np.pi))
        dx = np.minimum(np.abs(xx - cx), W - np.abs(xx - cx)) / stretch
        d = np.sqrt(dx ** 2 + (yy - cy) ** 2) / rad
        bowl = np.where(d < 1, -depth * (1 - d ** 2), 0)
        rim = np.where((d >= 0.85) & (d < 1.25), depth * 0.6 * np.cos((d - 1.05) / 0.2 * np.pi / 2) ** 2, 0)
        v = v + bowl + rim
    return v


def rock(seed, maria):
    v = periodic_noise(seed, 7, base=4, persistence=0.58)
    m = periodic_noise(seed + 3, 3, base=2)
    v = v - maria * np.clip((m - 0.52) * 4, 0, 1) * 0.35
    v = craters(v, seed + 11, 46, 3, 16, 0.22)
    v = craters(v, seed + 12, 120, 1.5, 4, 0.12)
    return norm(v)


def ice(seed):
    v = np.clip(0.78 + 0.22 * (periodic_noise(seed, 6, base=5) - 0.5), 0, 1)
    r = rng(seed + 5)
    img = Image.fromarray((v * 255).astype(np.uint8))
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img)
    for _ in range(26):
        x, y = r.uniform(0, W), r.uniform(H * 0.15, H * 0.85)
        pts = [(x, y)]
        ang = r.uniform(0, np.pi)
        for _ in range(int(r.integers(4, 9))):
            ang += r.uniform(-0.6, 0.6)
            x += np.cos(ang) * r.uniform(8, 22)
            y += np.sin(ang) * r.uniform(4, 10)
            pts.append((x, y))
        draw.line(pts, fill=int(r.integers(150, 185)), width=1)
    v = np.asarray(img).astype(float) / 255
    caps = np.clip((np.abs(lat) - 1.05) * 3.2, 0, 1)
    return np.clip(v * (1 - caps) + caps * 1.0, 0, 1)


def ocean(seed):
    land = periodic_noise(seed, 7, base=6, persistence=0.6)
    land = land - 0.04 * np.cos(lat * 2)
    sea = land < 0.52
    rgb = np.zeros((H, W, 3))
    deep = np.array([18, 52, 120]) / 255
    shallow = np.array([38, 112, 178]) / 255
    t = np.clip((land - 0.35) / 0.18, 0, 1)[..., None]
    rgb = deep * (1 - t) + shallow * t
    g = np.clip((land - 0.53) / 0.2, 0, 1)[..., None]
    green = np.array([70, 128, 64]) / 255
    tan = np.array([170, 148, 98]) / 255
    landc = green * (1 - g) + tan * g
    rgb = np.where(sea[..., None], rgb, landc)
    clouds = np.clip((periodic_noise(seed + 9, 6, base=5) - 0.55) * 3.5, 0, 0.85)[..., None]
    rgb = rgb * (1 - clouds) + clouds * 0.96
    caps = np.clip((np.abs(lat) - 1.18) * 4, 0, 1)[..., None]
    rgb = rgb * (1 - caps) + caps * 0.97
    return (np.clip(rgb, 0, 1) * 255).astype(np.uint8)


MAPS = {
    "gas-a": lambda: gas(101, 9, 2.6),
    "gas-b": lambda: gas(202, 14, 1.8),
    "rock-a": lambda: rock(303, 1.0),
    "rock-b": lambda: rock(404, 0.4),
    "ice": lambda: ice(505),
    "ocean": lambda: ocean(606),
}


def encode(name):
    arr = MAPS[name]()
    img = Image.fromarray(arr if arr.ndim == 3 else (arr * 255).astype(np.uint8), "RGB" if arr.ndim == 3 else "L")
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=82, method=6)
    return buf.getvalue()


def main():
    check = "--check" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    rows, total, bad = [], 0, []
    for name in MAPS:
        data = encode(name)
        total += len(data)
        path = OUT / f"{name}.webp"
        if check:
            if not path.exists() or path.read_bytes() != data:
                bad.append(name)
        else:
            path.write_bytes(data)
        h = hashlib.sha256(data).hexdigest()[:10]
        rows.append(f'  "{name}": "/orbit/planets/{name}.webp?v={h}",')
    text = (
        "/** Orbit's planet surface maps (written by scripts/orbit-planet-maps.py; display only, never read by a sim). */\n"
        "export const ORBIT_PLANET_MAPS = {\n" + "\n".join(rows) + "\n} as const;\n"
        f"/** Their total size in bytes. */\nexport const ORBIT_PLANET_MAP_BYTES = {total};\n"
    )
    if check:
        if DATA.read_text() != text:
            bad.append(str(DATA))
        if bad:
            print("FAIL orbit-planet-maps: differs", bad)
            sys.exit(1)
        print(f"PASS orbit-planet-maps: {len(MAPS)} maps rebuilt byte for byte ({total} bytes)")
        return
    DATA.write_text(text)
    print(f"wrote {len(MAPS)} maps, {total} bytes")


if __name__ == "__main__":
    main()
