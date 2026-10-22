// tests/test_d4_invariance.js
const path = require('path');
const assert = require('assert');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const { generateMosaic } = window.MosaicEngine;
const { getAllowedTransformsForSymmetry, transformGridCoords } = window.D4Symmetry;
const { getTransformedTileId, TILE_RENDERERS } = window.TileRegistry;

const allTiles = Array.from({ length: TILE_RENDERERS.length }, (_, i) => i);
const tileSets = [[2], [2, 7, 13, 44, 75], allTiles];
const cellAt = (mosaic, r, c, N) =>
  mosaic.grid[Math.floor(r / N)][Math.floor(c / N)].cells[r % N][c % N];

let totalChecks = 0;
for (const mode of ['mandala_d4', 'rotational_c4', 'bilateral_d2']) {
  for (const n of [1, 2, 3, 4, 5]) {
    const tileSetToTest = tileSets;
    for (const allowedTiles of tileSetToTest) {
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
            seed,
            axisConflictMode: 'empty'
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

// --- Verification of Mixture (A + B): Mandala Livre / Caleidoscópio com Respiro ---
console.log('--- Testing Mandala Livre / Caleidoscópio Blend & Kaleidoscope Modes ---');

// 1. Verify default blend mode with asymmetric tiles [2] (only diagonal stripes)
let blendTilesFound = new Set();
for (let seed = 1; seed <= 20; seed++) {
  const mosaicBlend = generateMosaic({
    rows: 3,
    cols: 3,
    subdivision: 2,
    gridSymmetryMode: 'mandala_d4',
    blockSymmetryMode: 'mandala_d4',
    syncBlockSymmetry: true,
    allowedTiles: [2],
    seed,
    axisConflictMode: 'blend'
  }, (arr) => arr[seed % arr.length]);

  const N = mosaicBlend.subtilesPerSide;
  for (let r = 0; r < 3 * N; r++) {
    for (let c = 0; c < 3 * N; c++) {
      const cell = cellAt(mosaicBlend, r, c, N);
      blendTilesFound.add(cell.tileId);
      // Valid tiles must be either in the D4 orbit of tile 2 [2, 3, 4, 5] or empty tile 84
      assert.ok([2, 3, 4, 5, 84].includes(cell.tileId), `Tile ${cell.tileId} unexpected in blend mode`);
    }
  }
}

// In blend mode across 20 seeds, we expect BOTH kaleidoscope tiles and empty respiro tile 84 to appear
assert.ok(blendTilesFound.has(84), 'Blend mode must include empty tile #84 as an organic breath');
assert.ok(blendTilesFound.has(2) || blendTilesFound.has(4), 'Blend mode must include kaleidoscope transformed tiles');
console.log('✓ Blend mode (Mandala Livre + Respiro Vazio #84) verified successfully.');

// 2. Verify pure kaleidoscope mode (never injects #84 unless in allowedTiles)
const mosaicKal = generateMosaic({
  rows: 2,
  cols: 2,
  subdivision: 2,
  gridSymmetryMode: 'mandala_d4',
  blockSymmetryMode: 'mandala_d4',
  syncBlockSymmetry: true,
  allowedTiles: [2],
  seed: 42,
  axisConflictMode: 'kaleidoscope'
}, (arr) => arr[0]);

const NKal = mosaicKal.subtilesPerSide;
for (let r = 0; r < 2 * NKal; r++) {
  for (let c = 0; c < 2 * NKal; c++) {
    const cell = cellAt(mosaicKal, r, c, NKal);
    assert.ok([2, 3, 4, 5].includes(cell.tileId), 'Pure kaleidoscope mode must only use user tiles');
    assert.notStrictEqual(cell.tileId, 84, 'Pure kaleidoscope mode must not inject #84');
  }
}
console.log('✓ Pure Kaleidoscope mode verified successfully.');

