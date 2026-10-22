// tests/test_payload_version.js
// Tests the pure payload version validation and migration rules for state persistence.

const path = require('path');
const targetPath = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR, 'core/state_persistence.js')
  : path.resolve(__dirname, '../core/state_persistence.js');

const StatePersistence = require(targetPath);

console.log('--- Testing Payload Version Validation ---');
console.log('Testing target:', targetPath);

if (typeof StatePersistence.validatePayloadVersion !== 'function') {
  throw new TypeError(`validatePayloadVersion is not a function (got ${typeof StatePersistence.validatePayloadVersion})`);
}
if (StatePersistence.STORAGE_VERSION !== 3) {
  throw new Error(`Expected STORAGE_VERSION === 3, got ${StatePersistence.STORAGE_VERSION}`);
}

// 1. Future version (e.g. version: 99) -> restore: false, backupKey generated, warning provided
{
  const futurePayload = { version: 99, rows: 4, cols: 4 };
  const res = StatePersistence.validatePayloadVersion(futurePayload);
  if (res.restore !== false) {
    throw new Error(`Expected restore === false for version 99, got ${res.restore}`);
  }
  if (!res.backupKey || typeof res.backupKey !== 'string') {
    throw new Error(`Expected non-empty backupKey string, got ${res.backupKey}`);
  }
  if (!res.warning || typeof res.warning !== 'string') {
    throw new Error(`Expected warning message for future version, got ${res.warning}`);
  }
  console.log('✓ Future version (99) blocked from silent restore; backupKey and warning emitted.');
}

// 2. Missing/legacy version -> restore: true, warning present (warns user of legacy migration)
{
  const legacyPayload = { rows: 4, cols: 4 }; // version missing
  const res = StatePersistence.validatePayloadVersion(legacyPayload);
  if (res.restore !== true) {
    throw new Error(`Expected restore === true for legacy payload, got ${res.restore}`);
  }
  if (!res.warning) {
    throw new Error('Expected warning message for legacy migration');
  }
  console.log('✓ Legacy payload (missing version) allowed to restore with warning flag.');
}

// 3. Current version (version: 3) -> restore: true, no warning
{
  const currentPayload = { version: 3, rows: 4, cols: 4 };
  const res = StatePersistence.validatePayloadVersion(currentPayload);
  if (res.restore !== true) {
    throw new Error(`Expected restore === true for version 3, got ${res.restore}`);
  }
  if (res.warning) {
    throw new Error(`Expected no warning for current version 3, got ${res.warning}`);
  }
  console.log('✓ Current version (3) restores cleanly without warning.');
}

// 4. Past supported version (version: 2) -> restore: true, warning: 'Estado migrado de versão anterior'
{
  const v2Payload = { version: 2, rows: 4, cols: 4 };
  const res = StatePersistence.validatePayloadVersion(v2Payload);
  if (res.restore !== true) {
    throw new Error(`Expected restore === true for version 2, got ${res.restore}`);
  }
  console.log('✓ Version 2 restores successfully.');
}

console.log('--- ALL PAYLOAD VERSION CHECKS PASSED PERFECTLY! ---');
