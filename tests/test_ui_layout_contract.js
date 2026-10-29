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
const requiredStatusBarControls = ['btnFitArtboard', 'btnZoomReset100'];

for (const ctrlId of requiredStatusBarControls) {
  if (!statusBarBounds.content.includes(`id="${ctrlId}"`)) {
    throw new Error(`Contract violation: #${ctrlId} must be inside #status-bar.`);
  }
}
console.log('✓ #btnFitArtboard and #btnZoomReset100 are inside #status-bar.');

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
  ['#workspace-body > #utility-rail', '2'],
  ['#workspace-body > #right-dock', '3']
];

for (const [selector, order] of orderRules) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(escaped + '\\s*\\{\\s*order:\\s*' + order + '\\s*;');
  if (!re.test(css)) {
    throw new Error(`Contract violation: style.css must set "order: ${order}" for ${selector}.`);
  }
}
console.log('✓ Flex order is left-toolbar (0) → canvas (1) → utility-rail (2) → right-dock (3).');

// 6. Illustrator geography: document controls in the static right dock; the top
// bar carries only the active tool's options.
const topBarBounds = getElementBounds(html, 'top-control-bar');
if (!topBarBounds) throw new Error('Missing #top-control-bar in index.html');

const documentPanelBounds = getElementBounds(html, 'panel-document');
if (!documentPanelBounds) throw new Error('Missing #panel-document in index.html');
if (!rightDockBounds.content.includes('id="panel-document"')) {
  throw new Error('Contract violation: #panel-document must be inside #right-dock.');
}
if (!documentPanelBounds.content.includes('id="paddingInput"')) {
  throw new Error('Contract violation: #paddingInput must be inside #panel-document.');
}
if (topBarBounds.content.includes('id="paddingInput"')) {
  throw new Error('Contract violation: #paddingInput must not be inside #top-control-bar.');
}
for (const id of ['canvasW', 'canvasH', 'gridRows', 'gridCols', 'gridMargin']) {
  if (!documentPanelBounds.content.includes(`id="${id}"`)) {
    throw new Error(`Contract violation: #${id} must be inside #panel-document.`);
  }
  if (topBarBounds.content.includes(`id="${id}"`)) {
    throw new Error(`Contract violation: #${id} must not be inside #top-control-bar.`);
  }
}
console.log('✓ Document controls moved to #panel-document inside the static right dock.');

const toolContextIds = ['topToolContext', 'ctxPaint', 'rotateToolOptionsWrap', 'freezeToolOptionsWrap'];
for (const id of toolContextIds) {
  if (!topBarBounds.content.includes(`id="${id}"`)) {
    throw new Error(`Contract violation: #${id} must be inside #top-control-bar (contextual tool options).`);
  }
}
if (html.includes('id="dock-workspace-edit"')) {
  throw new Error('Contract violation: #dock-workspace-edit must be gone; the dock no longer swaps with the tool.');
}
const generatePaneContent = getElementBounds(html, 'dock-workspace-generate');
if (!generatePaneContent) throw new Error('Missing #dock-workspace-generate in index.html');
for (const id of ['panel-edit-scope', 'panel-edit-brush']) {
  if (!generatePaneContent.content.includes(`id="${id}"`)) {
    throw new Error(`Contract violation: #${id} must live in the static dock pane.`);
  }
}
console.log('✓ Top bar owns the tool options; the dock keeps static properties (no #dock-workspace-edit).');

const seedControlIds = ['btnRandomize', 'seedInput', 'btnPrevSeed', 'btnNextSeed'];
for (const scId of seedControlIds) {
  if (leftToolbarBounds.content.includes(`id="${scId}"`)) {
    throw new Error(`Contract violation: #${scId} must not be inside #left-toolbar (generator lives in the right dock).`);
  }
  if (topBarBounds.content.includes(`id="${scId}"`)) {
    throw new Error(`Contract violation: #${scId} must not be inside #top-control-bar.`);
  }
}

// 7. Generator and export live in the right dock; history lives in the utility rail.
const generatorBounds = getElementBounds(html, 'dock-generator');
const historyBounds = getElementBounds(html, 'dock-history');
const headerBounds = getElementBounds(html, 'dock-header');
const railBounds = getElementBounds(html, 'utility-rail');
const exportBounds = getElementBounds(html, 'dock-export');
const generatePaneBounds = getElementBounds(html, 'dock-workspace-generate');
if (!generatorBounds) throw new Error('Missing #dock-generator in index.html');
if (!historyBounds) throw new Error('Missing #dock-history in index.html');
if (!headerBounds) throw new Error('Missing #dock-header in index.html');
if (!railBounds) throw new Error('Missing #utility-rail in index.html');
if (!exportBounds) throw new Error('Missing #dock-export in index.html');
if (!generatePaneBounds) throw new Error('Missing #dock-workspace-generate in index.html');

if (!rightDockBounds.content.includes('id="dock-generator"')) {
  throw new Error('Contract violation: #dock-generator must be inside #right-dock.');
}
if (!railBounds.content.includes('id="dock-history"')) {
  throw new Error('Contract violation: #dock-history must be a compact control inside #utility-rail (no dedicated row in the dock).');
}
if (rightDockBounds.content.includes('id="dock-history"')) {
  throw new Error('Contract violation: #dock-history must not be inside #right-dock.');
}
if (topBarBounds.content.includes('id="dock-history"')) {
  throw new Error('Contract violation: #dock-history must not be inside #top-control-bar.');
}
if (headerBounds.content.includes('id="dock-history"')) {
  throw new Error('Contract violation: #dock-history must not be inside #dock-header.');
}
if (!rightDockBounds.content.includes('id="dock-export"')) {
  throw new Error('Contract violation: #dock-export must be inside #right-dock.');
}
if (generatePaneBounds.content.includes('id="dock-generator"')) {
  throw new Error('Contract violation: #dock-generator must stay above the contextual panes (visible in generate and edit contexts).');
}
if (generatePaneBounds.content.includes('id="dock-export"')) {
  throw new Error('Contract violation: #dock-export must stay pinned to the dock footer, outside the contextual panes.');
}
if (generatorBounds.content.includes('id="dock-history"')) {
  throw new Error('Contract violation: #dock-history must not live inside the generator strip.');
}
if (!(railBounds.startIndex > leftToolbarBounds.startIndex && railBounds.endIndex < rightDockBounds.startIndex)) {
  throw new Error('Contract violation: #utility-rail must sit between the canvas column and #right-dock in the DOM.');
}

for (const scId of seedControlIds) {
  if (!generatorBounds.content.includes(`id="${scId}"`)) {
    throw new Error(`Contract violation: #${scId} must be inside #dock-generator.`);
  }
}
for (const historyId of ['btnToggleHistory', 'seedHistoryList']) {
  if (!historyBounds.content.includes(`id="${historyId}"`)) {
    throw new Error(`Contract violation: #${historyId} must be inside #dock-history.`);
  }
  if (leftToolbarBounds.content.includes(`id="${historyId}"`)) {
    throw new Error(`Contract violation: #${historyId} must not be inside #left-toolbar.`);
  }
}
for (const exportId of ['btnExport', 'exportFormatSelect']) {
  if (!exportBounds.content.includes(`id="${exportId}"`)) {
    throw new Error(`Contract violation: #${exportId} must be inside #dock-export.`);
  }
  if (leftToolbarBounds.content.includes(`id="${exportId}"`)) {
    throw new Error(`Contract violation: #${exportId} must not be inside #left-toolbar.`);
  }
}

// Dock geography: header → generator → tabs → active pane → export footer.
const dockHeaderIdx = rightDockBounds.content.indexOf('id="dock-header"');
const dockGenIdx = rightDockBounds.content.indexOf('id="dock-generator"');
const dockTabsIdx = rightDockBounds.content.indexOf('id="dockTabs"');
const dockPaneIdx = rightDockBounds.content.indexOf('id="dock-workspace-generate"');
const dockExportIdx = rightDockBounds.content.indexOf('id="dock-export"');
if (!(dockHeaderIdx > -1 && dockGenIdx > dockHeaderIdx && dockTabsIdx > dockGenIdx && dockPaneIdx > dockTabsIdx && dockExportIdx > dockPaneIdx)) {
  throw new Error('Contract violation: dock order must be header < generator < tabs < panes < export.');
}
console.log('✓ Right dock: header → generator → tabs → active pane → export; history stays in the utility rail.');

// The left toolbar is tools + guides + colors only.
const inspectIdx = leftToolbarBounds.content.indexOf('id="toolInspect"');
const fgColorIdx = leftToolbarBounds.content.indexOf('id="fgColorPicker"');
if (!(inspectIdx > -1 && fgColorIdx > inspectIdx)) {
  throw new Error('Contract violation: ordering must be tools < colors in #left-toolbar.');
}
if (leftToolbarBounds.content.includes('id="seedHistoryList"')) {
  throw new Error('Contract violation: #seedHistoryList must not be inside #left-toolbar.');
}
console.log('✓ Left toolbar ordered: tools → visual guides → colors (no generator/history/export).');

console.log('--- ALL UI LAYOUT CONTRACT CHECKS PASSED! ---');

const viewport = getElementBounds(html, 'workspace-viewport');
const status = getElementBounds(html, 'status-bar');
if (!(status.startIndex > viewport.startIndex && status.endIndex < viewport.endIndex)) {
  throw new Error('Status controls must stay inside the canvas column between the sidebars.');
}
const pasteboard = getElementBounds(html, 'artboard-pasteboard');
if (!pasteboard.content.includes('id="editorToast"')) {
  throw new Error('Editor messages must stay inside the artboard area above the status bar.');
}

// 8. #btnRandomize must NOT include keyboard tag "G"
const btnRandomizeBounds = getElementBounds(html, 'btnRandomize');
if (btnRandomizeBounds && (btnRandomizeBounds.content.includes('<kbd') || />\s*G\s*</.test(btnRandomizeBounds.content))) {
  throw new Error('Contract violation: #btnRandomize must not display the "G" kbd badge.');
}
console.log('✓ #btnRandomize has no "G" badge.');

// 9. No sidebar scrolls as a whole: the active tab's body scrolls internally.
if (!/#right-dock\s*\{[^}]*overflow:\s*hidden/.test(css)) {
  throw new Error('Contract violation: #right-dock must not scroll as a column.');
}
if (!/#dock-workspace-generate\s*\{[^}]*overflow:\s*hidden/.test(css)) {
  throw new Error('Contract violation: #dock-workspace-generate must not scroll as a column.');
}
if (!/#dock-workspace-generate > \.dock-panel > \.panel-body\s*\{[^}]*overflow-y:\s*auto/.test(css)) {
  throw new Error('Contract violation: the active tab body must own the vertical scroll.');
}
if (!css.includes('.families-swatch-scroll') || !css.includes('overflow-y: auto')) {
  throw new Error('Contract violation: .families-swatch-scroll must have overflow-y: auto.');
}
console.log('✓ No sidebar scrolls; the active tab and the tiles list keep their own scroll.');

// 9b. Tabs live inside the dock (Illustrator panel group); the rail stays a document rail.
const tabsBounds = getElementBounds(html, 'dockTabs');
if (!tabsBounds) throw new Error('Missing #dockTabs in index.html');
if (!rightDockBounds.content.includes('id="dockTabs"')) {
  throw new Error('Contract violation: #dockTabs must live inside #right-dock.');
}
if (railBounds.content.includes('id="dockTabs"')) {
  throw new Error('Contract violation: the panel tabs must not live in #utility-rail.');
}
const dockTabIds = ['dockTabDocument', 'dockTabSymmetry', 'dockTabPieces', 'dockTabScope', 'dockTabBrush'];
for (const tabId of dockTabIds) {
  const tabBounds = getElementBounds(html, tabId);
  if (!tabBounds) throw new Error(`Missing #${tabId} in index.html`);
  if (!/role="tab"/.test(tabBounds.content)) throw new Error(`#${tabId} must have role="tab".`);
  const panelId = /aria-controls="([^"]+)"/.exec(tabBounds.content)?.[1];
  if (!panelId || !generatePaneContent.content.includes(`id="${panelId}"`)) {
    throw new Error(`#${tabId} must control a panel inside #dock-workspace-generate.`);
  }
  const panelTag = new RegExp(`<section[^>]*id="${panelId}"[^>]*>`).exec(html)?.[0] || '';
  if (!/role="tabpanel"/.test(panelTag) || !/data-dock-panel=/.test(panelTag)) {
    throw new Error(`#${panelId} must be a tabpanel with data-dock-panel.`);
  }
}
if (!railBounds.content.includes('id="railOpenLibrary"')) {
  throw new Error('Contract violation: the utility rail must keep its Library shortcut.');
}
if (!(tabsBounds.startIndex > generatorBounds.startIndex && tabsBounds.endIndex < generatePaneBounds.startIndex)) {
  throw new Error('Contract violation: the dock tab strip must sit between the generator and the panel area.');
}
console.log('✓ Dock tabs live inside #right-dock; the rail stays history + Library.');

// 10. Both environments share outer toolbar scrolling; history stays in its flyout.
if (!/\s*#left-toolbar\s*\{[^}]*overflow-y:\s*auto/.test(css)) {
  throw new Error('The shared left toolbar must scroll so short viewports keep all tools reachable.');
}
if (!/#left-toolbar \.subtile-left-pane\s*\{[^}]*overflow:\s*visible/.test(css)) {
  throw new Error('The tile pane must not add a second scrollbar that narrows its tool grid.');
}
if (!css.includes('.sidebar-history-list') || !css.includes('overflow-y: auto')) {
  throw new Error('Contract violation: .sidebar-history-list must have overflow-y: auto.');
}
if (!/#dock-history\s+\.sidebar-history-list\s*\{[^}]*position:\s*absolute/.test(css)) {
  throw new Error('Contract violation: the utility-rail history list must open as an absolute flyout over the canvas.');
}
if (!/#dock-history\s+\.sidebar-history-list\s*\{[^}]*right:\s*calc\(100%\s*\+\s*10px\)/.test(css)) {
  throw new Error('Contract violation: the history flyout must open to the left of the utility rail (right: calc(100% + 10px)).');
}
console.log('✓ Both modes share toolbar scrolling; the history flyout keeps its own scroll.');
