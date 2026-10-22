/**
 * analysis/density.js — densidade de tinta por tile (raster 72x72) e por família.
 */
const fs = require('fs');
const path = require('path');
global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
const { TILE_RENDERERS, TILE_NAMES, TILE_FAMILIES_META } = window.TileRegistry;

class R {
  constructor() { this.polys = []; this.strokes = []; this.f = null; this.s = null; this.w = 1; this.cur = null; }
  fill() { this.f = 1; } noFill() { this.f = null; }
  stroke() { this.s = 1; } noStroke() { this.s = null; }
  strokeWeight(w) { this.w = w; }
  emit(p, closed) {
    if (this.f) this.polys.push(p);
    if (this.s) this.strokes.push({ p: closed ? [...p, p[0]] : p, w: this.w });
  }
  rect(x, y, w, h) { this.emit([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); }
  ellipse(x, y, w, h) {
    const p = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; p.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]); }
    this.emit(p, true);
  }
  triangle(x1, y1, x2, y2, x3, y3) { this.emit([[x1, y1], [x2, y2], [x3, y3]], true); }
  line(x1, y1, x2, y2) { this.strokes.push({ p: [[x1, y1], [x2, y2]], w: this.w }); }
  arc(x, y, w, h, a0, a1) {
    const p = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; p.push([x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2]); }
    this.strokes.push({ p, w: this.w });
  }
  beginShape() { this.cur = []; }
  vertex(x, y) { this.cur.push([x, y]); }
  endShape(m) { this.emit(this.cur, m === 'CLOSE'); this.cur = null; }
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

const S = 1000, N = 72;
const rows = [];
for (let id = 0; id < TILE_RENDERERS.length; id++) {
  const r = new R(); TILE_RENDERERS[id](r, S, S, 0, '#000');
  let ink = 0, total = 0;
  for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
    const x = -S / 2 + (ix + 0.5) * S / N;
    const y = -S / 2 + (iy + 0.5) * S / N;
    total++;
    let on = r.polys.some(p => pip(x, y, p));
    if (!on) on = r.strokes.some(sp => {
      const tol = sp.w / 2;
      for (let k = 1; k < sp.p.length; k++) if (segd(x, y, sp.p[k - 1][0], sp.p[k - 1][1], sp.p[k][0], sp.p[k][1]) <= tol) return true;
      return false;
    });
    if (on) ink++;
  }
  rows.push({ id, name: TILE_NAMES[id], density: +(ink / total).toFixed(4) });
}
const fam = {};
for (const f of TILE_FAMILIES_META) {
  const ds = f.tileIds.map(id => rows[id].density);
  fam[f.id] = +(ds.reduce((a, b) => a + b, 0) / ds.length).toFixed(4);
}
console.log('density by family');
for (const f of [...TILE_FAMILIES_META].sort((a, b) => fam[b.id] - fam[a.id])) console.log(fam[f.id].toFixed(3), f.id.padEnd(20), f.name);
fs.writeFileSync(path.join(__dirname, 'density.json'), JSON.stringify({ rows, fam }, null, 2));
