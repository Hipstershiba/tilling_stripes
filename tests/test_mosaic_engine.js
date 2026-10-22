// tests/test_mosaic_engine.js
const path = require('path');
global.window = {};

require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
require(path.join(__dirname, '../core/mosaic_engine.js'));

const {
  generateMosaic,
  renderMosaicToContext,
} = window.MosaicEngine;

const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
console.log(`Testing MosaicEngine with ${totalTiles} tiles across 3 symmetry modes...`);

const allowedAll = Array.from({ length: totalTiles }, (_, i) => i);
const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];

for (const symMode of ['mandala_d4', 'rotational_c4', 'bilateral_d2']) {
  const mosaic = generateMosaic({
    rows: 4,
    cols: 4,
    subdivision: 2,
    gridSymmetryMode: symMode,
    blockSymmetryMode: symMode,
    allowedTiles: allowedAll,
    seed: 12345
  }, randomPick);

  if (!mosaic || mosaic.blocks.length !== 16) {
    throw new Error(`Mosaic generation failed for mode ${symMode}`);
  }

  let drawCalls = 0;
  const mockCtx = {
    background: () => {},
    push: () => {},
    pop: () => {},
    translate: () => {},
    rotate: () => {},
    scale: () => {},
    fill: () => {},
    noFill: () => {},
    stroke: () => {},
    noStroke: () => {},
    strokeWeight: () => {},
    rect: () => { drawCalls++; },
    ellipse: () => { drawCalls++; },
    line: () => { drawCalls++; },
    triangle: () => { drawCalls++; },
    arc: () => { drawCalls++; },
    beginShape: () => {},
    vertex: () => { drawCalls++; },
    endShape: () => {}
  };

  renderMosaicToContext(mockCtx, mosaic, {
    width: 800,
    height: 800,
    margin: 32,
    paddingRatio: 0.05,
    bgColor: '#000',
    fgColor: '#fff'
  });

  console.log(`✓ Mode ${symMode}: generated 16 blocks and rendered ${drawCalls} vector primitives.`);
}

console.log('All MosaicEngine integration checks passed!');
