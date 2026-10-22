// tests/test_d4_badge_state.js
// Tests the pure isMosaicD4Invariant check and verifies that the D4 badge state
// accurately reflects true mathematical invariance (including turning OFF on undo).

const path = require('path');
const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

global.window = global.window || {};
require(path.join(baseDir, 'core/d4_symmetry.js'));
require(path.join(baseDir, 'core/tile_registry.js'));
require(path.join(baseDir, 'core/mosaic_engine.js'));

console.log('--- Testing isMosaicD4Invariant & D4 Badge State ---');

const { generateMosaic, isMosaicD4Invariant, applyStampPlacements, snapshotMosaicCells, restoreMosaicCellsSnapshot } = window.MosaicEngine;

if (typeof isMosaicD4Invariant !== 'function') {
  throw new TypeError(`isMosaicD4Invariant is not a function (got ${typeof isMosaicD4Invariant})`);
}

// 1. Newly generated mandala_d4 mosaic must be strictly D4 invariant
const mosaic = generateMosaic({
  rows: 3,
  cols: 3,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [2, 7, 13, 44, 75],
  seed: 12345
}, (arr) => arr[0]);

const initialInvariant = isMosaicD4Invariant(mosaic);
if (initialInvariant !== true) {
  throw new Error(`Expected freshly generated mandala_d4 mosaic to be invariant, got ${initialInvariant}`);
}
console.log('✓ Freshly generated mandala_d4 mosaic satisfies isMosaicD4Invariant === true.');

// 2. Snapshot state, then paint an asymmetric tile on an axis cell -> invariance MUST break (false)
const snapshot = snapshotMosaicCells(mosaic);

// Tile 2 has stabilizer md only (not invariant under mx or my or r90).
// Placing tile 2 at (0, 1) or diagonal without rotating counterparts breaks strict D4 invariance.
const currentTile = mosaic.grid[0][0].cells[0][1].tileId;
const differentTile = currentTile === 2 ? 7 : 2;

const placement = [{
  row: 0,
  col: 0,
  subRow: 0,
  subCol: 1,
  tileId: differentTile,
  baseTileId: differentTile,
  transform: 'id'
}];

applyStampPlacements(mosaic, placement);

const postEditInvariant = isMosaicD4Invariant(mosaic);
if (postEditInvariant !== false) {
  throw new Error(`Expected isMosaicD4Invariant === false after asymmetric unilateral edit, got ${postEditInvariant}`);
}
console.log('✓ Asymmetric edit correctly causes isMosaicD4Invariant to return false.');

// 3. Restore snapshot (simulating Undo) -> invariance MUST be restored to true
restoreMosaicCellsSnapshot(mosaic, snapshot);

const postUndoInvariant = isMosaicD4Invariant(mosaic);
if (postUndoInvariant !== true) {
  throw new Error(`Expected isMosaicD4Invariant === true after restoring snapshot (Undo), got ${postUndoInvariant}`);
}
console.log('✓ Snapshot restoration (Undo) restores isMosaicD4Invariant === true.');

// 4. Regenerating mosaic -> invariance is true
const regenerated = generateMosaic({
  rows: 4,
  cols: 4,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [2, 7],
  seed: 999
}, (arr) => arr[0]);

if (isMosaicD4Invariant(regenerated) !== true) {
  throw new Error('Expected regenerated mosaic to be D4 invariant');
}
console.log('✓ Regenerated mosaic satisfies isMosaicD4Invariant === true.');

console.log('--- ALL D4 BADGE & INVARIANCE CHECKS PASSED PERFECTLY! ---');
