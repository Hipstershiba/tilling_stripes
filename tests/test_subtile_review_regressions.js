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
studio.closeTilesStudio();
assert.strictEqual(hostState.activeTool, 'rotate');
// A global mouseup over inspector controls must not rebuild/detach them before click.
hostState.studioMode = 'tiles';
ve.state.dragOp = null;
global.document = { getElementById() { throw new Error('Inspector must not rerender without a canvas gesture'); } };
assert.strictEqual(studio.handleViewportMouseUp(0, 0, {}, hostState), false);
delete global.document;
hostState.studioMode = 'mosaic';
// Inspector tabs expose exactly one panel and retain the selection when switching.
const inspectorTabs = ['layers', 'properties', 'library', 'variants'].map(panel => ({
  dataset: {tilePanel: panel}, attrs: {}, setAttribute(k, v) {this.attrs[k] = v;}, focus() {this.focused = true;}
}));
const inspectorElements = {'dock-workspace-tiles': {dataset: {}, querySelectorAll: () => inspectorTabs}};
for (const id of ['panel-tile-layers', 'panel-tile-shape-props', 'panel-tile-library-mgr', 'panel-tile-d4-live']) {
  inspectorElements[id] = {setAttribute() {}};
}
global.document = {getElementById: id => inspectorElements[id]};
ve.state.selectedShapeIds = ['first', 'second'];
studio.setInspectorPanel('library', true);
assert.strictEqual(inspectorElements['panel-tile-library-mgr'].hidden, false);
assert.strictEqual(inspectorElements['panel-tile-layers'].hidden, true);
assert.strictEqual(inspectorTabs[2].attrs['aria-selected'], 'true');
assert.strictEqual(inspectorTabs[2].tabIndex, 0);
assert.strictEqual(inspectorTabs[0].tabIndex, -1);
assert.strictEqual(inspectorTabs[2].focused, true);
assert.deepStrictEqual(ve.state.selectedShapeIds, ['first', 'second']);
studio.setInspectorPanel('invalid');
assert.strictEqual(studio.state.inspectorPanel, 'library');
delete global.document;
const fs = require('fs');
const ui = fs.readFileSync(require.resolve('../core/subtile_studio_ui.js'), 'utf8');
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
