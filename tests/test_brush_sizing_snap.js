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
    focus() { global.document.activeElement = this; },
    getBoundingClientRect() { return {left:0, top:0, width:this.width, height:this.height}; },
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
const elCache = new Map();
global.document = {
  getElementById: (id) => {
    if (!elCache.has(id)) elCache.set(id, createMockEl(id));
    return elCache.get(id);
  },
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

// 5. Testing Scope Mode Cycling (cycleEditScope via Q or Tab)
console.log('5. Testing Scope Mode Cycling...');
assert.strictEqual(typeof window.cycleEditScope, 'function', 'window.cycleEditScope must be exported');

StudioState.editScope = 'canvas_center'; // 1
assert.strictEqual(window.cycleEditScope(1), 'orbit_sym', 'Must cycle 1 -> 2 (orbit_sym)');
assert.strictEqual(window.cycleEditScope(1), 'block_sym', 'Must cycle 2 -> 3 (block_sym)');
assert.strictEqual(window.cycleEditScope(1), 'all_blocks', 'Must cycle 3 -> 4 (all_blocks)');
assert.strictEqual(window.cycleEditScope(1), 'single', 'Must cycle 4 -> 5 (single)');
assert.strictEqual(window.cycleEditScope(1), 'same_tile', 'Must cycle 5 -> 6 (same_tile)');
assert.strictEqual(window.cycleEditScope(1), 'canvas_center', 'Must wrap around 6 -> 1 (canvas_center)');

// Reverse cycling with Shift (direction = -1)
assert.strictEqual(window.cycleEditScope(-1), 'same_tile', 'Must cycle backward 1 -> 6 (same_tile)');
assert.strictEqual(window.cycleEditScope(-1), 'single', 'Must cycle backward 6 -> 5 (single)');
console.log('✓ cycleEditScope smoothly cycles forward and backward across all 6 scopes.');

// 6. Testing Brush Size & Snap Status UI Display Elements
console.log('6. Testing Brush Size & Snap Status UI display elements...');
const sizeValEl = document.getElementById('brushSizeValueText');
const sizeSubEl = document.getElementById('brushSizeSubText');
const snapStatusEl = document.getElementById('brushSnapStatusText');

StudioState.brushSnapToBlock = false;
window.setBrushSizeMode('3');
assert.strictEqual(sizeValEl.textContent, '3×3', 'Display must show 3×3');
assert.strictEqual(sizeSubEl.textContent, 'subtiles (linhas × colunas)', 'Display must identify dimensional units');
assert.strictEqual(snapStatusEl.textContent, 'Desativado', 'Snap status must show Desativado');

StudioState.brushSnapToBlock = true;
window.setBrushSizeMode('8', true); // 2 blocks (N=4)
assert.strictEqual(sizeValEl.textContent, '8×8', 'Display must show 8×8');
assert.strictEqual(sizeSubEl.textContent, '2×2 blocos', 'Display must show 2×2 blocos');
assert.strictEqual(snapStatusEl.textContent, 'Ativado', 'Snap status must show Ativado');
console.log('✓ Brush size value text and snap status badge render accurately.');

console.log('--- ALL BRUSH SIZING, SNAP TO BLOCK, ERASER, SCOPE & UI DISPLAY TESTS PASSED! ---');

// Every size gesture uses monotonic steps, including area tools and small blocks.
StudioState.activeTool = 'rotate';
StudioState.rotateSizeMode = '1';
assert.strictEqual(window.cycleActiveToolSize(-1), false);
assert.strictEqual(StudioState.rotateSizeMode, '1');
StudioState.rotateSizeMode = 'block';
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.rotateSizeMode, '5');
assert.strictEqual(StudioState.rotateSnapToBlock, false);
window.cycleActiveToolSize(-1);
assert.strictEqual(StudioState.rotateSizeMode, '4');
StudioState.rotateSizeMode = '32';
assert.strictEqual(window.cycleActiveToolSize(1), false);
StudioState.activeTool = 'freeze';
StudioState.freezeSize = 'block';
assert.strictEqual(window.cycleActiveToolSize(1), false);
window.cycleActiveToolSize(-1);
assert.strictEqual(StudioState.freezeSize, '3');
StudioState.freezeSize = '1';
assert.strictEqual(window.cycleActiveToolSize(-1), false);
StudioState.mosaicData.subtilesPerSide = 2;
StudioState.freezeSize = '2';
assert.strictEqual(window.cycleActiveToolSize(1), false);
StudioState.mosaicData.subtilesPerSide = N;
StudioState.activeTool = 'stamp';
StudioState.brushSnapToBlock = false;
StudioState.brushSizeMode = 'custom';
StudioState.supertilePattern = window.MosaicEngine.createSupertilePattern(2, 5, 2, 'id');
window.selectBrushTile(2);
assert.strictEqual(sizeValEl.textContent, '2×5');
assert.strictEqual(document.getElementById('activeBrushBadge').textContent, 'Aguardando captura');
window.cycleActiveToolSize(1);
assert.strictEqual(StudioState.brushSizeMode, '6');
assert.strictEqual(document.getElementById('btnBrushSizeDec').disabled, false);
window.setBrushSizeMode('1');
assert.strictEqual(document.getElementById('btnBrushSizeDec').disabled, true);
console.log('✓ Rotate, freeze, rectangular stamps and boundary feedback share consistent sizing.');

// Regression: clone sessions and painter sessions do not overwrite one another.
window.activateStudioTool('paint');
window.selectBrushTile(2);
window.setBrushSizeMode('2');
window.activateStudioTool('stamp');
assert.strictEqual(StudioState.stampInteractionMode, 'apply');
StudioState.mosaicData.grid[1][1].cells[0][0] = {baseTileId:67,tileId:67,transform:'id'};
window.startCanvasRegionCaptureDrag({row:1,col:1,subRow:0,subCol:0});
window.updateCaptureDragBounds({row:1,col:1,subRow:1,subCol:2});
assert.strictEqual(window.finishCanvasRegionCapture(), true);
assert.strictEqual(StudioState.stampInteractionMode, 'apply');
assert.strictEqual(StudioState.supertilePattern.rows, 2);
assert.strictEqual(StudioState.supertilePattern.cols, 3);
assert.strictEqual(document.getElementById('activeBrushBadge').textContent, '2×3');
const capturedClone = JSON.parse(JSON.stringify(StudioState.supertilePattern));
window.activateStudioTool('paint');
assert.strictEqual(StudioState.brushSizeMode, '2');
assert.strictEqual(StudioState.supertilePattern.rows, 2);
assert.strictEqual(StudioState.supertilePattern.cols, 2);
window.selectBrushTile(40);
window.activateStudioTool('stamp');
assert.deepStrictEqual(StudioState.supertilePattern, capturedClone);
assert.strictEqual(StudioState.stampInteractionMode, 'apply');
window.beginCloneCapture();
window.startCanvasRegionCaptureDrag({row:0,col:0,subRow:0,subCol:0});
window.cancelCloneCapture();
assert.strictEqual(window.finishCanvasRegionCapture(), false);
assert.deepStrictEqual(StudioState.supertilePattern, capturedClone);
assert.strictEqual(StudioState.stampInteractionMode, 'apply');
// Cancelling mid-gesture by switching tools prevents a later mouseup from capturing.
window.beginCloneCapture();
window.startCanvasRegionCaptureDrag({row:0,col:0,subRow:0,subCol:0});
StudioState.isPaintingDrag = true;
window.activateStudioTool('rotate');
assert.strictEqual(StudioState.isSelectingStampDrag, false);
assert.strictEqual(StudioState.isPaintingDrag, false);
assert.strictEqual(window.finishCanvasRegionCapture(), false);
assert.strictEqual(document.body.dataset.cursorMode, 'rotate');
window.activateStudioTool('stamp');
assert.strictEqual(StudioState.stampInteractionMode, 'apply', 'Returning after interrupted capture should resume the existing clone');
window.cancelCloneCapture();
assert.deepStrictEqual(StudioState.supertilePattern, capturedClone);
StudioState.brushSnapToBlock = true;
window.startCanvasRegionCaptureDrag({row:2,col:3,subRow:1,subCol:1});
window.updateCaptureDragBounds({row:0,col:1,subRow:1,subCol:1});
assert.deepStrictEqual([StudioState.stampDragStartGR,StudioState.stampDragStartGC,
  StudioState.stampDragCurrGR,StudioState.stampDragCurrGC],[0,4,11,15]);
window.cancelCloneCapture();
window.activateStudioTool('zoom');
StudioState.isAltDown = true;
window.syncCanvasCursor();
assert.strictEqual(document.body.dataset.cursorMode, 'zoom-out');
StudioState.isSpaceDown = true;
window.syncCanvasCursor();
assert.strictEqual(document.body.dataset.cursorMode, 'grab');
StudioState.isSpaceDown = false; StudioState.isAltDown = false;
window.activateStudioTool('paint');
assert.strictEqual(StudioState.editBrushTileId, 40);
console.log('✓ Clone capture/cancel, independent brushes, reverse block selection and cursor priorities verified.');

// Small wheel events accumulate; reversing direction must not inherit old input.
StudioState.brushSnapToBlock = false;
window.setBrushSizeMode('2');
assert.strictEqual(window.stepToolSizeFromWheel({deltaY:-20,timeStamp:1000}), false);
assert.strictEqual(window.stepToolSizeFromWheel({deltaY:-25,timeStamp:1010}), true);
assert.strictEqual(StudioState.brushSizeMode, '3');
window.stepToolSizeFromWheel({deltaY:-20,timeStamp:1020});
assert.strictEqual(window.stepToolSizeFromWheel({deltaY:25,timeStamp:1030}), false);
window.stepToolSizeFromWheel({deltaY:20,timeStamp:1040});
assert.strictEqual(StudioState.brushSizeMode, '2');
StudioState.editScope = 'same_tile';
window.syncCanvasCursor();
assert.strictEqual(document.body.dataset.cursorMode, 'unavailable');
StudioState.editScope = 'single';
console.log('✓ Wheel normalization and unavailable-action cursor verified.');

// Alt-capture enters clone before replacing the live pattern, retaining the painter.
let storedBrushPayload = null;
global.localStorage.setItem = (_key, value) => { storedBrushPayload = JSON.parse(value); };
window.activateStudioTool('paint');
window.selectBrushTile(40);
window.setBrushSizeMode('2');
const painterBeforeAlt = JSON.parse(JSON.stringify(StudioState.supertilePattern));
window.startCanvasRegionCaptureDrag({row:1,col:1,subRow:0,subCol:0});
assert.strictEqual(StudioState.activeTool, 'stamp', 'Alt-style region capture must use the clone session');
window.finishCanvasRegionCapture();
const cloneAfterAlt = JSON.parse(JSON.stringify(StudioState.supertilePattern));
window.activateStudioTool('paint');
assert.deepStrictEqual(StudioState.supertilePattern, painterBeforeAlt, 'Painter must not inherit the Alt capture');
assert.strictEqual(StudioState.editBrushTileId, 40);
assert.strictEqual(StudioState.brushSizeMode, '2');
window.activateStudioTool('stamp');
assert.deepStrictEqual(StudioState.supertilePattern, cloneAfterAlt);
assert.ok(storedBrushPayload.brushToolSessions.paint && storedBrushPayload.brushToolSessions.stamp,
  'Actual studio payload must save both brushes');
const savedSessions = JSON.parse(JSON.stringify(storedBrushPayload.brushToolSessions));
// A reload rebuilds the cache from persisted sessions, including while clone is active.
window.restoreBrushToolSessions(savedSessions);
window.activateStudioTool('paint');
assert.deepStrictEqual(StudioState.supertilePattern, painterBeforeAlt);
window.activateStudioTool('stamp');
assert.deepStrictEqual(StudioState.supertilePattern, cloneAfterAlt);
// Legacy save: it may claim paint while holding clone geometry, with no paint cache.
window.restoreBrushToolSessions(undefined);
StudioState.activeTool = 'paint';
StudioState.supertilePattern = JSON.parse(JSON.stringify(cloneAfterAlt));
StudioState.stampBlock = StudioState.supertilePattern;
window.activateStudioTool('paint');
assert.strictEqual(StudioState.supertilePattern.rows, 1);
assert.strictEqual(StudioState.supertilePattern.cols, 1);
assert.strictEqual(StudioState.editBrushTileId, 2);
window.activateStudioTool('stamp');
assert.deepStrictEqual(StudioState.supertilePattern, cloneAfterAlt, 'Legacy recovery must retain the captured clone');
console.log('✓ Alt capture, persistent brush separation and legacy clone-contaminated paint saves verified.');

// Real editor workflow: palette picks ink, canvas paints individual cells,
// resize preserves artwork, local undo/redo works, Cancel restores the original.
window.activateStudioTool('paint');
window.selectBrushTile(2);
window.setBrushSizeMode('2');
const originalEditorBrush = JSON.parse(JSON.stringify(StudioState.supertilePattern));
const editorBody = document.getElementById('panelEditBrushBody');
let restoredEditorBody = false;
editorBody.parentNode = {insertBefore: () => {restoredEditorBody = true;}};
editorBody.nextSibling = null;
window.openBrushEditor();
const editorCanvas = document.getElementById('supertileBuilderCanvas');
assert.strictEqual(editorCanvas.width, 576);
window.selectBrushTile(67);
assert.deepStrictEqual(StudioState.supertilePattern, originalEditorBrush, 'Palette must not fill the whole editor brush');
window.handleMiniBuilderCanvasMouse({clientX:100,clientY:100,button:0});
assert.strictEqual(StudioState.supertilePattern.cells[0][0].baseTileId,67);
assert.strictEqual(StudioState.supertilePattern.cells[1][1].baseTileId,2);
const beforeSample = JSON.parse(JSON.stringify(StudioState.supertilePattern));
window.selectBrushTile(40);
window.handleMiniBuilderCanvasMouse({clientX:100,clientY:100,button:0,altKey:true});
assert.strictEqual(StudioState.editBrushTileId,67);
assert.deepStrictEqual(StudioState.supertilePattern,beforeSample,'Alt sampling must not paint');
window.resizeBrushEditorGrid(2,3);
assert.strictEqual(StudioState.supertilePattern.cols,3);
assert.strictEqual(StudioState.supertilePattern.cells[0][0].baseTileId,67);
assert.strictEqual(StudioState.supertilePattern.cells[0][2].baseTileId,84);
window.stepBrushEditorHistory(-1);
assert.strictEqual(StudioState.supertilePattern.cols,2);
window.stepBrushEditorHistory(-1);
assert.deepStrictEqual(StudioState.supertilePattern, originalEditorBrush);
window.stepBrushEditorHistory(1);
assert.strictEqual(StudioState.supertilePattern.cells[0][0].baseTileId,67);
window.closeBrushEditor(false);
assert.deepStrictEqual(StudioState.supertilePattern, originalEditorBrush);
assert.strictEqual(StudioState.editBrushTileId,2);
assert.strictEqual(editorCanvas.width,104);
assert.strictEqual(restoredEditorBody,true);
window.openBrushEditor();
window.selectBrushTile(84);
window.handleMiniBuilderCanvasMouse({clientX:100,clientY:100,button:0});
window.closeBrushEditor();
assert.strictEqual(StudioState.supertilePattern.cells[0][0].baseTileId,84);
assert.strictEqual(StudioState.supertilePattern.cells[1][1].baseTileId,2);
console.log('✓ Expanded brush editing: ink selection, painting, rectangular resize, undo/redo, erasing and cancel/commit verified.');

// Clone's ordinary click applies; Alt is the primary capture modifier.
const paintBeforeAltGesture = JSON.parse(JSON.stringify(StudioState.supertilePattern));
window.restoreBrushToolSessions(undefined);
window.activateStudioTool('stamp');
assert.strictEqual(StudioState.stampInteractionMode, 'apply');
global.mouseX = StudioState.margin + 20;
global.mouseY = StudioState.margin + 20;
window.handleCanvasMouseDown({button:0,altKey:false,preventDefault(){}});
assert.strictEqual(StudioState.isSelectingStampDrag,false, 'A normal click must not silently enter capture');
assert.strictEqual(document.getElementById('activeBrushBadge').textContent,'Aguardando captura');
window.handleCanvasMouseDown({button:0,altKey:true,preventDefault(){}});
assert.strictEqual(StudioState.isSelectingStampDrag,true);
assert.strictEqual(document.body.dataset.cursorMode,'capture');
window.finishCanvasRegionCapture();
assert.strictEqual(StudioState.stampInteractionMode,'apply');
assert.strictEqual(document.body.dataset.cursorMode,'clone');
window.activateStudioTool('paint');
assert.deepStrictEqual(StudioState.supertilePattern,paintBeforeAltGesture);
console.log('✓ Clone uses Alt capture and resumes apply without replacing the painter.');
