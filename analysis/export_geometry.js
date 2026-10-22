/**
 * analysis/export_geometry.js
 * Exporta a geometria vetorial dos 85 tiles existentes e dos 19 propostos
 * para analysis/geometry.json, em coordenadas centradas (S=1000).
 * Cada primitiva carrega fill/stroke/weight para o rasterizador Pillow.
 */
const fs = require('fs');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
const { TILE_RENDERERS, TILE_NAMES, TILE_FAMILIES_META } = window.TileRegistry;
const { PROPOSED_FAMILIES } = require('./proposed_tiles.js');

const S = 1000;

class GeoRec {
  constructor() { this.prims = []; this.f = null; this.s = null; this.w = 1; this.cur = null; }
  fill(c) { this.f = c; } noFill() { this.f = null; }
  stroke(c) { this.s = c; } noStroke() { this.s = null; }
  strokeWeight(w) { this.w = w; }
  _poly(points, closed, fill, stroke, weight) {
    const p = points.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);
    this.prims.push({
      t: 'poly',
      pts: p,
      closed: !!closed,
      fill: fill ? 1 : 0,
      stroke: stroke ? 1 : 0,
      w: +(weight || 0).toFixed(2)
    });
  }
  rect(x, y, w, h) { this._poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, this.f, this.s, this.w); }
  ellipse(x, y, w, h) {
    this.prims.push({
      t: 'ellipse', cx: +x.toFixed(2), cy: +y.toFixed(2),
      rx: +(w / 2).toFixed(2), ry: +(h / 2).toFixed(2),
      fill: this.f ? 1 : 0, stroke: this.s ? 1 : 0, w: +this.w.toFixed(2)
    });
  }
  triangle(x1, y1, x2, y2, x3, y3) { this._poly([[x1, y1], [x2, y2], [x3, y3]], true, this.f, this.s, this.w); }
  line(x1, y1, x2, y2) {
    this.prims.push({ t: 'line', pts: [[+x1.toFixed(2), +y1.toFixed(2)], [+x2.toFixed(2), +y2.toFixed(2)]], w: +this.w.toFixed(2) });
  }
  arc(x, y, w, h, a0, a1) {
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = a0 + (a1 - a0) * (i / 64);
      pts.push([+(x + Math.cos(a) * w / 2).toFixed(2), +(y + Math.sin(a) * h / 2).toFixed(2)]);
    }
    this.prims.push({ t: 'line', pts, w: +this.w.toFixed(2) });
  }
  beginShape() { this.cur = []; }
  vertex(x, y) { this.cur.push([x, y]); }
  endShape(m) {
    if (!this.cur) return;
    this._poly(this.cur, m === 'CLOSE', this.f, this.s, this.w);
    this.cur = null;
  }
}

function exportTile(renderer) {
  const out = {};
  for (const [key, p] of [['tight', 0], ['padded', S * 0.05]]) {
    const rec = new GeoRec();
    renderer(rec, S, S, p, '#000');
    out[key] = rec.prims;
  }
  return out;
}

const tiles = [];
for (let id = 0; id < TILE_RENDERERS.length; id++) {
  const fam = TILE_FAMILIES_META.find(f => f.tileIds.includes(id));
  tiles.push({
    id, name: TILE_NAMES[id], family: fam ? fam.id : null, familyName: fam ? fam.name : null,
    group: fam ? fam.group : null, proposed: false, ...exportTile(TILE_RENDERERS[id])
  });
}
const proposedFamilies = [];
for (const fam of PROPOSED_FAMILIES) {
  const ids = [];
  for (const t of fam.tiles) {
    ids.push(t.id);
    tiles.push({
      id: t.id, name: t.name, family: fam.id, familyName: fam.name, group: fam.group,
      proposed: true, module: fam.module, material: fam.material, sets: fam.sets,
      ...exportTile(t.draw)
    });
  }
  proposedFamilies.push({
    id: fam.id, name: fam.name, group: fam.group, module: fam.module, material: fam.material,
    sets: fam.sets, rationale: fam.rationale, tileIds: ids
  });
}

fs.writeFileSync(path.join(__dirname, 'geometry.json'), JSON.stringify({ S, tiles, proposedFamilies }, null, 0));
console.log('Wrote analysis/geometry.json with', tiles.length, 'tiles and', proposedFamilies.length, 'proposed families.');
