// Exercise production document handlers and undo with real mosaic snapshots.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
global.window = {};
require('../core/d4_symmetry.js');
require('../core/tile_registry.js');
require('../core/mosaic_engine.js');
const DocumentSnapshot = require('../core/document_snapshot.js');
const engine = window.MosaicEngine;
const source = fs.readFileSync(require.resolve('../sketch.js'), 'utf8');
const fn = name => {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, name);
  return source.slice(start, source.indexOf('\n}', start) + 2);
};
function field(id) {
  const listeners = {};
  return {id, value: '', classList: {toggle() {}}, addEventListener(type, callback) {
    (listeners[type] ||= []).push(callback);
  }, fire(type, event = {}) { for (const cb of listeners[type] || []) cb(event); }};
}
const fields = Object.fromEntries(['canvasW','canvasH','btnSwapCanvasSize','btnLockCanvasRatio',
  'btnFitCanvasToGrid','gridRows','gridCols','btnSwapGridSize','btnLockGridRatio','btnSquareGrid',
  'gridMargin','paddingInput','fgColorPicker','bgColorPicker','btnSwapColors'].map(id => [id, field(id)]));
const state = {width: 800, height: 600, rows: 2, cols: 2, subdivision: 1, seed: 42,
  margin: 24, paddingRatio: .05, fgColor: '#ffffff', bgColor: '#111111',
  gridSymmetryMode: 'mandala_d4', blockSymmetryMode: 'mandala_d4', syncBlockSymmetry: true,
  allowedTiles: new Set([0, 1, 2, 84]), frozenCells: new Map(), editHistory: [], editHistoryIndex: -1};
state.mosaicData = engine.generateMosaic({...state, allowedTiles: [...state.allowedTiles]}, arr => arr[0]);
const calls = {resize: 0, save: 0, redraw: 0};
const context = {StudioState: state, window: {DocumentSnapshot, MosaicEngine: engine},
  document: {getElementById: id => fields[id], querySelectorAll: () => []},
  randomSeed() {}, random: n => 0, floor: Math.floor,
  saveStudioStateToStorage() {calls.save++;}, flushSaveStudioStateToStorage() {},
  saveScheduler: {schedule() {}}, redraw() {calls.redraw++;},
  syncFreezeUI() {}, syncD4Badge() {}, syncSymmetryPanelUI() {}, syncEditWorkspaceUI() {},
  renderSwatchesPanel() {}, renderEditBrushPalette() {}, renderSupertileBuilderCanvas() {},
  updateStatusBar() {}, applyZoomTransform() {calls.resize++;},
  getMaxEditHistoryForMosaic: () => 60, requestTopologyChange() {},
  LOCK_ICON_SVG: '', UNLOCK_ICON_SVG: ''};
vm.createContext(context);
vm.runInContext('let documentEditTransaction = null;\n' + [
  'buildDocumentSnapshot','restoreDocumentSnapshot','swapStudioColors','beginDocumentEdit',
  'commitDocumentEdit','cancelDocumentEdit','bindDocumentEditField','resetEditHistoryWithInitialSnapshot',
  'pushEditHistorySnapshot','undoMosaicEdit','redoMosaicEdit','syncEditUndoUI','syncAllInputsFromState'
].map(fn).join('\n'), context);
// Register the actual field handlers, without unrelated application setup.
const dimensionStart = source.indexOf('  // --- Artboard Size Controls ---');
const dimensionEnd = source.indexOf('  // --- Custom Stepper Buttons', dimensionStart);
const paddingStart = source.indexOf("  const paddingInput = document.getElementById('paddingInput');", dimensionEnd);
const paddingEnd = source.indexOf('  // --- Spout output ---', paddingStart);
const colorStart = source.indexOf("  const fgPicker = document.getElementById('fgColorPicker');", paddingEnd);
const colorEnd = source.indexOf('  // --- Swatches Bulk Controls ---', colorStart);
assert(colorStart > paddingEnd);
vm.runInContext(source.slice(dimensionStart, dimensionEnd) + source.slice(paddingStart, paddingEnd)
  + source.slice(colorStart, colorEnd), context);
context.resetEditHistoryWithInitialSnapshot();
const edit = (id, value, type = 'input') => { fields[id].value = value; fields[id].fire(type); };
const cells = () => JSON.stringify(engine.cloneMosaicCellsSnapshot(state.mosaicData, state.frozenCells));
const initialCells = cells();
// Thirty live events produce one step, then exact field and document restoration.
for (let i = 1; i <= 30; i++) edit('fgColorPicker', '#' + i.toString(16).padStart(6, '0'));
assert.equal(state.editHistory.length, 1);
fields.fgColorPicker.fire('change'); fields.fgColorPicker.fire('blur');
assert.equal(state.editHistory.length, 2);
context.undoMosaicEdit(); assert.equal(state.fgColor, '#ffffff'); assert.equal(fields.fgColorPicker.value, '#ffffff');
context.redoMosaicEdit(); assert.equal(state.fgColor, '#00001e');
context.swapStudioColors();
assert.equal(state.bgColor, '#00001e'); context.undoMosaicEdit(); assert.equal(state.fgColor, '#00001e');
context.redoMosaicEdit(); assert.equal(state.fgColor, '#111111');
// Appearance steps must survive a following stroke without rewinding appearance.
edit('paddingInput', 12); fields.paddingInput.fire('change');
const strokeTile = state.mosaicData.grid[0][0].cells[0][0].tileId === 84 ? 40 : 84;
state.mosaicData.grid[0][0].cells[0][0].tileId = strokeTile; context.pushEditHistorySnapshot();
context.undoMosaicEdit(); assert.equal(state.paddingRatio, .12);
context.undoMosaicEdit(); assert.equal(state.paddingRatio, .05); assert.equal(fields.paddingInput.value, 5);
context.redoMosaicEdit(); assert.equal(state.paddingRatio, .12);
// No-op and cancellation preserve the redo branch and don't add history.
const history = JSON.stringify(state.editHistory), index = state.editHistoryIndex;
edit('paddingInput', 12); fields.paddingInput.fire('change');
assert.equal(JSON.stringify(state.editHistory), history);
edit('paddingInput', 24);
let prevented = false;
fields.paddingInput.fire('keydown', {key: 'Escape', preventDefault() {prevented = true;}, stopPropagation() {}});
assert(prevented); assert.equal(state.paddingRatio, .12);
assert.equal(JSON.stringify(state.editHistory), history); assert.equal(state.editHistoryIndex, index);
context.redoMosaicEdit(); assert.equal(state.mosaicData.grid[0][0].cells[0][0].tileId, strokeTile);
// Margin preview, then dimension changes keep manual cells/preservations intact.
edit('gridMargin', 50); fields.gridMargin.fire('blur'); context.undoMosaicEdit(); assert.equal(state.margin, 24);
context.redoMosaicEdit(); assert.equal(state.margin, 50);
state.frozenCells.set('0,0,0,0', {tileId: 84, baseTileId: 84, transform: 'id'});
context.pushEditHistorySnapshot();
const editedCells = cells();
edit('canvasW', 1200, 'change'); assert.equal(state.width, 1200); assert.equal(cells(), editedCells);
context.undoMosaicEdit(); assert.equal(state.width, 800); assert.equal(fields.canvasW.value, 800);
context.redoMosaicEdit(); assert.equal(state.width, 1200); assert.equal(fields.canvasW.value, 1200);
assert.equal(cells(), editedCells); assert(calls.resize > 0);
// A new real edit after undo invalidates redo; navigation does not create steps.
context.undoMosaicEdit(); edit('bgColorPicker', '#123456'); fields.bgColorPicker.fire('change');
assert.equal(state.editHistoryIndex, state.editHistory.length - 1);
const count = state.editHistory.length;
state.zoomPercent = 150; state.activeTool = 'inspect'; context.pushEditHistorySnapshot();
assert.equal(state.editHistory.length, count);
// Old snapshots omit the new appearance fields and preserve current values.
DocumentSnapshot.applyParams(state, {rows: 2, paddingRatio: .1});
assert.equal(state.width, 800); assert.equal(state.bgColor, '#123456');
assert.notEqual(cells(), initialCells);
console.log('✓ Production appearance handlers: 30-event gesture, cancel/no-op, X, fields, dimensions, strokes, redo and legacy payload.');

// Regeneration after edits retains their document parameters on both sides.
context.resetD4BrokenState = () => {};
context.pushGenerationHistory = () => {};
vm.runInContext(fn('regenerateMosaic'), context);
// Return from the explicit legacy applyParams check to the rendered document.
state.paddingRatio = .12;
edit('gridMargin', 60); fields.gridMargin.fire('change');
const beforeGeneration = cells(), beforeGenerationIndex = state.editHistoryIndex;
state.seed = 77; context.regenerateMosaic(true);
assert.equal(state.editHistoryIndex, beforeGenerationIndex + 1);
context.undoMosaicEdit();
assert.equal(state.seed, 42); assert.equal(state.margin, 60); assert.equal(state.paddingRatio, .12);
assert.equal(state.width, 800); assert.equal(state.bgColor, '#123456'); assert.equal(cells(), beforeGeneration);
context.redoMosaicEdit(); assert.equal(state.seed, 77); assert.equal(state.margin, 60);
context.undoMosaicEdit(); context.undoMosaicEdit(); assert.equal(state.margin, 50);
console.log('✓ Generation after appearance/cell edits restores both document parameters and preserved cells.');

// A restored legacy current entry acquires parameters BEFORE its first generation.
context.window.TileRegistry = window.TileRegistry;
context.renderHistoryUI = () => {};
vm.runInContext(fn('restoreMosaicFromSavedState'), context);
state.editHistory = [engine.cloneMosaicCellsSnapshot(state.mosaicData, state.frozenCells)];
state.editHistoryIndex = 0; state.savedCellsSnapshot = state.editHistory[0];
state.lastDocumentParams = null;
context.restoreMosaicFromSavedState();
state.seed = 99; context.regenerateMosaic(true); context.undoMosaicEdit();
assert.equal(state.seed, 42); assert.equal(state.width, 800); assert.equal(state.bgColor, '#123456');
console.log('✓ Legacy restored current entry can undo the first generation after reload.');

// Existing family transactions include clipToTile, independent of mosaic undo.
const ve = require('../core/vector_editor.js');
const family = {id: 't05-clip', shapes: [], clipToTile: false};
const clipButton = field('btnTileClipToggle');
const store = {updateFamily(id, patch) { Object.assign(family, patch); return {family}; }};
const familyContext = {ve, store, document: {getElementById: () => clipButton},
  getSelectedFamilyMeta: () => family, getSelectedFamilyDoc: () => family,
  resolveDeps: () => ({store, ve}), refresh() {}, requestHostRedraw() {}};
const ui = fs.readFileSync(require.resolve('../core/subtile_studio_ui.js'), 'utf8');
vm.createContext(familyContext);
const clipStart = ui.indexOf("    document.getElementById('btnTileClipToggle')");
vm.runInContext(ui.slice(clipStart, ui.indexOf("    document.getElementById('btnTileTestInMosaic')", clipStart)), familyContext);
const undoStart = ui.indexOf('  function handleVecUndo()');
const redoEnd = ui.indexOf('\n  // ===', ui.indexOf('  function handleVecRedo()'));
vm.runInContext(ui.slice(undoStart, redoEnd), familyContext);
clipButton.fire('click'); assert.equal(family.clipToTile, true);
familyContext.handleVecUndo(); assert.equal(family.clipToTile, false);
familyContext.handleVecRedo(); assert.equal(family.clipToTile, true);
family.protected = true; clipButton.fire('click'); assert.equal(family.clipToTile, true);
console.log('✓ Production family clip button and undo/redo restore clipToTile and respect protection.');
