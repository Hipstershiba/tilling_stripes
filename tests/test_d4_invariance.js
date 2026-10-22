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
console.log(`✓ All D4/C4/D2 symmetry invariance checks passed! Total checks: ${totalChecks}`);
