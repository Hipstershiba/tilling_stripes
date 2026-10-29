// tests/test_edge_match_ui.js
// Proves the checkbox exists once, is wired to the generation mode, and that the
// document snapshot carries the new parameter.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sketch = fs.readFileSync(path.join(root, 'sketch.js'), 'utf8');

console.log('--- Testing edge-match UI wiring ---');

const checkboxMatches = html.match(/id=["']toggleEdgeMatch["']/g) || [];
assert.strictEqual(checkboxMatches.length, 1, 'toggleEdgeMatch must exist exactly once');
assert.ok(/<input[^>]*id=["']toggleEdgeMatch["'][^>]*type=["']checkbox["']/.test(html) ||
  /<input[^>]*type=["']checkbox["'][^>]*id=["']toggleEdgeMatch["']/.test(html),
  'toggleEdgeMatch must be a checkbox');
assert.ok(/<label[^>]*for=["']toggleEdgeMatch["']/.test(html), 'the checkbox must have an explicit label');
assert.ok(html.indexOf('core/tile_edge_signatures.js') < html.indexOf('core/mosaic_engine.js'),
  'edge signatures must load before the mosaic engine');
console.log('✓ Checkbox, label and script order are valid.');

function extractFunction(name) {
  const start = sketch.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist in sketch.js`);
  const end = sketch.indexOf('\n}', start);
  assert.ok(end > start, `${name} must be a complete function`);
  return sketch.slice(start, end + 2);
}

let regenerations = 0;
const context = {
  StudioState: { edgeMatch: false },
  regenerateMosaic: () => { regenerations++; }
};
vm.createContext(context);
vm.runInContext(extractFunction('setEdgeMatchMode'), context);

assert.strictEqual(context.setEdgeMatchMode(true), true);
assert.strictEqual(context.StudioState.edgeMatch, true);
assert.strictEqual(regenerations, 1);
assert.strictEqual(context.setEdgeMatchMode(true), false, 'unchanged state must not regenerate');
assert.strictEqual(regenerations, 1);
assert.strictEqual(context.setEdgeMatchMode(false), true);
assert.strictEqual(context.StudioState.edgeMatch, false);
assert.strictEqual(regenerations, 2);
console.log('✓ setEdgeMatchMode flips the flag and regenerates only on change.');

const DocumentSnapshot = require(path.join(root, 'core/document_snapshot.js'));
assert.ok(DocumentSnapshot.PARAM_FIELDS.includes('edgeMatch'), 'edgeMatch must be a document parameter');
const params = DocumentSnapshot.collectParams({
  edgeMatch: true,
  allowedTiles: new Set([1, 2]),
  rows: 3,
  cols: 3
});
assert.strictEqual(params.edgeMatch, true);
const restored = { edgeMatch: false };
DocumentSnapshot.applyParams(restored, params);
assert.strictEqual(restored.edgeMatch, true, 'edgeMatch must survive undo snapshots');
console.log('✓ Document snapshots capture and restore edgeMatch.');

console.log('--- ALL EDGE-MATCH UI CHECKS PASSED! ---');
