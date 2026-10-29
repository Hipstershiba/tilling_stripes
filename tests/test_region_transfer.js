const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '../sketch.js'), 'utf8');
const start = source.indexOf('function moveMosaicRegion(');
const end = source.indexOf('\nfunction performBrushOrStampAtHit', start);
function fixture(mask = [[true,true]]) {
  const cells = Array.from({length:4}, (_,r) => Array.from({length:4}, (_,c) => ({baseTileId:r*4+c,tileId:r*4+c,transform:'id'})));
  const state = {mosaicData:{rows:1,cols:1,subtilesPerSide:4,grid:[[{cells}]]},frozenCells:new Map()};
  const context = {StudioState:state,regionMoveGesture:null,redraw(){},syncCanvasCursor(){},syncEditWorkspaceUI(){},pushEditHistorySnapshot(){context.snapshots=(context.snapshots||0)+1;}, mosaicRegion:{row:0,col:0,pattern:{rows:mask.length,cols:mask[0].length,cells:mask}},syncD4Badge(){},syncFreezeUI(){}};
  vm.createContext(context);
  vm.runInContext(source.slice(start,end),context);
  return {state,cells,context,move:(r,c)=>context.moveMosaicRegion({row:0,col:0,subRow:r,subCol:c})};
}
let f = fixture();
const before = JSON.stringify(f.cells);
assert.strictEqual(f.move(0,3),false,'reject destination outside artboard');
assert.strictEqual(JSON.stringify(f.cells),before,'rejection must not clear source');
assert.strictEqual(f.move(0,0),false,'same destination is a no-op');
f.state.frozenCells.set('0,0,0,0',{baseTileId:0,tileId:0,transform:'id'});
assert.strictEqual(f.move(0,1),true,'overlapping move');
assert.deepStrictEqual(f.cells[0].map(c=>c.tileId),[84,0,1,3]);
assert.ok(f.state.frozenCells.has('0,0,0,1'),'preservation moves with content');
assert.ok(!f.state.frozenCells.has('0,0,0,0'));
assert.strictEqual(f.move(1,1),true,'can move selection again');
assert.deepStrictEqual(f.cells[1].map(c=>c.tileId),[4,0,1,7]);
f = fixture([[null,true,null],[true,true,true],[null,true,null]]);
assert.strictEqual(f.move(1,1),true);
assert.strictEqual(f.cells[3][3].tileId,15,'mask hole preserves destination');
assert.strictEqual(f.cells[0][0].tileId,0,'mask hole preserves source');
assert.strictEqual(f.cells[1][2].tileId,1,'selected cell transferred');
assert.strictEqual(f.cells[0][1].tileId,84,'selected source cleared');

global.window = {};
require('../core/tile_registry.js');
require('../core/d4_symmetry.js');
const engine = require('../core/mosaic_engine.js');
const pattern = {rows:2,cols:2,cells:[[{baseTileId:2,tileId:2,transform:'id'},null],[null,null]]};
for (const key of ['id','r90','r180','r270','mx','my','md','mad']) {
  const transformed = engine.transformClonePattern(pattern,key);
  assert.strictEqual(transformed.cells.flat().filter(Boolean).length,1,'D4 preserves mask: '+key);
}
console.log('Region transfer, overlap, mask and preservation PASSED');

function gesture(shape, points, diameter=1) {
  const g=engine.createRegionGesture(shape,8,8,diameter);
  for(const [x,y] of points) engine.extendRegionGesture(g,x,y);
  return g;
}
let g=gesture('brush',[[.5,.5],[6.5,.5]]);
assert.strictEqual(engine.getRegionGestureCells(g).length,7,'interpolate sparse mouse events without gaps');
assert.ok(engine.getRegionGestureCells(g).every(c=>c.gr===0));
engine.extendRegionGesture(g,.5,.5);
assert.strictEqual(engine.getRegionGestureCells(g).length,7,'repainting selection is idempotent');
g=gesture('brush',[[2.5,2.5]],3);
assert.strictEqual(engine.getRegionGestureCells(g).length,9,'brush diameter controls footprint');
g=gesture('brush',[[.1,.1]],3);
assert.ok(engine.getRegionGestureCells(g).every(c=>c.gr>=0&&c.gc>=0),'brush clips to artboard');
const uiSource = fs.readFileSync(require('path').join(__dirname,'../core/subtile_studio_ui.js'),'utf8');
const cancelStart = uiSource.indexOf('  function cancelVectorPreview()');
const ve = {state:{dragOp:{duplicate:true,initialSelection:['original']},selectedShapeIds:['copy'],workingShapes:[{}]}};
const cancelContext = {resolveDeps:()=>({ve})};
vm.createContext(cancelContext);
vm.runInContext(uiSource.slice(cancelStart,uiSource.indexOf('\n  }',cancelStart)+4),cancelContext);
cancelContext.cancelVectorPreview();
assert.strictEqual(ve.state.selectedShapeIds.join(','),'original','cancel duplicate restores original selection');
assert.strictEqual(ve.state.workingShapes,null);


// Exercise the real controller capture path without mutating the document.
const captureFixture=fixture();
const captureState=captureFixture.state;
captureState.activeTool='stamp';
const captureContext={StudioState:captureState,window:{MosaicEngine:engine},mosaicSelectionShape:'rect',mosaicTransferMode:'move',regionMoveGesture:null,captureGesture:null,captureOriginHit:null,mosaicRegion:null,selectionBrushDiameter:1,brushEditorPortal:null,
  getToolSizeInfo:()=>({dim:1,max:4}),isEffectiveBrushSnap:()=>false,syncEditWorkspaceUI(){},syncCanvasCursor(){},redraw(){},renderEditBrushPalette(){},renderSupertileBuilderCanvas(){},saveStudioStateToStorage(){}};
vm.createContext(captureContext);
for(const name of ['updateCaptureDragBounds','startCanvasRegionCaptureDrag','finishCanvasRegionCapture','cancelCloneCapture','cycleActiveToolSize']) {
  const from=source.indexOf('function '+name+'(');
  const to=source.indexOf('\n}',from)+2;
  vm.runInContext(source.slice(from,to),captureContext);
}
const hit=(x,y)=>({row:0,col:0,subRow:Math.floor(y),subCol:Math.floor(x),selectionX:x,selectionY:y});
const unchanged=JSON.stringify(captureFixture.cells);
captureContext.startCanvasRegionCaptureDrag(hit(.1,.1));
captureContext.updateCaptureDragBounds(hit(1.9,1.9));
assert.strictEqual(captureContext.finishCanvasRegionCapture(),true);
assert.strictEqual(captureState.supertilePattern.cells.flat().filter(Boolean).length,4);
assert.strictEqual(JSON.stringify(captureFixture.cells),unchanged,'capturing is non-destructive');
captureContext.mosaicSelectionShape='brush';
captureContext.startCanvasRegionCaptureDrag(hit(.5,.5));
captureContext.updateCaptureDragBounds(hit(3.5,.5));
captureContext.finishCanvasRegionCapture();
assert.strictEqual(captureState.supertilePattern.cols,4);
assert.strictEqual(captureState.supertilePattern.rows,1);
assert.strictEqual(captureState.supertilePattern.cells.flat().filter(Boolean).length,4);
captureContext.startCanvasRegionCaptureDrag(hit(.5,2.5));
captureContext.cancelCloneCapture();
assert.strictEqual(captureContext.captureGesture,null);
assert.strictEqual(JSON.stringify(captureFixture.cells),unchanged,'canceling never clears source');
console.log('Rectangle, brush and real capture controller PASSED');

captureState.stampInteractionMode='select';
const clipboardBefore=JSON.stringify(captureState.supertilePattern);
assert.strictEqual(captureContext.cycleActiveToolSize(1),true);
assert.strictEqual(captureContext.selectionBrushDiameter,2);
assert.strictEqual(JSON.stringify(captureState.supertilePattern),clipboardBefore,'selection size leaves captured pattern intact');
captureContext.startCanvasRegionCaptureDrag(hit(.5,.5));
assert.strictEqual(captureContext.captureGesture.radius,1,'selection diameter is independent of captured bounds');

// Drag selection: source stays intact during motion, one commit on release.
f=fixture();
const dragBefore=JSON.stringify(f.cells);
f.context.beginRegionInteraction({row:0,col:0,subRow:0,subCol:0});
f.context.updateRegionMove({row:0,col:0,subRow:1,subCol:2});
assert.strictEqual(JSON.stringify(f.cells),dragBefore,'pointer move only updates preview');
assert.strictEqual(f.context.finishRegionMove(),true);
assert.strictEqual(f.context.snapshots,1,'one undo for complete drag');
assert.strictEqual(f.state.stampBlock.minGlobalRow,1,'clone source follows moved selection');
assert.strictEqual(f.state.stampBlock.minGlobalCol,2);
assert.deepStrictEqual(f.cells[1].map(c=>c.tileId),[4,5,0,1]);
f=fixture();
f.context.beginRegionInteraction({row:0,col:0,subRow:0,subCol:0});
f.context.updateRegionMove({row:0,col:0,subRow:3,subCol:3});
assert.strictEqual(f.context.finishRegionMove(),false,'out of bounds is rejected');
assert.strictEqual(JSON.stringify(f.cells),dragBefore);
f.context.beginRegionInteraction({row:0,col:0,subRow:0,subCol:0});
f.context.updateRegionMove(null);
assert.strictEqual(f.context.finishRegionMove(),false,'leaving artboard cancels move');
assert.strictEqual(JSON.stringify(f.cells),dragBefore);

// Escape/cancel must discard a provisional drag before global mouseup commits it.
f=fixture();
const cancelRegionStart=source.indexOf('function cancelCloneCapture(');
vm.runInContext(source.slice(cancelRegionStart,source.indexOf('\n}',cancelRegionStart)+2),f.context);
f.context.beginRegionInteraction({row:0,col:0,subRow:0,subCol:0});
f.context.updateRegionMove({row:0,col:0,subRow:1,subCol:2});
f.context.cancelCloneCapture();
assert.strictEqual(f.context.finishRegionMove(),false);
assert.strictEqual(JSON.stringify(f.cells),dragBefore,'cancelled movement preserves source');

// Shift unions masks, retains gaps, and reads current cell contents without editing the mosaic.
{
  const state=captureState, c=captureContext;
  c.mosaicTransferMode='move';c.mosaicSelectionShape='rect';c.selectionBrushDiameter=1;
  c.isEffectiveBrushSnap=()=>true; // Shift must not also expand selection to whole blocks.
  c.startCanvasRegionCaptureDrag(hit(.5,.5));c.finishCanvasRegionCapture();
  assert.equal(state.supertilePattern.cells.flat().filter(Boolean).length,1);
  const first=JSON.stringify(c.mosaicRegion.pattern);
  c.startCanvasRegionCaptureDrag(hit(3.5,3.5),true);c.finishCanvasRegionCapture();
  assert.equal(state.supertilePattern.rows,4);assert.equal(state.supertilePattern.cols,4);
  assert.equal(state.supertilePattern.cells.flat().filter(Boolean).length,2);
  assert.equal(state.supertilePattern.cells[1][1],null,'gap is outside the union');
  c.startCanvasRegionCaptureDrag(hit(.5,.5),true);c.finishCanvasRegionCapture();
  assert.equal(state.supertilePattern.cells.flat().filter(Boolean).length,2,'overlap is not counted twice');
  c.mosaicSelectionShape='brush';c.startCanvasRegionCaptureDrag(hit(3.5,.5),true);c.finishCanvasRegionCapture();
  assert.equal(state.supertilePattern.cells.flat().filter(Boolean).length,3,'brush can extend rectangle selection');
  const kept=JSON.stringify(c.mosaicRegion);
  c.startCanvasRegionCaptureDrag(hit(.5,3.5),true);c.cancelCloneCapture();
  assert.equal(JSON.stringify(c.mosaicRegion),kept,'cancel preserves original mask');
  assert.equal(JSON.stringify(captureFixture.cells),unchanged,'additive capture does not edit cells');
  const pattern=JSON.parse(first), added=engine.captureSubtileRegion(state.mosaicData,3,3,3,3);
  const initial=JSON.stringify(pattern), combined=engine.mergeRegionSelections(state.mosaicData,pattern,added);
  assert.equal(JSON.stringify(pattern),initial,'merge does not mutate previous mask');
  assert.equal(combined.cells.flat().filter(Boolean).length,2);
  const drag=fixture();let args;
  drag.context.startCanvasRegionCaptureDrag=(...values)=>{args=values;};
  drag.context.beginRegionInteraction({row:0,col:0,subRow:0,subCol:0},true);
  assert.equal(args[1],true,'Shift inside selection starts additive capture, not moving');
  assert.equal(drag.context.regionMoveGesture,null);
}
console.log('Shift additive mosaic selection, masks, overlap and cancellation PASSED');

for(const transformKey of ['mx','my']) for(const rotateSize of ['1','2']) {
 const f=fixture(), before=JSON.stringify(f.cells), hit={row:0,col:0,subRow:0,subCol:0};
 for(let i=0;i<2;i++) {
  const result=engine.resolveRotateRegionPlacements(f.state.mosaicData,hit,{rotateSize,rotateGroupMode:'group',rotateBehavior:'family',scopeMode:'single',transformKey});
  assert(result.placements.length>0);
  engine.applyStampPlacements(f.state.mosaicData,result.placements);
 }
 assert.equal(JSON.stringify(f.cells),before,'two reflections restore geometry and orientation: '+transformKey+' '+rotateSize);
}
console.log('Horizontal and vertical mirrors are involutions for cells and groups PASSED');
