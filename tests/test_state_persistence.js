// tests/test_state_persistence.js
const path = require('path');

// Setup Node.js browser mocks
const storageMap = new Map();
global.localStorage = {
  getItem: (key) => (storageMap.has(key) ? storageMap.get(key) : null),
  setItem: (key, val) => storageMap.set(key, String(val)),
  removeItem: (key) => storageMap.delete(key),
  clear: () => storageMap.clear()
};

global.window = {
  localStorage: global.localStorage,
  devicePixelRatio: 1,
  addEventListener: () => {}
};
global.document = {
  getElementById: () => null,
  querySelectorAll: () => []
};

require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const { generateMosaic, cloneMosaicCellsSnapshot, restoreMosaicCellsSnapshot } = window.MosaicEngine;
const totalTiles = window.TileRegistry.TILE_RENDERERS.length;

console.log(`--- Testing Mosaic & Studio State Persistence with ${totalTiles} tiles ---`);

// 1. Generate a mosaic
const mosaic = generateMosaic({
  rows: 3,
  cols: 3,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  allowedTiles: [0, 1, 2, 3, 4],
  seed: 9999
}, (arr) => arr[0]);

// Verify initial cell
const initialCell = mosaic.grid[1][1].cells[0][0];
console.log('Initial center block cell [0,0]: tileId =', initialCell.tileId);

// 2. Simulate user editing: Paint cell [0,0] with tileId 15 and transform 'r90'
initialCell.baseTileId = 15;
initialCell.tileId = window.TileRegistry.getTransformedTileId(15, 'r90');
initialCell.transform = 'r90';

// 3. Create a snapshot and save to mock localStorage
const snapshot = cloneMosaicCellsSnapshot(mosaic);
if (!snapshot) throw new Error('Failed to create snapshot');

const payload = {
  version: 2,
  seed: 9999,
  rows: 3,
  cols: 3,
  subdivision: 2,
  workspace: 'edit',
  activeTool: 'paint',
  cellsSnapshot: snapshot
};

localStorage.setItem('tiling_stripes_studio_state_v2', JSON.stringify(payload));
console.log('✓ Successfully serialized and saved mosaic state to localStorage');

// 4. Simulate page reload: load from localStorage
const raw = localStorage.getItem('tiling_stripes_studio_state_v2');
if (!raw) throw new Error('localStorage empty after save');
const restoredPayload = JSON.parse(raw);

// 5. Generate fresh mosaic from base parameters
const reloadedMosaic = generateMosaic({
  rows: restoredPayload.rows,
  cols: restoredPayload.cols,
  subdivision: restoredPayload.subdivision,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  allowedTiles: [0, 1, 2, 3, 4],
  seed: restoredPayload.seed
}, (arr) => arr[0]);

// Before restore, cell is in default generated state
console.log('Reloaded mosaic before restore: tileId =', reloadedMosaic.grid[1][1].cells[0][0].tileId);

// 6. Restore cells from snapshot
const ok = restoreMosaicCellsSnapshot(reloadedMosaic, restoredPayload.cellsSnapshot);
if (!ok) throw new Error('restoreMosaicCellsSnapshot failed');

const restoredCell = reloadedMosaic.grid[1][1].cells[0][0];
console.log('Reloaded mosaic AFTER restore: tileId =', restoredCell.tileId, 'transform =', restoredCell.transform);

if (restoredCell.baseTileId !== 15 || restoredCell.transform !== 'r90') {
  throw new Error(`Expected tileId 15 and transform r90, got baseTileId ${restoredCell.baseTileId}, transform ${restoredCell.transform}`);
}

console.log('✓ User edits were 100% restored after reload simulation!');
console.log('--- ALL PERSISTENCE CHECKS PASSED PERFECTLY! ---');
