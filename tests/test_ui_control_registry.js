// tests/test_ui_control_registry.js
// Validates that all 58 frozen UI control IDs from Annex A exist exactly once in index.html.

const fs = require('fs');
const path = require('path');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

const htmlPath = path.join(baseDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing UI Control Registry (58 IDs) ---');

const expectedIds = [
  "canvasW", "btnSwapCanvasSize", "canvasH", "btnLockCanvasRatio", "btnFitCanvasToGrid",
  "gridRows", "btnSwapGridSize", "gridCols", "btnLockGridRatio", "btnSquareGrid", "gridMargin",
  "seedInput", "btnRandomize", "btnPrevSeed", "btnNextSeed", "btnToggleHistory",
  "exportFormatSelect", "btnExport",
  "toolInspect", "toolPaint", "toolRotate", "toolStamp", "toolPan", "toolZoom",
  "bgColorPicker", "fgColorPicker", "btnSwapColors",
  "toggleGuideAxes", "toggleGuideBlocks", "toggleGuideSubtiles", "toggleGuideOrbits",
  "btnFitArtboard", "btnToggleRightDock",
  "btnZoomOut", "zoomPresetSelect", "btnZoomIn", "btnZoomReset100", "btnHelp",
  "btnMakeGridEqual", "paddingSlider", "tileSearchInput", "btnSelectAllTiles", "btnSelectNoTiles",
  "btnInvertTiles", "btnRandomFamilies",
  "btnEditUndo", "btnEditRedo", "btnD4Undo", "btnD4Continue",
  "btnBrushRot90", "btnBrushFlipX", "btnBrushFlipY", "btnBrushResetD4",
  "btnSupertileFillAll", "btnSupertileSymmetrize", "btnSupertileCapture",
  "editBrushSearchInput", "infoPopoverClose"
];

if (expectedIds.length !== 58) {
  throw new Error(`Expected exactly 58 IDs in registry list, got ${expectedIds.length}`);
}

const missing = [];
const duplicates = [];

for (const id of expectedIds) {
  // Regex to match id="foo" or id='foo'
  const re = new RegExp(`id=["']${id}["']`, 'g');
  const matches = html.match(re);
  if (!matches || matches.length === 0) {
    missing.push(id);
  } else if (matches.length > 1) {
    duplicates.push(`${id} (${matches.length}x)`);
  }
}

if (missing.length > 0) {
  throw new Error(`Missing required UI control IDs in index.html: ${missing.join(', ')}`);
}

if (duplicates.length > 0) {
  throw new Error(`Duplicate UI control IDs found in index.html: ${duplicates.join(', ')}`);
}

console.log(`✓ All 58 control IDs exist exactly once in index.html.`);
console.log('--- ALL UI CONTROL REGISTRY CHECKS PASSED! ---');
