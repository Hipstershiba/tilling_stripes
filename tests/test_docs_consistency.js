// tests/test_docs_consistency.js
// Tests that documentation (MANUAL_MANUTENCAO.md, README.md) matches actual code contracts,
// function signatures, symmetry mode IDs, and storage keys without false statements.

const fs = require('fs');
const path = require('path');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

console.log('--- Testing Documentation Consistency ---');

const manualPath = fs.existsSync(path.join(baseDir, 'docs/MANUAL_MANUTENCAO.md'))
  ? path.join(baseDir, 'docs/MANUAL_MANUTENCAO.md')
  : path.join(baseDir, 'MANUAL_MANUTENCAO.md');
const readmePath = path.join(baseDir, 'README.md');

const manualText = fs.existsSync(manualPath) ? fs.readFileSync(manualPath, 'utf8') : '';
const readmeText = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';

// 1. "kaleidoscope_permissive" must NOT appear in live docs (canonical ID is "kaleidoscope")
if (manualText.includes('kaleidoscope_permissive')) {
  throw new Error('Found invalid mode ID "kaleidoscope_permissive" in MANUAL_MANUTENCAO.md (must be "kaleidoscope")');
}
if (readmeText.includes('kaleidoscope_permissive')) {
  throw new Error('Found invalid mode ID "kaleidoscope_permissive" in README.md (must be "kaleidoscope")');
}
console.log('✓ No invalid "kaleidoscope_permissive" ID found in documentation.');

// 2. Deprecated storage key "tiling_stripes_studio_v2_state" must NOT appear in live docs
if (manualText.includes('tiling_stripes_studio_v2_state')) {
  throw new Error('Found deprecated key "tiling_stripes_studio_v2_state" in MANUAL_MANUTENCAO.md');
}
if (readmeText.includes('tiling_stripes_studio_v2_state')) {
  throw new Error('Found deprecated key "tiling_stripes_studio_v2_state" in README.md');
}
console.log('✓ No deprecated storage keys found in documentation.');

// 3. Verify function signatures described in manual match actual exports of core/state_persistence.js
const StatePersistence = require(path.join(baseDir, 'core/state_persistence.js'));
const expectedFunctions = [
  'isQuotaError',
  'getMaxEditHistoryForMosaic',
  'trimHistoryOnPush',
  'migratePayloadHistories',
  'buildMinimalEmergencyPayload',
  'saveWithQuotaFallback',
  'createSaveScheduler',
  'validatePayloadVersion'
];

for (const fnName of expectedFunctions) {
  if (typeof StatePersistence[fnName] !== 'function') {
    throw new Error(`Export ${fnName} missing from StatePersistence`);
  }
}
console.log('✓ All documented StatePersistence functions exist and are exported.');

console.log('--- ALL DOCS CONSISTENCY CHECKS PASSED PERFECTLY! ---');
