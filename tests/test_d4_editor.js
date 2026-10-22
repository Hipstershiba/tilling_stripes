// tests/test_d4_editor.js
const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const { getCellStabilizer, isTileInvariantUnder } = window.D4Symmetry;
const { generateMosaic, resolveStampRegionPlacements, applyStampPlacements } = window.MosaicEngine;

console.log('--- Testing Editor D4 Strict Transparency Contract (Rodada 2) ---');

// 1. Generate base mosaic with Mandala D4
const mosaic = generateMosaic({
  rows: 2,
  cols: 2,
  subdivision: 2, // N = 4
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [6, 84],
  seed: 1
}, (arr) => arr[0]);

const N = mosaic.subtilesPerSide; // 4
const totalR = 2 * N;
const totalC = 2 * N;

// Diagonal cell (0, 0) has stabilizer ['id', 'md']
const stabDiag = getCellStabilizer(0, 0, N, N, 'mandala_d4');
assert.ok(stabDiag.includes('md'), 'Diagonal cell must have md in stabilizer under mandala_d4');

// Off-diagonal cell (0, 1) has stabilizer ['id']
const stabOffDiag = getCellStabilizer(0, 1, N, N, 'mandala_d4');
assert.deepStrictEqual(stabOffDiag, ['id'], 'Off-diagonal cell stabilizer is only id');

// 2. Test Invariance Check on Tile #2 (Diagonal stripe - asymmetric under md)
// In tile registry, tile 2 reflected across main diagonal (md) transforms into tile 3
assert.strictEqual(isTileInvariantUnder(2, 'md'), false, 'Tile 2 is NOT invariant under md');
assert.strictEqual(isTileInvariantUnder(6, 'md'), true, 'Tile 6 (Cross) IS invariant under md');
assert.strictEqual(isTileInvariantUnder(84, 'md'), true, 'Tile 84 (Empty) IS invariant under md');

// 3. Simulate Editor Painting with Scope: 'canvas_center'
// A) Painting Tile #2 on global center diagonal (gr = 0, gc = 0)
const hitDiag = { row: 0, col: 0, subRow: 0, subCol: 0, globalRow: 0, globalCol: 0 };
const patAsymmetric = { rows: 1, cols: 1, cells: [[{ tileId: 2, baseTileId: 2, transform: 'id' }]] };

const resAsym = resolveStampRegionPlacements(
  mosaic,
  patAsymmetric,
  hitDiag,
  'canvas_center',
  'id',
  { canvasCenterSymmetry: 'mandala_d4' }
);
const placementsAsym = resAsym.placements || [];

// Detection logic matching sketch.js
let breaksD4Asym = false;
for (const p of placementsAsym) {
  const stab = getCellStabilizer(p.gr, p.gc, totalR, totalC, 'mandala_d4');
  for (const g of stab) {
    if (!isTileInvariantUnder(p.tileId, g)) {
      breaksD4Asym = true;
      break;
    }
  }
}
assert.strictEqual(breaksD4Asym, true, 'Painting tile #2 on diagonal in mandala_d4 must detect symmetry break');
console.log('✓ Asymmetric tile painting on diagonal correctly flagged as D4 symmetry break.');

// B) Painting Tile #6 on global center diagonal (gr = 0, gc = 0)
const patSymmetric = { rows: 1, cols: 1, cells: [[{ tileId: 6, baseTileId: 6, transform: 'id' }]] };
const resSym = resolveStampRegionPlacements(
  mosaic,
  patSymmetric,
  hitDiag,
  'canvas_center',
  'id',
  { canvasCenterSymmetry: 'mandala_d4' }
);
const placementsSym = resSym.placements || [];

let breaksD4Sym = false;
for (const p of placementsSym) {
  const stab = getCellStabilizer(p.gr, p.gc, totalR, totalC, 'mandala_d4');
  for (const g of stab) {
    if (!isTileInvariantUnder(p.tileId, g)) {
      breaksD4Sym = true;
      break;
    }
  }
}
assert.strictEqual(breaksD4Sym, false, 'Painting tile #6 on diagonal is invariant and must NOT flag break');
console.log('✓ Invariant tile painting on diagonal verified as completely compliant.');

// C) Painting in 'kaleidoscope' mode (Permissive)
const stabKal = getCellStabilizer(0, 0, N, N, 'kaleidoscope');
assert.deepStrictEqual(stabKal, ['id'], 'Permissive kaleidoscope mode has no axis stabilizer constraints');
console.log('✓ Permissive kaleidoscope mode confirmed unconstrained in editor.');

console.log('--- ALL EDITOR D4 CONTRACT CHECKS PASSED PERFECTLY! ---');
