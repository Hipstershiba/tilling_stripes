// tests/test_document_snapshot.js
// Proves the parameter half of a document snapshot: collect, apply and attach.
// Without this, undoing a generation restores cells that belong to different parameters.

const assert = require('assert');
const path = require('path');

const DocumentSnapshot = require(path.join(__dirname, '../core/document_snapshot.js'));

console.log('--- Testing document snapshot parameters ---');

function makeState() {
  return {
    rows: 3,
    cols: 4,
    subdivision: 2,
    seed: 1024,
    gridSymmetryMode: 'mandala_d4',
    blockSymmetryMode: 'bilateral_d2',
    syncBlockSymmetry: false,
    margin: 24,
    paddingRatio: 0.05,
    allowedTiles: new Set([7, 3, 2])
  };
}

// 1. collectParams normalizes the Set into a sorted array
const params = DocumentSnapshot.collectParams(makeState());
assert.deepStrictEqual(params.allowedTiles, [2, 3, 7], 'allowedTiles must be a sorted array');
assert.strictEqual(params.rows, 3);
assert.strictEqual(params.seed, 1024);
assert.strictEqual(params.paddingRatio, 0.05);
console.log('✓ collectParams captures every parameter and normalizes the tile set.');

// 2. applyParams restores a mutated state
const mutated = makeState();
mutated.rows = 6;
mutated.cols = 6;
mutated.seed = 999;
mutated.gridSymmetryMode = 'rotational_c4';
mutated.allowedTiles = new Set([1]);
mutated.paddingRatio = 0.2;

DocumentSnapshot.applyParams(mutated, params);

assert.strictEqual(mutated.rows, 3, 'rows restored');
assert.strictEqual(mutated.cols, 4, 'cols restored');
assert.strictEqual(mutated.seed, 1024, 'seed restored');
assert.strictEqual(mutated.gridSymmetryMode, 'mandala_d4', 'grid mode restored');
assert.strictEqual(mutated.blockSymmetryMode, 'bilateral_d2', 'block mode restored');
assert.strictEqual(mutated.syncBlockSymmetry, false, 'sync flag restored');
assert.strictEqual(mutated.margin, 24, 'margin restored');
assert.strictEqual(mutated.paddingRatio, 0.05, 'padding restored');
assert.deepStrictEqual(Array.from(mutated.allowedTiles).sort((a, b) => a - b), [2, 3, 7], 'palette restored');
console.log('✓ applyParams restores the whole document state.');

// 3. attachDocument marks the snapshot as a document step
const cells = { rows: 3, cols: 4, subtilesPerSide: 4, gridSnap: [] };
assert.strictEqual(DocumentSnapshot.hasDocument(cells), false, 'a plain cells snapshot is not a document step');
const doc = DocumentSnapshot.attachDocument(cells, params);
assert.strictEqual(doc, cells, 'attachDocument returns the same object');
assert.strictEqual(DocumentSnapshot.hasDocument(doc), true, 'snapshot now crosses generations');
assert.strictEqual(doc.document.seed, 1024);
console.log('✓ attachDocument turns a cell snapshot into a document snapshot.');

// 4. A snapshot without parameters stays a plain cell snapshot (paint undo never rewinds params)
const plain = DocumentSnapshot.attachDocument({ rows: 1, cols: 1, subtilesPerSide: 2, gridSnap: [] }, null);
assert.strictEqual(DocumentSnapshot.hasDocument(plain), false);
console.log('✓ Paint-level snapshots are unaffected (params are not rewound by a stroke).');

// 5. Round trip
const roundTrip = JSON.parse(JSON.stringify(DocumentSnapshot.collectParams(makeState())));
assert.deepStrictEqual(roundTrip, params, 'parameters survive serialization');
console.log('✓ Parameters survive a JSON round trip (payload compatible).');

console.log('--- ALL DOCUMENT SNAPSHOT CHECKS PASSED! ---');
