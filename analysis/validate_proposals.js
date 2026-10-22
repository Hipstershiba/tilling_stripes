/**
 * analysis/validate_proposals.js
 * Amostra as bordas dos 19 subtiles propostos e classifica as portas.
 */
const path = require('path');
global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
const { PROPOSED_FAMILIES } = require('./proposed_tiles.js');

const S = 1000, SAMPLES = 1024, EPS = 0.5, inset = 1;

class Rec {
  constructor() { this.fillPolys = []; this.strokePaths = []; this._fill = null; this._stroke = null; this._weight = 1; this._cur = null; }
  fill(c) { this._fill = c; } noFill() { this._fill = null; }
  stroke(c) { this._stroke = c; } noStroke() { this._stroke = null; }
  strokeWeight(w) { this._weight = w; }
  _emit(points, closed) {
    if (this._fill) this.fillPolys.push(points);
    if (this._stroke) this.strokePaths.push({ pts: closed ? [...points, points[0]] : points, w: this._weight });
  }
  rect(x, y, w, h) { this._emit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); }
  ellipse(x, y, w, h) { const p = []; for (let i = 0; i < 96; i++) { const a = i / 96 * Math.PI * 2; p.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]); } this._emit(p, true); }
  triangle(x1, y1, x2, y2, x3, y3) { this._emit([[x1, y1], [x2, y2], [x3, y3]], true); }
  line(x1, y1, x2, y2) { if (this._stroke) this.strokePaths.push({ pts: [[x1, y1], [x2, y2]], w: this._weight }); }
  arc(x, y, w, h, a0, a1) { const p = []; for (let i = 0; i <= 64; i++) { const a = a0 + (a1 - a0) * i / 64; p.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]); } if (this._stroke) this.strokePaths.push({ pts: p, w: this._weight }); }
  beginShape() { this._cur = []; }
  vertex(x, y) { this._cur.push([x, y]); }
  endShape(m) { if (!this._cur) return; this._emit(this._cur, m === 'CLOSE'); this._cur = null; }
}
function pip(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function segd(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function sample(rec) {
  const out = { left: [], right: [], top: [], bottom: [] }, half = S / 2;
  for (let i = 0; i < SAMPLES; i++) {
    const t = (i + 0.5) / SAMPLES, p = -half + t * S;
    for (const [side, x, y] of [['left', -half + inset, p], ['right', half - inset, p], ['top', p, -half + inset], ['bottom', p, half - inset]]) {
      let ink = rec.fillPolys.some(poly => pip(x, y, poly));
      if (!ink) ink = rec.strokePaths.some(sp => sp.pts.some((pt, k) => k > 0 && segd(x, y, sp.pts[k - 1][0], sp.pts[k - 1][1], pt[0], pt[1]) <= sp.w / 2 + EPS));
      out[side].push(ink ? 1 : 0);
    }
  }
  return out;
}
function intervals(bits) {
  const out = []; let st = -1;
  for (let i = 0; i <= bits.length; i++) {
    if (i < bits.length && bits[i]) { if (st < 0) st = i; }
    else if (st >= 0) { out.push([st / bits.length, i / bits.length]); st = -1; }
  }
  return out;
}
function clean(iv) {
  const merged = [];
  for (const [a, b] of iv) if (b - a >= 1e-6) {
    if (merged.length && a - merged[merged.length - 1][1] < 0.002) merged[merged.length - 1][1] = b;
    else merged.push([a, b]);
  }
  const ints = [], pts = [];
  for (const [a, b] of merged) (b - a < 0.03 ? pts : ints).push(b - a < 0.03 ? +((a + b) / 2).toFixed(3) : [+a.toFixed(3), +b.toFixed(3)]);
  return { intervals: ints, points: pts };
}
const T = {
  full: [[0, 1]], center3: [[1 / 3, 2 / 3]], half0: [[0, 0.5]], half1: [[0.5, 1]],
  third0: [[0, 1 / 3]], third1: [[2 / 3, 1]], doubleThird: [[0, 1 / 3], [2 / 3, 1]],
  midHalf: [[0.25, 0.75]], quarter0: [[0, 0.25]], quarter1: [[0.75, 1]]
};
function same(iv, tpl, tol = 0.025) {
  if (iv.length !== tpl.length) return false;
  return iv.every(([a, b], i) => Math.abs(a - tpl[i][0]) <= tol && Math.abs(b - tpl[i][1]) <= tol);
}
function cls(side) {
  if (!side.intervals.length) return side.points.length ? `P(${side.points.join(',')})` : '∅';
  for (const [n, tpl] of Object.entries(T)) if (same(side.intervals, tpl)) return n;
  if (side.intervals.every(([a, b]) => b - a < 0.22)) return 'S[' + side.intervals.map(([a, b]) => `${((a + b) / 2).toFixed(2)}w${(b - a).toFixed(2)}`).join(' ') + ']';
  return '?' + JSON.stringify(side.intervals);
}

const fs = require('fs');
const outProfiles = [];
for (const fam of PROPOSED_FAMILIES) {
  console.log(`\n${fam.id} — ${fam.name} [${fam.module}/${fam.material}] sets: ${fam.sets.join(', ')}`);
  for (const t of fam.tiles) {
    const rec = new Rec(); t.draw(rec, S, S, 0);
    const bits = sample(rec);
    const sides = {};
    for (const s of ['left', 'right', 'top', 'bottom']) sides[s] = clean(intervals(bits[s]));
    outProfiles.push({ id: t.id, name: t.name, family: fam.id, sides });
    console.log(` ${t.id} ${t.name.padEnd(46)} ${['left', 'right', 'top', 'bottom'].map(s => cls(sides[s])).join(' | ')}`);
  }
}
fs.writeFileSync(__dirname + '/proposed_profiles.json', JSON.stringify(outProfiles, null, 2));
console.log('\nwrote analysis/proposed_profiles.json');
