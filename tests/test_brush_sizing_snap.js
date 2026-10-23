// tests/test_brush_sizing_snap.js
// Tests non-cyclic integer brush sizing up to canvas limits, snap to block, Ctrl+U / Shift modifiers, and Eraser shortcut (Tile 84).

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Brush Sizing, Snap to Block & Eraser Shortcut ---');

// Mock DOM elements and global environment
function createMockEl(id = '', tag = 'div') {
  return {
    id,
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: {
      contains: () => false,
      add: () => {},
      remove: () => {},
      toggle: () => {}
    },
    style: {},
    appendChild: () => {},
    setAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getContext: () => ({
      clearRect: () => {},
      drawImage: () => {}
    }),
    width: 104,
    height: 104
  };
}

global.window = global;
global.localStorage = {
  setItem: () => {},
  getItem: () => null,
  removeItem: () => {}
};
global.document = {
  getElementById: (id) => createMockEl(id),
  createElement: (tag) => createMockEl('', tag),
  querySelectorAll: () => [],
  body: createMockEl('body', 'body')
};

// Mock p5 graphics context with proxy covering any draw calls
const mockGfx = new Proxy({
  elt: {},
  remove: () => {}
}, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return () => mockGfx;
  }
});
global.createGraphics = () => mockGfx;
global.color = (c) => c;
global.requestAnimationFrame = (cb) => cb();
global.redraw = () => {};
global.noLoop = () => {};

// Load Core Dependencies
require('../core/d4_symmetry.js');
require('../core/tile_registry.js');
require('../core/mosaic_engine.js');
require('../sketch.js');

const StudioState = window.StudioState;

// Setup a mock mosaicData: 6 rows, 8 cols, N = 4 subtiles per side
const N = 4;
StudioState.mosaicData = {
  rows: 6,
  cols: 8,
  subtilesPerSide: N,
  grid: Array.from({ length: 6 }, () =>
    Array.from({ length: 8 }, () => ({
      orbitId: 1,
      transformFromSource: 'id',
      cells: Array.from({ length: N }, () =>
        Array.from({ length: N }, () => ({
          tileId: 2,
          baseTileId: 2,
          transform: 'id'
        }))
      )
    }))
  )
};

// 1. Verify Non-Cyclic Integer Brush Sizing (Free Subtile Mode, Snap OFF)
console.log('1. Testing non-cyclic integer brush sizing...');
StudioState.activeTool = 'paint';
StudioState.brushSnapToBlock = false;
window.setBrushSizeMode('1');

// Step up: 1 -> 2 -> 3 -> 4 -> 5
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '2', 'Brush must increase to 2');
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '3', 'Brush must increase to 3');
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '4', 'Brush must increase to 4');
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '5', 'Brush must increase beyond discrete 4 to integer 5');

// Clamping at min (1): stepping down repeatedly must clamp at 1 and NEVER wrap around to max
window.cycleActiveToolSize(-1); // 4
window.cycleActiveToolSize(-1); // 3
window.cycleActiveToolSize(-1); // 2
window.cycleActiveToolSize(-1); // 1
assert.strictEqual(StudioState.brushSizeMode, '1');
const didCycleDownAtMin = window.cycleActiveToolSize(-1);
assert.strictEqual(didCycleDownAtMin, false, 'Stepping down at min must return false (clamped)');
assert.strictEqual(StudioState.brushSizeMode, '1', 'Must clamp at 1 and not wrap to canvas size');
console.log('✓ Brush sizing clamps at 1 and does not cycle.');

// Clamping at max canvas size: max = max(6*4, 8*4) = 32 subtiles
const maxDim = Math.max(6 * N, 8 * N);
assert.strictEqual(maxDim, 32);
window.setBrushSizeMode(String(maxDim));
const didCycleUpAtMax = window.cycleActiveToolSize(1);
assert.strictEqual(didCycleUpAtMax, false, 'Stepping up at max must return false (clamped)');
assert.strictEqual(StudioState.brushSizeMode, '32', 'Must clamp at max canvas subtiles and not wrap to 1');
console.log('✓ Brush sizing clamps at canvas limit (32) and does not cycle.');

// 2. Testing Snap to Block sizing (stepping by whole block increments)
console.log('2. Testing Snap to Block sizing...');
StudioState.brushSnapToBlock = true;
window.setBrushSizeMode('4', true); // 1 block (4 subtiles)

window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '8', 'Snap to block must step up to 2 blocks (8 subtiles)');
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '12', 'Snap to block must step up to 3 blocks (12 subtiles)');
window.cycleActiveToolSize(-1);
assert.strictEqual(StudioState.brushSizeMode, '8', 'Snap to block must step down to 2 blocks');
window.cycleActiveToolSize(-1);
assert.strictEqual(StudioState.brushSizeMode, '4', 'Snap to block must step down to 1 block');

const didCycleDownBlock = window.cycleActiveToolSize(-1);
assert.strictEqual(didCycleDownBlock, false, 'Snap to block must clamp at 1 block and return false');
assert.strictEqual(StudioState.brushSizeMode, '4', 'Must remain at 1 block');
console.log('✓ Snap to block steps in whole block increments (N=4) and clamps at 1 block.');

// 3. Testing isEffectiveBrushSnap with Shift Modifier
console.log('3. Testing isEffectiveBrushSnap with Shift modifier...');
// When Snap is OFF by default:
StudioState.brushSnapToBlock = false;
StudioState.isShiftDown = false;
assert.strictEqual(window.isEffectiveBrushSnap(), false, 'Effective snap must be false when both are false');

// Holding Shift temporarily forces Snap ON
StudioState.isShiftDown = true;
assert.strictEqual(window.isEffectiveBrushSnap(), true, 'Holding Shift must temporarily activate Snap');

// When Snap is ON (sticky via Ctrl+U):
StudioState.brushSnapToBlock = true;
StudioState.isShiftDown = false;
assert.strictEqual(window.isEffectiveBrushSnap(), true, 'Effective snap must be true when snapToBlock is true');

// Holding Shift when Snap is ON temporarily inverts/bypasses Snap for free precision
StudioState.isShiftDown = true;
assert.strictEqual(window.isEffectiveBrushSnap(), false, 'Holding Shift when snap is ON must temporarily allow free subtile placement');
console.log('✓ Shift modifier correctly inverts and activates Snap to Block dynamically.');

// 4. Testing Eraser Shortcut (E) & Brush (B) Restoration
console.log('4. Testing Eraser Shortcut (E) for Tile 84...');
StudioState.isShiftDown = false;
StudioState.brushSnapToBlock = false;
StudioState.activeTool = 'paint';
StudioState.editBrushTileId = 2; // Selected tile #2
window.setBrushSizeMode('3'); // 3x3 brush

// Select Eraser (Tile 84)
window.selectBrushTile(84);
assert.strictEqual(StudioState.editBrushTileId, 84, 'Active brush tile must be 84 (empty-tile)');
assert.strictEqual(StudioState.activeTool, 'paint', 'Tool must be paint');

// Ensure pattern of size 3x3 is fully populated with Tile 84
const pat = StudioState.supertilePattern;
assert.strictEqual(pat.rows, 3);
assert.strictEqual(pat.cols, 3);
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    assert.strictEqual(pat.cells[r][c].baseTileId, 84, 'All brush subtiles must be Tile 84');
    assert.strictEqual(pat.cells[r][c].tileId, 84);
  }
}
console.log('✓ Eraser fills multi-cell brush pattern with Tile 84 (empty tile).');

// Restoring previous tile
StudioState.previousBrushTileId = 2;
window.selectBrushTile(StudioState.previousBrushTileId);
assert.strictEqual(StudioState.editBrushTileId, 2, 'Active brush tile must be restored to 2');
for (let r = 0; r < 3; r++) {
  for (let c = 0; c < 3; c++) {
    assert.strictEqual(StudioState.supertilePattern.cells[r][c].baseTileId, 2, 'All brush subtiles restored to Tile 2');
  }
}
console.log('✓ Restoring previous tile fills multi-cell brush pattern with restored tile.');

console.log('--- ALL BRUSH SIZING, SNAP TO BLOCK & ERASER TESTS PASSED! ---');
