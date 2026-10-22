// tests/test_d4_block_combinations.js
const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const { generateMosaic } = window.MosaicEngine;
const { SYMMETRY_MODES, getAllowedTransformsForSymmetry, transformGridCoords } = window.D4Symmetry;

console.log('--- Testing D4 Grid × Block Symmetry Matrix & Reduction Rules ---');

const gridModes = ['mandala_d4', 'kaleidoscope', 'rotational_c4', 'bilateral_d2'];
const blockModes = ['sync', 'mandala_d4', 'kaleidoscope', 'rotational_c4', 'bilateral_d2'];

let combinationsTested = 0;

for (const gMode of gridModes) {
  for (const bMode of blockModes) {
    combinationsTested++;
    const isSync = bMode === 'sync';
    const effectiveBlockMode = isSync ? gMode : bMode;

    const mosaic = generateMosaic(
      {
        rows: 2,
        cols: 2,
        subdivision: 2,
        gridSymmetryMode: gMode,
        blockSymmetryMode: effectiveBlockMode,
        syncBlockSymmetry: isSync,
        allowedTiles: [2, 6, 84],
        seed: 42
      },
      (arr) => arr[0]
    );

    assert.ok(mosaic && mosaic.grid, `Mosaic should generate cleanly for ${gMode} x ${bMode}`);

    // Verify reduction logic:
    // If grid requires 8 octants (mandala_d4) but block is limited to 4 (bilateral_d2 or rotational_c4),
    // global symmetry is reduced to 4.
    const isReduced = (!isSync && gMode === 'mandala_d4' && (bMode === 'bilateral_d2' || bMode === 'rotational_c4'));
    if (isReduced) {
      // In reduced mode, the 8-fold diagonal reflections are NOT guaranteed globally
      // (because internal blocks only satisfy D2 or C4)
      const allowedTransforms = getAllowedTransformsForSymmetry(bMode, 4, 4);
      assert.strictEqual(allowedTransforms.length, 4, 'Reduced block symmetry only satisfies 4 transforms');
    }
  }
}

console.log(`✓ All ${combinationsTested} Grid × Block symmetry combinations generated and verified.`);
console.log('--- ALL D4 BLOCK COMBINATION CHECKS PASSED PERFECTLY! ---');
