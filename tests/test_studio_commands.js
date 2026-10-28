const assert = require('assert');
global.window = {};
const commands = require('../core/studio_commands.js');
require('../core/d4_symmetry.js');
require('../core/vector_renderer.js');
require('../core/d4_detect.js');
require('../core/tile_library.js');
require('../core/library_compiler.js');
const store = require('../core/library_store.js');
const registry = require('../core/tile_registry.js');
require('../core/mosaic_engine.js');
const ve = require('../core/vector_editor.js');
const studio = require('../core/subtile_studio_ui.js');
require('../ui_info.js');
const event = (key, extra = {}) => ({key, preventDefault() {this.defaultPrevented = true;}, ...extra});
const messages = [];
const pattern = {rows: 2, cols: 2, cells: [[{tileId: 0}]]};
const state = {studioMode: 'mosaic', activeTool: 'stamp', editScope: 'single',
  editBrushTileId: 0, supertilePattern: pattern, paddingRatio: .05};
studio.init({studioState: state, setActiveTool(tool) {state.activeTool = tool;}, showToast: text => messages.push(text)});
studio.openTilesStudio(registry.TILE_FAMILIES_META[0].id);
const familyCount = () => registry.TILE_FAMILIES_META.length;
let count = familyCount();
studio.handleKeyDown(event('d', {ctrlKey: true}), state);
assert.equal(familyCount(), count); assert(messages.pop().includes('Criar cópia'));
const custom = store.createFamily({name: 'Pan • Clip • nome do usuário'}).family;
studio.selectFamily(custom.id);
const getDoc = () => store.getFamilyById(custom.id);
ve.state.selectedShapeIds = [];
studio.handleKeyDown(event('d', {ctrlKey: true}), state);
assert.equal(familyCount(), count + 1); assert.equal(messages.pop(), 'Selecione formas para duplicar.');
const original = JSON.stringify(getDoc().shapes);
// Use actual pen pointer events and the production keyboard controller.
function penPoint(x, y) { ve.onPointerDown(x, y, {}, getDoc()); ve.onPointerUp(getDoc()); }
function path() {studio.setVectorTool('pen'); penPoint(-.2, -.2); penPoint(.2, .2);}
path(); assert(ve.state.penSession);
studio.handleKeyDown(event('Escape'), state);
assert.equal(ve.state.penSession, null); assert.equal(ve.state.workingShapes, null);
assert.equal(JSON.stringify(getDoc().shapes), original); assert.equal(state.studioMode, 'tiles');
studio.handleKeyDown(event('Escape'), state); assert.equal(state.studioMode, 'tiles');
path(); studio.handleKeyDown(event('Enter'), state);
assert.equal(getDoc().shapes.length, JSON.parse(original).length + 1);
assert.equal(ve.state.penSession, null);
const beforeDuplicate = getDoc().shapes.length;
studio.handleKeyDown(event('d', {ctrlKey: true}), state);
assert.equal(getDoc().shapes.length, beforeDuplicate + 1); assert.equal(familyCount(), count + 1);
studio.handleKeyDown(event('z', {ctrlKey: true}), state);
assert.equal(getDoc().shapes.length, beforeDuplicate);
studio.handleKeyDown(event('z', {ctrlKey: true, shiftKey: true}), state);
assert.equal(getDoc().shapes.length, beforeDuplicate + 1);
// Tool changes finish a valid released path, but never commit a drag preview.
path(); const beforeSwitch = getDoc().shapes.length;
studio.setVectorTool('rect'); assert.equal(getDoc().shapes.length, beforeSwitch + 1);
studio.setVectorTool('pen'); ve.onPointerDown(-.3, -.3, {}, getDoc());
assert(ve.state.dragOp);
const beforeDrag = JSON.stringify(getDoc().shapes);
studio.setVectorTool('ellipse');
assert.equal(ve.state.dragOp, null); assert.equal(JSON.stringify(getDoc().shapes), beforeDrag);
assert.equal(studio.handleViewportMouseUp(0, 0, {}, state), false);
// Escape discards an ordinary shape preview, including delayed pointer release.
studio.setVectorTool('rect'); ve.onPointerDown(-.2, -.2, {}, getDoc());
ve.onPointerMove(.3, .3, {}, getDoc());
studio.handleKeyDown(event('Escape'), state);
assert.equal(ve.state.dragOp, null); assert.equal(JSON.stringify(getDoc().shapes), beforeDrag);
studio.handleKeyDown(event('g'), state); assert.equal(ve.state.activeTool, 'polygon');
studio.handleKeyDown(event('a'), state); assert.equal(ve.state.activeTool, 'direct');
studio.handleKeyDown(event('g', {ctrlKey: true}), state); assert.equal(ve.state.activeTool, 'direct');
studio.handleKeyDown(event('g', {altKey: true}), state); assert.equal(ve.state.activeTool, 'direct');
studio.handleKeyDown(event('g', {repeat: true}), state); assert.equal(ve.state.activeTool, 'direct');
studio.handleKeyDown(event('e', {ctrlKey: true}), state);
assert.equal(state.studioMode, 'mosaic'); assert.equal(state.activeTool, 'stamp');
assert.equal(state.supertilePattern, pattern); assert.equal(state.editScope, 'single');
studio.handleKeyDown(event('e', {ctrlKey: true}), state); studio.closeTilesStudio();
assert.equal(state.activeTool, 'stamp'); assert.equal(state.supertilePattern, pattern);
assert.equal(getDoc().name, 'Pan • Clip • nome do usuário');
console.log('✓ Production commands: Ctrl+D scope, pen Enter/Escape, drag cancellation, tool switching, G/A, undo/redo and environment return.');

// The same catalog supplies button titles, help and keyboard callbacks.
for (const context of ['mosaic', 'tiles']) {
  const elements = {};
  const root = {getElementById(id) {return elements[id];}};
  for (const command of commands.definitions.filter(item => item.context === context)) {
    for (const id of command.controls) elements[id] = {querySelector: () => null};
  }
  commands.applyLabels(root, context);
  const help = commands.help(context);
  for (const command of commands.definitions.filter(item => item.context === context)) {
    for (const id of command.controls) assert(elements[id].title.startsWith(command.name));
    if (command.shortcut) assert(help.some(line => line.startsWith(`${command.shortcut}: ${command.name}`)));
  }
  const calls = [];
  const ctx = {selectTool: tool => calls.push(tool), generate: () => calls.push('generate')};
  for (const [tool, , shortcut] of commands.tools[context]) {
    commands.run(context, tool, ctx); commands.dispatch(context, event(shortcut.toLowerCase()), ctx);
    assert.deepEqual(calls.splice(0), [tool, tool]);
  }
}
const helpText = JSON.stringify(window.InfoUI.INFO_TOPICS.shortcuts);
assert(helpText.includes('Ctrl+D: Duplicar formas')); assert(helpText.includes('Escape cancela'));
assert(!commands.get('tiles', 'copyEditable').shortcut);
console.log('✓ Shared catalog drives names, shortcuts, availability, callbacks, button titles and contextual help.');

// Standard, compact tool names stay consistent in tooltips, help and controls.
assert.equal(commands.get('tiles', 'direct').name, 'Seleção direta');
assert.equal(commands.get('tiles', 'arc').name, 'Arco');
assert.equal(commands.get('tiles', 'pen').name, 'Caneta');
for (const entries of Object.values(commands.tools)) for (const [, name] of entries) {
  assert(name.length <= 14, `Tool name needs a compact label: ${name}`);
}

// Region tools share the command catalog; modifier shortcuts do not steal guide keys.
const regions=[];
const selectionContext={selectRegion:shape=>regions.push(shape)};
for (const [key,extra,shape] of [['m',{shiftKey:true},'rect'],['w',{},'brush']]) {
  assert.strictEqual(commands.dispatch('mosaic',event(key,extra),selectionContext),true);
  assert.strictEqual(regions.pop(),shape);
}
assert.strictEqual(commands.dispatch('mosaic',event('l'),selectionContext),false,'lasso is removed');
assert.strictEqual(commands.dispatch('mosaic',event('m'),selectionContext),false,'M remains the subtile guide');
assert.strictEqual(commands.dispatch('mosaic',event('l',{ctrlKey:true}),selectionContext),false);
assert.strictEqual(commands.dispatch('mosaic',event('w',{ctrlKey:true}),selectionContext),false);
assert.strictEqual(commands.dispatch('mosaic',event('l',{repeat:true}),selectionContext),false);
const tileTools=[];
assert.strictEqual(commands.dispatch('tiles',event('l'),{selectTool:tool=>tileTools.push(tool)}),true);
assert.deepStrictEqual(tileTools,['ellipse'],'L still draws ellipses in the vector editor');
assert.strictEqual(commands.dispatch('tiles',event('w'),selectionContext),false);
console.log('✓ Region shortcuts preserve guides, browser modifiers and vector tools.');
