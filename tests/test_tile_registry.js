// tests/test_tile_registry.js - Full verification of core/tile_registry.js
const path = require('path');
global.window = {};

require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));

const {
  TILE_RENDERERS,
  TILE_NAMES,
  TILE_FAMILIES_META,
  TILE_D4_MAP,
  getTransformedTileId,
  getFamilyForTile,
  getNextTileInFamily
} = window.TileRegistry;

const { D4_TRANSFORMS, composeD4, invertD4 } = window.D4Symmetry;

console.log('--- Verifying Tile Registry ---');
console.log('Total renderers:', TILE_RENDERERS.length);
console.log('Total tile names:', TILE_NAMES.length);
console.log('Total families:', TILE_FAMILIES_META.length);

if (TILE_RENDERERS.length !== 90) {
  throw new Error(`Expected 90 renderers, got ${TILE_RENDERERS.length}`);
}
if (TILE_NAMES.length !== 90) {
  throw new Error(`Expected 90 names, got ${TILE_NAMES.length}`);
}
if (TILE_FAMILIES_META.length !== 33) {
  throw new Error(`Expected 33 families, got ${TILE_FAMILIES_META.length}`);
}

// 1. Check all tile IDs in families match 0..89 exactly and are sequential
let expectedId = 0;
const allIdsInFamilies = new Set();
for (const fam of TILE_FAMILIES_META) {
  for (const tid of fam.tileIds) {
    if (tid !== expectedId) {
      throw new Error(`Sequential index broken: expected ${expectedId}, got ${tid} in family ${fam.id}`);
    }
    expectedId++;
    allIdsInFamilies.add(tid);
  }
}
if (allIdsInFamilies.size !== 90) {
  throw new Error(`Expected 90 distinct tileIds across families, found ${allIdsInFamilies.size}`);
}
console.log('✓ All 90 tile IDs are sequentially and cleanly indexed across all 33 families.');

// 2. Test rendering for all 90 tiles
const mockCtx = {
  fill: () => {},
  noFill: () => {},
  stroke: () => {},
  noStroke: () => {},
  strokeWeight: () => {},
  rect: () => {},
  ellipse: () => {},
  line: () => {},
  triangle: () => {},
  arc: () => {},
  beginShape: () => {},
  vertex: () => {},
  endShape: () => {}
};

TILE_RENDERERS.forEach((renderer, id) => {
  try {
    renderer(mockCtx, 100, 100, 5, '#ffffff');
  } catch (err) {
    throw new Error(`Renderer failed for tileId ${id} (${TILE_NAMES[id]}): ${err.message}`);
  }
});
console.log('✓ All 90 renderers executed successfully without error.');

// 3. Test D4 group action on all 90 tiles
for (let id = 0; id < 90; id++) {
  const mapEntry = TILE_D4_MAP[id];
  if (!mapEntry) {
    throw new Error(`Missing TILE_D4_MAP entry for tileId ${id}`);
  }
  // Identity
  if (mapEntry['id'] !== id) {
    throw new Error(`Identity failed for tile ${id}: got ${mapEntry['id']}`);
  }
  // Invertibility
  for (const g of D4_TRANSFORMS) {
    const tgt = mapEntry[g];
    const gInv = invertD4(g);
    const back = TILE_D4_MAP[tgt][gInv];
    if (back !== id) {
      throw new Error(`Invertibility failed for tile ${id} under ${g}: back is ${back}`);
    }
  }
  // Composition
  for (const g1 of D4_TRANSFORMS) {
    for (const g2 of D4_TRANSFORMS) {
      const step1 = mapEntry[g2];
      const step2 = TILE_D4_MAP[step1][g1];
      const composed = composeD4(g1, g2);
      const direct = mapEntry[composed];
      if (step2 !== direct) {
        throw new Error(`Composition mismatch on tile ${id} (${g1} o ${g2}): step2=${step2}, direct=${direct}`);
      }
    }
  }
  // Family closure
  const fam = getFamilyForTile(id);
  if (!fam) throw new Error(`Family lookup failed for tile ${id}`);
  for (const g of D4_TRANSFORMS) {
    const tgt = mapEntry[g];
    if (!fam.tileIds.includes(tgt)) {
      throw new Error(`Tile ${id} mapped outside family ${fam.id} to ${tgt}`);
    }
  }
}
console.log('✓ All 90 tiles satisfy full D4 dihedral group axioms (Identity, Inverse, Composition, Family Closure).');

// 4. Test family cycling
for (const fam of TILE_FAMILIES_META) {
  for (let i = 0; i < fam.tileIds.length; i++) {
    const t = fam.tileIds[i];
    const next = getNextTileInFamily(t, 1);
    const expectedNext = fam.tileIds[(i + 1) % fam.tileIds.length];
    if (next !== expectedNext) {
      throw new Error(`Cycling next failed for tile ${t}: expected ${expectedNext}, got ${next}`);
    }
    const prev = getNextTileInFamily(t, -1);
    const expectedPrev = fam.tileIds[(i - 1 + fam.tileIds.length) % fam.tileIds.length];
    if (prev !== expectedPrev) {
      throw new Error(`Cycling prev failed for tile ${t}: expected ${expectedPrev}, got ${prev}`);
    }
  }
}
console.log('✓ Next/Previous tile family cycling verified across all 33 families.');

console.log('--- ALL CHECKS PASSED PERFECTLY! ---');
