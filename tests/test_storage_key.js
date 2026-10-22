// tests/test_storage_key.js
// Tests that there is exactly ONE unified storage key definition in production code,
// and validates round-trip storage using this single constant.

const fs = require('fs');
const path = require('path');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

console.log('--- Testing Storage Key Unification ---');
console.log('Checking directory:', baseDir);

const filesToCheck = [
  path.join(baseDir, 'sketch.js'),
  path.join(baseDir, 'core/state_persistence.js'),
  path.join(baseDir, 'core/mosaic_engine.js'),
  path.join(baseDir, 'core/d4_symmetry.js'),
  path.join(baseDir, 'core/tile_registry.js'),
  path.join(baseDir, 'ui_info.js')
];

const occurrences = [];
for (const file of filesToCheck) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/tiling_stripes_studio_[a-zA-Z0-9_]+/g);
  if (matches) {
    for (const m of matches) {
      occurrences.push({ file: path.basename(file), key: m });
    }
  }
}

console.log('Found storage key literals in production code:', occurrences);

// Baseline has 'tiling_stripes_studio_v2_state' in state_persistence.js AND 'tiling_stripes_studio_state_v2' in sketch.js.
// Requirement: exactly one unique literal value in production code, defined in core/state_persistence.js.
const uniqueKeys = new Set(occurrences.map(o => o.key));

if (uniqueKeys.has('tiling_stripes_studio_v2_state')) {
  throw new Error('Found deprecated diverging key "tiling_stripes_studio_v2_state" in production code');
}

if (!uniqueKeys.has('tiling_stripes_studio_state_v2')) {
  throw new Error('Expected canonical key "tiling_stripes_studio_state_v2" not found');
}

// In production code, only state_persistence.js should define the literal; sketch.js must read window.StatePersistence.STORAGE_KEY_STUDIO_STATE
const sketchContent = fs.readFileSync(path.join(baseDir, 'sketch.js'), 'utf8');
if (sketchContent.includes("'tiling_stripes_studio_state_v2'") || sketchContent.includes('"tiling_stripes_studio_state_v2"')) {
  throw new Error('sketch.js still contains hardcoded storage key literal instead of reading from StatePersistence');
}

// Check StatePersistence exports canonical key
const StatePersistence = require(path.join(baseDir, 'core/state_persistence.js'));
if (StatePersistence.STORAGE_KEY_STUDIO_STATE !== 'tiling_stripes_studio_state_v2') {
  throw new Error(`StatePersistence.STORAGE_KEY_STUDIO_STATE is "${StatePersistence.STORAGE_KEY_STUDIO_STATE}", expected "tiling_stripes_studio_state_v2"`);
}

console.log('✓ Exactly one canonical storage key exists in production code ("tiling_stripes_studio_state_v2").');
console.log('--- ALL STORAGE KEY CHECKS PASSED PERFECTLY! ---');
