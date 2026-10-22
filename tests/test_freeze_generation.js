// tests/test_freeze_generation.js
// Tests that generateMosaicWithFrozen preserves frozen cells across different PRNG runs,
// updates only unfrozen cells, and discards out-of-bounds keys.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const MosaicEngine = window.MosaicEngine;

console.log('--- Testing generateMosaicWithFrozen & applyFrozenCells ---');

assert.strictEqual(
  typeof MosaicEngine.generateMosaicWithFrozen,
  'function',
  'generateMosaicWithFrozen must be exported by MosaicEngine'
);
assert.strictEqual(
  typeof MosaicEngine.applyFrozenCells,
  'function',
  'applyFrozenCells must be exported by MosaicEngine'
);

const config = {
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [0, 1, 2, 3, 4, 5, 6, 7]
};

// PRNG 1
let s1 = 0;
const prng1 = (arr) => arr[(s1++) % arr.length];
const m1 = MosaicEngine.generateMosaic(config, prng1);

// Freeze cell [0, 0, 1, 1]
const cell00 = m1.grid[0][0].cells[1][1];
const frozenMap = new Map();
frozenMap.set('0,0,1,1', {
  baseTileId: cell00.baseTileId,
  transform: cell00.transform,
  tileId: cell00.tileId
});

// Also add an invalid out-of-bounds key
frozenMap.set('99,99,99,99', {
  baseTileId: 2,
  transform: 'id',
  tileId: 2
});

// PRNG 2 (different sequence)
let s2 = 42;
const prng2 = (arr) => arr[(s2++) % arr.length];

// Generate with frozen cells
const m2 = MosaicEngine.generateMosaicWithFrozen(config, prng2, frozenMap);

// 1. Frozen cell must be strictly preserved
const preservedCell = m2.grid[0][0].cells[1][1];
assert.strictEqual(preservedCell.baseTileId, cell00.baseTileId, 'baseTileId must be preserved');
assert.strictEqual(preservedCell.transform, cell00.transform, 'transform must be preserved');
assert.strictEqual(preservedCell.tileId, cell00.tileId, 'tileId must be preserved');

// 2. Unfrozen cell must follow the new PRNG sequence
let s2Ref = 42;
const prng2Ref = (arr) => arr[(s2Ref++) % arr.length];
const m2Pure = MosaicEngine.generateMosaic(config, prng2Ref);
assert.strictEqual(m2.grid[0][0].cells[0][0].tileId, m2Pure.grid[0][0].cells[0][0].tileId, 'Unfrozen cell must roll new seed');

// 3. Out-of-bounds key must be discarded from frozenMap
assert.strictEqual(frozenMap.has('99,99,99,99'), false, 'Out-of-bounds key must be pruned from frozenMap');

console.log('✓ All generateMosaicWithFrozen tests passed.');
