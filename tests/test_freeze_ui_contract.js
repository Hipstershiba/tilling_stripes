// tests/test_freeze_ui_contract.js
// Tests the structural UI contracts for Freeze Tool:
// 1. [data-tool="freeze"] is unique (single tool selector on the rail)
// 2. data-icon="snowflake" on the freeze tool button
// 3. #freezeToolOptionsWrap exists in index.html with class hidden
// 4. #freezeHelpText and #btnToggleFreezeTool are absent from DOM
// 5. #btnClearFrozen is present inside #freezeStatusRow
// 6. #freezeModeControl, #freezeSizeControl, #freezeUseScope exist

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

console.log('--- Testing Freeze UI Contract (T6) ---');

// 1. [data-tool="freeze"] unique
const freezeBtnMatches = html.match(/data-tool=["']freeze["']/g);
assert.ok(freezeBtnMatches && freezeBtnMatches.length === 1, 'Exactly one [data-tool="freeze"] must exist in DOM');
console.log('✓ Exactly 1 freeze tool button on rail.');

// 2. data-icon="snowflake"
assert.ok(html.includes('data-icon="snowflake"'), '#toolFreeze must declare data-icon="snowflake"');
console.log('✓ data-icon="snowflake" verified.');

// 3. #freezeToolOptionsWrap exists in the contextual top bar, initially hidden
const freezeWrapTag = /<div[^>]*id="freezeToolOptionsWrap"[^>]*>/.exec(html);
assert.ok(freezeWrapTag, '#freezeToolOptionsWrap must exist');
assert.ok(/\bprop-section\b/.test(freezeWrapTag[0]) && /\bhidden\b/.test(freezeWrapTag[0]),
  '#freezeToolOptionsWrap must keep the prop-section surface and start hidden');
console.log('✓ #freezeToolOptionsWrap exists with prop-section and hidden.');

// 3b. The freeze options moved from the dock to the top control bar.
const topBarStart = html.indexOf('id="top-control-bar"');
const topBarEnd = html.indexOf('</header>', topBarStart);
assert.ok(topBarStart > -1 && html.indexOf('id="freezeToolOptionsWrap"') > topBarStart &&
  html.indexOf('id="freezeToolOptionsWrap"') < topBarEnd,
  '#freezeToolOptionsWrap must live inside #top-control-bar');
console.log('✓ Freeze options live in the contextual top bar.');

// 4. Absence of legacy duplicates
assert.ok(!html.includes('id="freezeHelpText"'), '#freezeHelpText must be absent from DOM');
assert.ok(!html.includes('id="btnToggleFreezeTool"'), '#btnToggleFreezeTool must be absent from DOM');
console.log('✓ Legacy duplicates (#freezeHelpText, #btnToggleFreezeTool) absent.');

// 5. Round 6 revision: the generation panel is read-only status; the clear action moved
//    to the freeze tool options (#btnFreezeClearSelection).
const statusRowIdx = html.indexOf('id="freezeStatusRow"');
assert.ok(statusRowIdx !== -1, '#freezeStatusRow must exist');
const statusRowCloseIdx = html.indexOf('</div>', statusRowIdx);
const statusRowContent = html.slice(statusRowIdx, statusRowCloseIdx);
assert.ok(!statusRowContent.includes('id="btnClearFrozen"'), '#btnClearFrozen must not be inside #freezeStatusRow');
assert.ok(!html.includes('id="btnClearFrozen"'), '#btnClearFrozen must be gone from the DOM');
console.log('✓ Generation status row is read-only (no clear button).');

// 6. Mode, Size, and Clear Selection controls exist; redundant freezeUseScope checkbox absent
assert.ok(html.includes('id="freezeModeControl"'), '#freezeModeControl must exist');
assert.ok(html.includes('id="freezeSizeControl"'), '#freezeSizeControl must exist');
assert.ok(html.includes('id="btnFreezeClearSelection"'), '#btnFreezeClearSelection must exist in editor');
assert.ok(!html.includes('id="freezeUseScope"'), '#freezeUseScope checkbox must be absent (free scope already exists)');
console.log('✓ All freeze mode, size, and clear selection controls verified.');

// 7. Verify keyboard shortcuts in sketch.js: Shift+F and Delete/Backspace
const sketchCode = fs.readFileSync(path.join(baseDir, 'sketch.js'), 'utf8');
assert.ok(
  sketchCode.includes("k === 'f'") && sketchCode.includes("e.shiftKey") && sketchCode.includes("clearFrozenCells"),
  'Shift+F shortcut must trigger clearFrozenCells in sketch.js'
);
assert.ok(
  sketchCode.includes("StudioState.activeTool === 'freeze'") &&
  sketchCode.includes("e.key === 'Delete'") &&
  sketchCode.includes("clearFrozenCells"),
  'Delete/Backspace shortcut must trigger clearFrozenCells when freeze tool is active'
);
assert.ok(
  sketchCode.includes("btnFreezeClearSelection.addEventListener('click'"),
  '#btnFreezeClearSelection must have click listener in sketch.js'
);
console.log('✓ Freeze clear selection button listener and shortcuts (Shift+F, Delete/Backspace) verified.');

console.log('--- ALL FREEZE UI CONTRACT CHECKS PASSED! ---');
