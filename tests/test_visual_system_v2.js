// tests/test_visual_system_v2.js
// Contratos da camada visual V2 (revisão de 28/10/2026):
// ação primária visível, alternância de ambiente no topo da barra, rodapé que
// não esconde o estado do documento e escala tipográfica declarada em tokens.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = process.env.TEST_TARGET_DIR ? path.resolve(process.env.TEST_TARGET_DIR) : path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');

const token = (name) => {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(css);
  assert(match, `Missing token --${name}`);
  return match[1].trim();
};

// 1. A ação primária do produto tem rótulo visível e não é um ícone solto.
const randomize = /<button[^>]*id="btnRandomize"[^>]*>/.exec(html);
assert(randomize, '#btnRandomize must exist');
assert(!/icon-only/.test(randomize[0]), '#btnRandomize must show its label');
const randomizeBlock = html.slice(randomize.index, html.indexOf('</button>', randomize.index));
assert(/<span class="gen-btn-label">\s*Gerar\s*<\/span>/.test(randomizeBlock),
  '#btnRandomize must keep the visible "Gerar" label');
console.log('✓ Primary generate action is labelled and visible.');

// 2. A alternância de ambiente vive no topo da barra esquerda, antes das ferramentas.
const modeIdx = html.indexOf('id="btnStudioTilesMode"');
const toolsIdx = html.indexOf('aria-label="Ferramentas de Edição e Criação de Subtiles"');
assert(modeIdx > -1 && toolsIdx > -1 && modeIdx < toolsIdx,
  '#btnStudioTilesMode must precede the tools section inside #left-toolbar');
const modeTag = /<button[^>]*id="btnStudioTilesMode"[^>]*>/.exec(html);
assert(modeTag && /class="[^"]*studio-mode-btn/.test(modeTag[0]),
  '#btnStudioTilesMode must use the studio-mode-btn surface');
console.log('✓ Environment switch sits at the top of the left bar, before the tools.');

// 3. Escala e geografia declaradas em tokens.
assert.equal(token('font-section'), '11px');
assert.equal(token('status-bar-h'), '32px');
assert.equal(token('top-bar-h'), '48px');
assert.equal(token('left-tool-w'), '120px');
assert.equal(token('right-dock-w'), '304px');
const card = /--radius-card:\s*8px/.test(css);
assert(card, '--radius-card must define the grouped surface radius');
console.log('✓ Type/surface/geography tokens keep the V2 scale.');

// 4. O rodapé nunca esconde o estado de salvamento; só o nome do Spout sai de cena.
const v2Layer = css.slice(css.indexOf('V2 — REFORMA VISUAL'));
assert(v2Layer.length > 0, 'The V2 layer must exist');
assert(!/#saveStatusText\s*\{[^}]*position:\s*absolute/.test(v2Layer),
  'The status bar must not hide #saveStatusText in the 1050px column');
assert(/\.status-spout-name\s*\{\s*display:\s*none/.test(v2Layer),
  'The Spout name field is the element removed first when space is tight');
assert(/status-sep[\s\S]{0,120}?background/.test(v2Layer),
  'Status separators must be drawn, not typed as low-contrast text');
console.log('✓ Save state stays visible; separators are drawn, not low-contrast glyphs.');

// 5. Alvos de linha permanecem utilizáveis.
const toggle = /#familiesSwatchContainer \.family-toggle-btn \{([\s\S]*?)\}/.exec(v2Layer);
assert(toggle && /min-height:\s*(\d+)px/.test(toggle[1]), 'Family toggle needs an explicit min-height');
const toggleH = Number(/min-height:\s*(\d+)px/.exec(toggle[1])[1]);
assert(toggleH >= 24, `Family toggle target must be >= 24px tall (got ${toggleH})`);
// Os passos numéricos vivem no flyout Documento desde a revisão da barra de
// controle (29/10/2026); a barra superior não usa mais `.step-btn`.
const step = /\.document-field \.step-btn \{([\s\S]*?)\}/.exec(css);
assert(step, 'Document steppers must be styled');
const stepW = Number(/min-width:\s*(\d+)px/.exec(step[1])[1]);
assert(stepW >= 24, `Stepper target must be >= 24px wide (got ${stepW})`);
console.log('✓ Row and stepper targets stay at or above 24px.');

// 6. A camada V2 é a última palavra do arquivo (precisa vencer a herança).
const v2 = css.indexOf('V2 — REFORMA VISUAL');
assert(v2 > -1, 'The V2 layer must stay documented in style.css');
assert(v2 > css.indexOf('#status-bar') && v2 > css.indexOf('#left-toolbar'),
  'The V2 layer must come after the historical component rules');
console.log('✓ V2 layer order keeps its overrides effective.');

// 7. Cores: a amostra nativa preenche o chip (sem o deslocamento -8px legado).
const colorRules = [...css.matchAll(/#left-toolbar \.sidebar-color-chip \.color-preview-wrap input\[type="color"\] \{([\s\S]*?)\}/g)];
assert(colorRules.length > 0, 'The rail color input needs an explicit rule');
const colorRule = colorRules[colorRules.length - 1][1];
assert(/inset:\s*0;/.test(colorRule), 'The color input must fill its wrapper (inset: 0)');
assert(/appearance:\s*none/.test(colorRule), 'The color input must reset the native appearance');
assert(css.includes('::-webkit-color-swatch-wrapper') && css.includes('::-webkit-color-swatch {'),
  'The native color swatch must be reset so the full chip shows the color');
console.log('✓ Colour swatches fill their chip and reset the native control chrome.');

// 8. Guias: mesma grade 2×N e altura dos botões de ferramenta.
const guideGrids = [...css.matchAll(/#left-toolbar \[aria-label="Guias Visuais"\] \.tools-grid-2col \{([\s\S]*?)\}/g)];
assert(guideGrids.length > 0, 'The visual guides grid must be styled with the rail');
const guideGrid = guideGrids[guideGrids.length - 1][1];
assert(/grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/.test(guideGrid),
  'Visual guides must use the same two-column grid as the tools');
const guideBtns = [...css.matchAll(/#left-toolbar \[aria-label="Guias Visuais"\] \.guide-toggle \{([\s\S]*?)\}/g)];
assert(guideBtns.length > 0, 'Guide toggles must be styled');
const guideBtn = guideBtns[guideBtns.length - 1][1];
assert(/height:\s*38px/.test(guideBtn), 'Guide toggles must keep the 38px tool row height');
console.log('✓ Visual guides keep the tool grid and row height.');

// A troca de ambiente não pode adicionar um divisor antes da primeira seção.
const tilesPane = html.slice(html.indexOf('id="leftToolbarTilesPane"'), html.indexOf('</aside>'));
assert(/^id="leftToolbarTilesPane"[^>]*>\s*<div class="sidebar-section">/.test(tilesPane),
  'Tile tools must start directly with the first section, like Mosaic (no leading divider)');
assert(!/<div class="tool-divider"><\/div>\s*<details/.test(tilesPane),
  'Disclosures draw their own separator; do not stack another divider above them');
assert(!tilesPane.includes('class="subtile-left-spacer"'),
  'Disclosure spacing must come from the shared gap, not an extra spacer');
console.log('✓ Environment entry and disclosures have no extra divider or spacer.');
console.log('--- ALL VISUAL SYSTEM V2 CHECKS PASSED ---');

// Contextual inspector geography: tools left, document and asset tasks right.
const propsPanelStart = html.indexOf('id="panel-tile-shape-props"');
const propsPanel = html.slice(propsPanelStart, html.indexOf('</section>', propsPanelStart));
const libraryPanelStart = html.indexOf('id="panel-tile-library-mgr"');
const libraryPanel = html.slice(libraryPanelStart, html.indexOf('</section>', libraryPanelStart));
assert(!tilesPane.includes('id="curveFraction"') && propsPanel.includes('id="curveFraction"'),
  'Curve settings must live beside other contextual properties');
for (const id of ['btnRailNewSubtile','btnRailDuplicateSubtile','btnRailNewGroup']) {
  assert(!tilesPane.includes(`id="${id}"`) && libraryPanel.includes(`id="${id}"`),
    `${id} must live in the Library, with no duplicate tool-rail action`);
}
assert(propsPanel.includes('id="tilePathfinderContainer"'), 'Pathfinder must stay within Properties');
assert(tilesPane.includes('id="btnTileOpenLibrary"'), 'Library access remains available from the left rail');
assert(/id="tileTabProperties"[^>]*aria-selected="true"/.test(html), 'Properties is the editing entry tab');
console.log('✓ Contextual inspector separates tools, selected-object editing and library tasks.');

const menuStart = html.indexOf('id="app-menubar"');
const menuMarkup = html.slice(menuStart, html.indexOf('</nav>', menuStart));
for (const id of ['btnImportSubtileSvg','btnExportSubtileSvg','btnExportLibraryJson','btnImportLibraryJson','btnResetLibraryDefaults']) {
  assert(menuMarkup.includes(`id="${id}"`), `${id} must remain a unique, wired menu command`);
}
const libraryPageStart = html.indexOf('id="library-page"');
assert(libraryPageStart > html.indexOf('id="right-dock"') && libraryPanelStart > libraryPageStart,
  'The Library must be a separate view, outside the editor dock');
assert(/id="tilePathfinderSection"[^>]*\bopen(?:\s|>)/.test(html), 'Pathfinder must start expanded');
