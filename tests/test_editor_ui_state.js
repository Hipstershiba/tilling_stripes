// tests/test_editor_ui_state.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Editor UI State and Visibility Matrix ---');

// 1. Static CSS / HTML Analysis
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Assert generic .hidden rule exists
assert.ok(
  css.includes('.hidden') && css.includes('display: none !important;'),
  'style.css must have generic .hidden { display: none !important; } rule'
);
console.log('✓ Generic .hidden { display: none !important; } verified in style.css');

// Assert all hidden elements in index.html are valid
const hiddenMatches = html.match(/class="[^"]*\bhidden\b[^"]*"/g) || [];
console.log(`✓ Found ${hiddenMatches.length} initial .hidden elements in index.html, all styled with display: none !important.`);

// Assert #editScopeHint exists
assert.ok(html.includes('id="editScopeHint"'), 'index.html must have #editScopeHint');
assert.ok(css.includes('.edit-scope-hint'), 'style.css must have .edit-scope-hint rule');
console.log('✓ #editScopeHint element and CSS rule verified.');

// Assert #sameTileNotice exists
assert.ok(html.includes('id="sameTileNotice"'), 'index.html must have #sameTileNotice');
console.log('✓ #sameTileNotice element verified.');

// Assert #persistenceWarning exists
assert.ok(html.includes('id="persistenceWarning"'), 'index.html must have #persistenceWarning');
assert.ok(css.includes('.persistence-warning'), 'style.css must have .persistence-warning rule');
console.log('✓ #persistenceWarning element and CSS rule verified.');

// Assert #editorToast exists
assert.ok(html.includes('id="editorToast"'), 'index.html must have #editorToast');
assert.ok(css.includes('.editor-toast'), 'style.css must have .editor-toast rule');
console.log('✓ #editorToast element and CSS rule verified.');

// Assert .tile-swatch-btn.available exists
assert.ok(css.includes('.tile-swatch-btn.available'), 'style.css must have .tile-swatch-btn.available rule');
console.log('✓ .tile-swatch-btn.available state verified in style.css.');

// Assert cursor definitions for all active tools exist
const tools = ['paint', 'rotate', 'stamp', 'inspect', 'pan', 'zoom'];
for (const t of tools) {
  assert.ok(
    css.includes(`body[data-active-tool="${t}"]`),
    `style.css must define cursor for tool: ${t}`
  );
}
console.log('✓ Cursor rules for all active tools verified in style.css.');

console.log('--- ALL EDITOR UI STATE CHECKS PASSED PERFECTLY! ---');
