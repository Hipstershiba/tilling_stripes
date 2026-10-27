// tests/test_info_scopes_source.js
// Tests that INFO_TOPICS in ui_info.js derives scope descriptions directly from MosaicEngine.EDIT_SCOPES.

const path = require('path');
const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

// Set up minimal browser window mock for Node
global.window = global.window || {};
require(path.join(baseDir, 'core/d4_symmetry.js'));
require(path.join(baseDir, 'core/tile_registry.js'));
require(path.join(baseDir, 'core/mosaic_engine.js'));
require(path.join(baseDir, 'ui_info.js'));

console.log('--- Testing ui_info.js Scope Topic Derivation ---');

const { EDIT_SCOPES } = window.MosaicEngine;
if (!EDIT_SCOPES) {
  throw new Error('window.MosaicEngine.EDIT_SCOPES not found');
}

const InfoUI = window.InfoUI;
if (!InfoUI || !InfoUI.INFO_TOPICS) {
  throw new Error('window.InfoUI.INFO_TOPICS not found');
}

const scopesTopic = InfoUI.INFO_TOPICS.scopes;
if (!scopesTopic || !Array.isArray(scopesTopic.body)) {
  throw new Error('INFO_TOPICS.scopes.body must be an array of strings');
}

// 1. Verify that "Livre (1)" does NOT exist (which was the bug where shortcut 1 was misattributed to single/Livre)
const canvasCenterShortcut = EDIT_SCOPES.canvas_center.shortcut;
for (const line of scopesTopic.body) {
  if (line.includes('Livre (1)') && canvasCenterShortcut === '1') {
    throw new Error(`Contradiction found in scopes help: line reads "${line}", but canvas_center.shortcut is 1!`);
  }
}

// 2. Verify that for every scope defined in MosaicEngine.EDIT_SCOPES,
// there is an entry with `${s.name} (${s.shortcut})`
const scopesList = Object.values(EDIT_SCOPES).sort((a, b) => Number(a.shortcut) - Number(b.shortcut));
if (scopesTopic.body.length !== scopesList.length) {
  throw new Error(`Expected ${scopesList.length} items in scopesTopic.body, got ${scopesTopic.body.length}`);
}

for (let i = 0; i < scopesList.length; i++) {
  const scope = scopesList[i];
  const item = scopesTopic.body[i];
  const expectedPrefix = `${scope.name} (${scope.shortcut})`;
  if (!item.startsWith(expectedPrefix)) {
    throw new Error(`Item ${i}: expected to start with "${expectedPrefix}", got "${item}"`);
  }
}
console.log('✓ All 6 scopes in INFO_TOPICS are strictly ordered 1..6 matching EDIT_SCOPES shortcuts.');

// 3. Verify shortcuts topic also references correct 1-6 mapping
const shortcutsTopic = InfoUI.INFO_TOPICS.shortcuts;
if (!shortcutsTopic || !Array.isArray(shortcutsTopic.body)) {
  throw new Error('INFO_TOPICS.shortcuts.body must be an array of strings');
}

const scopeShortcutLine = shortcutsTopic.body.find(l => l.includes('1 a 6') || l.includes('1-6') || l.includes('1–6'));
if (!scopeShortcutLine) {
  throw new Error('Could not find 1-6 scope shortcut line in shortcuts topic');
}
if (!scopeShortcutLine.includes('Q ou Tab') || scopeShortcutLine.includes('1 a 6: Seleciona')) {
  throw new Error('shortcuts topic still contains misattributed "Livre (1)"');
}

console.log('--- ALL SCOPES SOURCE DERIVATION CHECKS PASSED PERFECTLY! ---');
