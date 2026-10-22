// tests/test_freeze_wiring.js
// Contract test: fails if regenerateMosaic in sketch.js fails to call generateMosaicWithFrozen.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const sketchPath = path.join(__dirname, '../sketch.js');
const sketchCode = fs.readFileSync(sketchPath, 'utf8');

console.log('--- Testing regenerateMosaic Wiring Contract ---');

// Extract regenerateMosaic body
const fnStart = sketchCode.indexOf('function regenerateMosaic(');
assert.ok(fnStart !== -1, 'function regenerateMosaic must exist in sketch.js');

const fnEnd = sketchCode.indexOf('function pushGenerationHistory(', fnStart);
assert.ok(fnEnd !== -1, 'pushGenerationHistory must follow regenerateMosaic');

const fnBody = sketchCode.slice(fnStart, fnEnd);

// Contract assertion: must call generateMosaicWithFrozen
const hasCall = fnBody.includes('generateMosaicWithFrozen');
assert.ok(
  hasCall,
  'regenerateMosaic() in sketch.js MUST call window.MosaicEngine.generateMosaicWithFrozen(..., StudioState.frozenCells)'
);

// Contract assertion: must NOT have local duplicate loop restoring frozenCells
assert.ok(
  !fnBody.includes('targetCell.baseTileId = cellData.baseTileId'),
  'regenerateMosaic() must not contain duplicate local loop restoring cellData (logic belongs in core/mosaic_engine.js)'
);

console.log('✓ regenerateMosaic wiring contract verified.');
