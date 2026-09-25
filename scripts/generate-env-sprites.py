"""Generate environment sprite sheets (trees, rocks, grass) for Creature Sandbox.

Each sheet is a horizontal strip of square frames. Trees and rocks use fixed
palettes (no currentColor) so the runtime hue tint leaves them alone; grass
uses currentColor so biome/season tinting still applies.
"""
import math
import random
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else 'creature-sim/assets/sprites/environment'


def sheet(frames, size):
    w = size * len(frames)
    body = ''.join(f'<g transform="translate({i * size} 0)">{f}</g>' for i, f in enumerate(frames))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{size}" '
            f'viewBox="0 0 {w} {size}" fill="none">{body}</svg>')


def blob(cx, cy, r, fill, pid, shade=0.28, light=0.22):
    """A canopy ball: base fill, darker underside, soft top-left highlight."""
    return (
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}"/>'
        f'<path d="M{cx - r:.1f} {cy:.1f} A{r:.1f} {r:.1f} 0 0 0 {cx + r:.1f} {cy:.1f} '
        f'A{r:.1f} {r * 0.62:.1f} 0 0 1 {cx - r:.1f} {cy:.1f}Z" fill="#000" opacity="{shade}"/>'
        f'<circle cx="{cx - r * 0.32:.1f}" cy="{cy - r * 0.34:.1f}" r="{r * 0.42:.1f}" '
        f'fill="#fff" opacity="{light}"/>'
    )


def trunk(x, top, bottom, w, color='#6b4a2e'):
    return (
        f'<path d="M{x - w:.1f} {bottom} Q{x - w * 0.6:.1f} {(top + bottom) / 2:.1f} {x - w * 0.45:.1f} {top} '
        f'L{x + w * 0.45:.1f} {top} Q{x + w * 0.6:.1f} {(top + bottom) / 2:.1f} {x + w:.1f} {bottom}Z" fill="{color}"/>'
        f'<path d="M{x + w * 0.1:.1f} {top} L{x + w * 0.45:.1f} {top} '
        f'Q{x + w * 0.6:.1f} {(top + bottom) / 2:.1f} {x + w:.1f} {bottom} L{x + w * 0.3:.1f} {bottom}Z" '
        f'fill="#000" opacity="0.22"/>'
    )


def round_tree(pal, seed, extra=''):
    rnd = random.Random(seed)
    s = trunk(48, 52, 90, 5.5)
    # back layer, then front layer, then crown
    for cx, cy, r in [(30, 50, 17), (66, 50, 17), (48, 42, 21), (36, 32, 15), (60, 32, 15), (48, 22, 14)]:
        s += blob(cx + rnd.uniform(-2, 2), cy + rnd.uniform(-2, 2), r, pal[rnd.randrange(len(pal))], seed)
    return s + extra


def pine(pal, snow=False):
    s = trunk(48, 70, 91, 4.5, '#5a3d27')
    tiers = [(80, 36, 26), (64, 30, 22), (48, 24, 18), (33, 17, 14)]
    for i, (base, halfw, h) in enumerate(tiers):
        c = pal[i % len(pal)]
        top = base - h - 8
        s += (f'<path d="M{48 - halfw} {base} Q48 {base - 6} {48 + halfw} {base} L48 {top}Z" fill="{c}"/>'
              f'<path d="M48 {top} L{48 + halfw} {base} Q{48 + halfw * 0.5} {base - 3} 48 {base - 4}Z" '
              f'fill="#000" opacity="0.25"/>')
        if snow:
            s += (f'<path d="M48 {top} L{48 - halfw * 0.55} {top + h * 0.55} Q48 {top + h * 0.4} '
                  f'{48 + halfw * 0.5} {top + h * 0.5}Z" fill="#f4f8ff" opacity="0.95"/>')
    return s


def bush():
    s = ''
    for cx, cy, r, c in [(30, 74, 15, '#2f7d45'), (66, 74, 15, '#2f7d45'), (48, 66, 19, '#3f9a55'),
                         (36, 60, 12, '#4cae62'), (60, 60, 12, '#46a55c')]:
        s += blob(cx, cy, r, c, 0)
    rnd = random.Random(7)
    for _ in range(9):
        x, y = rnd.uniform(28, 68), rnd.uniform(56, 82)
        s += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.6" fill="#e0355a"/><circle cx="{x - 0.8:.1f}" cy="{y - 0.9:.1f}" r="0.9" fill="#fff" opacity="0.7"/>'
    return s


def deadwood():
    c = '#6f5a48'
    s = trunk(48, 40, 91, 5, c)
    for (x1, y1, x2, y2, w) in [(48, 44, 26, 22, 3.2), (48, 48, 72, 26, 3.2), (36, 32, 28, 12, 2),
                                (62, 36, 74, 16, 2), (48, 40, 50, 10, 2.6), (30, 26, 20, 24, 1.4)]:
        s += f'<path d="M{x1} {y1} Q{(x1 + x2) / 2 + 3} {(y1 + y2) / 2} {x2} {y2}" stroke="{c}" stroke-width="{w}" stroke-linecap="round"/>'
    return s


def willow():
    s = trunk(48, 44, 91, 5.5)
    for cx, cy, r, col in [(34, 40, 16, '#3e8f6f'), (62, 40, 16, '#3e8f6f'), (48, 30, 19, '#4fa580')]:
        s += blob(cx, cy, r, col, 0)
    rnd = random.Random(3)
    for i in range(14):
        x = 22 + i * 3.8
        top = 38 + rnd.uniform(-6, 4)
        s += (f'<path d="M{x:.1f} {top:.1f} Q{x + rnd.uniform(-3, 3):.1f} {top + 18:.1f} {x + rnd.uniform(-2, 2):.1f} '
              f'{top + 30 + rnd.uniform(0, 10):.1f}" stroke="#5cb88c" stroke-width="2" stroke-linecap="round" opacity="0.9"/>')
    return s


def blossom_extra():
    rnd = random.Random(11)
    return ''.join(
        f'<circle cx="{rnd.uniform(24, 72):.1f}" cy="{rnd.uniform(14, 60):.1f}" r="1.6" fill="#fff" opacity="0.85"/>'
        for _ in range(16))


trees = [
    round_tree(['#3f9a4f', '#4fae5c', '#36894a'], 1),                 # oak
    pine(['#23694a', '#2b7a55', '#317f5a']),                           # pine
    round_tree(['#e0852f', '#d06a25', '#efa23c', '#c9542a'], 2),       # autumn maple
    bush(),                                                            # berry bush
    pine(['#2a5f58', '#326c63', '#3a776d'], snow=True),                # winter pine
    round_tree(['#f19ac0', '#f7b6d2', '#e67fab'], 3, blossom_extra()), # blossom
    deadwood(),                                                        # deadwood
    willow(),                                                          # wetland willow
]


def rock(seed, moss=False):
    rnd = random.Random(seed)
    n = 9
    cx, cy = 48, 70
    rx, ry = rnd.uniform(26, 34), rnd.uniform(18, 24)
    pts = []
    for i in range(n):
        a = math.pi + (i / (n - 1)) * math.pi  # top half arc, left to right
        k = rnd.uniform(0.82, 1.08)
        pts.append((cx + math.cos(a) * rx * k, cy + math.sin(a) * ry * k * 1.25))
    pts += [(cx + rx * 0.95, cy + 8), (cx - rx * 0.95, cy + 8)]
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z'
    base = rnd.choice(['#8a8f96', '#7d838c', '#959a9f', '#858a82'])
    s = f'<path d="{d}" fill="{base}"/>'
    # lit top facet
    mid = pts[n // 2]
    s += (f'<path d="M{pts[1][0]:.1f} {pts[1][1]:.1f} L{mid[0]:.1f} {mid[1]:.1f} L{pts[n - 2][0]:.1f} {pts[n - 2][1]:.1f} '
          f'L{cx + 4:.1f} {cy - 2:.1f}Z" fill="#fff" opacity="0.2"/>')
    # shadowed right face
    s += (f'<path d="M{mid[0]:.1f} {mid[1]:.1f} L{pts[n - 1][0]:.1f} {pts[n - 1][1]:.1f} L{pts[n][0]:.1f} {pts[n][1]:.1f} '
          f'L{cx + 6:.1f} {cy + 8:.1f} L{cx + 4:.1f} {cy - 2:.1f}Z" fill="#000" opacity="0.25"/>')
    s += f'<path d="{d}" stroke="#000" stroke-opacity="0.25" stroke-width="1.2"/>'
    # a crack
    s += (f'<path d="M{cx - 8:.1f} {cy - 10:.1f} l4 6 l-2 5" stroke="#000" stroke-opacity="0.3" '
          f'stroke-width="1" stroke-linecap="round"/>')
    if moss:
        s += (f'<path d="M{pts[2][0]:.1f} {pts[2][1] + 2:.1f} Q{mid[0]:.1f} {mid[1] - 3:.1f} {pts[n - 3][0]:.1f} {pts[n - 3][1] + 2:.1f} '
              f'Q{mid[0]:.1f} {mid[1] + 6:.1f} {pts[2][0]:.1f} {pts[2][1] + 2:.1f}Z" fill="#5f9a47" opacity="0.9"/>')
    # small pebble companion
    px = cx + rnd.choice([-1, 1]) * (rx + 4)
    s += f'<ellipse cx="{px:.1f}" cy="{cy + 5:.1f}" rx="5" ry="3.4" fill="{base}"/><ellipse cx="{px - 1:.1f}" cy="{cy + 4:.1f}" rx="2.4" ry="1.4" fill="#fff" opacity="0.22"/>'
    return s


rocks = [rock(i + 20, moss=(i % 3 == 1)) for i in range(8)]


def grass(seed):
    rnd = random.Random(seed)
    blades = rnd.randint(7, 11)
    s = ''
    tall = 52 + rnd.uniform(-8, 10)
    for i in range(blades):
        t = i / (blades - 1)
        bx = 48 + (t - 0.5) * 30 + rnd.uniform(-2, 2)
        h = tall * (0.55 + 0.45 * math.sin(math.pi * t)) * rnd.uniform(0.85, 1.1)
        lean = (t - 0.5) * 26 + rnd.uniform(-5, 5)
        tipx, tipy = bx + lean, 88 - h
        w = rnd.uniform(2.4, 3.4)
        s += (f'<path d="M{bx - w:.1f} 88 Q{bx + lean * 0.3:.1f} {88 - h * 0.55:.1f} {tipx:.1f} {tipy:.1f} '
              f'Q{bx + lean * 0.35 + w * 0.4:.1f} {88 - h * 0.5:.1f} {bx + w:.1f} 88Z" fill="currentColor"/>')
        if i % 2 == 0:
            s += (f'<path d="M{bx:.1f} 88 Q{bx + lean * 0.3:.1f} {88 - h * 0.55:.1f} {tipx:.1f} {tipy:.1f}" '
                  f'stroke="#fff" stroke-opacity="0.22" stroke-width="0.9"/>')
    # darker base so the tuft sits in the ground
    s += '<ellipse cx="48" cy="88" rx="17" ry="3.5" fill="#000" opacity="0.25"/>'
    if seed % 3 == 0:
        for _ in range(3):
            x = 48 + rnd.uniform(-10, 10)
            y = 88 - tall * rnd.uniform(0.9, 1.05)
            s += (f'<path d="M{x:.1f} 88 L{x + rnd.uniform(-4, 4):.1f} {y:.1f}" stroke="currentColor" stroke-width="1.2"/>'
                  f'<ellipse cx="{x:.1f}" cy="{y - 3:.1f}" rx="2" ry="4.5" fill="#d8c27a"/>')
    return s


grasses = [grass(i) for i in range(8)]

if __name__ == '__main__':
    open(f'{OUT}/env_trees.svg', 'w').write(sheet(trees, 96))
    open(f'{OUT}/env_rocks.svg', 'w').write(sheet(rocks, 96))
    open(f'{OUT}/env_grass.svg', 'w').write(sheet(grasses, 96))
    print('ok')
