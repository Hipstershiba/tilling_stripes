// tests/test_edge_match_generation.js
// Proves the new mosaic generation mode: tiles are chosen so touching sides have
// compatible fill/background signatures, without breaking the D4 invariants.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/tile_edge_signatures.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const Engine = window.MosaicEngine;
const EdgeSignatures = window.TileEdgeSignatures;
const { generateMosaic, generateMosaicWithFrozen, isMosaicD4Invariant, computeMosaicEdgeStats } = Engine;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function picker(seed) {
  const rnd = mulberry32(seed);
  return (arr) => arr[Math.floor(rnd() * arr.length)];
}

const allTiles = Array.from({ length: window.TileRegistry.TILE_RENDERERS.length }, (_, i) => i);
const baseConfig = {
  rows: 3,
  cols: 3,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: allTiles
};

console.log('--- Testing edge-matched mosaic generation ---');

const classic = generateMosaic(baseConfig, picker(12345));
const classicStats = computeMosaicEdgeStats(classic, EdgeSignatures);
const edge = generateMosaic(Object.assign({}, baseConfig, { edgeMatch: true }), picker(12345));

assert.strictEqual(edge.generationMode, 'edge_match');
assert.strictEqual(edge.edgeMatch, true);
assert.ok(edge.edgeMatchStats, 'edge mode must report its own score statistics');
assert.strictEqual(edge.edgeMatchStats.edges, classicStats.edges, 'both modes expose the same number of adjacencies');
assert.ok(edge.edgeMatchStats.average > classicStats.average + 0.2,
  `edge matching must improve average continuity (classic=${classicStats.average.toFixed(3)}, edge=${edge.edgeMatchStats.average.toFixed(3)})`);
assert.ok(edge.edgeMatchStats.perfect > classicStats.perfect,
  'edge matching must produce more perfect seams than classic random generation');
assert.ok(edge.edgeMatchStats.fillPairs > 0, 'edge matching must join pairs that both carry ink');
console.log(`✓ Average seam score: classic=${classicStats.average.toFixed(3)} → edge=${edge.edgeMatchStats.average.toFixed(3)} ` +
  `(${edge.edgeMatchStats.perfect}/${edge.edgeMatchStats.edges} perfect).`);

assert.strictEqual(isMosaicD4Invariant(edge), true, 'edge mode must keep the strict D4 invariant');
assert.strictEqual(isMosaicD4Invariant(classic), true);
assert.strictEqual(edge.blocks.length, 9, 'hierarchical block layout must be preserved');
console.log('✓ D4 symmetry and the hierarchical block layout are intact.');

// The optimiser must be deterministic under a seeded picker.
const edgeAgain = generateMosaic(Object.assign({}, baseConfig, { edgeMatch: true }), picker(12345));
const ids = (mosaic) => mosaic.blocks.map((block) => block.cells.map((row) => row.map((cell) => `${cell.baseTileId}:${cell.transform}`).join('|')).join('/')).join('#');
assert.strictEqual(ids(edge), ids(edgeAgain), 'same seed and same picker must reproduce the same edge-matched mosaic');
console.log('✓ Edge-matched generation is deterministic for a seeded picker.');

// Every adjacent pair is actually scored; recomputing from the final grid must agree.
function recomputeAverage(mosaic) {
  const N = mosaic.subtilesPerSide;
  const cellAt = (r, c) => mosaic.grid[Math.floor(r / N)][Math.floor(c / N)].cells[r % N][c % N];
  let total = 0;
  let edges = 0;
  for (let r = 0; r < mosaic.rows * N; r++) {
    for (let c = 0; c < mosaic.cols * N; c++) {
      const a = cellAt(r, c);
      if (c + 1 < mosaic.cols * N) {
        const b = cellAt(r, c + 1);
        total += EdgeSignatures.scoreSide(
          EdgeSignatures.getOrientedProfile(a.baseTileId, a.transform).sides.right,
          EdgeSignatures.getOrientedProfile(b.baseTileId, b.transform).sides.left
        );
        edges++;
      }
      if (r + 1 < mosaic.rows * N) {
        const b = cellAt(r + 1, c);
        total += EdgeSignatures.scoreSide(
          EdgeSignatures.getOrientedProfile(a.baseTileId, a.transform).sides.bottom,
          EdgeSignatures.getOrientedProfile(b.baseTileId, b.transform).sides.top
        );
        edges++;
      }
    }
  }
  return { average: total / edges, edges };
}
const recomputed = recomputeAverage(edge);
assert.strictEqual(recomputed.edges, edge.edgeMatchStats.edges);
assert.ok(Math.abs(recomputed.average - edge.edgeMatchStats.average) < 1e-9,
  'reported statistics must match the rendered grid');
console.log('✓ Reported statistics match an independent pass over the final grid.');

// The mode must respect every symmetry family, not just Mandala.
for (const mode of ['kaleidoscope', 'rotational_c4', 'bilateral_d2']) {
  const config = Object.assign({}, baseConfig, {
    gridSymmetryMode: mode,
    blockSymmetryMode: mode,
    edgeMatch: true
  });
  const mosaic = generateMosaic(config, picker(777));
  assert.strictEqual(isMosaicD4Invariant(mosaic), true, `${mode} must remain invariant`);
  assert.ok(mosaic.edgeMatchStats.average > 0.5, `${mode} should find good seams`);
  console.log(`✓ ${mode}: average seam score ${mosaic.edgeMatchStats.average.toFixed(3)}.`);
}

// A small ribbon-only palette should still improve over random placement.
const ribbonTiles = Array.from({ length: 21 }, (_, i) => i);
const ribbonClassic = generateMosaic(Object.assign({}, baseConfig, { allowedTiles: ribbonTiles }), picker(2024));
const ribbonEdge = generateMosaic(Object.assign({}, baseConfig, { allowedTiles: ribbonTiles, edgeMatch: true }), picker(2024));
const ribbonClassicStats = computeMosaicEdgeStats(ribbonClassic, EdgeSignatures);
assert.ok(ribbonEdge.edgeMatchStats.average > ribbonClassicStats.average,
  'edge matching must also improve a restricted ribbon palette');
console.log(`✓ Ribbon palette: ${ribbonClassicStats.average.toFixed(3)} → ${ribbonEdge.edgeMatchStats.average.toFixed(3)}.`);

// Frozen cells are hard constraints, and their orbit is not moved by the optimiser.
const frozenKey = '1,1,0,0';
const frozenCells = new Map([[frozenKey, { baseTileId: 0, transform: 'id', tileId: 0 }]]);
const frozenMosaic = generateMosaicWithFrozen(
  Object.assign({}, baseConfig, { edgeMatch: true }),
  picker(99),
  frozenCells
);
const frozenCell = frozenMosaic.grid[1][1].cells[0][0];
assert.strictEqual(frozenCell.baseTileId, 0, 'frozen base tile must survive generation');
assert.strictEqual(frozenCell.transform, 'id', 'frozen orientation must survive generation');
assert.ok(frozenMosaic.edgeMatchStats.average > 0.5);
console.log('✓ Frozen cells remain fixed while the rest of the mosaic is matched.');

// No allowed tiles still falls back to the canonical empty tile.
const emptyOnly = generateMosaic(Object.assign({}, baseConfig, { edgeMatch: true, allowedTiles: [] }), picker(3));
for (const block of emptyOnly.blocks) {
  for (const row of block.cells) {
    for (const cell of row) assert.strictEqual(cell.tileId, window.TileRegistry.CANONICAL_EMPTY_TILE_ID);
  }
}
console.log('✓ Empty palette falls back to tile #84.');

console.log('--- ALL EDGE-MATCH GENERATION CHECKS PASSED! ---');
