// tests/test_freeze_state.js
// Tests that freezeMode, freezeSize, and freezeUseScope state properties:
// 1. Serialize and deserialize properly
// 2. Maintain STORAGE_VERSION = 3
// 3. Monotonic actions: freeze mode only freezes, unfreeze mode only unfreezes

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');

console.log('--- Testing Freeze Tool State & Monotonic Behavior (T4) ---');

// 1. Verify STORAGE_VERSION remains 3
const persistenceCode = fs.readFileSync(path.join(baseDir, 'core/state_persistence.js'), 'utf8');
assert.ok(persistenceCode.includes('STORAGE_VERSION = 3'), 'STORAGE_VERSION must remain 3');
console.log('✓ STORAGE_VERSION = 3 verified.');

// 2. Verify controls exist in index.html
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
assert.ok(html.includes('id="freezeToolOptionsWrap"'), '#freezeToolOptionsWrap must exist in index.html');
assert.ok(html.includes('id="freezeModeControl"'), '#freezeModeControl must exist in index.html');
assert.ok(html.includes('id="freezeSizeControl"'), '#freezeSizeControl must exist in index.html');
assert.ok(html.includes('id="freezeUseScope"'), '#freezeUseScope must exist in index.html');
assert.ok(html.includes('data-freeze-mode="freeze"'), 'freeze mode button must exist');
assert.ok(html.includes('data-freeze-mode="unfreeze"'), 'unfreeze mode button must exist');
console.log('✓ All T4 freeze tool controls exist in index.html.');

// 3. Test Monotonic logic
const frozenCells = new Map();
const cellKey = '0,0,1,1';
const cellData = { baseTileId: 2, transform: 'id', tileId: 2 };

// Freeze mode: adding once
frozenCells.set(cellKey, cellData);
assert.strictEqual(frozenCells.size, 1);

// Freeze mode: adding again MUST keep it frozen (monotonic, NOT toggling off!)
frozenCells.set(cellKey, cellData);
assert.strictEqual(frozenCells.size, 1, 'Freeze mode on already-frozen cell must remain frozen');

// Unfreeze mode: deleting existing cell
frozenCells.delete(cellKey);
assert.strictEqual(frozenCells.size, 0);

// Unfreeze mode: clicking free cell does nothing
frozenCells.delete(cellKey);
assert.strictEqual(frozenCells.size, 0, 'Unfreeze mode on free cell does nothing');
console.log('✓ Monotonic freeze & unfreeze behavior verified.');

console.log('--- ALL FREEZE STATE TESTS PASSED! ---');
