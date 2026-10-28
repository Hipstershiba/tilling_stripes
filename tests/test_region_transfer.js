const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname, '../sketch.js'), 'utf8');
const start = source.indexOf('function moveMosaicRegion(');
const end = source.indexOf('\nfunction performBrushOrStampAtHit', start);
function fixture(mask = [[true,true]]) {
  const cells = Array.from({length:4}, (_,r) => Array.from({length:4}, (_,c) => ({baseTileId:r*4+c,tileId:r*4+c,transform:'id'})));
  const state = {mosaicData:{rows:1,cols:1,subtilesPerSide:4,grid:[[{cells}]]},frozenCells:new Map()};
  const context = {StudioState:state, mosaicRegion:{row:0,col:0,pattern:{rows:mask.length,cols:mask[0].length,cells:mask}},syncD4Badge(){},syncFreezeUI(){}};
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

for (const shape of ['rect','ellipse','diamond']) {
  const selected = Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>engine.isRegionCellSelected(y,x,4,4,shape))).flat().filter(Boolean).length;
  assert.strictEqual(selected,shape==='rect'?16:12);
  assert.strictEqual(engine.isRegionCellSelected(0,0,1,1,shape),true,'one cell selection');
}
const uiSource = fs.readFileSync(require('path').join(__dirname,'../core/subtile_studio_ui.js'),'utf8');
const cancelStart = uiSource.indexOf('  function cancelVectorPreview()');
const ve = {state:{dragOp:{duplicate:true,initialSelection:['original']},selectedShapeIds:['copy'],workingShapes:[{}]}};
const cancelContext = {resolveDeps:()=>({ve})};
vm.createContext(cancelContext);
vm.runInContext(uiSource.slice(cancelStart,uiSource.indexOf('\n  }',cancelStart)+4),cancelContext);
cancelContext.cancelVectorPreview();
assert.strictEqual(ve.state.selectedShapeIds.join(','),'original','cancel duplicate restores original selection');
assert.strictEqual(ve.state.workingShapes,null);

assert.strictEqual(Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>engine.isRegionCellSelected(y,x,5,5,'diamond'))).flat().filter(Boolean).length,13);
assert.strictEqual(Array.from({length:5},(_,y)=>Array.from({length:5},(_,x)=>engine.isRegionCellSelected(y,x,5,5,'ellipse'))).flat().filter(Boolean).length,21);
