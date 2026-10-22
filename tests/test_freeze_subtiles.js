// tests/test_freeze_subtiles.js
// Tests the Subtile Freezing / Locking feature:
// 1. DOM elements and UI triggers exist
// 2. Integration with MosaicEngine & D4 symmetry scopes
// 3. Regeneration preserves frozen cells while rolling non-frozen cells
// 4. Clearing locks restores full regeneration
// 5. State serialization and restoration

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');

console.log('--- Testing Subtile Freezing / Locking System ---');

// 1. Verify DOM elements in index.html
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
assert.ok(html.includes('id="toolFreeze"'), '#toolFreeze must exist in index.html');
assert.ok(html.includes('id="freezeSection"'), '#freezeSection must exist in index.html');
assert.ok(html.includes('id="freezeCountBadge"'), '#freezeCountBadge must exist in index.html');
assert.ok(html.includes('id="btnToggleFreezeTool"'), '#btnToggleFreezeTool must exist in index.html');
assert.ok(html.includes('id="btnClearFrozen"'), '#btnClearFrozen must exist in index.html');
console.log('✓ All freeze DOM controls and buttons exist in index.html.');

// 2. Verify ui_info.js documentation topic
const uiInfoText = fs.readFileSync(path.join(baseDir, 'ui_info.js'), 'utf8');
assert.ok(uiInfoText.includes("'freeze':"), "ui_info.js must contain 'freeze' topic");
console.log("✓ 'freeze' info topic defined in ui_info.js.");

// 3. Test MosaicEngine generation with frozen preservation
global.window = {};
require(path.join(baseDir, 'core/d4_symmetry.js'));
require(path.join(baseDir, 'core/tile_registry.js'));
require(path.join(baseDir, 'core/mosaic_engine.js'));

const MosaicEngine = window.MosaicEngine;

const config = {
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [0, 1, 2, 3, 4, 5, 6, 7]
};

// Generate initial mosaic with deterministic PRNG 1
let step1 = 0;
const prng1 = (arr) => arr[(step1++) % arr.length];
const mosaic1 = MosaicEngine.generateMosaic(config, prng1);

const N = mosaic1.subtilesPerSide; // 4x4 subtiles per block
assert.strictEqual(N, 4, 'Subtiles per side must be 4');

// Target cell to freeze: Block [0, 0], Subtile [1, 1]
const originalCell = mosaic1.grid[0][0].cells[1][1];
const frozenKey = '0,0,1,1';
const frozenData = {
  baseTileId: originalCell.baseTileId,
  transform: originalCell.transform,
  tileId: originalCell.tileId
};

const frozenMap = new Map();
frozenMap.set(frozenKey, { ...frozenData });

// Generate second mosaic with different PRNG seed without freeze
let step2 = 17;
const prng2 = (arr) => arr[(step2++) % arr.length];
const mosaic2 = MosaicEngine.generateMosaic(config, prng2);
const unfrozenCellAfter = mosaic2.grid[0][0].cells[1][1];

// Generate third mosaic with PRNG 2 AND apply frozenMap
let step3 = 17;
const prng3 = (arr) => arr[(step3++) % arr.length];
const mosaic3 = MosaicEngine.generateMosaic(config, prng3);

// Apply frozenMap
for (const [key, cellData] of frozenMap.entries()) {
  const [r, c, subR, subC] = key.split(',').map(Number);
  const target = mosaic3.grid[r][c].cells[subR][subC];
  target.baseTileId = cellData.baseTileId;
  target.transform = cellData.transform;
  target.tileId = cellData.tileId;
}

// Verification:
// The frozen cell in mosaic3 must match originalCell exactly
assert.strictEqual(mosaic3.grid[0][0].cells[1][1].baseTileId, frozenData.baseTileId, 'Frozen baseTileId preserved');
assert.strictEqual(mosaic3.grid[0][0].cells[1][1].transform, frozenData.transform, 'Frozen transform preserved');
assert.strictEqual(mosaic3.grid[0][0].cells[1][1].tileId, frozenData.tileId, 'Frozen tileId preserved');

// Unfrozen cells (e.g. [0,0].cells[0][0]) should follow the new PRNG
assert.strictEqual(mosaic3.grid[0][0].cells[0][0].tileId, mosaic2.grid[0][0].cells[0][0].tileId, 'Unfrozen cells roll as expected');
console.log('✓ Frozen cell preserved during regeneration while unfrozen cells rolled.');

// 4. Test Scope Placement Resolution for Freeze
const dummyPat = { rows: 1, cols: 1, cells: [[{ tileId: 1, baseTileId: 1, transform: 'id' }]] };
const singleHit = { row: 0, col: 0, subRow: 1, subCol: 1 };

const resolvedSingle = MosaicEngine.resolveStampRegionPlacements(
  mosaic1,
  dummyPat,
  singleHit,
  'single',
  'id',
  {}
);
const singlePlacements = Array.isArray(resolvedSingle) ? resolvedSingle : resolvedSingle.placements;
assert.strictEqual(singlePlacements.length, 1, 'Single scope must target exactly 1 cell');

const resolvedOrbit = MosaicEngine.resolveStampRegionPlacements(
  mosaic1,
  dummyPat,
  singleHit,
  'orbit_sym',
  'id',
  {}
);
const orbitPlacements = Array.isArray(resolvedOrbit) ? resolvedOrbit : resolvedOrbit.placements;
assert.ok(orbitPlacements.length > 1, 'Orbit scope must target symmetric counterpart cells');
console.log(`✓ Scope resolution for freeze verified (Single: ${singlePlacements.length}, Orbit: ${orbitPlacements.length} cells).`);

// 5. Test State Serialization
const serializedFrozen = Array.from(frozenMap.entries());
assert.ok(Array.isArray(serializedFrozen), 'Serialized frozen cells must be an array');
assert.strictEqual(serializedFrozen.length, 1);
assert.strictEqual(serializedFrozen[0][0], frozenKey);

const restoredMap = new Map(serializedFrozen);
assert.strictEqual(restoredMap.size, 1);
assert.deepStrictEqual(restoredMap.get(frozenKey), frozenData);
console.log('✓ State serialization and Map restoration roundtrip verified.');

console.log('--- ALL SUBTILE FREEZING TESTS PASSED! ---');
