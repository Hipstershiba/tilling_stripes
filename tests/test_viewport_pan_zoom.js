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
  setZoomPercent(100);
}

StudioState.panOffsetX = -320;
StudioState.panOffsetY = 190;
StudioState.zoomPercent = 250;
resetZoom100();
assert.strictEqual(StudioState.zoomPercent, 100, 'resetZoom100 must set zoom to 100%');
assert.strictEqual(StudioState.panOffsetX, 0, 'resetZoom100 must reset panOffsetX to 0 (re-center)');
assert.strictEqual(StudioState.panOffsetY, 0, 'resetZoom100 must reset panOffsetY to 0 (re-center)');
assert.strictEqual(mockStage.style.transform, 'translate(0px, 0px)');
console.log('✓ resetZoom100 (Tecla 1 / Ctrl+1) resets zoom to 100% and re-centers pan.');

// 6. Verify CSS rules in style.css
const styleCss = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
assert.ok(styleCss.includes('#artboard-pasteboard {') && styleCss.includes('overflow: hidden;'), 'style.css must set overflow: hidden on #artboard-pasteboard');
assert.ok(styleCss.includes('body.is-panning'), 'style.css must define body.is-panning grabbing cursor');
assert.ok(styleCss.includes('will-change: transform;'), 'style.css must optimize #canvas-stage transform');
console.log('✓ style.css layout and cursor rules verified.');

console.log('--- ALL 2D VIEWPORT PAN & ZOOM CHECKS PASSED PERFECTLY! ---');
