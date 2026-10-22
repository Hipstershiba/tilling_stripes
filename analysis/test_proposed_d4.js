/**
 * analysis/test_proposed_d4.js — valida o fechamento D4 dos 19 tiles propostos.
 */
global.window = {};
require('../core/d4_symmetry.js');
const { D4_TRANSFORMS, composeD4, invertD4 } = window.D4Symmetry;

function buildMap() {
  const map = {};
  function registerEdge4(L, R, T, B) {
    const baseFromL = { id: L, r90: T, r180: R, r270: B, mx: R, my: L, md: T, mad: B };
    for (const { tile, fromL } of [
      { tile: L, fromL: 'id' }, { tile: T, fromL: 'r90' }, { tile: R, fromL: 'r180' }, { tile: B, fromL: 'r270' }
    ]) {
      map[tile] = {};
      for (const g of D4_TRANSFORMS) map[tile][g] = baseFromL[composeD4(g, fromL)];
    }
  }
  function registerCorner4(TL, TR, BR, BL) {
    const baseFromTL = { id: TL, r90: TR, r180: BR, r270: BL, mx: TR, my: BL, md: TL, mad: BR };
    for (const { tile, fromTL } of [
      { tile: TL, fromTL: 'id' }, { tile: TR, fromTL: 'r90' }, { tile: BR, fromTL: 'r180' }, { tile: BL, fromTL: 'r270' }
    ]) {
      map[tile] = {};
      for (const g of D4_TRANSFORMS) map[tile][g] = baseFromTL[composeD4(g, fromTL)];
    }
  }
  function registerSymmetric1(T) {
    map[T] = {};
    for (const g of D4_TRANSFORMS) map[T][g] = T;
  }
  registerCorner4(85, 86, 87, 88);
  registerEdge4(89, 90, 91, 92);
  registerEdge4(93, 94, 95, 96);
  for (const id of [97, 98, 99, 100, 101, 102, 103]) registerSymmetric1(id);
  return map;
}

const map = buildMap();
for (let id = 85; id <= 103; id++) {
  const e = map[id];
  if (!e) throw new Error(`missing ${id}`);
  if (e.id !== id) throw new Error(`identity ${id}`);
  for (const g of D4_TRANSFORMS) {
    const tgt = e[g];
    if (map[tgt][invertD4(g)] !== id) throw new Error(`inverse ${id}/${g}`);
    for (const h of D4_TRANSFORMS) {
      if (map[map[id][h]][g] !== e[composeD4(g, h)]) throw new Error(`composition ${id}/${g}/${h}`);
    }
  }
}
console.log('✓ Proposed D4 maps: identity, inverse, composition, closure OK for 85..103.');
