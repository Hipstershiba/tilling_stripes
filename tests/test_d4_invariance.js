// tests/test_d4_invariance.js
const path = require('path');
const assert = require('assert');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const { generateMosaic } = window.MosaicEngine;
const { getAllowedTransformsForSymmetry, transformGridCoords, resolveCellSymmetry } = window.D4Symmetry;
const { getTransformedTileId, TILE_RENDERERS } = window.TileRegistry;

const allTiles = Array.from({ length: TILE_RENDERERS.length }, (_, i) => i);
const tileSets = [[2], [2, 7, 13, 44, 75], allTiles];
const cellAt = (mosaic, r, c, N) =>
  mosaic.grid[Math.floor(r / N)][Math.floor(c / N)].cells[r % N][c % N];

// Part 1: Verify strict D4 / C4 / D2 mathematical invariance
// When D4 is impossible with user's selected tiles (e.g. tile [2] on diagonals),
// empty tile #84 is automatically and reliably used on the axes.
let totalChecks = 0;
for (const mode of ['mandala_d4', 'rotational_c4', 'bilateral_d2']) {
  for (const n of [1, 2, 3, 4, 5]) {
    for (const allowedTiles of tileSets) {
      for (const seed of [1, 7, 42, 9999]) {
        const mosaic = generateMosaic(
          {
            rows: n,
            cols: n,
            subdivision: 2,
            gridSymmetryMode: mode,
            blockSymmetryMode: mode,
            syncBlockSymmetry: true,
            allowedTiles,
            seed
          },
          (arr) => arr[(seed + arr.length) % arr.length]
        );
        const N = mosaic.subtilesPerSide;
        const R = n * N;
        const C = n * N;
        const transforms = getAllowedTransformsForSymmetry(mode, R, C);
        for (const g of transforms) {
          for (let r = 0; r < R; r++) {
            for (let c = 0; c < C; c++) {
              totalChecks++;
              const [tr, tc] = transformGridCoords(r, c, R, C, g);
              const src = cellAt(mosaic, r, c, N);
              const dst = cellAt(mosaic, tr, tc, N);
              assert.strictEqual(
                dst.tileId,
                getTransformedTileId(src.tileId, g),
                `${mode} ${n} seed ${seed} ${g} (${r},${c})`
              );
            }
          }
        }
      }
    }
  }
}
console.log(`✓ All D4/C4/D2 strict invariance checks passed! Total checks: ${totalChecks}`);

// Part 2: Verify the new more permissive symmetry mode ('kaleidoscope')
console.log('--- Testing New Permissive Symmetry Mode: Caleidoscópio (Livre) ---');

// When user selects asymmetric tiles [2] (only diagonal stripes),
// kaleidoscope mode allows them freely across all 8 octants without forcing empty tile #84!
for (const seed of [1, 7, 42, 100, 777]) {
  const mosaicKal = generateMosaic({
    rows: 3,
    cols: 3,
    subdivision: 2,
    gridSymmetryMode: 'kaleidoscope',
    blockSymmetryMode: 'kaleidoscope',
    syncBlockSymmetry: true,
    allowedTiles: [2],
    seed
  }, (arr) => arr[seed % arr.length]);

  const N = mosaicKal.subtilesPerSide;
  for (let r = 0; r < 3 * N; r++) {
    for (let c = 0; c < 3 * N; c++) {
      const cell = cellAt(mosaicKal, r, c, N);
      // In permissive kaleidoscope mode, only the user's tiles in their D4 orbit [2, 3, 4, 5] appear
      assert.ok([2, 3, 4, 5].includes(cell.tileId), `Cell (${r},${c}) has unexpected tile ${cell.tileId}`);
      assert.notStrictEqual(cell.tileId, 84, 'Permissive kaleidoscope mode must NOT force empty tile #84');
    }
  }

  // Verify internal block propagation: every cell is transformed from its canonical source subtile
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const block = mosaicKal.grid[br][bc];
      for (let sr = 0; sr < N; sr++) {
        for (let sc = 0; sc < N; sc++) {
          const rel = resolveCellSymmetry(sr, sc, N, N, 'kaleidoscope');
          const srcCell = block.cells[rel.sourceRow][rel.sourceCol];
          const curCell = block.cells[sr][sc];
          assert.strictEqual(
            curCell.tileId,
            getTransformedTileId(srcCell.tileId, rel.transformFromSource),
            `Block (${br},${bc}) subtile (${sr},${sc}) should transform from (${rel.sourceRow},${rel.sourceCol})`
          );
        }
      }
    }
  }
}
console.log('✓ Permissive Kaleidoscope mode verified successfully across all octants and blocks.');

// Part 3: Verify that in Mandala D4, empty tile #84 is reliably used on axes when D4 is impossible
console.log('--- Testing Mandala D4 fallback to Tile Vazio #84 when D4 is impossible ---');
const mosaicD4 = generateMosaic({
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [2], // Tile 2 is not invariant under diagonal reflection (md)
  seed: 42
}, (arr) => arr[0]);

const ND4 = mosaicD4.subtilesPerSide;
let emptyTilesFound = 0;
for (let r = 0; r < 2 * ND4; r++) {
  for (let c = 0; c < 2 * ND4; c++) {
    const cell = cellAt(mosaicD4, r, c, ND4);
    if (cell.tileId === 84) {
      emptyTilesFound++;
    }
  }
}
assert.ok(emptyTilesFound > 0, 'Mandala D4 must use tile #84 on diagonal cells when tile 2 is not invariant');
console.log(`✓ Mandala D4 correctly used Tile Vazio #84 on ${emptyTilesFound} axis cells where D4 was impossible.`);
