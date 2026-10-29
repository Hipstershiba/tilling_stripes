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

const rangeMatches = html.match(/id=["']edgeVariabilityInput["']/g) || [];
assert.strictEqual(rangeMatches.length, 1, 'edgeVariabilityInput must exist exactly once');
assert.ok(/<input[^>]*type=["']range["'][^>]*id=["']edgeVariabilityInput["']/.test(html) ||
  /<input[^>]*id=["']edgeVariabilityInput["'][^>]*type=["']range["']/.test(html),
  'edgeVariabilityInput must be a range control');
assert.ok(/<input[^>]*id=["']edgeVariabilityInput["'][^>]*min=["']0["'][^>]*max=["']100["']/.test(html),
  'variability must run from 0 to 100 percent');
assert.ok(/<label[^>]*for=["']edgeVariabilityInput["'][^>]*title=["']Variabilidade do encaixe["']/.test(html),
  'the variability control must be labelled and expose its full name on hover');
assert.ok(/<output[^>]*id=["']edgeVariabilityValue["'][^>]*for=["']edgeVariabilityInput["']/.test(html),
  'the variability control must expose its numeric readout');
assert.ok(html.includes('data-icon-slot="variability"'), 'the variability control must lead with an icon');
console.log('✓ Variability slider, label, readout and icon are present.');

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

let variabilityRegenerations = 0;
const variabilityContext = {
  StudioState: { edgeMatch: true, edgeVariability: 0.3 },
  regenerateMosaic: () => { variabilityRegenerations++; }
};
vm.createContext(variabilityContext);
vm.runInContext(
  extractFunction('clampEdgeVariability') + '\n' + extractFunction('setEdgeVariability'),
  variabilityContext
);
assert.strictEqual(variabilityContext.setEdgeVariability(0.55), true);
assert.strictEqual(variabilityContext.StudioState.edgeVariability, 0.55);
assert.strictEqual(variabilityRegenerations, 1);
assert.strictEqual(variabilityContext.setEdgeVariability(0.55), false, 'unchanged variability must not regenerate');
assert.strictEqual(variabilityContext.setEdgeVariability(2), true);
assert.strictEqual(variabilityContext.StudioState.edgeVariability, 1, 'variability clamps above 1');
assert.strictEqual(variabilityContext.setEdgeVariability(-1), true);
assert.strictEqual(variabilityContext.StudioState.edgeVariability, 0, 'variability clamps below 0');
assert.strictEqual(variabilityRegenerations, 3);
console.log('✓ setEdgeVariability clamps, regenerates only on change and drives the generator.');

const DocumentSnapshot = require(path.join(root, 'core/document_snapshot.js'));
assert.ok(DocumentSnapshot.PARAM_FIELDS.includes('edgeMatch'), 'edgeMatch must be a document parameter');
assert.ok(DocumentSnapshot.PARAM_FIELDS.includes('edgeVariability'), 'edgeVariability must be a document parameter');
const params = DocumentSnapshot.collectParams({
  edgeMatch: true,
  edgeVariability: 0.65,
  allowedTiles: new Set([1, 2]),
  rows: 3,
  cols: 3
});
assert.strictEqual(params.edgeMatch, true);
assert.strictEqual(params.edgeVariability, 0.65);
const restored = { edgeMatch: false, edgeVariability: 0 };
DocumentSnapshot.applyParams(restored, params);
assert.strictEqual(restored.edgeMatch, true, 'edgeMatch must survive undo snapshots');
assert.strictEqual(restored.edgeVariability, 0.65, 'edgeVariability must survive undo snapshots');
console.log('✓ Document snapshots capture and restore edgeMatch and edgeVariability.');

// The v3 payload and the generation history must carry the new parameter too,
// otherwise reopening the file would silently reset the slider.
assert.ok((sketch.match(/edgeVariability:\s*StudioState\.edgeVariability/g) || []).length >= 4,
  'payload, history and the three generation calls must carry edgeVariability');
assert.ok(/saved\.edgeVariability/.test(sketch), 'applySavedStudioState must restore edgeVariability');
console.log('✓ Persistence and generation history carry edgeVariability.');

console.log('--- ALL EDGE-MATCH UI CHECKS PASSED! ---');
