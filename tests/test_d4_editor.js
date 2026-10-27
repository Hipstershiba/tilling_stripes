// tests/test_d4_editor.js
const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const { getCellStabilizer, isTileInvariantUnder } = window.D4Symmetry;
const { generateMosaic, resolveStampRegionPlacements, applyStampPlacements } = window.MosaicEngine;

console.log('--- Testing Editor D4 Strict Transparency Contract (Rodada 2) ---');

// 1. Generate base mosaic with Mandala D4
const mosaic = generateMosaic({
  rows: 2,
  cols: 2,
  subdivision: 2, // N = 4
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [6, 84],
  seed: 1
}, (arr) => arr[0]);

const N = mosaic.subtilesPerSide; // 4
const totalR = 2 * N;
const totalC = 2 * N;

// Diagonal cell (0, 0) has stabilizer ['id', 'md']
const stabDiag = getCellStabilizer(0, 0, N, N, 'mandala_d4');
assert.ok(stabDiag.includes('md'), 'Diagonal cell must have md in stabilizer under mandala_d4');

// Off-diagonal cell (0, 1) has stabilizer ['id']
const stabOffDiag = getCellStabilizer(0, 1, N, N, 'mandala_d4');
assert.deepStrictEqual(stabOffDiag, ['id'], 'Off-diagonal cell stabilizer is only id');

// 2. Test Invariance Check on Tile #2 (Diagonal stripe - asymmetric under md)
// In tile registry, tile 2 reflected across main diagonal (md) transforms into tile 3
assert.strictEqual(isTileInvariantUnder(2, 'md'), false, 'Tile 2 is NOT invariant under md');
assert.strictEqual(isTileInvariantUnder(6, 'md'), true, 'Tile 6 (Cross) IS invariant under md');
assert.strictEqual(isTileInvariantUnder(84, 'md'), true, 'Tile 84 (Empty) IS invariant under md');

// 3. Simulate Editor Painting with Scope: 'canvas_center'
// A) Painting Tile #2 on global center diagonal (gr = 0, gc = 0)
const hitDiag = { row: 0, col: 0, subRow: 0, subCol: 0, globalRow: 0, globalCol: 0 };
const patAsymmetric = { rows: 1, cols: 1, cells: [[{ tileId: 2, baseTileId: 2, transform: 'id' }]] };

const resAsym = resolveStampRegionPlacements(
  mosaic,
  patAsymmetric,
  hitDiag,
  'canvas_center',
  'id',
  { canvasCenterSymmetry: 'mandala_d4' }
);
const placementsAsym = resAsym.placements || [];

// Detection logic matching sketch.js
let breaksD4Asym = false;
for (const p of placementsAsym) {
  const stab = getCellStabilizer(p.gr, p.gc, totalR, totalC, 'mandala_d4');
  for (const g of stab) {
    if (!isTileInvariantUnder(p.tileId, g)) {
      breaksD4Asym = true;
      break;
    }
  }
}
assert.strictEqual(breaksD4Asym, true, 'Painting tile #2 on diagonal in mandala_d4 must detect symmetry break');
console.log('✓ Asymmetric tile painting on diagonal correctly flagged as D4 symmetry break.');

// B) Painting Tile #6 on global center diagonal (gr = 0, gc = 0)
const patSymmetric = { rows: 1, cols: 1, cells: [[{ tileId: 6, baseTileId: 6, transform: 'id' }]] };
const resSym = resolveStampRegionPlacements(
  mosaic,
  patSymmetric,
  hitDiag,
  'canvas_center',
  'id',
  { canvasCenterSymmetry: 'mandala_d4' }
);
const placementsSym = resSym.placements || [];

let breaksD4Sym = false;
for (const p of placementsSym) {
  const stab = getCellStabilizer(p.gr, p.gc, totalR, totalC, 'mandala_d4');
  for (const g of stab) {
    if (!isTileInvariantUnder(p.tileId, g)) {
      breaksD4Sym = true;
      break;
    }
  }
}
assert.strictEqual(breaksD4Sym, false, 'Painting tile #6 on diagonal is invariant and must NOT flag break');
console.log('✓ Invariant tile painting on diagonal verified as completely compliant.');

// C) Painting in 'kaleidoscope' mode (Permissive)
const stabKal = getCellStabilizer(0, 0, N, N, 'kaleidoscope');
assert.deepStrictEqual(stabKal, ['id'], 'Permissive kaleidoscope mode has no axis stabilizer constraints');
console.log('✓ Permissive kaleidoscope mode confirmed unconstrained in editor.');

console.log('--- ALL EDITOR D4 CONTRACT CHECKS PASSED PERFECTLY! ---');

// The rotate cursor must cover precisely the placements used by the operation,
// with visible replicated scope regions and no internal grid in contiguous areas.
const engine = window.MosaicEngine;
const layout = {width: 400, height: 400, margin: 0};
const cellSide = 400 / totalR;
for (const scope of Object.keys(engine.EDIT_SCOPES)) {
  for (const size of ['1', '2', 'block']) {
    const resolved = engine.resolveRotateRegionPlacements(mosaic,
      {row: 0, col: 0, subRow: 1, subCol: 2},
      {rotateSize: size, scopeMode: scope, canvasCenterSymmetry: 'mandala_d4'});
    const rectangles = [], lines = [];
    const context = new Proxy({}, {get: (_target, key) => {
      if (key === 'color') return () => ({setAlpha() {}});
      if (key === 'rect') return (...args) => rectangles.push(args);
      if (key === 'line') return (...args) => lines.push(args);
      return () => {};
    }});
    engine.renderEditScopeAndGhostOverlay(context, mosaic, layout,
      {tool: 'rotate', scopeMode: scope, regionPlacements: resolved.placements, anchorBounds: resolved.anchorBounds});
    const highlighted = rectangles.map(([x, y]) => `${Math.round(y / cellSide)},${Math.round(x / cellSide)}`).sort();
    const affected = resolved.placements.map(cell => `${cell.gr},${cell.gc}`).sort();
    assert.deepStrictEqual(highlighted, affected, `Rotate cursor must match actual ${scope}/${size} targets`);
    if (affected.length) assert.ok(lines.length > 0, 'Affected regions must have visible boundaries');
    if (scope === 'single' && size === '2') {
      const sharedX = rectangles[0][0] + cellSide;
      const sharedY = rectangles[0][1] + cellSide;
      assert.ok(!lines.some(([x0,y0,x1,y1]) =>
        (x0 === sharedX && x1 === sharedX) || (y0 === sharedY && y1 === sharedY)),
        'A 2x2 cursor must not outline its internal cell boundaries');
    }
  }
}
console.log('✓ Rotate cursor matches all six scopes, size changes and block alignment without an internal grid.');

// Regression: edited regions in scope replicas must rotate their own artwork,
// instead of being overwritten with a transformed copy of the anchor region.
const edited = JSON.parse(JSON.stringify(mosaic));
let editId = 0;
for (const row of edited.grid) for (const block of row) {
  for (const cells of block.cells) for (const cell of cells) {
    cell.baseTileId = editId++;
    cell.transform = 'id';
    cell.tileId = cell.baseTileId;
  }
}
const readCell = (data, gr, gc) => data.grid[Math.floor(gr/N)][Math.floor(gc/N)].cells[gr%N][gc%N];
const artwork = data => data.grid.flatMap(row => row.flatMap(block => block.cells.flat().map(cell => cell.baseTileId))).sort((a,b) => a-b);
const beforeArtwork = artwork(edited);
for (const scope of Object.keys(engine.EDIT_SCOPES)) {
  for (const size of ['1', '2', '3', 'block']) for (const group of ['group', 'individual']) {
    const data = JSON.parse(JSON.stringify(edited));
    const hit = {row: 0, col: 0, subRow: 1, subCol: 2};
    const options = {rotateSize: size, rotateGroupMode: group, scopeMode: scope, canvasCenterSymmetry: 'mandala_d4'};
    const result = engine.resolveRotateRegionPlacements(data, hit, options);
    if (!(scope === 'same_tile' && size !== '1')) assert.ok(result.placements.length > 0, `${scope}/${size}/${group} must act`);
    for (const placement of result.placements) {
      assert.strictEqual(placement.baseTileId, readCell(edited, placement.sourceGR, placement.sourceGC).baseTileId,
        `${scope}/${size}/${group} must read the actual edited source in that region`);
    }
    engine.applyStampPlacements(data, result.placements);
    assert.deepStrictEqual(artwork(data), beforeArtwork, `${scope}/${size}/${group} must not erase or duplicate edited tiles`);
    const affected = new Set(result.placements.map(p => `${p.gr},${p.gc}`));
    for (let gr=0; gr<totalR; gr++) for (let gc=0; gc<totalC; gc++) {
      if (!affected.has(`${gr},${gc}`)) assert.deepStrictEqual(readCell(data,gr,gc), readCell(edited,gr,gc));
    }
    if (scope === 'single' || scope === 'all_blocks') {
      engine.applyStampPlacements(data, engine.resolveRotateRegionPlacements(data, hit, {...options, step:-1}).placements);
      assert.deepStrictEqual(data.grid, edited.grid, 'Inverse rotation must recover each edited region');
    }
  }
}
const localResult = engine.resolveRotateRegionPlacements(edited, {row:0,col:0,subRow:0,subCol:0},
  {rotateSize:'2',scopeMode:'single',rotateGroupMode:'group'});
const localData = JSON.parse(JSON.stringify(edited));
engine.applyStampPlacements(localData, localResult.placements);
assert.strictEqual(readCell(localData,0,0).baseTileId, readCell(edited,1,0).baseTileId);
assert.strictEqual(readCell(localData,0,1).baseTileId, readCell(edited,0,0).baseTileId);
assert.strictEqual(readCell(localData,1,1).baseTileId, readCell(edited,0,1).baseTileId);
console.log('✓ Edited artwork is preserved across all rotation scopes, including overlapping regions and inverse rotations.');

const mirrored = engine.resolveRotateRegionPlacements(edited, {row:0,col:0,subRow:0,subCol:0},
  {rotateSize:'2',scopeMode:'canvas_center',rotateGroupMode:'group',canvasCenterSymmetry:'bilateral_d2'});
const mirroredCorner = mirrored.placements.find(p => p.gr === 0 && p.gc === totalC - 1);
assert.strictEqual(mirroredCorner.baseTileId, readCell(edited,1,totalC-1).baseTileId);
assert.strictEqual(mirroredCorner.transform, 'r270', 'Reflected copies must conjugate the local rotation');
console.log('✓ Mirrored scope copies rotate their edited content with the correct D4 direction.');
