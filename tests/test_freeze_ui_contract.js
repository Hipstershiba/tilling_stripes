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

// 3. #freezeToolOptionsWrap with class hidden
assert.ok(
  html.includes('id="freezeToolOptionsWrap" class="prop-section hidden"') ||
  html.includes('id="freezeToolOptionsWrap" class="hidden prop-section"'),
  '#freezeToolOptionsWrap must exist with class hidden'
);
console.log('✓ #freezeToolOptionsWrap exists with class hidden.');

// 4. Absence of legacy duplicates
assert.ok(!html.includes('id="freezeHelpText"'), '#freezeHelpText must be absent from DOM');
assert.ok(!html.includes('id="btnToggleFreezeTool"'), '#btnToggleFreezeTool must be absent from DOM');
console.log('✓ Legacy duplicates (#freezeHelpText, #btnToggleFreezeTool) absent.');

// 5. #btnClearFrozen inside #freezeStatusRow
const statusRowIdx = html.indexOf('id="freezeStatusRow"');
assert.ok(statusRowIdx !== -1, '#freezeStatusRow must exist');
const statusRowCloseIdx = html.indexOf('</div>', statusRowIdx);
const statusRowContent = html.slice(statusRowIdx, statusRowCloseIdx);
assert.ok(statusRowContent.includes('id="btnClearFrozen"'), '#btnClearFrozen must be inside #freezeStatusRow');
console.log('✓ #btnClearFrozen inside #freezeStatusRow verified.');

// 6. Mode, Size, Scope controls exist
assert.ok(html.includes('id="freezeModeControl"'), '#freezeModeControl must exist');
assert.ok(html.includes('id="freezeSizeControl"'), '#freezeSizeControl must exist');
assert.ok(html.includes('id="freezeUseScope"'), '#freezeUseScope must exist');
console.log('✓ All freeze mode, size, and scope controls exist.');

console.log('--- ALL FREEZE UI CONTRACT CHECKS PASSED! ---');
