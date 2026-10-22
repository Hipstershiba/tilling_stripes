// tests/test_ui_layout_contract.js
// Tests the structural layout contracts of index.html for Round 4 UI surfaces reorganization:
// 1. #workspaceSwitcher and #btnToggleRightDock inside #right-dock
// 2. #btnFitArtboard, #btnZoomReset100 and the 4 #toggleGuide* inside #status-bar
// 3. #fgColorPicker inside #left-toolbar and strictly after the last .tool-btn[data-tool]
// 4. #editToolSegmented absent from DOM

const fs = require('fs');
const path = require('path');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

const htmlPath = path.join(baseDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('--- Testing UI Layout Contract ---');

// Helper to extract outer HTML / boundaries of an element by id
function getElementBounds(content, id) {
  const startTagRegex = new RegExp(`<([a-zA-Z0-9]+)[^>]*id=["']${id}["'][^>]*>`, 'i');
  const match = content.match(startTagRegex);
  if (!match) return null;

  const tagName = match[1].toLowerCase();
  const startIndex = match.index;
  const tagOpenEnd = startIndex + match[0].length;

  // Find matching closing tag taking nested same tags into account
  let depth = 1;
  const tagRegex = new RegExp(`<\/?${tagName}[^>]*>`, 'gi');
  tagRegex.lastIndex = tagOpenEnd;

  let endTagMatch;
  while ((endTagMatch = tagRegex.exec(content)) !== null) {
    if (endTagMatch[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return {
          startIndex,
          endIndex: endTagMatch.index + endTagMatch[0].length,
          content: content.slice(startIndex, endTagMatch.index + endTagMatch[0].length)
        };
      }
    } else if (!endTagMatch[0].endsWith('/>')) {
      depth++;
    }
  }

  return { startIndex, endIndex: content.length, content: content.slice(startIndex) };
}

// 1. #editToolSegmented must be absent from index.html
if (html.includes('id="editToolSegmented"') || html.includes("id='editToolSegmented'")) {
  throw new Error('Contract violation: #editToolSegmented must be removed from index.html (no duplicate tool selectors).');
}
console.log('✓ #editToolSegmented is absent from index.html.');

// Extract regions
const rightDockBounds = getElementBounds(html, 'right-dock');
if (!rightDockBounds) throw new Error('Missing #right-dock in index.html');

const statusBarBounds = getElementBounds(html, 'status-bar');
if (!statusBarBounds) throw new Error('Missing #status-bar in index.html');

const leftToolbarBounds = getElementBounds(html, 'left-toolbar');
if (!leftToolbarBounds) throw new Error('Missing #left-toolbar in index.html');

// 2. #workspaceSwitcher and #btnToggleRightDock must be inside #right-dock
if (!rightDockBounds.content.includes('id="workspaceSwitcher"')) {
  throw new Error('Contract violation: #workspaceSwitcher must be inside #right-dock.');
}
if (!rightDockBounds.content.includes('id="btnToggleRightDock"')) {
  throw new Error('Contract violation: #btnToggleRightDock must be inside #right-dock.');
}
console.log('✓ #workspaceSwitcher and #btnToggleRightDock are inside #right-dock.');

// 3. #btnFitArtboard, #btnZoomReset100, and 4 #toggleGuide* inside #status-bar
const requiredStatusBarControls = [
  'btnFitArtboard',
  'btnZoomReset100',
  'toggleGuideAxes',
  'toggleGuideBlocks',
  'toggleGuideSubtiles',
  'toggleGuideOrbits'
];

for (const ctrlId of requiredStatusBarControls) {
  if (!statusBarBounds.content.includes(`id="${ctrlId}"`)) {
    throw new Error(`Contract violation: #${ctrlId} must be inside #status-bar.`);
  }
}
console.log('✓ #btnFitArtboard, #btnZoomReset100, and all 4 guide toggles are inside #status-bar.');

// 4. #fgColorPicker inside #left-toolbar and strictly after the last .tool-btn[data-tool]
if (!leftToolbarBounds.content.includes('id="fgColorPicker"')) {
  throw new Error('Contract violation: #fgColorPicker must be inside #left-toolbar.');
}

const toolBtnRegex = /class=["'][^"']*tool-btn[^"']*["'][^>]*data-tool=/g;
let lastToolBtnIndex = -1;
let match;
while ((match = toolBtnRegex.exec(leftToolbarBounds.content)) !== null) {
  lastToolBtnIndex = match.index;
}

if (lastToolBtnIndex === -1) {
  throw new Error('No .tool-btn[data-tool] elements found in #left-toolbar.');
}

const fgColorIndex = leftToolbarBounds.content.indexOf('id="fgColorPicker"');
if (fgColorIndex <= lastToolBtnIndex) {
  throw new Error('Contract violation: #fgColorPicker must appear AFTER the last .tool-btn[data-tool] in #left-toolbar.');
}
console.log('✓ #fgColorPicker is inside #left-toolbar after all tool buttons.');

console.log('--- ALL UI LAYOUT CONTRACT CHECKS PASSED! ---');
