// tests/test_freeze_undo.js
// Tests that snapshot captures frozenCells and undo restores previous frozen state.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const MosaicEngine = window.MosaicEngine;

console.log('--- Testing Freeze Undo/Redo Snapshot Contract (T5) ---');

const config = {
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [0, 1, 2, 3]
};

const mosaic = MosaicEngine.generateMosaic(config, (arr) => arr[0]);

// 1. Initial empty frozen map
const frozenMap = new Map();
const snapEmpty = MosaicEngine.cloneMosaicCellsSnapshot(mosaic, frozenMap);
assert.ok(Array.isArray(snapEmpty.frozenCells), 'Snapshot must contain frozenCells array');
assert.strictEqual(snapEmpty.frozenCells.length, 0);

// 2. Add 4 frozen cells
frozenMap.set('0,0,0,0', { baseTileId: 1, transform: 'id', tileId: 1 });
frozenMap.set('0,0,0,1', { baseTileId: 2, transform: 'id', tileId: 2 });
frozenMap.set('0,0,1,0', { baseTileId: 3, transform: 'id', tileId: 3 });
frozenMap.set('0,0,1,1', { baseTileId: 0, transform: 'id', tileId: 0 });

const snapWith4 = MosaicEngine.cloneMosaicCellsSnapshot(mosaic, frozenMap);
assert.strictEqual(snapWith4.frozenCells.length, 4);

// 3. Clear frozen map (e.g. Descongelar tudo)
frozenMap.clear();
assert.strictEqual(frozenMap.size, 0);

// 4. Undo: restore snapWith4 -> frozenMap must regain the 4 cells!
MosaicEngine.restoreMosaicCellsSnapshot(mosaic, snapWith4, frozenMap);
assert.strictEqual(frozenMap.size, 4, 'Undo must restore the 4 frozen cells');
assert.strictEqual(frozenMap.has('0,0,0,0'), true);
assert.strictEqual(frozenMap.has('0,0,1,1'), true);

// 5. Undo back to snapEmpty -> frozenMap must become empty again!
MosaicEngine.restoreMosaicCellsSnapshot(mosaic, snapEmpty, frozenMap);
assert.strictEqual(frozenMap.size, 0, 'Undo to initial state must empty the frozen cells');

console.log('✓ Freeze undo/redo snapshot contract verified.');
console.log('--- ALL FREEZE UNDO TESTS PASSED! ---');
