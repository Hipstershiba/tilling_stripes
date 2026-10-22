// tests/test_scope_chip.js
// Tests the pure formatScopeChip formatter and dynamic scope chip labels.

const path = require('path');
const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

const modulePath = path.join(baseDir, 'core/ui_format.js');
console.log('--- Testing Scope Chip Dynamic Formatting ---');
console.log('Testing target module:', modulePath);

let UiFormat;
try {
  UiFormat = require(modulePath);
} catch (err) {
  throw new Error(`Failed to load core/ui_format.js: ${err.message}`);
}

if (typeof UiFormat.formatScopeChip !== 'function') {
  throw new TypeError(`formatScopeChip is not a function (got ${typeof UiFormat.formatScopeChip})`);
}

const EXPECTED_LABELS = {
  canvas_center: 'Centro • 8 eixos',
  orbit_sym:     'Órbita • bloco+grade',
  block_sym:     'Bloco • 4 quadrantes',
  all_blocks:    'Todos • grade inteira',
  single:        'Livre • 1 célula',
  same_tile:     'Iguais • mesmo tile'
};

// 1. All 6 known scopes return exact expected string
for (const [scopeId, expectedText] of Object.entries(EXPECTED_LABELS)) {
  const result = UiFormat.formatScopeChip(scopeId, { rows: 1, cols: 1 });
  if (result !== expectedText) {
    throw new Error(`Scope "${scopeId}": expected "${expectedText}", got "${result}"`);
  }
}
console.log('✓ All 6 scope IDs return exact expected formatted labels.');

// 2. Unknown scope returns empty string
const unknownResult = UiFormat.formatScopeChip('unknown_mode_xyz');
if (unknownResult !== '') {
  throw new Error(`Expected empty string for unknown scope, got "${unknownResult}"`);
}
console.log('✓ Unknown scope safely returns empty string.');

// 3. Multi-cell pattern on same_tile returns indicator suffix
const multiPatternResult = UiFormat.formatScopeChip('same_tile', { rows: 2, cols: 3 });
if (multiPatternResult !== 'Iguais • mesmo tile • pincel 2×3') {
  throw new Error(`Expected "Iguais • mesmo tile • pincel 2×3", got "${multiPatternResult}"`);
}
console.log('✓ Multi-cell pattern on same_tile properly flags pattern dimensions.');

// 4. Multi-cell pattern on other scopes does NOT append suffix
const centerMulti = UiFormat.formatScopeChip('canvas_center', { rows: 2, cols: 2 });
if (centerMulti !== 'Centro • 8 eixos') {
  throw new Error(`Expected unadorned label for canvas_center with 2x2, got "${centerMulti}"`);
}
console.log('✓ Non-same_tile scopes do not append brush dimensions.');

console.log('--- ALL SCOPE CHIP FORMATTING CHECKS PASSED PERFECTLY! ---');
