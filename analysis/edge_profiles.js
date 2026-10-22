/**
 * analysis/edge_profiles.js
 * Extrai a assinatura de borda (portas) de cada subtile diretamente da geometria
 * dos renderers, sem rasterizar. Gera analysis/edge_profiles.json.
 *
 * Uso: node analysis/edge_profiles.js
 */
const fs = require('fs');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));

const { TILE_RENDERERS, TILE_NAMES, TILE_FAMILIES_META, TILE_D4_MAP } = window.TileRegistry;

const S = 1000;            // lado lógico do tile
const SAMPLES = 1024;      // amostras por borda
const EPS = 0.5;

/** Contexto que grava polígonos preenchidos e polilinhas traçadas. */
class Recorder {
  constructor() {
    this.fillPolys = [];
    this.strokePaths = [];
    this._fill = null;
    this._stroke = null;
    this._weight = 1;
    this._cur = null;
  }
  fill(c) { this._fill = c; }
  noFill() { this._fill = null; }
  stroke(c) { this._stroke = c; }
  noStroke() { this._stroke = null; }
  strokeWeight(w) { this._weight = w; }
  _emit(points, closed) {
    if (this._fill) this.fillPolys.push(points);
    if (this._stroke) {
      const pts = closed ? [...points, points[0]] : points;
      this.strokePaths.push({ pts, w: this._weight });
    }
  }
  rect(x, y, w, h) {
    this._emit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
  }
  ellipse(x, y, w, h) {
    const pts = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]);
    }
    this._emit(pts, true);
  }
  triangle(x1, y1, x2, y2, x3, y3) {
    this._emit([[x1, y1], [x2, y2], [x3, y3]], true);
  }
  line(x1, y1, x2, y2) {
    if (this._stroke) this.strokePaths.push({ pts: [[x1, y1], [x2, y2]], w: this._weight });
  }
  arc(x, y, w, h, a0, a1) {
    const pts = [];
    const n = 64;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * (i / n);
      pts.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]);
    }
    if (this._stroke) this.strokePaths.push({ pts, w: this._weight });
  }
  beginShape() { this._cur = []; }
  vertex(x, y) { if (this._cur) this._cur.push([x, y]); }
  endShape(mode) {
    if (!this._cur) return;
    const closed = mode === 'CLOSE' || mode === 'close';
    this._emit(this._cur, closed);
    this._cur = null;
  }
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function pointSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** Amostra as 4 bordas do quadrado [-S/2,S/2]^2. */
function sampleEdges(rec) {
  const edges = { left: [], right: [], top: [], bottom: [] };
  const half = S / 2;
  // Sonda 1 unidade DENTRO do tile: a borda exata é degenerada para
  // point-in-polygon quando o preenchimento termina justamente nela.
  const inset = 1;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i + 0.5) / SAMPLES;
    const p = -half + t * S;
    const probes = [
      ['left', -half + inset, p],
      ['right', half - inset, p],
      ['top', p, -half + inset],
      ['bottom', p, half - inset]
    ];
    for (const [side, x, y] of probes) {
      let ink = false;
      for (const poly of rec.fillPolys) {
        if (pointInPoly(x, y, poly)) { ink = true; break; }
      }
      if (!ink) {
        for (const sp of rec.strokePaths) {
          const tol = sp.w / 2 + EPS;
          for (let k = 1; k < sp.pts.length; k++) {
            const [ax, ay] = sp.pts[k - 1];
            const [bx, by] = sp.pts[k];
            if (pointSegDist(x, y, ax, ay, bx, by) <= tol) { ink = true; break; }
          }
          if (ink) break;
        }
      }
      edges[side].push(ink ? 1 : 0);
    }
  }
  return edges;
}

/** Converte vetor binário em intervalos normalizados [inicio, fim]. */
function runsToIntervals(bits) {
  const out = [];
  let start = -1;
  for (let i = 0; i <= bits.length; i++) {
    if (i < bits.length && bits[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push([start / bits.length, i / bits.length]);
      start = -1;
    }
  }
  return out;
}

/**
 * Limpa intervalos: fusões e remoção de farpas < 3% (contatos tangentes/pontuais).
 * Retorna { intervals, points }: points são contatos degenerados (centro do intervalo).
 */
function cleanIntervals(iv) {
  const merged = [];
  for (const [a, b] of iv) {
    if (b - a < 1e-6) continue;
    if (merged.length && a - merged[merged.length - 1][1] < 0.002) {
      merged[merged.length - 1][1] = b;
    } else {
      merged.push([a, b]);
    }
  }
  const intervals = [];
  const points = [];
  for (const [a, b] of merged) {
    if (b - a < 0.03) points.push(+(((a + b) / 2)).toFixed(3));
    else intervals.push([+a.toFixed(3), +b.toFixed(3)]);
  }
  return { intervals, points };
}

function coverageOfIntervals(iv) {
  let n = 0;
  for (const [a, b] of iv) n += b - a;
  return n;
}

function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) {
      uni++;
      if (a[i] && b[i]) inter++;
    }
  }
  return uni ? inter / uni : 1;
}

function fmtIntervals(iv) {
  return iv.map(([a, b]) => `${a.toFixed(3)}-${b.toFixed(3)}`).join(' ');
}

const profiles = [];
for (let id = 0; id < TILE_RENDERERS.length; id++) {
  const rec = new Recorder();
  TILE_RENDERERS[id](rec, S, S, 0, '#000');
  const bits = sampleEdges(rec);
  const entry = {
    id,
    name: TILE_NAMES[id],
    family: (TILE_FAMILIES_META.find(f => f.tileIds.includes(id)) || {}).id || null,
    sides: {}
  };
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const raw = runsToIntervals(bits[side]);
    const { intervals, points } = cleanIntervals(raw);
    entry.sides[side] = {
      coverage: +coverageOfIntervals(intervals).toFixed(4),
      runs: intervals.length,
      intervals,
      points
    };
  }
  entry.edgeCoverage = +((entry.sides.left.coverage + entry.sides.right.coverage +
    entry.sides.top.coverage + entry.sides.bottom.coverage) / 4).toFixed(4);
  profiles.push(entry);
  // guarda bits em base64 para análises de compatibilidade
  entry._bits = {};
  for (const side of ['left', 'right', 'top', 'bottom']) {
    entry._bits[side] = Buffer.from(bits[side].join('')).toString('base64');
  }
}

// Compatibilidade direcional exata: right(A) vs left(B), bottom(A) vs top(B)
const bitsCache = {};
for (const p of profiles) {
  bitsCache[p.id] = {};
  for (const side of ['left', 'right', 'top', 'bottom']) {
    bitsCache[p.id][side] = [...Buffer.from(p._bits[side], 'base64').toString()].map(Number);
  }
}
const compat = [];
function intervalsEqual(a, b, tol = 0.02) {
  if (a.intervals.length !== b.intervals.length) return false;
  for (let i = 0; i < a.intervals.length; i++) {
    if (Math.abs(a.intervals[i][0] - b.intervals[i][0]) > tol) return false;
    if (Math.abs(a.intervals[i][1] - b.intervals[i][1]) > tol) return false;
  }
  return true;
}
for (const a of profiles) {
  for (const b of profiles) {
    const hMatch = intervalsEqual(a.sides.right, b.sides.left);
    const vMatch = intervalsEqual(a.sides.bottom, b.sides.top);
    const h = iou(bitsCache[a.id].right, bitsCache[b.id].left);
    const v = iou(bitsCache[a.id].bottom, bitsCache[b.id].top);
    if (hMatch || vMatch) {
      compat.push({ a: a.id, b: b.id, h: hMatch ? +h.toFixed(3) : 0, v: vMatch ? +v.toFixed(3) : 0 });
    }
  }
}

// Famílias: vocabulário de perfis de borda
const famProfiles = {};
for (const f of TILE_FAMILIES_META) famProfiles[f.id] = new Set();
for (const p of profiles) {
  if (!p.family) continue;
  for (const side of ['left', 'right', 'top', 'bottom']) {
    famProfiles[p.family].add(JSON.stringify(p.sides[side].intervals));
  }
}
const famCompat = [];
const famIds = TILE_FAMILIES_META.map(f => f.id);
for (let i = 0; i < famIds.length; i++) {
  for (let j = i; j < famIds.length; j++) {
    const A = famProfiles[famIds[i]], B = famProfiles[famIds[j]];
    let shared = 0;
    for (const p of A) if (B.has(p)) shared++;
    if (shared > 0) famCompat.push({ a: famIds[i], b: famIds[j], shared });
  }
}

// Vocabulário global de perfis (agrupamento de assinaturas de borda)
const vocab = new Map();
for (const p of profiles) {
  for (const side of ['left', 'right', 'top', 'bottom']) {
    const key = JSON.stringify({ i: p.sides[side].intervals, p: p.sides[side].points });
    if (!vocab.has(key)) vocab.set(key, { key, intervals: p.sides[side].intervals, points: p.sides[side].points, tiles: [] });
    vocab.get(key).tiles.push({ id: p.id, side });
  }
}
const vocabulary = [...vocab.values()].map((v, idx) => ({
  code: `E${String(idx + 1).padStart(2, '0')}`,
  intervals: v.intervals,
  points: v.points,
  count: v.tiles.length,
  tiles: v.tiles
}));

const out = {
  meta: { S, samples: SAMPLES, totalTiles: profiles.length, totalFamilies: TILE_FAMILIES_META.length },
  families: TILE_FAMILIES_META,
  profiles,
  compat,
  famCompat,
  vocabulary
};
fs.writeFileSync(path.join(__dirname, 'edge_profiles.json'), JSON.stringify(out, null, 2));
console.log('Wrote analysis/edge_profiles.json');
console.log('Tiles:', profiles.length, 'families:', TILE_FAMILIES_META.length);
console.log('Directional compatible pairs (IoU>=0.85):', compat.length);
for (const p of profiles) {
  console.log(
    String(p.id).padStart(3), p.family.padEnd(18),
    'L', p.sides.left.coverage.toFixed(2), fmtIntervals(p.sides.left.intervals).padEnd(34),
    'R', p.sides.right.coverage.toFixed(2), fmtIntervals(p.sides.right.intervals).padEnd(34),
    'T', p.sides.top.coverage.toFixed(2), fmtIntervals(p.sides.top.intervals).padEnd(34),
    'B', p.sides.bottom.coverage.toFixed(2), fmtIntervals(p.sides.bottom.intervals)
  );
}
