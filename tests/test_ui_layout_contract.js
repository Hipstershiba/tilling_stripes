// tests/test_ui_layout_contract.js
// Structural layout contracts of index.html.
// Toolbar on the left, canvas in the center, dock on the right.
// The collapse button #btnToggleRightDock lives inside #right-dock on the right side.

const fs = require('fs');
const path = require('path');

const baseDir = process.env.TEST_TARGET_DIR
  ? path.resolve(process.env.TEST_TARGET_DIR)
  : path.resolve(__dirname, '..');

const htmlPath = path.join(baseDir, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'style.css'), 'utf8');

console.log('--- Testing UI Layout Contract ---');

// Helper to extract outer HTML / boundaries of an element by id
function getElementBounds(content, id) {
  const startTagRegex = new RegExp(`<([a-zA-Z0-9]+)[^>]*id=["']${id}["'][^>]*>`, 'i');
  const match = content.match(startTagRegex);
  if (!match) return null;

  const tagName = match[1].toLowerCase();
  const startIndex = match.index;
  const tagOpenEnd = startIndex + match[0].length;

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

// 2. Toolbar on the left, right dock on the right with #btnToggleRightDock inside #dock-header
if (html.includes('id="workspaceSwitcher"')) {
  throw new Error('Contract violation: #workspaceSwitcher must be gone (inspect is the generation context).');
}
if (html.includes('id="btnContextGenerator"')) {
  throw new Error('Contract violation: #btnContextGenerator is redundant with #toolInspect.');
}
if (!rightDockBounds.content.includes('id="btnToggleRightDock"')) {
  throw new Error('Contract violation: #btnToggleRightDock must be inside #right-dock on the right side.');
}
if (leftToolbarBounds.content.includes('id="btnToggleRightDock"')) {
  throw new Error('Contract violation: #btnToggleRightDock must not be inside #left-toolbar.');
}
console.log('✓ Toolbar is on the left; collapse control #btnToggleRightDock lives on the right inside #right-dock.');

// 3. Status bar controls & visual guides in tool column
const requiredStatusBarControls = ['btnFitArtboard', 'btnZoomReset100', 'btnExport'];

for (const ctrlId of requiredStatusBarControls) {
  if (!statusBarBounds.content.includes(`id="${ctrlId}"`)) {
    throw new Error(`Contract violation: #${ctrlId} must be inside #status-bar.`);
  }
}
console.log('✓ #btnFitArtboard, #btnZoomReset100 and #btnExport are inside #status-bar.');

const guideIds = ['toggleGuideAxes', 'toggleGuideBlocks', 'toggleGuideSubtiles', 'toggleGuideOrbits'];
for (const gid of guideIds) {
  if (!leftToolbarBounds.content.includes(`id="${gid}"`)) {
    throw new Error(`Contract violation: #${gid} must be inside #left-toolbar.`);
  }
  if (statusBarBounds.content.includes(`id="${gid}"`)) {
    throw new Error(`Contract violation: #${gid} must not remain in #status-bar.`);
  }
}

const zoomIdx = leftToolbarBounds.content.indexOf('id="toolZoom"');
const firstGuideIdx = leftToolbarBounds.content.indexOf('id="toggleGuideAxes"');
if (!(zoomIdx > -1 && firstGuideIdx > zoomIdx)) {
  throw new Error('Contract violation: the guides must come after #toolZoom in the tool column.');
}
console.log('✓ Guides are in the tool column, after #toolZoom (before the colors).');

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

// 5. Layout order: left-toolbar -> workspace-viewport -> right-dock; no #left-rail
if (html.includes('id="left-rail"')) {
  throw new Error('Contract violation: #left-rail must not exist in index.html (toolbar is back on the left).');
}

const orderRules = [
  ['#workspace-body > #left-toolbar', '0'],
  ['#workspace-body > #workspace-viewport', '1'],
  ['#workspace-body > #right-dock', '2']
];

for (const [selector, order] of orderRules) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{\\s*order:\\s*' + order + '\\s*;');
  if (!re.test(css)) {
    throw new Error(`Contract violation: style.css must set "order: ${order}" for ${selector}.`);
  }
}
console.log('✓ Flex order is left-toolbar (0) → canvas (1) → right-dock (2).');

console.log('--- ALL UI LAYOUT CONTRACT CHECKS PASSED! ---');
