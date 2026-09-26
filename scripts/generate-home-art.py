"""Generate start-menu illustrations for Creature Sandbox.

Usage: python3 scripts/generate-home-art.py [out_dir]
(default out_dir: creature-sim/assets/sprites/ui)

Builds the three home feature cards (320x180) and a hero banner (720x180)
from the same drawing code as the in-game sprites, so the start menu shows
the creatures and field the player will actually see.
"""
import importlib.util
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'creature-sim', 'assets', 'sprites', 'ui')


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, f'{name}.py'))
    mod = importlib.util.module_from_spec(spec)
    argv, sys.argv = sys.argv, [sys.argv[0]]
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.argv = argv
    return mod


cr = load('generate-creature-sprites')
env = load('generate-env-sprites')

GROUND = ('#2f5a37', '#1f3f28')


def svg(w, h, body, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" fill="none">'
            f'<defs>{defs}</defs>{body}</svg>')


def backdrop(w, h, gid, top='#3f7446', bottom='#1c3a25'):
    defs = (f'<linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bottom}"/></linearGradient>'
            f'<radialGradient id="{gid}v" cx="0.5" cy="0.45" r="0.75">'
            f'<stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>')
    body = f'<rect width="{w}" height="{h}" fill="url(#{gid})"/>'
    rnd = random.Random(w * 7 + h)
    for _ in range(int(w * h / 900)):
        x, y = rnd.uniform(0, w), rnd.uniform(0, h)
        body += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rnd.uniform(0.6, 1.5):.1f}" fill="#bfe39a" opacity="{rnd.uniform(0.08, 0.2):.2f}"/>'
    return defs, body, f'<rect width="{w}" height="{h}" fill="url(#{gid}v)"/>'


def place(frame_svg, x, y, scale, color=None, flip=False):
    """Place a 64 (creature) or 96 (env) frame with its anchor at (x, y)."""
    sx = -scale if flip else scale
    col = f' color="{color}"' if color else ''
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({sx:.3f} {scale:.3f}) translate(-32 -48)"{col}>{frame_svg}</g>'


def place_env(frame_svg, x, y, scale, color=None):
    col = f' color="{color}"' if color else ''
    return f'<g transform="translate({x:.1f} {y:.1f}) scale({scale:.3f}) translate(-48 -90)"{col}>{frame_svg}</g>'


def creature(kind, i=2, n=10):
    if kind == 'fish':
        return cr.fish(i, n)
    if kind == 'bird':
        return cr.bird(i, 16)
    if kind == 'mole':
        return cr.mole(i, 16)
    return cr.quadruped(i, n, cr.SPECS[f'creature_{kind}'])


def shadow(x, y, rx):
    return f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{rx:.1f}" ry="{rx * 0.3:.1f}" fill="#000" opacity="0.28"/>'


def grass_row(w, y0, count, seed, color='#7cc45a', scale=0.42):
    rnd = random.Random(seed)
    out = ''
    for _ in range(count):
        out += place_env(env.grasses[rnd.randrange(8)], rnd.uniform(0, w), y0 + rnd.uniform(-6, 6), scale * rnd.uniform(0.8, 1.2), color)
    return out


def card_traits():
    w, h = 320, 180
    defs, body, vignette = backdrop(w, h, 'bgT', '#35623e', '#16301f')
    body += grass_row(w, 170, 14, 3, '#5fa84a', 0.36)
    # the subject, large, under a magnifier lens
    body += shadow(118, 148, 44)
    body += place(creature('herbivore', 2), 118, 132, 2.35, '#6fd0a8')
    body += (f'<circle cx="150" cy="84" r="46" fill="#dff6ff" opacity="0.07" stroke="#e8f7d8" stroke-width="5"/>'
             f'<circle cx="150" cy="84" r="46" stroke="#1b2a1e" stroke-width="1.5" opacity="0.6"/>'
             f'<path d="M184 116 L204 140" stroke="#c9a86a" stroke-width="9" stroke-linecap="round"/>'
             f'<path d="M184 116 L204 140" stroke="#000" stroke-opacity="0.25" stroke-width="2" stroke-linecap="round"/>')
    # gene readout card
    body += '<rect x="214" y="30" width="92" height="104" rx="10" fill="#0c2217" opacity="0.92" stroke="#b7e2bb" stroke-opacity="0.3"/>'
    for k, (label, val, col) in enumerate([('SPEED', 0.72, '#9fe070'), ('SENSE', 0.55, '#6cc9e8'), ('HERD', 0.84, '#f2c14e'), ('CALM', 0.4, '#e98fb4')]):
        y = 46 + k * 22
        body += (f'<text x="222" y="{y}" font-family="Verdana,sans-serif" font-size="8" font-weight="700" fill="#cfe8c8" letter-spacing="1">{label}</text>'
                 f'<rect x="222" y="{y + 4}" width="76" height="6" rx="3" fill="#ffffff" opacity="0.12"/>'
                 f'<rect x="222" y="{y + 4}" width="{76 * val:.0f}" height="6" rx="3" fill="{col}"/>')
    return svg(w, h, body + vignette, defs)


def card_habitat():
    w, h = 320, 180
    defs, body, vignette = backdrop(w, h, 'bgH', '#3d7445', '#1b3924')
    # pond
    defs += ('<radialGradient id="pond" cx="0.45" cy="0.4" r="0.7"><stop offset="0" stop-color="#5fb3d6"/>'
             '<stop offset="1" stop-color="#2c6f95"/></radialGradient>')
    body += ('<ellipse cx="238" cy="132" rx="70" ry="30" fill="url(#pond)" stroke="#1e4a5f" stroke-width="2"/>'
             '<path d="M200 126 q14 -6 28 0 M236 140 q12 -5 24 0" stroke="#d8f1ff" stroke-opacity="0.55" stroke-width="2" stroke-linecap="round"/>')
    body += place(creature('fish', 3), 250, 138, 0.62, '#f09a4a')
    # trees on the ridge
    for x, y, s, t in [(34, 96, 0.9, 1), (78, 88, 1.0, 0), (126, 94, 0.8, 2), (286, 70, 0.75, 5)]:
        body += place_env(env.trees[t], x, y, s)
    body += grass_row(w, 176, 16, 5, '#76c052', 0.4)
    # food scatter and a god-mode brush ring
    rnd = random.Random(9)
    for _ in range(14):
        x, y = 70 + rnd.uniform(-38, 38), 138 + rnd.uniform(-18, 18)
        c = rnd.choice(['#e0355a', '#f29a2e', '#8fd46a'])
        body += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.2" fill="{c}" stroke="#1b2a1e" stroke-width="0.8"/>'
    body += ('<circle cx="70" cy="138" r="44" fill="#9ff07a" opacity="0.1" stroke="#b9f58f" stroke-width="2" stroke-dasharray="6 5"/>')
    body += shadow(142, 150, 22)
    body += place(creature('omnivore', 5), 142, 142, 1.35, '#e88ab8')
    body += shadow(176, 162, 18)
    body += place(creature('baby', 3), 176, 156, 1.05, '#f2c64e', flip=True)
    return svg(w, h, body + vignette, defs)


def card_story():
    w, h = 320, 180
    defs, body, vignette = backdrop(w, h, 'bgS', '#2f5a3a', '#142a1d')
    # journal page
    body += ('<rect x="18" y="18" width="284" height="148" rx="12" fill="#efe4c6" opacity="0.94"/>'
             '<rect x="18" y="18" width="284" height="148" rx="12" stroke="#6b5534" stroke-opacity="0.5" stroke-width="2"/>')
    for k in range(6):
        body += f'<path d="M30 {44 + k * 20} H290" stroke="#b9a57a" stroke-opacity="0.35" stroke-width="1"/>'
    # family tree
    nodes = [(160, 50, 'alpha', '#5aa9e6'), (100, 100, 'herbivore', '#5ccf9a'), (220, 100, 'predator', '#9aa7b8'),
             (70, 146, 'baby', '#f2c64e'), (130, 146, 'baby', '#e88ab8'), (250, 146, 'baby', '#8fd46a')]
    links = [(0, 1), (0, 2), (1, 3), (1, 4), (2, 5)]
    for a, b in links:
        (x1, y1, *_), (x2, y2, *_) = nodes[a], nodes[b]
        body += f'<path d="M{x1} {y1 + 12} C{x1} {(y1 + y2) / 2} {x2} {(y1 + y2) / 2} {x2} {y2 - 14}" stroke="#6b5534" stroke-width="2.2" fill="none"/>'
    for x, y, kind, col in nodes:
        big = kind != 'baby'
        body += f'<circle cx="{x}" cy="{y}" r="{18 if big else 14}" fill="#fff8e6" stroke="#6b5534" stroke-width="2"/>'
        body += place(creature(kind, 1), x - 1, y + (9 if big else 7), 0.5 if big else 0.42, col)
    body += '<text x="30" y="36" font-family="Georgia,serif" font-style="italic" font-size="13" fill="#5a4526">Family of Zephyr</text>'
    body += '<path d="M252 26 l10 0 l0 18 l-5 -4 l-5 4z" fill="#d9534f"/>'
    return svg(w, h, body + vignette, defs)


def hero_banner():
    w, h = 720, 180
    defs, body, vignette = backdrop(w, h, 'bgB', '#3f7648', '#16301f')
    defs += ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8b0" stop-opacity="0.25"/>'
             '<stop offset="1" stop-color="#9fd8b0" stop-opacity="0"/></linearGradient>')
    body += f'<rect width="{w}" height="70" fill="url(#sky)"/>'
    for x, y, s, t in [(40, 96, 1.0, 1), (120, 90, 1.1, 0), (610, 92, 1.05, 2), (690, 98, 0.9, 5), (560, 96, 0.8, 4)]:
        body += place_env(env.trees[t], x, y, s)
    body += grass_row(w, 178, 34, 11, '#78c255', 0.44)
    cast = [('herbivore', '#6fd0a8', 1.35, 180, 150, 2), ('baby', '#f2c64e', 1.0, 232, 158, 4),
            ('omnivore', '#e88ab8', 1.4, 300, 150, 6), ('alpha', '#5aa9e6', 1.5, 380, 148, 3),
            ('predator', '#9aa7b8', 1.45, 520, 152, 5), ('mole', '#c79a6b', 1.05, 450, 162, 4)]
    for kind, col, s, x, y, i in cast:
        body += shadow(x, y + 6, 18 * s)
        body += place(creature(kind, i), x, y, s, col)
    body += place(creature('bird', 5), 470, 70, 1.1, '#f0d060')
    body += place(creature('bird', 11), 250, 58, 0.8, '#7fd0f0', flip=True)
    return svg(w, h, body + vignette, defs)


SPAWN_PORTRAITS = {
    'herbivore': ('herbivore', '#6fd0a8', 1.0),
    'omnivore': ('omnivore', '#e88ab8', 1.0),
    'predator': ('predator', '#9aa7b8', 0.95),
    'aquatic': ('fish', '#5fb4e6', 1.1),
    'flying': ('bird', '#f0d060', 1.05),
    'burrowing': ('mole', '#c79a6b', 1.05),
}


def spawn_portrait(kind, color, scale):
    """96x96 transparent portrait of one creature type for the Spawn menu."""
    body = shadow(48, 74, 22 * scale)
    body += place(creature(kind, 1), 48, 70, 1.35 * scale, color)
    return svg(96, 96, body)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in [('home_card_traits', card_traits), ('home_card_habitat', card_habitat),
                     ('home_card_story', card_story), ('home_hero', hero_banner)]:
        open(os.path.join(OUT, f'{name}.svg'), 'w').write(fn())
    for key, (kind, color, scale) in SPAWN_PORTRAITS.items():
        open(os.path.join(OUT, f'spawn_{key}.svg'), 'w').write(spawn_portrait(kind, color, scale))
    print('wrote home art to', OUT)
