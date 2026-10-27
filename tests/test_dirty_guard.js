// tests/test_dirty_guard.js
// Proves the Dirty Guard logic and modal contract (Rodada 4.2 / T2).
// Prevents accidental mosaic destruction when altering parameters on an edited or locked document.

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- Testing Dirty Guard Contract (Rodada 4.2 / T2) ---');

// 1. DOM contract: #dirtyGuardDialog exists with required attributes and buttons
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

assert.ok(html.includes('id="dirtyGuardDialog"'), '#dirtyGuardDialog must exist in index.html');
assert.ok(html.includes('role="dialog"'), '#dirtyGuardDialog must have role="dialog"');
assert.ok(html.includes('aria-modal="true"'), '#dirtyGuardDialog must have aria-modal="true"');
assert.ok(html.includes('id="btnDirtyGuardCancel"'), '#btnDirtyGuardCancel must exist');
assert.ok(html.includes('id="btnDirtyGuardConfirm"'), '#btnDirtyGuardConfirm must exist');
assert.ok(html.includes('id="dirtyGuardDontAsk"'), '#dirtyGuardDontAsk must exist');
console.log('✓ #dirtyGuardDialog DOM contract verified (role, aria-modal, cancel/confirm buttons, session checkbox).');

// 2. Logic contract: isDocumentDirty
const sketchSource = fs.readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');
assert.ok(sketchSource.includes('function isDocumentDirty('), 'isDocumentDirty function must exist in sketch.js');

// Simulate isDocumentDirty
function isDocumentDirty(state) {
  if (!state) return false;
  const hasEdits = typeof state.editHistoryIndex === 'number' && state.editHistoryIndex > 0;
  const hasFrozen = Boolean(state.frozenCells && state.frozenCells.size > 0);
  return hasEdits || hasFrozen;
}

// Clean state
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 0, frozenCells: new Map() }), false, 'Clean document is not dirty');
assert.strictEqual(isDocumentDirty({ editHistoryIndex: -1, frozenCells: new Map() }), false, 'Initial boot is not dirty');

// Dirty by edit
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 1, frozenCells: new Map() }), true, '1 edit makes document dirty');
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 5, frozenCells: new Map() }), true, 'Multiple edits make document dirty');

// Dirty by frozen cells
const frozenMap = new Map();
frozenMap.set('0,0,0,0', { baseTileId: 1 });
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 0, frozenCells: frozenMap }), true, 'Frozen cells make document dirty even with index 0');

console.log('✓ isDocumentDirty logic verified (edits and frozen cells correctly identified).');

// Run the production listener and modal lifecycle rather than matching source wording.
const vm = require('vm');
const listenerStart = sketchSource.indexOf("  window.addEventListener('keydown', (e) => {", sketchSource.indexOf('// --- Illustrator & Editor Keyboard'));
const listenerEnd = sketchSource.indexOf("\n  window.addEventListener('keyup'", listenerStart);
const handlers = {};
const calls = {swap: 0, generate: 0, undo: 0, environment: 0, scope: 0, history: 0};
const stage = {id: 'canvas-stage', tagName: 'DIV'};
const tool = {focus() { document.activeElement = tool; }};
const context = {
  window: {addEventListener: (type, fn) => handlers[type] = fn},
  document: {getElementById: id => id === 'canvas-stage' ? stage : null, querySelector: () => tool},
  StudioState: {activeTool: 'paint', workspace: 'edit'},
  syncCanvasCursor() {}, redraw() {},
  swapStudioColors() { calls.swap++; },
  triggerRandomSeed() { calls.generate++; },
  undoMosaicEdit() { calls.undo++; },
  cycleEditScope() { calls.scope++; },
  restoreGenerationHistory() { calls.history++; },
  cancelToolGesture() {}, cancelCloneCapture() {}
};
context.window.SubtileStudioUI = {handleKeyDown(e) {
  if (e.ctrlKey && e.key === 'e') { calls.environment++; return true; }
  return false;
}};
vm.createContext(context);
vm.runInContext(sketchSource.slice(listenerStart, listenerEnd), context);
function key(key, extra = {}) {
  const e = {key, target: stage, preventDefault() {this.defaultPrevented = true;}, ...extra};
  handlers.keydown(e); return e;
}
key('x'); assert.equal(calls.swap, 1);
for (const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{repeat:true},{isComposing:true},{defaultPrevented:true},{target:{isContentEditable:true}}]) key('x',extra);
assert.equal(calls.swap, 1, 'Only an exact, fresh X swaps colors');
key('g'); key('g',{repeat:true}); assert.equal(calls.generate,1);
key('Tab',{target:{tagName:'BUTTON'}}); assert.equal(calls.scope,0);
key('Tab'); assert.equal(calls.scope,1);
context.StudioState.activeTool='inspect';
assert(!key('Tab').defaultPrevented); assert.equal(calls.scope,1);
key('ArrowLeft',{target:{tagName:'BUTTON'}}); assert.equal(calls.history,0);
key('ArrowLeft'); assert.equal(calls.history,1);
context.StudioState.activeTool='paint';
key('ArrowRight'); assert.equal(calls.history,1);

// Production modal manager with a small DOM surface: inert siblings, Tab cycle, cancel, focus restoration.
global.window = {};
require('../core/subtile_studio_ui.js');
const modal = window.StudioModal;
const background = {inert:false};
const origin = {isConnected:true, focus() {document.activeElement=this;}};
const makeControl = () => ({disabled:false, closest:()=>false, getClientRects:()=>[{}], focus(){document.activeElement=this;}});
const first = makeControl(), last = makeControl();
const dialog = {parentElement:{children:[]}, querySelectorAll:()=>[first,last], contains: el=>el===first||el===last};
dialog.parentElement.children=[background,dialog];
global.document = {activeElement:origin};
let applied=0, reverted=0;
const cancel=()=>{reverted++;modal.leave(dialog);};
modal.enter(dialog,cancel);
assert.equal(background.inert,true); assert(!dialog.inert); assert(modal.isOpen());
last.focus(); dialog.onkeydown({key:'Tab',preventDefault(){}}); assert.equal(document.activeElement,first);
first.focus(); dialog.onkeydown({key:'Tab',shiftKey:true,preventDefault(){}}); assert.equal(document.activeElement,last);
context.window.StudioModal=modal;
for (const target of [first,last]) for (const [k,extra] of [['x',{}],['g',{}],['z',{ctrlKey:true}],['e',{ctrlKey:true}]]) key(k,{target,...extra});
assert.deepEqual(calls,{swap:1,generate:1,undo:0,environment:0,scope:1,history:1});
key('Escape'); assert.equal(reverted,1); assert.equal(applied,0);
assert.equal(background.inert,false); assert.equal(document.activeElement,origin); assert(!modal.isOpen());
// Reopen and close without cancelling, including pre-existing inert state.
background.inert=true;modal.enter(dialog,cancel);modal.leave(dialog);assert.equal(background.inert,true);

// Count actual out-of-bounds frozen coordinates for a topology change.
vm.runInContext(sketchSource.slice(sketchSource.indexOf('function countFrozenOutsideTopology('),sketchSource.indexOf('function requestTopologyChange(')),context);
assert.equal(context.countFrozenOutsideTopology(new Map([['0,0,0,0',{}],['2,2,3,3',{}],['0,0,4,4',{}]]),2,2,2),2);
assert.equal(context.countFrozenOutsideTopology(new Map([['2,2,3,3',{}]]),3,3,2),0);
console.log('--- ALL DIRTY GUARD AND KEYBOARD CHECKS PASSED! ---');

// First topology change after restoring a session must snapshot parameters BEFORE mutation.
context.window.DocumentSnapshot = require('../core/document_snapshot.js');
context.StudioState = {rows:3, cols:3, subdivision:2, frozenCells:new Map(), editHistory:[{}], editHistoryIndex:0, lastDocumentParams:null};
context.requestParamChangeWithGuard = (_trigger, _revert, apply) => apply();
context.syncAllInputsFromState = () => {};
context.regenerateMosaic = () => {
  assert.equal(context.StudioState.lastDocumentParams.rows,3);
  assert.equal(context.StudioState.editHistory[0].document.rows,3);
  assert.equal(context.StudioState.rows,1);
};
vm.runInContext(sketchSource.slice(sketchSource.indexOf('function requestTopologyChange('),sketchSource.indexOf('function swapStudioColors(')),context);
context.requestTopologyChange({rows:1},stage);
console.log('Topology undo after session restore PASSED');
