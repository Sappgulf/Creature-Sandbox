"""Generate creature sprite sheets for Creature Sandbox.

Usage: python3 scripts/generate-creature-sprites.py [out_dir]
(default out_dir: creature-sim/assets/sprites/creatures)

Each sheet is a horizontal strip of 64x64 frames, facing right. Body parts use
currentColor so the runtime tints each creature by its genes; outlines, eyes,
belly and accent layers use fixed neutral colours.

Frame layout matches CREATURE_CLIPS in creature-presentation.js:
  0-3 idle (breathing), 2-7 walk, 4-9 run, 7-9 eat (head dips).
Flying and burrowing sheets have 16 frames; the extra frames continue the cycle.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'creature-sim', 'assets', 'sprites', 'creatures')
S = 64
INK = 'rgba(12,18,16,0.55)'


def sheet(frames):
    w = S * len(frames)
    body = ''.join(f'<g transform="translate({i * S} 0)">{f}</g>' for i, f in enumerate(frames))
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{S}" viewBox="0 0 {w} {S}" fill="none">{body}</svg>'


def ell(cx, cy, rx, ry, fill, extra=''):
    return f'<ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" fill="{fill}" {extra}/>'


def outlined(cx, cy, rx, ry, rot=0):
    t = f'transform="rotate({rot:.1f} {cx:.2f} {cy:.2f})"' if rot else ''
    return ell(cx, cy, rx, ry, 'currentColor', f'stroke="{INK}" stroke-width="1.3" {t}')


def eye(cx, cy, r, look=0.35, lid=0.0):
    s = ell(cx, cy, r, r * 1.05, '#fff', f'stroke="{INK}" stroke-width="0.9"')
    s += ell(cx + r * look, cy + r * 0.05, r * 0.55, r * 0.62, '#1b1d22')
    s += ell(cx + r * look - r * 0.2, cy - r * 0.25, r * 0.2, r * 0.2, '#fff')
    if lid > 0:
        s += (f'<path d="M{cx - r:.2f} {cy:.2f} A{r:.2f} {r:.2f} 0 0 1 {cx + r:.2f} {cy:.2f} '
              f'L{cx + r:.2f} {cy - r * (1 - lid * 2):.2f} Z" fill="currentColor" stroke="{INK}" stroke-width="0.8"/>')
    return s


def leg(x, top, length, swing, w=3.2):
    fx = x + math.sin(swing) * length * 0.45
    fy = top + length - max(0, math.cos(swing)) * 1.2
    return (f'<path d="M{x:.2f} {top:.2f} L{fx:.2f} {fy:.2f}" stroke="currentColor" stroke-width="{w}" stroke-linecap="round"/>'
            f'<path d="M{x:.2f} {top:.2f} L{fx:.2f} {fy:.2f}" stroke="{INK}" stroke-width="{w + 1.4}" stroke-linecap="round" opacity="0.5"/>'
            f'<path d="M{x:.2f} {top:.2f} L{fx:.2f} {fy:.2f}" stroke="currentColor" stroke-width="{w}" stroke-linecap="round"/>'
            + ell(fx + 0.8, fy, w * 0.7, w * 0.45, '#2a2320', 'opacity="0.55"'))


def phase(i, n):
    """Walk phase, breathing bob and eating dip for frame i."""
    t = i / n
    walk = 2 * math.pi * t * 2  # two strides per sheet
    bob = math.sin(2 * math.pi * t * 2) * 0.9
    eat = 1.0 if i in (7, 8, 9) else 0.0
    breathe = 1 + 0.025 * math.sin(2 * math.pi * t)
    return walk, bob, eat, breathe


def quadruped(i, n, spec):
    walk, bob, eat, breathe = phase(i, n)
    bx, by = 30, 34 + bob
    brx, bry = spec['body']
    head_dx, head_dy, hr = spec['head']
    hx, hy = bx + head_dx, by + head_dy + eat * 5
    s = ''
    # tail (behind body)
    tail = spec.get('tail', 'tuft')
    if tail == 'tuft':
        s += outlined(bx - brx + 1, by - 3, 4.2, 3.6)
        s += ell(bx - brx + 0.5, by - 4, 2.2, 1.8, '#fff', 'opacity="0.55"')
    elif tail == 'long':
        sw = math.sin(walk) * 3
        s += (f'<path d="M{bx - brx + 3:.1f} {by - 2:.1f} Q{bx - brx - 8:.1f} {by - 10 + sw:.1f} {bx - brx - 12:.1f} {by - 4 + sw:.1f}" '
              f'stroke="{INK}" stroke-width="5.2" stroke-linecap="round"/>'
              f'<path d="M{bx - brx + 3:.1f} {by - 2:.1f} Q{bx - brx - 8:.1f} {by - 10 + sw:.1f} {bx - brx - 12:.1f} {by - 4 + sw:.1f}" '
              f'stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/>')
    # far legs (darker), near legs
    legtop = by + bry * 0.55
    ll = spec.get('leg', 9)
    for dx, off in ((-brx * 0.55, math.pi), (brx * 0.5, 0)):
        s += f'<g opacity="0.7">{leg(bx + dx + 2, legtop, ll, walk + off + math.pi)}</g>'
    # body
    s += outlined(bx, by, brx * breathe, bry * breathe)
    s += ell(bx + 1, by + bry * 0.42, brx * 0.72, bry * 0.42, '#fff', 'opacity="0.22"')  # belly
    s += ell(bx - brx * 0.25, by - bry * 0.45, brx * 0.45, bry * 0.28, '#fff', 'opacity="0.2"')  # sheen
    if spec.get('stripes'):
        for k in range(3):
            x = bx - brx * 0.4 + k * brx * 0.38
            s += f'<path d="M{x:.1f} {by - bry + 1:.1f} q2 {bry * 0.55:.1f} -1 {bry * 0.9:.1f}" stroke="#000" stroke-opacity="0.28" stroke-width="2.2" stroke-linecap="round"/>'
    if spec.get('mane'):
        s += ell(bx + brx * 0.55, by - bry * 0.35, 7, 8.5, '#000', 'opacity="0.18"')
    for dx, off in ((-brx * 0.55, 0), (brx * 0.5, math.pi)):
        s += leg(bx + dx, legtop, ll, walk + off)
    # ears (behind head)
    ear = spec.get('ears', 'tall')
    if ear == 'tall':
        s += outlined(hx - 2, hy - hr - 3, 2.6, 6, -12) + ell(hx - 2, hy - hr - 3, 1.2, 4, '#ffb3c1', 'opacity="0.6" transform="rotate(-12 %.2f %.2f)"' % (hx - 2, hy - hr - 3))
    elif ear == 'round':
        s += outlined(hx - 4, hy - hr + 1, 3.6, 3.6) + outlined(hx + 3, hy - hr, 3.4, 3.4)
    elif ear == 'pointed':
        s += (f'<path d="M{hx - 5:.1f} {hy - hr + 3:.1f} L{hx - 3:.1f} {hy - hr - 7:.1f} L{hx + 1:.1f} {hy - hr + 2:.1f}Z" '
              f'fill="currentColor" stroke="{INK}" stroke-width="1.2" stroke-linejoin="round"/>')
    # antlers
    if spec.get('antlers'):
        for sx in (-1, 1):
            ax = hx + sx * 2.5
            s += (f'<path d="M{ax:.1f} {hy - hr + 1:.1f} l{sx * 2:.1f} -7 l{sx * 3:.1f} -2 M{ax + sx * 1.3:.1f} {hy - hr - 3:.1f} l{-sx * 2:.1f} -4" '
                  f'stroke="#e9dcc0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
    # head
    s += outlined(hx, hy, hr, hr * 0.92)
    # snout / muzzle
    snout = spec.get('snout', 0)
    if snout:
        s += outlined(hx + hr * 0.75, hy + hr * 0.3, snout, snout * 0.72)
        s += ell(hx + hr * 0.75 + snout * 0.75, hy + hr * 0.18, 1.4, 1.1, '#2a1f1f')
    else:
        s += ell(hx + hr * 0.92, hy + hr * 0.15, 1.3, 1.0, '#2a1f1f')
    if spec.get('teeth'):
        s += f'<path d="M{hx + hr * 0.7:.1f} {hy + hr * 0.62:.1f} l1 2 l1 -2" fill="#fff" stroke="{INK}" stroke-width="0.4"/>'
    # cheek
    s += ell(hx + hr * 0.1, hy + hr * 0.45, hr * 0.28, hr * 0.18, '#ff8fa3', 'opacity="0.35"')
    # eye
    er = spec.get('eye', 3.3)
    s += eye(hx + hr * 0.3, hy - hr * 0.15, er, lid=0.25 if spec.get('sleepy') else 0)
    if spec.get('brows'):
        s += f'<path d="M{hx + hr * 0.3 - er:.1f} {hy - hr * 0.15 - er - 1.5:.1f} q{er:.1f} -2 {er * 2:.1f} 0" stroke="#f3f0ea" stroke-width="1.8" stroke-linecap="round"/>'
        s += f'<path d="M{hx + hr:.1f} {hy + hr * 0.35:.1f} l5 1 M{hx + hr:.1f} {hy + hr * 0.5:.1f} l4.5 2.5" stroke="#f3f0ea" stroke-width="0.9" stroke-linecap="round"/>'
    # mouth
    s += f'<path d="M{hx + hr * 0.45:.1f} {hy + hr * 0.55:.1f} q1.6 1.2 3.2 0" stroke="{INK}" stroke-width="0.9" stroke-linecap="round"/>'
    return s


def fish(i, n):
    walk, bob, eat, breathe = phase(i, n)
    sw = math.sin(walk) * 4
    bx, by = 31, 33 + bob * 0.6
    s = (f'<path d="M{bx - 13:.1f} {by:.1f} L{bx - 23:.1f} {by - 8 + sw:.1f} L{bx - 21:.1f} {by + sw * 0.3:.1f} L{bx - 23:.1f} {by + 8 + sw:.1f}Z" '
         f'fill="currentColor" stroke="{INK}" stroke-width="1.2" stroke-linejoin="round"/>')
    s += (f'<path d="M{bx - 3:.1f} {by - 9:.1f} Q{bx + 2:.1f} {by - 18:.1f} {bx + 8:.1f} {by - 9:.1f}Z" '
          f'fill="currentColor" stroke="{INK}" stroke-width="1.1"/>')
    s += outlined(bx, by, 16 * breathe, 10.5 * breathe)
    s += ell(bx + 1, by + 4.5, 11, 4, '#fff', 'opacity="0.25"')
    for k in range(3):
        s += f'<path d="M{bx - 6 + k * 5:.1f} {by - 6:.1f} q2.5 6 0 12" stroke="#000" stroke-opacity="0.16" stroke-width="1.2"/>'
    s += (f'<path d="M{bx + 1:.1f} {by + 3:.1f} q-4 {5 + sw * 0.4:.1f} -8 {3:.1f}" fill="currentColor" stroke="{INK}" stroke-width="1"/>')
    s += eye(bx + 9, by - 2.5, 3.2)
    s += f'<path d="M{bx + 13:.1f} {by + 3:.1f} q1.5 1 3 0" stroke="{INK}" stroke-width="0.9" stroke-linecap="round"/>'
    s += ell(bx + 6, by + 3, 2.2, 1.3, '#ff8fa3', 'opacity="0.35"')
    return s


def bird(i, n):
    t = i / n
    flap = math.sin(2 * math.pi * t * 2)
    bob = -flap * 1.5
    bx, by = 30, 32 + bob
    s = ''
    # far wing
    wy = by - 2 - flap * 10
    s += (f'<path d="M{bx - 2:.1f} {by - 3:.1f} Q{bx - 10:.1f} {wy - 4:.1f} {bx - 16:.1f} {wy:.1f} Q{bx - 6:.1f} {by - 1:.1f} {bx + 4:.1f} {by - 2:.1f}Z" '
          f'fill="currentColor" stroke="{INK}" stroke-width="1" opacity="0.75"/>')
    # tail feathers
    s += (f'<path d="M{bx - 10:.1f} {by:.1f} L{bx - 20:.1f} {by - 4:.1f} L{bx - 19:.1f} {by + 1:.1f} L{bx - 21:.1f} {by + 5:.1f}Z" '
          f'fill="currentColor" stroke="{INK}" stroke-width="1.1" stroke-linejoin="round"/>')
    s += outlined(bx, by, 12, 9)
    s += ell(bx + 2, by + 3.5, 8, 4, '#fff', 'opacity="0.28"')
    # legs tucked
    s += f'<path d="M{bx:.1f} {by + 8:.1f} l-1 4 M{bx + 4:.1f} {by + 8:.1f} l-1 4" stroke="#d99a3a" stroke-width="1.4" stroke-linecap="round"/>'
    # head
    hx, hy = bx + 11, by - 6
    s += outlined(hx, hy, 7, 6.5)
    s += f'<path d="M{hx + 6:.1f} {hy - 1:.1f} l6 2 l-6 2Z" fill="#f2b233" stroke="{INK}" stroke-width="0.9" stroke-linejoin="round"/>'
    s += f'<path d="M{hx - 3:.1f} {hy - 6:.1f} q2 -4 4 -1 q1 -3 3 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'
    s += eye(hx + 1.5, hy - 1.2, 2.6)
    s += ell(hx + 0.5, hy + 3, 1.8, 1.1, '#ff8fa3', 'opacity="0.35"')
    # near wing
    wy2 = by - flap * 12
    s += (f'<path d="M{bx - 4:.1f} {by - 1:.1f} Q{bx - 4:.1f} {wy2 - 8:.1f} {bx - 14:.1f} {wy2 - 2:.1f} Q{bx - 2:.1f} {by + 5:.1f} {bx + 5:.1f} {by:.1f}Z" '
          f'fill="currentColor" stroke="{INK}" stroke-width="1.1"/>'
          f'<path d="M{bx - 6:.1f} {by:.1f} Q{bx - 6:.1f} {wy2 - 4:.1f} {bx - 11:.1f} {wy2:.1f}" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>')
    return s


def mole(i, n):
    walk, bob, eat, breathe = phase(i, n)
    bx, by = 30, 38 + bob * 0.5
    s = ''
    for dx, off in ((-10, math.pi), (8, 0)):
        s += f'<g opacity="0.7">{leg(bx + dx, by + 5, 5, walk + off + math.pi, 3.6)}</g>'
    s += outlined(bx, by, 17 * breathe, 10 * breathe)
    s += ell(bx + 2, by + 4, 12, 4, '#fff', 'opacity="0.18"')
    s += ell(bx - 5, by - 5, 7, 3, '#fff', 'opacity="0.18"')
    for dx, off in ((-10, 0), (8, math.pi)):
        s += leg(bx + dx, by + 5, 5, walk + off, 3.6)
    # big digging claws
    cx, cy = bx + 13, by + 7 + eat * 2
    s += f'<path d="M{cx:.1f} {cy:.1f} l4 2 M{cx:.1f} {cy:.1f} l4.5 0 M{cx:.1f} {cy:.1f} l3.5 -2" stroke="#f1e6d3" stroke-width="1.5" stroke-linecap="round"/>'
    # head merges into body with long nose
    hx, hy = bx + 13, by - 1 + eat * 3
    s += outlined(hx, hy, 7.5, 6.5)
    s += outlined(hx + 7, hy + 1, 3.2, 2.4)
    s += ell(hx + 10, hy + 0.8, 1.8, 1.6, '#ff9fb2')
    s += eye(hx + 1, hy - 2.2, 1.9, lid=0.35)
    # dirt specks
    s += ell(bx - 16, by + 10, 2, 1.2, '#6b4f36', 'opacity="0.6"') + ell(bx + 20, by + 11, 1.6, 1, '#6b4f36', 'opacity="0.6"')
    return s


SPECS = {
    'creature_herbivore': dict(body=(14, 10), head=(14, -6, 8.5), ears='tall', tail='tuft', leg=9),
    'creature_omnivore': dict(body=(15, 11.5), head=(14, -5, 9), ears='round', tail='tuft', snout=4.2, leg=8),
    'creature_predator': dict(body=(17, 9), head=(16, -5, 8.2), ears='pointed', tail='long', snout=4.8, teeth=True, stripes=True, leg=10, eye=2.9),
    'creature_baby': dict(body=(10, 8), head=(10, -6, 10.5), ears='tall', tail='tuft', leg=6, eye=4.2),
    'creature_elder': dict(body=(14, 10), head=(14, -3, 8.5), ears='round', tail='tuft', leg=8, brows=True, sleepy=True),
    'creature_alpha': dict(body=(16, 11), head=(15, -6, 9), ears='pointed', tail='long', snout=3.6, antlers=True, mane=True, leg=10),
}

os.makedirs(OUT, exist_ok=True)
for key, spec in SPECS.items():
    frames = [quadruped(i, 10, spec) for i in range(10)]
    open(os.path.join(OUT, f'{key}.svg'), 'w').write(sheet(frames))
open(os.path.join(OUT, 'creature_aquatic.svg'), 'w').write(sheet([fish(i, 10) for i in range(10)]))
open(os.path.join(OUT, 'creature_flying.svg'), 'w').write(sheet([bird(i, 16) for i in range(16)]))
open(os.path.join(OUT, 'creature_burrowing.svg'), 'w').write(sheet([mole(i, 16) for i in range(16)]))
print('wrote creature sheets to', OUT)
