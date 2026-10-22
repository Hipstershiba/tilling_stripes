// tests/test_info_ui_state.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Information Architecture & UI State (Rodada 2) ---');

// 1. Load and verify ui_info.js
const uiInfoPath = path.join(__dirname, '../ui_info.js');
assert.ok(fs.existsSync(uiInfoPath), 'ui_info.js must exist');

const uiInfoContent = fs.readFileSync(uiInfoPath, 'utf8');

// Mock window and execute ui_info.js
global.window = {};
global.document = {
  getElementById: () => null,
  addEventListener: () => {}
};
eval(uiInfoContent);

assert.ok(window.InfoUI, 'window.InfoUI must be exposed');
const { INFO_TOPICS } = window.InfoUI;
assert.ok(INFO_TOPICS && typeof INFO_TOPICS === 'object', 'INFO_TOPICS must be an object');

const requiredTopics = [
  'grid-symmetry',
  'block-symmetry',
  'scopes',
  'center-symmetry',
  'brush',
  'rotate',
  'stamp',
  'same-tile',
  'd4-strict',
  'kaleidoscope',
  'persistence',
  'shortcuts',
  'inspect'
];

for (const t of requiredTopics) {
  assert.ok(INFO_TOPICS[t], `Topic '${t}' must be defined in INFO_TOPICS`);
  assert.ok(INFO_TOPICS[t].title && typeof INFO_TOPICS[t].title === 'string', `Topic '${t}' must have a title`);
  assert.ok(Array.isArray(INFO_TOPICS[t].body) && INFO_TOPICS[t].body.length > 0, `Topic '${t}' must have body items`);
}
console.log(`✓ All ${requiredTopics.length} required info topics are defined with titles and bullet items.`);

// 2. Check index.html structure
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// Popover and tooltip elements
assert.ok(html.includes('id="infoPopover"'), '#infoPopover must exist in index.html');
assert.ok(html.includes('id="uiTooltip"'), '#uiTooltip must exist in index.html');
assert.ok(html.includes('id="btnHelp"'), '#btnHelp must exist in index.html');

// Shortcut pills removal
assert.ok(!html.includes('class="shortcut-pill"'), '.shortcut-pill elements must NOT exist in index.html');
console.log('✓ Shortcut pills removed and replaced by #btnHelp.');

// Cleaned descriptions in Gerador
assert.ok(html.includes('id="gridSymmetryDesc" class="prop-help-box hidden"'), '#gridSymmetryDesc must have class hidden');
assert.ok(html.includes('id="blockSymmetryDesc" class="prop-sub-hint hidden"'), '#blockSymmetryDesc must have class hidden');
assert.ok(html.includes('id="blockSymmetryWarning"'), '#blockSymmetryWarning must exist');

// Cleaned descriptions in Editor
assert.ok(!html.includes('id="editScopeHint"'), '#editScopeHint paragraph must be removed from index.html');
assert.ok(html.includes('id="editScopeChip"'), '#editScopeChip must exist for compact scope status');
assert.ok(html.includes('id="d4SymmetryWarning"'), '#d4SymmetryWarning must exist');
assert.ok(html.includes('id="d4EditedBadge"'), '#d4EditedBadge must exist');

// Illustrator Color Widget on Left Toolbar
assert.ok(html.includes('class="illustrator-color-widget"'), 'Illustrator color widget must exist in index.html');
assert.ok(html.includes('id="fgColorPicker"'), '#fgColorPicker must exist in index.html');
assert.ok(html.includes('id="bgColorPicker"'), '#bgColorPicker must exist in index.html');
assert.ok(html.includes('id="btnSwapColors"'), '#btnSwapColors must exist in index.html');
console.log('✓ Illustrator-style color widget verified on toolbar.');

// 3. Check CSS rules in style.css
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');

assert.ok(css.includes('.info-btn'), '.info-btn CSS rule must exist');
assert.ok(css.includes('.info-popover'), '.info-popover CSS rule must exist');
assert.ok(css.includes('.ui-tooltip'), '.ui-tooltip CSS rule must exist');
assert.ok(css.includes('.illustrator-color-widget'), '.illustrator-color-widget CSS rule must exist');
assert.ok(css.includes('.status-help-btn'), '.status-help-btn CSS rule must exist');
assert.ok(css.includes('.canvas-center-sym-grid'), '.canvas-center-sym-grid CSS rule must exist');
assert.ok(css.includes('.d4-edited-badge'), '.d4-edited-badge CSS rule must exist');
console.log('✓ CSS styling for popovers, tooltips, buttons and color widget verified.');

console.log('--- ALL INFO UI STATE CHECKS PASSED PERFECTLY! ---');
