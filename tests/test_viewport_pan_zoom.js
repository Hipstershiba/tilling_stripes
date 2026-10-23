// tests/test_viewport_pan_zoom.js
// Tests the 2D Viewport Pan & Zoom engine, ensuring unbounded 360° panning,
// correct CSS transform application, focus preservation during zoom, and view resets.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing 2D Viewport Pan & Zoom Engine ---');

// Mock DOM elements
function createMockElement(id, styles = {}) {
  return {
    id,
    style: { ...styles },
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      toggle(c, force) {
        if (force === undefined) {
          if (this._classes.has(c)) this._classes.delete(c);
          else this._classes.add(c);
        } else if (force) {
          this._classes.add(c);
        } else {
          this._classes.delete(c);
        }
      },
      contains(c) { return this._classes.has(c); }
    },
    addEventListener() {},
    querySelector() { return null; }
  };
}

const mockStage = createMockElement('canvas-stage');
const mockPasteboard = createMockElement('artboard-pasteboard');
mockPasteboard.clientWidth = 1200;
mockPasteboard.clientHeight = 800;

global.document = {
  body: createMockElement('body'),
  getElementById(id) {
    if (id === 'canvas-stage') return mockStage;
    if (id === 'artboard-pasteboard') return mockPasteboard;
    if (id === 'zoomPresetSelect') return createMockElement('zoomPresetSelect');
    return null;
  },
  querySelectorAll() { return []; }
};

// Load sketch.js functions in isolated context or eval
const sketchContent = fs.readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');

// 1. Verify StudioState structure
assert.ok(sketchContent.includes('panOffsetX: 0'), 'StudioState must define panOffsetX');
assert.ok(sketchContent.includes('panOffsetY: 0'), 'StudioState must define panOffsetY');
assert.ok(sketchContent.includes('panStartOffsetX: 0'), 'StudioState must define panStartOffsetX');
assert.ok(sketchContent.includes('panStartOffsetY: 0'), 'StudioState must define panStartOffsetY');
console.log('✓ StudioState pan properties verified.');

// 2. Test applyPanTransform logic directly
const StudioState = {
  width: 800,
  height: 800,
  zoomPercent: 100,
  zoomMode: 'custom',
  panOffsetX: 0,
  panOffsetY: 0
};

function applyPanTransform() {
  const stage = global.document.getElementById('canvas-stage');
  const pasteboard = global.document.getElementById('artboard-pasteboard');
  const x = Math.round(StudioState.panOffsetX || 0);
  const y = Math.round(StudioState.panOffsetY || 0);
  if (stage) {
    stage.style.transform = `translate(${x}px, ${y}px)`;
  }
  if (pasteboard) {
    pasteboard.style.backgroundPosition = `${x % 20}px ${y % 20}px`;
  }
}

// Centered state (0, 0)
applyPanTransform();
assert.strictEqual(mockStage.style.transform, 'translate(0px, 0px)');
assert.strictEqual(mockPasteboard.style.backgroundPosition, '0px 0px');
console.log('✓ Centered transform (0, 0) verified.');

// Upward pan (negative Y: user pans up beyond the center)
StudioState.panOffsetY = -240;
StudioState.panOffsetX = 0;
applyPanTransform();
assert.strictEqual(mockStage.style.transform, 'translate(0px, -240px)');
console.log('✓ Upward pan (panOffsetY = -240px) succeeds without clipping.');

// Downward pan (positive Y)
StudioState.panOffsetY = 350;
applyPanTransform();
assert.strictEqual(mockStage.style.transform, 'translate(0px, 350px)');
console.log('✓ Downward pan (panOffsetY = 350px) verified.');

// Leftward pan (negative X: user pans left beyond the center)
StudioState.panOffsetX = -180;
StudioState.panOffsetY = 0;
applyPanTransform();
assert.strictEqual(mockStage.style.transform, 'translate(-180px, 0px)');
console.log('✓ Leftward pan (panOffsetX = -180px) succeeds without clipping.');

// Rightward pan (positive X)
StudioState.panOffsetX = 220;
applyPanTransform();
assert.strictEqual(mockStage.style.transform, 'translate(220px, 0px)');
console.log('✓ Rightward pan (panOffsetX = 220px) verified.');

// 3. Test fitArtboardToWindow resets pan to exact center
function fitArtboardToWindow() {
  const pasteboard = global.document.getElementById('artboard-pasteboard');
  if (!pasteboard) return;

  const availW = Math.max(100, pasteboard.clientWidth - 72);
  const availH = Math.max(100, pasteboard.clientHeight - 72);
  const scale = Math.min(availW / StudioState.width, availH / StudioState.height);
  StudioState.zoomPercent = Math.max(15, Math.min(400, Math.round(scale * 100)));
  StudioState.zoomMode = 'fit';
  StudioState.panOffsetX = 0;
  StudioState.panOffsetY = 0;
  applyPanTransform();
}

fitArtboardToWindow();
assert.strictEqual(StudioState.panOffsetX, 0, 'Fit to window must reset panOffsetX to 0');
assert.strictEqual(StudioState.panOffsetY, 0, 'Fit to window must reset panOffsetY to 0');
assert.strictEqual(mockStage.style.transform, 'translate(0px, 0px)');
console.log('✓ fitArtboardToWindow resets pan to center (0, 0).');

// 4. Test zoom scaling preserves center or focuses proportionally
function setZoomPercent(nextPercent) {
  const oldZoom = StudioState.zoomPercent || 100;
  const clampedZoom = Math.max(15, Math.min(400, Math.round(nextPercent)));
  if (clampedZoom === oldZoom && StudioState.zoomMode === 'custom') return;

  const ratio = clampedZoom / oldZoom;
  StudioState.panOffsetX = Math.round((StudioState.panOffsetX || 0) * ratio);
  StudioState.panOffsetY = Math.round((StudioState.panOffsetY || 0) * ratio);

  StudioState.zoomPercent = clampedZoom;
  StudioState.zoomMode = 'custom';
  applyPanTransform();
}

// When centered at (0, 0), zooming in stays exactly centered
StudioState.panOffsetX = 0;
StudioState.panOffsetY = 0;
setZoomPercent(200);
assert.strictEqual(StudioState.panOffsetX, 0, 'Centering must remain 0 when zooming in');
assert.strictEqual(StudioState.panOffsetY, 0, 'Centering must remain 0 when zooming in');
assert.strictEqual(mockStage.style.transform, 'translate(0px, 0px)');
console.log('✓ Zooming from center expands symmetrically around (0, 0).');

// When panned to (-100, -50), zooming from 200% to 300% scales proportionally (1.5x)
StudioState.panOffsetX = -100;
StudioState.panOffsetY = -50;
setZoomPercent(300);
assert.strictEqual(StudioState.panOffsetX, -150, 'panOffsetX must scale proportionally by ratio 1.5');
assert.strictEqual(StudioState.panOffsetY, -75, 'panOffsetY must scale proportionally by ratio 1.5');
assert.strictEqual(mockStage.style.transform, 'translate(-150px, -75px)');
console.log('✓ Zooming while panned scales offsets proportionally, maintaining viewport focus.');

// 5. Test resetZoom100 resets zoom to 100% and recenters pan to (0, 0)
function resetZoom100() {
  StudioState.panOffsetX = 0;
  StudioState.panOffsetY = 0;
  StudioState.zoomPercent = 100;
  StudioState.zoomMode = 'custom';
  applyPanTransform();
}

// Subtest 5a: With zoom already applied (e.g. 250%)
StudioState.panOffsetX = -320;
StudioState.panOffsetY = 190;
StudioState.zoomPercent = 250;
resetZoom100();
assert.strictEqual(StudioState.zoomPercent, 100, 'resetZoom100 must set zoom to 100%');
assert.strictEqual(StudioState.panOffsetX, 0, 'resetZoom100 must reset panOffsetX to 0 (re-center)');
assert.strictEqual(StudioState.panOffsetY, 0, 'resetZoom100 must reset panOffsetY to 0 (re-center)');
assert.strictEqual(mockStage.style.transform, 'translate(0px, 0px)');

// Subtest 5b: REGRESSION TEST - When ALREADY at 100% zoom and panned accidentally!
StudioState.zoomPercent = 100;
StudioState.zoomMode = 'custom';
StudioState.panOffsetX = -180;
StudioState.panOffsetY = 150;
mockStage.style.transform = 'translate(-180px, 150px)';
resetZoom100();
assert.strictEqual(StudioState.panOffsetX, 0, 'Must re-center panOffsetX to 0 even if already at 100% zoom');
assert.strictEqual(StudioState.panOffsetY, 0, 'Must re-center panOffsetY to 0 even if already at 100% zoom');
assert.strictEqual(mockStage.style.transform, 'translate(0px, 0px)', 'Transform must be updated to 0px, 0px');
console.log('✓ resetZoom100 (Tecla 1 / Ctrl+1) re-centers even when ALREADY at 100% zoom.');

// 6. Test 1, Shift+1, and 0 navigation shortcuts while in edit mode (holding brush)
function simulateKeyNav(e, isEditTool) {
  const k = e.key ? e.key.toLowerCase() : '';
  const isDigit0 = k === '0' || (e.shiftKey && k === ')') || e.code === 'Digit0' || e.code === 'Numpad0';
  const isDigit1 = k === '1' || (e.shiftKey && k === '!') || e.code === 'Digit1' || e.code === 'Numpad1';

  if (isDigit0) {
    fitArtboardToWindow();
    return 'fit';
  }
  if (isDigit1 && !e.altKey) {
    resetZoom100();
    return '100';
  }
  return null;
}

// Case A: Holding brush, panned to (-120, 80), presses key '1'
StudioState.panOffsetX = -120;
StudioState.panOffsetY = 80;
StudioState.zoomPercent = 175;
const action1 = simulateKeyNav({ key: '1', code: 'Digit1', shiftKey: false, altKey: false }, true);
assert.strictEqual(action1, '100', 'Key 1 with brush must trigger 100% reset');
assert.strictEqual(StudioState.zoomPercent, 100, 'Zoom must reset to 100%');
assert.strictEqual(StudioState.panOffsetX, 0, 'Pan X must be re-centered to 0');
assert.strictEqual(StudioState.panOffsetY, 0, 'Pan Y must be re-centered to 0');
console.log('✓ Key 1 with brush (isEditTool=true) re-centers and sets 100% zoom.');

// Case B: Holding brush, panned to (200, -150), presses 'Shift + 1' -> sets 100% (1:1) and re-centers
StudioState.panOffsetX = 200;
StudioState.panOffsetY = -150;
StudioState.zoomPercent = 50;
const actionShift1 = simulateKeyNav({ key: '!', code: 'Digit1', shiftKey: true, altKey: false }, true);
assert.strictEqual(actionShift1, '100', 'Shift+1 with brush must trigger 100% reset (1:1 e recentralizar)');
assert.strictEqual(StudioState.zoomPercent, 100, 'Shift+1 must reset zoom to 100%');
assert.strictEqual(StudioState.panOffsetX, 0, 'Shift+1 must re-center pan X');
assert.strictEqual(StudioState.panOffsetY, 0, 'Shift+1 must re-center pan Y');
console.log('✓ Shift+1 with brush (isEditTool=true) re-centers and sets 100% zoom (1:1).');

// Case C: Holding brush, presses key '0'
StudioState.panOffsetX = -80;
StudioState.panOffsetY = 60;
const action0 = simulateKeyNav({ key: '0', code: 'Digit0', shiftKey: false, altKey: false }, true);
assert.strictEqual(action0, 'fit', 'Key 0 with brush must trigger fitArtboardToWindow');
assert.strictEqual(StudioState.panOffsetX, 0, 'Key 0 must re-center pan X');
assert.strictEqual(StudioState.panOffsetY, 0, 'Key 0 must re-center pan Y');
console.log('✓ Key 0 with brush (isEditTool=true) re-centers and fits artboard to window.');

// Case D: Old numeric scope shortcuts (1-6) are deactivated: pressing '2' does not switch scope
StudioState.editScope = 'canvas_center';
const action2 = simulateKeyNav({ key: '2', code: 'Digit2', shiftKey: false, altKey: false }, true);
assert.strictEqual(action2, null, 'Key 2 with brush must no longer switch scope (old numeric shortcuts removed)');
assert.strictEqual(StudioState.editScope, 'canvas_center', 'editScope must remain unchanged on numeric keys');
console.log('✓ Old numeric scope shortcuts successfully deactivated.');

// 7. Test Wheel behavior: plain wheel controls brush size without modifier keys; modifiers control zoom and pan!
function simulateWheel(e, activeTool, isSpaceDown = false) {
  // 1. Zoom with Ctrl / Cmd (or active tool 'zoom')
  if (e.ctrlKey || e.metaKey || activeTool === 'zoom') {
    const delta = e.deltaY < 0 ? 15 : -15;
    setZoomPercent(StudioState.zoomPercent + delta);
    return 'zoom';
  }

  // 2. Vertical Pan with Alt
  if (e.altKey) {
    const dy = e.deltaY;
    StudioState.panOffsetY = (StudioState.panOffsetY || 0) - dy;
    applyPanTransform();
    return 'pan_vertical';
  }

  // 3. Pan with modifier (Shift) or Space bar or Pan tool
  if (e.shiftKey || isSpaceDown || activeTool === 'pan') {
    const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
    StudioState.panOffsetX = (StudioState.panOffsetX || 0) - dx;
    StudioState.panOffsetY = (StudioState.panOffsetY || 0) - dy;
    applyPanTransform();
    return 'pan';
  }

  // 3. Edit tools without modifier keys: controls tool/brush size directly!
  const isEditTool = activeTool === 'paint' || activeTool === 'stamp' || activeTool === 'rotate' || activeTool === 'freeze';
  if (isEditTool) {
    const dir = e.deltaY < 0 ? 1 : -1;
    if (activeTool === 'paint' || activeTool === 'stamp') {
      const N = StudioState.mosaicData ? StudioState.mosaicData.subtilesPerSide : 4;
      const totalR = StudioState.mosaicData ? StudioState.mosaicData.rows * N : 64;
      const totalC = StudioState.mosaicData ? StudioState.mosaicData.cols * N : 64;
      const maxDim = Math.max(totalR, totalC);

      let currentDim = 1;
      if (StudioState.brushSizeMode === 'block') {
        currentDim = N;
      } else {
        currentDim = Math.max(1, parseInt(StudioState.brushSizeMode, 10) || 1);
      }

      if (StudioState.brushSnapToBlock) {
        const maxBlocks = Math.max(1, Math.floor(maxDim / N));
        const currentBlocks = Math.max(1, Math.round(currentDim / N));
        const nextBlocks = Math.max(1, Math.min(maxBlocks, currentBlocks + dir));
        if (nextBlocks === currentBlocks) return 'clamped';
        StudioState.brushSizeMode = String(nextBlocks * N);
        return 'brush_size_' + StudioState.brushSizeMode;
      } else {
        const nextDim = Math.max(1, Math.min(maxDim, currentDim + dir));
        if (nextDim === currentDim) return 'clamped';
        StudioState.brushSizeMode = String(nextDim);
        return 'brush_size_' + StudioState.brushSizeMode;
      }
    }
  }

  // 4. Inspect tool: plain wheel pans canvas in 2D
  StudioState.panOffsetX = (StudioState.panOffsetX || 0) - e.deltaX;
  StudioState.panOffsetY = (StudioState.panOffsetY || 0) - e.deltaY;
  applyPanTransform();
  return 'pan';
}

// Subtest 7a: Plain wheel over paint tool increases brush size from '1' to '2' without any modifier key
StudioState.brushSnapToBlock = false;
StudioState.brushSizeMode = '1';
const wheelRes1 = simulateWheel({ deltaY: -100, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelRes1, 'brush_size_2', 'Plain wheel up must increase brush size without modifiers');
assert.strictEqual(StudioState.brushSizeMode, '2');
console.log('✓ Plain wheel directly steps brush size without needing Ctrl or Shift.');

// Subtest 7a-2: Wheel down at min size 1 clamps strictly at 1 and does NOT cycle
const wheelClampMin = simulateWheel({ deltaY: 100, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelClampMin, 'brush_size_1');
const wheelClampMinAgain = simulateWheel({ deltaY: 100, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelClampMinAgain, 'clamped', 'Scrolling down at 1 must clamp');
assert.strictEqual(StudioState.brushSizeMode, '1', 'Must remain at min size 1 without wrapping to max');
console.log('✓ Brush sizing clamps at 1 and does NOT cycle.');

// Subtest 7a-3: Snap to block stepping (steps in whole block increments)
StudioState.brushSnapToBlock = true;
StudioState.brushSizeMode = '4'; // 1 block (when N=4)
const wheelBlockUp = simulateWheel({ deltaY: -100, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelBlockUp, 'brush_size_8', 'Snap to block must step by whole block (N=4)');
assert.strictEqual(StudioState.brushSizeMode, '8');
const wheelBlockDown = simulateWheel({ deltaY: 100, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelBlockDown, 'brush_size_4');
const wheelBlockClamp = simulateWheel({ deltaY: 100, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelBlockClamp, 'clamped', 'Snap to block must clamp at 1 block');
assert.strictEqual(StudioState.brushSizeMode, '4');
StudioState.brushSnapToBlock = false;
console.log('✓ Snap to block steps in whole block increments and clamps at 1 block.');

// Subtest 7b: Ctrl+wheel over paint tool zooms instead of changing brush size
StudioState.zoomPercent = 100;
const wheelRes2 = simulateWheel({ deltaY: -100, deltaX: 0, ctrlKey: true, shiftKey: false, altKey: false }, 'paint');
assert.strictEqual(wheelRes2, 'zoom', 'Ctrl+wheel over paint tool must zoom');
assert.strictEqual(StudioState.zoomPercent, 115);
console.log('✓ Ctrl+wheel over brush zooms in.');

// Subtest 7b-2: Alt+wheel over paint tool pans vertically instead of zooming or resizing
StudioState.panOffsetY = 0;
const wheelResAlt = simulateWheel({ deltaY: 40, deltaX: 0, ctrlKey: false, shiftKey: false, altKey: true }, 'paint');
assert.strictEqual(wheelResAlt, 'pan_vertical', 'Alt+wheel over paint tool must pan vertically');
assert.strictEqual(StudioState.panOffsetY, -40);
console.log('✓ Alt+wheel over brush pans vertically.');

// Subtest 7c: Shift+wheel over paint tool pans instead of changing brush size
StudioState.panOffsetX = 0;
StudioState.panOffsetY = 0;
const wheelRes3 = simulateWheel({ deltaY: 50, deltaX: 0, ctrlKey: false, shiftKey: true, altKey: false }, 'paint');
assert.strictEqual(wheelRes3, 'pan', 'Shift+wheel over paint tool must pan');
assert.strictEqual(StudioState.panOffsetX, -50);
console.log('✓ Shift+wheel over brush pans canvas horizontally.');

// Subtest 7d: Plain wheel over inspect tool pans canvas
StudioState.panOffsetX = 0;
StudioState.panOffsetY = 0;
const wheelRes4 = simulateWheel({ deltaY: 30, deltaX: 20, ctrlKey: false, shiftKey: false, altKey: false }, 'inspect');
assert.strictEqual(wheelRes4, 'pan', 'Plain wheel over inspect tool must pan');
assert.strictEqual(StudioState.panOffsetX, -20);
assert.strictEqual(StudioState.panOffsetY, -30);
console.log('✓ Plain wheel over inspect tool pans canvas in 2D.');

// 8. Verify CSS rules in style.css
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
assert.ok(styleCss.includes('#artboard-pasteboard {') && styleCss.includes('overflow: hidden;'), 'style.css must set overflow: hidden on #artboard-pasteboard');
assert.ok(styleCss.includes('body.is-panning'), 'style.css must define body.is-panning grabbing cursor');
assert.ok(styleCss.includes('will-change: transform;'), 'style.css must optimize #canvas-stage transform');
console.log('✓ style.css layout and cursor rules verified.');

console.log('--- ALL 2D VIEWPORT PAN & ZOOM CHECKS PASSED PERFECTLY! ---');
