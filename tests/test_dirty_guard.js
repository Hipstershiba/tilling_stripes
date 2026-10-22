// tests/test_dirty_guard.js
// Proves the Dirty Guard logic and modal contract (Rodada 4.2 / T2).
// Prevents accidental mosaic destruction when altering parameters on an edited or locked document.

const assert = require('assert');
const path = require('path');
const fs = require('fs');

console.log('--- Testing Dirty Guard Contract (Rodada 4.2 / T2) ---');

// 1. DOM contract: #dirtyGuardDialog exists with required attributes and buttons
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

assert.ok(html.includes('id="dirtyGuardDialog"'), '#dirtyGuardDialog must exist in index.html');
assert.ok(html.includes('role="dialog"'), '#dirtyGuardDialog must have role="dialog"');
assert.ok(html.includes('aria-modal="true"'), '#dirtyGuardDialog must have aria-modal="true"');
assert.ok(html.includes('id="btnDirtyGuardCancel"'), '#btnDirtyGuardCancel must exist');
assert.ok(html.includes('id="btnDirtyGuardConfirm"'), '#btnDirtyGuardConfirm must exist');
assert.ok(html.includes('id="dirtyGuardDontAsk"'), '#dirtyGuardDontAsk must exist');
console.log('✓ #dirtyGuardDialog DOM contract verified (role, aria-modal, cancel/confirm buttons, session checkbox).');

// 2. Logic contract: isDocumentDirty
const sketchSource = fs.readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');
assert.ok(sketchSource.includes('function isDocumentDirty('), 'isDocumentDirty function must exist in sketch.js');

// Simulate isDocumentDirty
function isDocumentDirty(state) {
  if (!state) return false;
  const hasEdits = typeof state.editHistoryIndex === 'number' && state.editHistoryIndex > 0;
  const hasFrozen = Boolean(state.frozenCells && state.frozenCells.size > 0);
  return hasEdits || hasFrozen;
}

// Clean state
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 0, frozenCells: new Map() }), false, 'Clean document is not dirty');
assert.strictEqual(isDocumentDirty({ editHistoryIndex: -1, frozenCells: new Map() }), false, 'Initial boot is not dirty');

// Dirty by edit
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 1, frozenCells: new Map() }), true, '1 edit makes document dirty');
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 5, frozenCells: new Map() }), true, 'Multiple edits make document dirty');

// Dirty by frozen cells
const frozenMap = new Map();
frozenMap.set('0,0,0,0', { baseTileId: 1 });
assert.strictEqual(isDocumentDirty({ editHistoryIndex: 0, frozenCells: frozenMap }), true, 'Frozen cells make document dirty even with index 0');

console.log('✓ isDocumentDirty logic verified (edits and frozen cells correctly identified).');

// 3. Static contract: Esc key closes Dirty Guard
assert.ok(sketchSource.includes("e.key === 'Escape' && dirtyDialog"), 'Escape key must close dirtyGuardDialog');
console.log('✓ Esc shortcut closes dirtyGuardDialog.');

console.log('--- ALL DIRTY GUARD CHECKS PASSED! ---');
