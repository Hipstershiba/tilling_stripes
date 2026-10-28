// tests/test_tile_studio_ui_contract.js
// Verifies Fase B contracts for Subtile Studio Mode (data-studio-mode="mosaic|tiles"),
// Group & Family Library Manager (CRUD, ordering, JSON inspect/import/export, #84 tombstone sync),
// D4 preview cell compositions, keyboard isolation, and viewport rendering.

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

console.log('--- Testing Subtile Studio UI & Library Manager Contract (Fase B) ---');

// ----------------------------------------------------------------------------
// 1. Static HTML, CSS & Script Order Contract
// ----------------------------------------------------------------------------
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'style.css'), 'utf8');
const sketchSrc = fs.readFileSync(path.join(baseDir, 'sketch.js'), 'utf8');

assert.ok(
  /<body[^>]*data-studio-mode="mosaic"/.test(html),
  'index.html <body> must start with data-studio-mode="mosaic"'
);

const requiredIds = [
  'btnStudioTilesMode',
  'btnSwatchesManageTiles',
  'topBarTilesControls',
  'tilePreviewModeGroup',
  'btnTileClipToggle',
  'btnTileTestInMosaic',
  'leftToolbarTilesPane',
  'btnRailNewSubtile',
  'btnRailDuplicateSubtile',
  'btnRailNewGroup',
  'toggleTileGuideGrid',
  'toggleTileGuideAxes',
  'toggleTileGuidePorts',
  'toggleTileGuidePadding',
  'btnExportLibraryJson',
  'btnImportLibraryJson',
  'btnResetLibraryDefaults',
  'dock-workspace-tiles',
  'panel-tile-d4-live',
  'tileLiveVariantsGrid',
  'panel-tile-library-mgr',
  'libMgrTreeContainer',
  'subtileConfirmDialog',
  'subtileImportDialog'
];

for (const id of requiredIds) {
  const matches = html.match(new RegExp(`\\bid=["']${id}["']`, 'g')) || [];
  assert.strictEqual(
    matches.length,
    1,
    `Expected exactly 1 occurrence of #${id} in index.html, found ${matches.length}`
  );
}
console.log(`✓ All ${requiredIds.length} Subtile Studio structural IDs exist uniquely in index.html.`);

// Ensure #leftToolbarTilesPane never uses .tool-btn[data-tool] (preserves the 7 canonical tool buttons)
const leftTilesPaneStart = html.indexOf('id="leftToolbarTilesPane"');
const leftAsideEnd = html.indexOf('</aside>', leftTilesPaneStart);
const leftTilesPaneHtml = html.slice(leftTilesPaneStart, leftAsideEnd);
assert.ok(
  !/data-tool=/.test(leftTilesPaneHtml),
  '#leftToolbarTilesPane must NOT add [data-tool] buttons inside #left-toolbar'
);
assert.ok(
  leftTilesPaneHtml.includes('subtile-rail-btn'),
  '#leftToolbarTilesPane must use .subtile-rail-btn for quick actions'
);

// Script load order: tile_registry.js -> ui_info.js -> subtile_studio_ui.js -> sketch.js
const idxRegistry = html.indexOf('core/tile_registry.js');
const idxInfo = html.indexOf('ui_info.js');
const idxSubtileUI = html.indexOf('core/subtile_studio_ui.js');
const idxSketch = html.indexOf('sketch.js');
assert.ok(
  idxRegistry > -1 && idxInfo > idxRegistry && idxSubtileUI > idxInfo && idxSketch > idxSubtileUI,
  'Script load order must be tile_registry.js < ui_info.js < subtile_studio_ui.js < sketch.js'
);
console.log('✓ Script loading order and #left-toolbar button isolation verified.');

// CSS mode rules
assert.ok(
  css.includes('body:not([data-studio-mode="tiles"]) .tiles-mode-only') &&
  css.includes('body[data-studio-mode="tiles"] .mosaic-mode-only'),
  'style.css must define .tiles-mode-only and .mosaic-mode-only visibility rules'
);
assert.ok(
  sketchSrc.includes('SubtileStudioUI.renderViewport') &&
  sketchSrc.includes('SubtileStudioUI.syncStudioStateWithLibraryEvent') &&
  sketchSrc.includes('SubtileStudioUI.handleKeyDown'),
  'sketch.js must wire SubtileStudioUI viewport, library sync, and keyboard isolation'
);
console.log('✓ style.css mode rules and sketch.js hooks verified.');

// ----------------------------------------------------------------------------
// 2. InfoUI Topic & Ctrl+E Shortcut Documentation
// ----------------------------------------------------------------------------
global.window = global.window || {};
require(path.join(baseDir, 'core/d4_symmetry.js'));
require(path.join(baseDir, 'core/vector_renderer.js'));
require(path.join(baseDir, 'core/d4_detect.js'));
require(path.join(baseDir, 'core/tile_library.js'));
require(path.join(baseDir, 'core/library_compiler.js'));
const LibraryStore = require(path.join(baseDir, 'core/library_store.js'));
const TileRegistry = require(path.join(baseDir, 'core/tile_registry.js'));
const MosaicEngine = require(path.join(baseDir, 'core/mosaic_engine.js'));
require(path.join(baseDir, 'ui_info.js'));
const SubtileStudioUI = require(path.join(baseDir, 'core/subtile_studio_ui.js'));

const topics = global.window.InfoUI && global.window.InfoUI.INFO_TOPICS;
assert.ok(topics && topics['subtile-library'], 'INFO_TOPICS must include "subtile-library"');
const shortcutsText = JSON.stringify(topics.shortcuts || {});
assert.ok(shortcutsText.includes('Ctrl+E'), 'INFO_TOPICS.shortcuts must document Ctrl+E');
console.log('✓ InfoUI "subtile-library" topic and Ctrl+E shortcut verified.');

// ----------------------------------------------------------------------------
// 3. Ordered Grouped Families & Built-in Immutability
// ----------------------------------------------------------------------------
LibraryStore.resetToDefaults();
assert.strictEqual(typeof TileRegistry.getOrderedGroupedFamilies, 'function');

const defaultGrouped = TileRegistry.getOrderedGroupedFamilies();
assert.strictEqual(defaultGrouped.length, 6, 'Default library must expose 6 canonical groups');
const totalDefaultFams = defaultGrouped.reduce((acc, g) => acc + g.families.length, 0);
assert.strictEqual(totalDefaultFams, 31, 'Default grouped tree must list all 31 built-in families');
assert.strictEqual(TileRegistry.TILE_FAMILIES_META.length, 31);
assert.strictEqual(TileRegistry.TILE_RENDERERS.length, 85);
assert.strictEqual(TileRegistry.getFamilyForTile(84).id, 'empty-tile');

// Create a custom group, duplicate a built-in into it, create a second custom family, and reorder
const customGrp = LibraryStore.createGroup({ name: 'Geometrias Autorais' });
const dup1 = LibraryStore.duplicateFamily('elbow-ribbon', {
  name: 'Curva Autoral A',
  groupId: customGrp.id
});
const created2 = LibraryStore.createFamily({
  name: 'Bloco Autoral B',
  groupId: customGrp.id
});

let groupedAfterAdd = TileRegistry.getOrderedGroupedFamilies();
const customEntry = groupedAfterAdd.find((g) => g.id === customGrp.id);
assert.ok(customEntry, 'Newly created custom group must appear in getOrderedGroupedFamilies()');
assert.deepStrictEqual(
  customEntry.families.map((f) => f.id),
  [dup1.family.id, created2.family.id],
  'Custom group families must appear in creation order initially'
);

// Reorder families within custom group (swap B before A)
LibraryStore.reorderFamiliesInGroup(customGrp.id, [created2.family.id, dup1.family.id]);
groupedAfterAdd = TileRegistry.getOrderedGroupedFamilies();
assert.deepStrictEqual(
  groupedAfterAdd.find((g) => g.id === customGrp.id).families.map((f) => f.id),
  [created2.family.id, dup1.family.id],
  'getOrderedGroupedFamilies() must respect reorderFamiliesInGroup uiOrder'
);

// Reorder custom group to the very top (index 0)
const allGrpIds = LibraryStore.getGroups().map((g) => g.id);
const movedGrpOrder = SubtileStudioUI.moveItemInArray(
  allGrpIds,
  allGrpIds.indexOf(customGrp.id),
  0
);
LibraryStore.reorderGroups(movedGrpOrder);
groupedAfterAdd = TileRegistry.getOrderedGroupedFamilies();
assert.strictEqual(
  groupedAfterAdd[0].id,
  customGrp.id,
  'getOrderedGroupedFamilies() must respect group order from LibraryStore'
);

// Cross-group move of dup1 into built-in 'grp-circles' group
LibraryStore.updateFamily(dup1.family.id, { groupId: 'grp-circles', uiOrder: 0 });
groupedAfterAdd = TileRegistry.getOrderedGroupedFamilies();
assert.ok(
  groupedAfterAdd.find((g) => g.id === 'grp-circles').families.some((f) => f.id === dup1.family.id),
  'Moved custom family must appear inside target group'
);

// Built-in slots 0..84 (#84 = empty-tile) must remain 100% intact!
assert.strictEqual(TileRegistry.getFamilyForTile(84).id, 'empty-tile');
for (let tid = 0; tid < 85; tid++) {
  assert.strictEqual(typeof TileRegistry.TILE_RENDERERS[tid], 'function');
}
console.log('✓ Group/family creation, reordering, cross-group move, and slots 0..84 immutability verified.');

// ----------------------------------------------------------------------------
// 4. Pure Helpers: inspectImportPayload, syncStudioStateWithLibraryEvent & Tombstone #84
// ----------------------------------------------------------------------------
const badJson = SubtileStudioUI.inspectImportPayload('{bad json');
assert.strictEqual(badJson.ok, false);

const missingFamilies = SubtileStudioUI.inspectImportPayload('{"version":1}');
assert.strictEqual(missingFamilies.ok, false);

const exportedCustomJson = LibraryStore.exportLibraryJSON({ customOnly: true });
const inspected = SubtileStudioUI.inspectImportPayload(exportedCustomJson);
assert.strictEqual(inspected.ok, true);
assert.strictEqual(inspected.customFamilyCount, 2);
assert.strictEqual(inspected.customGroupCount, 1);
console.log('✓ inspectImportPayload validation & custom pack summary verified.');

// Reset and test syncStudioStateWithLibraryEvent (auto-enrollment + #84 tombstone sanitization)
LibraryStore.resetToDefaults();
let trackedVariantKeys = new Set(LibraryStore.getCompiled().variantKeyToId.keys());
let lastLibEvent = null;
const unsub = LibraryStore.onChange((evt) => {
  lastLibEvent = evt;
});

const mockStudioState = {
  studioMode: 'mosaic',
  width: 800,
  height: 800,
  zoomPercent: 100,
  paddingRatio: 0.05,
  fgColor: '#f8fafc',
  bgColor: '#0f172a',
  allowedTiles: new Set([0, 1, 2, 3, 84]),
  editBrushTileId: 0,
  supertilePattern: {
    rows: 1,
    cols: 1,
    cells: [[{ tileId: 0, baseTileId: 0, transform: 'id' }]]
  },
  frozenCells: new Map(),
  mosaicData: MosaicEngine.generateMosaic({
    rows: 2,
    cols: 2,
    seed: 42,
    subdivision: 1,
    gridSymmetryMode: 'mandala_d4',
    blockSymmetryMode: 'mandala_d4',
    allowedTiles: new Set([0, 1, 2, 3, 6, 84])
  })
};

const dupCustom = LibraryStore.duplicateFamily('center-tee', { name: 'Junção T Custom' });
assert.ok(lastLibEvent, 'LibraryStore.onChange must fire on duplicateFamily');
const syncAdd = SubtileStudioUI.syncStudioStateWithLibraryEvent(mockStudioState, lastLibEvent, trackedVariantKeys);
trackedVariantKeys = syncAdd.variantKeys;

assert.strictEqual(
  syncAdd.enrolledTileIds.length,
  4,
  'Duplicating a 4-variant corner family must enroll 4 brand-new custom tileIds into allowedTiles'
);
for (const tid of dupCustom.meta.tileIds) {
  assert.ok(tid >= 85, 'Custom tileIds must be allocated at >= 85');
  assert.ok(mockStudioState.allowedTiles.has(tid), `Custom tileId #${tid} must be auto-enrolled in allowedTiles`);
}

// Paint custom tile into mosaicData, frozenCells, and active brush
const customTid = dupCustom.meta.tileIds[0];
mockStudioState.mosaicData.grid[0][0].cells[0][0] = {
  tileId: customTid,
  baseTileId: customTid,
  transform: 'id'
};
mockStudioState.mosaicData.grid[0][1].cells[0][1] = {
  tileId: dupCustom.meta.tileIds[1],
  baseTileId: customTid,
  transform: 'mx'
};
mockStudioState.frozenCells.set('0,0,0,0', {
  tileId: customTid,
  baseTileId: customTid,
  transform: 'id'
});
mockStudioState.editBrushTileId = customTid;
mockStudioState.supertilePattern = {
  rows: 1,
  cols: 1,
  cells: [[{ tileId: customTid, baseTileId: customTid, transform: 'id' }]]
};

const usage = SubtileStudioUI.countFamilyUsageInMosaic(mockStudioState, dupCustom.family.id);
assert.strictEqual(usage.mosaicCells, 2);
assert.strictEqual(usage.frozenCells, 1);
assert.strictEqual(usage.brushMatches, 1);
assert.strictEqual(usage.total, 4);

// Delete custom family -> verify tombstone #84 remap across mosaicData, frozenCells, brush, and allowedTiles
LibraryStore.deleteFamily(dupCustom.family.id);
const syncDel = SubtileStudioUI.syncStudioStateWithLibraryEvent(mockStudioState, lastLibEvent, trackedVariantKeys);
trackedVariantKeys = syncDel.variantKeys;

assert.strictEqual(syncDel.remapped, true, 'Deleting an active custom family must trigger StudioState remap');
assert.strictEqual(
  mockStudioState.mosaicData.grid[0][0].cells[0][0].tileId,
  84,
  'Deleted custom cell [0,0][0,0] must sanitize to canonical Empty Tile #84'
);
assert.strictEqual(
  mockStudioState.mosaicData.grid[0][1].cells[0][1].tileId,
  84,
  'Deleted custom cell [0,1][0,1] must sanitize to canonical Empty Tile #84'
);
assert.strictEqual(
  mockStudioState.frozenCells.get('0,0,0,0').tileId,
  84,
  'Frozen cell referencing deleted custom tile must sanitize to #84'
);
assert.ok(
  mockStudioState.editBrushTileId < 85,
  'Active brush tileId must fall back to a valid slot after deletion'
);
for (const tid of mockStudioState.allowedTiles) {
  assert.ok(tid >= 0 && tid < 85, `allowedTiles must drop out-of-range deleted ID #${tid}`);
}
unsub();
console.log('✓ Auto-enrollment of custom tileIds, usage counter, and #84 tombstone sanitization verified.');

// ----------------------------------------------------------------------------
// 5. D4 Preview Cell Compositions & Viewport Smoke Test
// ----------------------------------------------------------------------------
const prevSingle = SubtileStudioUI.computePreviewCells('single', 'r90');
assert.strictEqual(prevSingle.rows, 1);
assert.strictEqual(prevSingle.cells.length, 1);
assert.strictEqual(prevSingle.cells[0].transform, 'r90');
assert.strictEqual(prevSingle.cells[0].isMaster, true);

const prev3x3 = SubtileStudioUI.computePreviewCells('neighbors_3x3', 'mx');
assert.strictEqual(prev3x3.cells.length, 9);
assert.strictEqual(prev3x3.cells.filter((c) => c.isMaster).length, 1);
assert.strictEqual(prev3x3.cells.filter((c) => c.ghost).length, 8);
assert.ok(prev3x3.cells.find((c) => c.row === 1 && c.col === 1).isMaster);

const prevMandala = SubtileStudioUI.computePreviewCells('mandala_d4', 'id');
assert.deepStrictEqual(
  prevMandala.cells.map((c) => c.transform),
  ['id', 'mx', 'my', 'r180']
);

const prevRotC4 = SubtileStudioUI.computePreviewCells('rotational_c4', 'id');
assert.deepStrictEqual(
  prevRotC4.cells.map((c) => c.transform),
  ['id', 'r90', 'r270', 'r180']
);

// Mock p5 context for headless renderViewport verification
const mockP5 = {
  width: 800,
  height: 800,
  CLOSE: 'close',
  drawingContext: {
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    setLineDash() {}
  },
  color: (...args) => args,
  background() {},
  push() {},
  pop() {},
  translate() {},
  rotate() {},
  scale() {},
  fill() {},
  noFill() {},
  stroke() {},
  noStroke() {},
  strokeWeight() {},
  strokeCap() {},
  strokeJoin() {},
  rect() {},
  line() {},
  ellipse() {},
  arc() {},
  beginShape() {},
  vertex() {},
  bezierVertex() {},
  beginContour() {},
  endContour() {},
  endShape() {}
};

mockStudioState.studioMode = 'tiles';
SubtileStudioUI.state.selectedFamilyId = 'elbow-ribbon';
for (const mode of ['single', 'neighbors_3x3', 'mandala_d4', 'rotational_c4']) {
  SubtileStudioUI.state.previewMode = mode;
  SubtileStudioUI.renderViewport(mockP5, mockStudioState);
  assert.ok(SubtileStudioUI.state.lastMasterCellRect, `renderViewport(${mode}) must record lastMasterCellRect`);
}

const rect = SubtileStudioUI.state.lastMasterCellRect;
SubtileStudioUI.handleViewportMouseMoved(rect.cx, rect.cy, mockStudioState);
assert.ok(SubtileStudioUI.state.hoverNorm, 'Mouse inside master cell must populate hoverNorm');
assert.ok(Math.abs(SubtileStudioUI.state.hoverNorm.nx) < 1e-6);
assert.ok(Math.abs(SubtileStudioUI.state.hoverNorm.ny) < 1e-6);

const statusTexts = SubtileStudioUI.getStatusBarTexts(mockStudioState);
assert.ok(statusTexts.artboard.includes('Subtile'));
assert.ok(statusTexts.hover.includes('+0.000'));
console.log('✓ D4 preview modes, headless renderViewport, and normalized hover inspector verified.');

// ----------------------------------------------------------------------------
// 6. Keyboard Shortcut Isolation in Tiles Mode
// ----------------------------------------------------------------------------
const makeKeyEvt = (key, opts = {}) => ({
  key,
  code: opts.code || '',
  ctrlKey: Boolean(opts.ctrlKey),
  metaKey: Boolean(opts.metaKey),
  shiftKey: Boolean(opts.shiftKey),
  altKey: Boolean(opts.altKey),
  prevented: false,
  preventDefault() {
    this.prevented = true;
  }
});

// In Mosaic mode: single-letter Mosaic shortcuts pass through (false)
mockStudioState.studioMode = 'mosaic';
assert.strictEqual(SubtileStudioUI.handleKeyDown(makeKeyEvt('g'), mockStudioState), false);
assert.strictEqual(SubtileStudioUI.handleKeyDown(makeKeyEvt('b'), mockStudioState), false);

// In Tiles mode: Mosaic-mutating shortcuts are intercepted (true), viewport pan/zoom pass through (false)
mockStudioState.studioMode = 'tiles';
for (const blockedKey of ['g', 'b', 'e', 'f', 'r', 's', 'v', 'q', 'Delete']) {
  const evt = makeKeyEvt(blockedKey);
  assert.strictEqual(
    SubtileStudioUI.handleKeyDown(evt, mockStudioState),
    true,
    `Key "${blockedKey}" must be isolated in tiles mode so Mosaic state is protected`
  );
}
assert.strictEqual(
  SubtileStudioUI.handleKeyDown(makeKeyEvt('z', { ctrlKey: true }), mockStudioState),
  true,
  'Ctrl+Z in tiles mode must not undo Mosaic edits in the background'
);
for (const passKey of ['h', 'z', '0', '1']) {
  assert.strictEqual(
    SubtileStudioUI.handleKeyDown(makeKeyEvt(passKey), mockStudioState),
    false,
    `Viewport navigation key "${passKey}" must pass through in tiles mode`
  );
}
assert.strictEqual(
  SubtileStudioUI.handleKeyDown(makeKeyEvt(' ', { code: 'Space' }), mockStudioState),
  false,
  'Spacebar pan must pass through in tiles mode'
);
console.log('✓ Keyboard shortcut isolation between Mosaic and Subtile Studio verified.');

LibraryStore.resetToDefaults();
console.log('--- ALL SUBTILE STUDIO UI & LIBRARY MANAGER CHECKS PASSED! ---');

// A protected built-in must still expose the disabled Pathfinder instead of hiding the feature.
const pathfinderVm = require('vm');
class PathfinderElement {
  constructor() {this.children=[];this.innerHTML='';}
  contains() {return false;}
  appendChild(child) {this.children.push(child);}
  querySelectorAll() {return [];}
}
const propsForPathfinder = new PathfinderElement(), visiblePathfinder = new PathfinderElement();
const pathfinderContext = {iconizePropertyActions(){},document:{activeElement:null,createElement:()=>new PathfinderElement(),getElementById:id=>({vecPropsContainer:propsForPathfinder,tilePathfinderContainer:visiblePathfinder}[id]||null)},
  resolveDeps:()=>({ve:{VECTOR_TOOLS:[{id:'select',label:'Seleção'}],state:{activeTool:'select',selectedShapeIds:[]}},vb:{}}),
  ensureValidSelection:()=>({builtIn:true,protected:true}),getSelectedFamilyDoc:()=>({id:'builtin',shapes:[]})};
const pathfinderSource = fs.readFileSync(path.join(baseDir,'core/subtile_studio_ui.js'),'utf8');
const pathfinderStart = pathfinderSource.indexOf('  function renderShapePropsPanel(');
pathfinderVm.createContext(pathfinderContext);
pathfinderVm.runInContext(pathfinderSource.slice(pathfinderStart,pathfinderSource.indexOf('\n  }',pathfinderStart)+4),pathfinderContext);
pathfinderContext.renderShapePropsPanel();
assert.equal(visiblePathfinder.children.length,1);
assert.notEqual(visiblePathfinder.children[0].hidden,true);
assert(visiblePathfinder.children[0].innerHTML.includes('Pathfinder'));
assert.equal((visiblePathfinder.children[0].innerHTML.match(/ disabled/g)||[]).length,4);
console.log('✓ Protected pieces keep Pathfinder discoverable with four disabled operations.');
