const assert = require('assert');
global.window = {};
const ve = require('../core/vector_editor.js');
ve.resetTransientForFamilySwitch('A');
ve.state.selectedShapeIds = ['s1'];
ve.state.selectedNodes = [{shapeId: 's1', nodeIndex: 0}];
ve.state.workingFamilyId = null;
ve.state.dragOp = {type: 'move'};
ve.state.penSession = {nodes: []};
ve.resetTransientForFamilySwitch('B');
assert.deepStrictEqual(ve.state.selectedShapeIds, []);
assert.deepStrictEqual(ve.state.selectedNodes, []);
assert.strictEqual(ve.state.dragOp, null);
assert.strictEqual(ve.state.penSession, null);
assert.strictEqual(ve.state.currentFamilyId, 'B');
ve.state.selectedShapeIds = ['s1'];
ve.resetTransientForFamilySwitch('B');
assert.deepStrictEqual(ve.state.selectedShapeIds, ['s1']);
const studio = require('../core/subtile_studio_ui.js');
const hostState = {studioMode: 'mosaic', activeTool: 'rotate', paddingRatio: 0.05};
studio.init({studioState: hostState, setActiveTool: tool => {hostState.activeTool = tool;}});
studio.openTilesStudio('elbow-ribbon');
assert.strictEqual(hostState.activeTool, 'inspect');
hostState.activeTool = 'pan';
studio.setVectorTool('select');
assert.strictEqual(hostState.activeTool, 'inspect');
hostState.activeTool = 'zoom';
studio.setVectorTool('rect');
assert.strictEqual(hostState.activeTool, 'inspect');
studio.setInspectorPanel('layers');
studio.setVectorTool('select');
assert.strictEqual(studio.state.inspectorPanel, 'layers', 'Selection preserves the layer workflow');
studio.setVectorTool('curve');
assert.strictEqual(studio.state.inspectorPanel, 'properties', 'Drawing tools reveal contextual options');
studio.closeTilesStudio();
assert.strictEqual(hostState.activeTool, 'rotate');
// A global mouseup over inspector controls must not rebuild/detach them before click.
hostState.studioMode = 'tiles';
ve.state.dragOp = null;
global.document = { getElementById() { throw new Error('Inspector must not rerender without a canvas gesture'); } };
assert.strictEqual(studio.handleViewportMouseUp(0, 0, {}, hostState), false);
delete global.document;
hostState.studioMode = 'mosaic';
// Inspector tabs preserve selection; Library navigation leaves the chosen editing tab intact.
const inspectorTabs = ['properties', 'layers', 'variants'].map(panel => ({
  dataset: {tilePanel: panel}, attrs: {}, setAttribute(k, v) {this.attrs[k] = v;}, focus() {this.focused = true;}
}));
const inspectorElements = {'dock-workspace-tiles': {dataset: {}, querySelectorAll: () => inspectorTabs}};
for (const id of ['panel-tile-layers', 'panel-tile-shape-props', 'panel-tile-d4-live']) inspectorElements[id] = {setAttribute() {}};
global.document = {getElementById: id => inspectorElements[id]};
let libraryOpened = 0;
global.window.WorkspaceNavigation = {openLibrary() { libraryOpened++; }};
ve.state.selectedShapeIds = ['first', 'second'];
studio.setInspectorPanel('layers', true);
assert.strictEqual(inspectorElements['panel-tile-layers'].hidden, false);
assert.strictEqual(inspectorElements['panel-tile-shape-props'].hidden, true);
assert.strictEqual(inspectorTabs[1].attrs['aria-selected'], 'true');
assert.strictEqual(inspectorTabs[1].tabIndex, 0);
assert.strictEqual(inspectorTabs[0].tabIndex, -1);
assert.strictEqual(inspectorTabs[1].focused, true);
studio.setInspectorPanel('library', true);
assert.strictEqual(libraryOpened, 1);
assert.strictEqual(studio.state.inspectorPanel, 'layers', 'Page navigation preserves the editing panel');
assert.deepStrictEqual(ve.state.selectedShapeIds, ['first', 'second']);
studio.setInspectorPanel('invalid');
assert.strictEqual(studio.state.inspectorPanel, 'layers');
delete global.window.WorkspaceNavigation;
delete global.document;

// --- Subtile Studio Navigation & Snap Invariants ---
// 1. Snapping on binary grid (div 4) does NOT attract to 1/6 ports unless explicitly asked
const snapBinaryNoPorts = ve.snapPoint(0.17, 0, { gridDiv: 4, snapPorts: false });
assert.strictEqual(snapBinaryNoPorts.u, 0.17, 'Point 0.17 must not snap to 1/6 when snapPorts is false');
const snapBinaryDiv = ve.snapPoint(0.24, 0, { gridDiv: 4, snapPorts: false });
assert.strictEqual(snapBinaryDiv.u, 0.25, 'Point 0.24 must snap to 1/4 grid line');

// 2. Default snap with div 4 excludes ports, while div 6 includes ports
const snapDefaultDiv4 = ve.snapPoint(0.17, 0, { gridDiv: 4 });
assert.strictEqual(snapDefaultDiv4.u, 0.17, 'Default snap with div 4 must not inject 1/6 port targets');
const snapDefaultDiv6 = ve.snapPoint(0.17, 0, { gridDiv: 6 });
assert.strictEqual(snapDefaultDiv6.u, 0.166667, 'Default snap with div 6 must snap to 1/6');

// 3. Navigation State sync: Pan and Zoom buttons
const navElements = {
  btnTileViewPan: { classList: new Set(), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } },
  btnTileViewZoom: { classList: new Set(), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }
};
navElements.btnTileViewPan.classList.toggle = function(cls, on) { on ? this.add(cls) : this.delete(cls); };
navElements.btnTileViewZoom.classList.toggle = function(cls, on) { on ? this.add(cls) : this.delete(cls); };
global.document = { getElementById: id => navElements[id] || null };

hostState.activeTool = 'pan';
studio.syncNavigationState();
assert.strictEqual(navElements.btnTileViewPan.attrs['aria-pressed'], 'true');
assert.strictEqual(navElements.btnTileViewZoom.attrs['aria-pressed'], 'false');

hostState.activeTool = 'zoom';
studio.syncNavigationState();
assert.strictEqual(navElements.btnTileViewPan.attrs['aria-pressed'], 'false');
assert.strictEqual(navElements.btnTileViewZoom.attrs['aria-pressed'], 'true');
delete global.document;

const fs = require('fs');
const htmlSource = fs.readFileSync(require.resolve('../index.html'), 'utf8');
assert(htmlSource.includes('id="btnTileViewPan"'), 'btnTileViewPan must exist in index.html');
assert(htmlSource.includes('id="btnTileViewZoom"'), 'btnTileViewZoom must exist in index.html');
assert(!htmlSource.includes('id="btnTileViewReset"'), 'btnTileViewReset must be removed as redundant');
assert(!htmlSource.includes('sidebar-section-title">Navegação</div>'), 'Navigation must stay in Ferramentas in both environments');
const toolGridStart = htmlSource.indexOf('id="vecToolsGrid"');
const toolGrid = htmlSource.slice(toolGridStart, htmlSource.indexOf('</div>', toolGridStart));
assert(toolGrid.includes('id="btnTileViewPan"') && toolGrid.includes('id="btnTileViewZoom"'),
  'Hand and Zoom must belong to the main tile tools grid');
assert(toolGrid.indexOf('id="btnTileViewPan"') > toolGrid.indexOf('id="vecToolCurve"'),
  'Navigation must follow drawing tools');
assert(/id="btnTileViewPan"[^>]*class="[^"]*tool-navigation-start/.test(toolGrid),
  'Hand must start the last navigation row so Hand and Zoom remain paired');
assert.strictEqual((htmlSource.match(/sidebar-section-title">Guias<\/div>/g) || []).length, 2,
  'Both toolbars must use the same short Guias heading');

const sketchSrc = fs.readFileSync(require.resolve('../sketch.js'), 'utf8');
assert(sketchSrc.includes("if (StudioState.studioMode === 'tiles')"), 'sketch.js must check tiles mode in wheel listener');
assert(sketchSrc.includes("setZoomPercent(StudioState.zoomPercent + delta)"), 'sketch.js must zoom on wheel in tiles mode');
assert(sketchSrc.includes("window.SubtileStudioUI?.syncNavigationState?.()"), 'sketch.js must sync navigation state');

const ui = fs.readFileSync(require.resolve('../core/subtile_studio_ui.js'), 'utf8');
const deleteFamilyFlow = ui.slice(ui.indexOf('  function handleDeleteFamily('), ui.indexOf('  function handleResetLibraryDefaults('));
assert(!deleteFamilyFlow.includes('backupLibrary()'), 'Deleting a family must not force a backup download or clear all vector histories');
assert(deleteFamilyFlow.includes('store.deleteFamily(familyId)'), 'Deletion must still use the store sanitization flow');
assert(!/[\u{1F441}\u{1F512}\u{1F513}]/u.test(ui));
assert(ui.includes('previousMosaicTool'));
assert(ui.includes("if (isTilesMode()) hostCtx.setActiveTool?.('inspect')"));
assert(/customOptions\.paddingRatio\s*:\s*0/.test(ui));
const sp = require('../core/state_persistence.js');
assert.strictEqual(sp.STORAGE_KEY_STUDIO_STATE, 'tiling_stripes_studio_v3_state');
assert.strictEqual(sp.IDB_DATABASE_NAME, 'TilingStripesDB_v1');
assert.strictEqual(sp.IDB_STORE_NAME, 'studio_state');
sp.resolveBootState({getItem: key => key === 'tiling_stripes_studio_state_v2' ? JSON.stringify({version: 3, timestamp: 10}) : null})
.then(result => {assert.strictEqual(result.payload.timestamp, 10); console.log('Subtile review regressions PASSED');})
.catch(err => {console.error(err); process.exitCode = 1;});
