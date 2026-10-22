#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
analysis/render_atlas.py
Gera as pranchas PNG da análise a partir de analysis/geometry.json:
  docs/analise/atlas_subtiles.png
  docs/analise/propostas_familias.png
  docs/analise/mapa_conjuntos.png
  docs/analise/emendas.png
"""
import json, os, textwrap
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'analise')
os.makedirs(OUT, exist_ok=True)

with open(os.path.join(ROOT, 'analysis', 'geometry.json'), encoding='utf-8') as f:
    GEO = json.load(f)
with open(os.path.join(ROOT, 'analysis', 'sets_meta.json'), encoding='utf-8') as f:
    SETS = json.load(f)

S = GEO['S']
TILES = {t['id']: t for t in GEO['tiles']}
FAMS = GEO['families'] if 'families' in GEO else None

BG = (15, 17, 22)
CARD = (26, 30, 38)
CARD2 = (32, 37, 47)
BORDER = (45, 52, 65)
INK = (22, 22, 22)
PAPER = (242, 240, 234)
TEXT = (232, 230, 225)
MUTED = (139, 147, 167)
ACCENT = (224, 168, 78)

GROUP_COLORS = {
    'Fitas & Tubos': (217, 164, 65),
    'Listras & Tramas': (111, 168, 199),
    'Massas Sólidas': (201, 120, 103),
    'Círculos & Arcos': (155, 138, 212),
    'Focos & Pontos': (111, 191, 154),
    'Espaço Negativo': (139, 147, 167),
}

FONT_DIR = r'C:\Windows\Fonts'
def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)
F_TITLE = font('arialbd.ttf', 44)
F_SUB = font('arial.ttf', 17)
F_H2 = font('arialbd.ttf', 19)
F_CARD = font('arialbd.ttf', 15)
F_SMALL = font('arial.ttf', 11)
F_TINY = font('arial.ttf', 9)
F_ID = font('consola.ttf', 8)
F_MONO = font('consola.ttf', 11)
F_BOLD = font('arialbd.ttf', 12)

SS = 3  # supersampling

def tile_image(tile, size, key='padded', paper=PAPER, ink=INK, radius=4):
    img = Image.new('RGB', (size * SS, size * SS), paper)
    d = ImageDraw.Draw(img)
    scale = (size * SS) / S
    ox = oy = size * SS / 2
    for prim in tile[key]:
        if prim['t'] == 'poly':
            pts = [(ox + x * scale, oy + y * scale) for x, y in prim['pts']]
            if prim.get('fill'):
                d.polygon(pts, fill=ink)
            if prim.get('stroke'):
                w = max(1, int(round(prim.get('w', 0) * scale)))
                seq = pts + [pts[0]] if prim.get('closed') else pts
                if len(seq) >= 2:
                    d.line(seq, fill=ink, width=w, joint='curve')
        elif prim['t'] == 'ellipse':
            x0 = ox + (prim['cx'] - prim['rx']) * scale
            y0 = oy + (prim['cy'] - prim['ry']) * scale
            x1 = ox + (prim['cx'] + prim['rx']) * scale
            y1 = oy + (prim['cy'] + prim['ry']) * scale
            box = [x0, y0, x1, y1]
            if prim.get('fill'):
                d.ellipse(box, fill=ink)
            if prim.get('stroke'):
                w = max(1, int(round(prim.get('w', 0) * scale)))
                d.ellipse(box, outline=ink, width=w)
        elif prim['t'] == 'line':
            pts = [(ox + x * scale, oy + y * scale) for x, y in prim['pts']]
            w = max(1, int(round(prim.get('w', 0) * scale)))
            if len(pts) >= 2:
                d.line(pts, fill=ink, width=w, joint='curve')
    img = img.resize((size, size), Image.LANCZOS)
    # rounded corners via mask
    mask = Image.new('L', (size, size), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    out = Image.new('RGB', (size, size), BG)
    out.paste(img, (0, 0), mask)
    return out

def paste_tile(canvas, tile, x, y, size, key='padded', paper=PAPER):
    canvas.paste(tile_image(tile, size, key, paper), (x, y))

def label(draw, xy, text, f, fill=TEXT, anchor='la'):
    draw.text(xy, text, font=f, fill=fill, anchor=anchor)

def header_block(canvas, draw, title, subtitle, width, y=40):
    draw.text((48, y), title, font=F_TITLE, fill=TEXT, anchor='la')
    draw.text((48, y + 54), subtitle, font=F_SUB, fill=MUTED, anchor='la')
    draw.line([(48, y + 88), (width - 48, y + 88)], fill=BORDER, width=1)

# ---------------------------------------------------------------------------
# 1. Atlas das 31 famílias existentes
# ---------------------------------------------------------------------------
def build_atlas():
    fams = []
    seen = set()
    for t in GEO['tiles']:
        if t['proposed'] or t['family'] in seen:
            continue
        seen.add(t['family'])
        fams.append((t['family'], t['familyName'], t['group'], [x['id'] for x in GEO['tiles'] if x['family'] == t['family'] and not x['proposed']]))

    W = 1830
    cols, card_w, card_h, gap = 4, 408, 150, 18
    rows = (len(fams) + cols - 1) // cols
    H = 170 + rows * (card_h + gap) + 30
    canvas = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    header_block(canvas, draw, 'ATLAS DE SUBTILES', '85 tiles · 31 famílias · 6 grupos  —  cada família é a órbita D4 de um tile radical', W)

    # legenda de grupos
    lx = 48
    for g, c in GROUP_COLORS.items():
        draw.rounded_rectangle([lx, 148, lx + 10, 158], radius=2, fill=c)
        label(draw, (lx + 16, 146), g, F_SMALL, MUTED)
        lx += draw.textlength(g, font=F_SMALL) + 42

    for i, (fid, fname, group, ids) in enumerate(fams):
        col, row = i % cols, i // cols
        x = 48 + col * (card_w + gap)
        y = 180 + row * (card_h + gap)
        c = GROUP_COLORS.get(group, ACCENT)
        draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=8, fill=CARD, outline=BORDER, width=1)
        draw.rounded_rectangle([x, y, x + card_w, y + 4], radius=4, fill=c)
        code = f'F{i + 1:02d}'
        label(draw, (x + 14, y + 14), fname, F_CARD, TEXT)
        label(draw, (x + card_w - 14, y + 16), f'{len(ids)} tile' + ('s' if len(ids) != 1 else ''), F_SMALL, MUTED, anchor='ra')
        label(draw, (x + 14, y + 32), f'{code} · {group}', F_TINY, c)
        tx = x + 14
        for tid in ids:
            paste_tile(canvas, TILES[tid], tx, y + 50, 78)
            label(draw, (tx + 39, y + 50 + 78 + 4), f'#{tid}', F_ID, MUTED, anchor='ma')
            tx += 78 + 8

    label(draw, (48, H - 18), 'Tiling Stripes Studio · análise de sinergia e harmonia · F01–F31', F_TINY, MUTED)
    canvas.save(os.path.join(OUT, 'atlas_subtiles.png'))
    print('atlas_subtiles.png', canvas.size)

# ---------------------------------------------------------------------------
# 2. Prancha das 10 famílias propostas
# ---------------------------------------------------------------------------
def build_proposed():
    pf = GEO['proposedFamilies']
    W = 1830
    cols, card_w, card_h, gap = 3, 578, 250, 18
    rows = (len(pf) + cols - 1) // cols
    H = 190 + rows * (card_h + gap) + 30
    canvas = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    header_block(canvas, draw, 'FAMÍLIAS PROPOSTAS', '19 subtiles novos · IDs 85–103 · completam seis conjuntos sem tocar nos IDs existentes', W)
    label(draw, (48, 148), 'As bordas hachuradas indicam tiles novos; o código F32–F41 é documental.', F_SMALL, MUTED)

    for i, fam in enumerate(pf):
        col, row = i % cols, i // cols
        x = 48 + col * (card_w + gap)
        y = 185 + row * (card_h + gap)
        draw.rounded_rectangle([x, y, x + card_w, y + card_h], radius=10, fill=CARD, outline=(92, 76, 48), width=1)
        draw.rounded_rectangle([x, y, x + card_w, y + 5], radius=4, fill=ACCENT)
        label(draw, (x + 16, y + 14), fam['name'], F_H2, TEXT)
        label(draw, (x + card_w - 16, y + 16), f"F{32 + i:02d} · {' + '.join(fam['sets'])}", F_TINY, ACCENT, anchor='ra')
        meta = f"módulo {fam['module']} · {fam['material']} · {len(fam['tileIds'])} tile" + ('s' if len(fam['tileIds']) != 1 else '')
        label(draw, (x + 16, y + 40), meta, F_SMALL, MUTED)
        tx = x + 16
        for tid in fam['tileIds']:
            paste_tile(canvas, TILES[tid], tx, y + 62, 104)
            label(draw, (tx + 52, y + 62 + 104 + 4), f'#{tid}', F_ID, MUTED, anchor='ma')
            tx += 104 + 12
        reason = textwrap.wrap(fam.get('rationale', ''), width=72)
        for j, line in enumerate(reason[:3]):
            label(draw, (x + 16, y + 185 + j * 14), line, F_SMALL, (198, 202, 212))
    label(draw, (48, H - 18), 'Proposta Rodada 5 · sem alterar IDs, persistência ou álgebra D4 existente', F_TINY, MUTED)
    canvas.save(os.path.join(OUT, 'propostas_familias.png'))
    print('propostas_familias.png', canvas.size)

# ---------------------------------------------------------------------------
# 3. Mapa de conjuntos (famílias x conjuntos)
# ---------------------------------------------------------------------------
ROLE_COLORS = {
    'core': (224, 168, 78),
    'bridge': (111, 168, 199),
    'terminal': (217, 120, 103),
    'accent': (155, 138, 212),
    'texture': (111, 191, 154),
    'tangent': (139, 147, 167),
}
ROLE_LABEL = {
    'core': 'núcleo', 'bridge': 'ponte', 'terminal': 'terminal',
    'accent': 'acento', 'texture': 'textura', 'tangent': 'tangente (!)'
}

def build_matrix():
    # ordem das famílias: existentes em ordem de registro + propostas
    fam_rows = []
    seen = set()
    for t in GEO['tiles']:
        if t['family'] in seen:
            continue
        seen.add(t['family'])
        fam_rows.append((t['family'], t['familyName'], t['group'], t['proposed']))
    set_list = SETS['sets']
    W = 1660
    label_w, col_w, row_h = 380, 132, 30
    H = 190 + len(fam_rows) * row_h + 60
    canvas = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    header_block(canvas, draw, 'MAPA DE CONJUNTOS', 'Uma família pode participar de vários conjuntos. O conjunto é uma lente de curadoria, não uma regra do gerador.', W)
    label(draw, (48, 150), 'cores = papel da família no conjunto', F_SMALL, MUTED)
    lx = 300
    for role, c in ROLE_COLORS.items():
        draw.rounded_rectangle([lx, 151, lx + 9, 160], radius=2, fill=c)
        label(draw, (lx + 14, 149), ROLE_LABEL[role], F_TINY, MUTED)
        lx += 105

    x0, y0 = 48, 185
    label(draw, (x0, y0), 'FAMÍLIA', F_TINY, MUTED)
    for j, s in enumerate(set_list):
        x = x0 + label_w + j * col_w
        label(draw, (x + col_w / 2, y0), s['name'], F_TINY, TEXT, anchor='ma')
    y = y0 + 22
    prev_group = None
    for i, (fid, fname, group, proposed) in enumerate(fam_rows):
        if group != prev_group:
            draw.line([(x0, y - 4), (W - 48, y - 4)], fill=BORDER, width=1)
            prev_group = group
        label(draw, (x0, y + 7), f'F{i + 1:02d}', F_ID, MUTED)
        label(draw, (x0 + 40, y + 6), fname, F_SMALL, TEXT)
        if proposed:
            label(draw, (x0 + 336, y + 6), 'NOVA', F_TINY, ACCENT)
        for j, s in enumerate(set_list):
            role = s['families'].get(fid)
            x = x0 + label_w + j * col_w
            if role:
                c = ROLE_COLORS.get(role, ROLE_COLORS['tangent'])
                draw.rounded_rectangle([x + col_w / 2 - 9, y + 5, x + col_w / 2 + 9, y + 23], radius=3, fill=c)
            else:
                draw.rounded_rectangle([x + col_w / 2 - 2, y + 12, x + col_w / 2 + 2, y + 16], radius=1, fill=(45, 52, 65))
        y += row_h

    # eixos verticais leves
    for j in range(len(set_list) + 1):
        x = x0 + label_w + j * col_w
        draw.line([(x, y0 + 12), (x, y - 6)], fill=(35, 41, 52), width=1)
    label(draw, (48, H - 24), 'Conjuntos: ' + ' · '.join(s['name'] for s in set_list), F_TINY, MUTED)
    canvas.save(os.path.join(OUT, 'mapa_conjuntos.png'))
    print('mapa_conjuntos.png', canvas.size)

# ---------------------------------------------------------------------------
# 4. Emendas (pares que se encaixam)
# ---------------------------------------------------------------------------
SEAMS = [
    (0, 2, 'H', 'C → C', 'Faixa Central → Junção T'),
    (0, 89, 'H', 'C → C', 'Faixa Central → Terminal de Fita (novo)'),
    (18, 17, 'H', 'full → full', 'Moldura L → Moldura L'),
    (18, 97, 'H', 'full → full', 'Moldura L → Moldura Fechada (novo)'),
    (25, 30, 'H', '2/3+2/3', 'Listras → Curva de Listras'),
    (25, 93, 'H', '2/3+2/3', 'Listras → Grampo de Listras (novo)'),
    (42, 85, 'H', '1/2 → 1/2', 'Meio Bloco → Quarto de Bloco (novo)'),
    (55, 63, 'V', '1/2 → 1/2', 'Meio Bloco & Círculo → Arco de Quarto'),
    (98, 98, 'H', 'duplo → duplo', 'Cruz Diagonal → Cruz Diagonal (novo)'),
    (101, 101, 'H', 'ponto → ponto', 'Pontos de Borda → Pontos de Borda (novo)'),
]

def build_seams():
    cols, rows = 5, 2
    cell_w, cell_h = 290, 300
    W = 48 * 2 + cols * cell_w
    H = 160 + rows * cell_h + 40
    canvas = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    header_block(canvas, draw, 'EMENDAS', 'Pares reais: a borda do primeiro encontra a borda do segundo; a linha vermelha marca a emenda', W)
    for i, (a, b, direction, kind, name) in enumerate(SEAMS):
        col, row = i % cols, i // cols
        x = 48 + col * cell_w
        y = 160 + row * cell_h
        draw.rounded_rectangle([x, y, x + cell_w - 16, y + cell_h - 14], radius=8, fill=CARD, outline=BORDER)
        size = 118
        if direction == 'H':
            paste_tile(canvas, TILES[a], x + 14, y + 12, size, key='tight')
            paste_tile(canvas, TILES[b], x + 14 + size, y + 12, size, key='tight')
            sx = x + 14 + size
            draw.line([(sx, y + 12), (sx, y + 12 + size)], fill=(217, 120, 103), width=1)
        else:
            paste_tile(canvas, TILES[a], x + 14, y + 12, size, key='tight')
            paste_tile(canvas, TILES[b], x + 14, y + 12 + size, size, key='tight')
            sy = y + 12 + size
            draw.line([(x + 14, sy), (x + 14 + size, sy)], fill=(217, 120, 103), width=1)
        label(draw, (x + 14, y + 252), f'{kind}', F_MONO, ACCENT)
        label(draw, (x + 14, y + 270), f'#{a} → #{b}', F_SMALL, TEXT)
        label(draw, (x + 14, y + 286), name, F_SMALL, MUTED)
    label(draw, (48, H - 20), 'A linha vermelha marca a emenda; padding 0 para evidenciar a continuidade.', F_TINY, MUTED)
    canvas.save(os.path.join(OUT, 'emendas.png'))
    print('emendas.png', canvas.size)

# ---------------------------------------------------------------------------
# 5. Painéis dos conjuntos (uma faixa por conjunto)
# ---------------------------------------------------------------------------
def build_set_panels():
    fam_order = []
    seen = set()
    for t in GEO['tiles']:
        if t['family'] in seen:
            continue
        seen.add(t['family'])
        fam_order.append(t['family'])
    code = {fid: f'F{i + 1:02d}' for i, fid in enumerate(fam_order)}
    first_tile = {}
    for t in GEO['tiles']:
        first_tile.setdefault(t['family'], t['id'])
    fam_name = {}
    for t in GEO['tiles']:
        fam_name.setdefault(t['family'], t['familyName'])

    order = {'core': 0, 'bridge': 1, 'terminal': 2, 'accent': 3, 'texture': 4, 'tangent': 5}
    sets = SETS['sets']
    W = 1830
    row_h = 104
    H = 175 + len(sets) * row_h + 30
    canvas = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(canvas)
    header_block(canvas, draw, 'CONJUNTOS', 'Nove lentes de curadoria. Uma família pode aparecer em várias; nenhuma lente é uma regra do gerador.', W)
    label(draw, (48, 150), 'a ordem dentro de cada faixa vai do núcleo ao acento; a borda indica o papel', F_SMALL, MUTED)

    for i, s in enumerate(sets):
        y = 180 + i * row_h
        draw.line([(48, y - 8), (W - 48, y - 8)], fill=BORDER, width=1)
        label(draw, (48, y + 4), s['name'], F_H2, TEXT)
        label(draw, (48, y + 28), s['tagline'], F_SMALL, MUTED)
        label(draw, (48, y + 44), f"módulo {s['module']} · {s['connection']}", F_TINY, ACCENT)
        members = sorted(s['families'].items(), key=lambda kv: order.get(kv[1], 9))
        tx = 330
        for fid, role in members:
            if fid not in first_tile:
                continue
            c = ROLE_COLORS.get(role, ROLE_COLORS['tangent'])
            paste_tile(canvas, TILES[first_tile[fid]], tx, y, 46)
            draw.rectangle([tx - 1, y - 1, tx + 46, y + 46], outline=c, width=2)
            label(draw, (tx, y + 50), code.get(fid, '?'), F_ID, c)
            short = fam_name.get(fid, fid)
            short = textwrap.shorten(short, width=12, placeholder='…')
            label(draw, (tx + 18, y + 49), short, F_TINY, MUTED)
            tx += 100

    label(draw, (48, H - 20), 'As bordas coloridas indicam o papel: núcleo, ponte, terminal, acento, textura ou tangente.', F_TINY, MUTED)
    canvas.save(os.path.join(OUT, 'paineis_conjuntos.png'))
    print('paineis_conjuntos.png', canvas.size)

if __name__ == '__main__':
    build_atlas()
    build_proposed()
    build_matrix()
    build_seams()
    build_set_panels()
