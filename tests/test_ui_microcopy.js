// tests/test_ui_microcopy.js
// Guards the interface microcopy rule of this workspace:
//   1. The chrome carries icons first and short names second; never explaining sentences.
//   2. Every detail lives behind an info trigger (popover) or the help menu.
//   3. Hovering reveals the full control name through title/data-tooltip.
//
// Dialogs (role="dialog") are intentionally out of scope: a confirmation or an
// import summary may explain itself because it is transient and user-initiated.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'style.css'), 'utf8');

console.log('--- Testing UI microcopy (icons first, short names, help behind info) ---');

/** Removes a balanced <div> block that contains the given marker. */
function stripDivBlocks(source, marker) {
  let out = source;
  let idx = out.indexOf(marker);
  while (idx >= 0) {
    const tagStart = out.lastIndexOf('<', idx);
    let depth = 1;
    const re = /<(\/?)div\b/g;
    re.lastIndex = out.indexOf('>', idx) + 1;
    let match;
    while (depth > 0 && (match = re.exec(out))) depth += match[1] ? -1 : 1;
    const closeEnd = out.indexOf('>', re.lastIndex) + 1;
    out = out.slice(0, tagStart) + out.slice(closeEnd);
    idx = out.indexOf(marker, tagStart);
  }
  return out;
}

const chrome = stripDivBlocks(html, 'class="modal-dialog-backdrop')
  .replace(/<script[\s\S]*?<\/script>/g, '<>')
  .replace(/<style[\s\S]*?<\/style>/g, '<>');

// 1. No explaining sentence survives in the permanent chrome.
const TEXT_BUDGET = 64;
const chunks = chrome.split(/<[^>]*>/).map((chunk) => chunk.replace(/\s+/g, ' ').trim()).filter(Boolean);
const longCopy = chunks.filter((chunk) => chunk.length > TEXT_BUDGET);
assert.deepStrictEqual(
  longCopy,
  [],
  `Interface text must stay within ${TEXT_BUDGET} characters; move the explanation to INFO_TOPICS. Found: ${JSON.stringify(longCopy)}`
);
console.log(`✓ ${chunks.length} static labels, none longer than ${TEXT_BUDGET} characters.`);

// 2. The edge-match switch is icon + short name + info trigger, with no hint line.
const section = html.slice(html.indexOf('edge-match-section'), html.indexOf('edge-match-section') + 1200);
assert.ok(/class="[^"]*\bedge-match-section\b[^"]*"/.test(html), 'the edge-match switch must live in its own section');
assert.ok(section.includes('data-icon-slot="edgeJoin"'), 'the edge-match switch must lead with an icon');
assert.ok(/>\s*Bordas\s*</.test(section), 'the edge-match switch name must be the short "Bordas"');
assert.ok(/<label[^>]*for="toggleEdgeMatch"[^>]*title="Encaixe por bordas"/.test(section),
  'hovering the switch must reveal the full name "Encaixe por bordas"');
assert.ok(/data-info-topic="edge-match"[^>]*aria-haspopup="dialog"[^>]*aria-controls="infoPopover"[^>]*aria-expanded="false"/.test(section),
  'the switch must expose its explanation through an info trigger');
assert.ok(section.indexOf('edgeJoin') < section.indexOf('Bordas'), 'the icon comes before the name');
assert.ok(!/edge-match-hint|edge-match-copy/.test(html), 'the edge-match hint/copy elements must be gone');
assert.ok(!/edge-match-hint|edge-match-copy/.test(css), 'the edge-match hint/copy styles must be gone');
assert.ok(!html.includes('Continua as regiões de tinta'), 'the explanation must not be printed in the chrome');
console.log('✓ Edge-match switch: icon, short name, tooltip, info trigger, no hint line.');

// 2b. The variability control follows the same rule: icon, short name, full name on hover.
assert.ok(section.includes('data-icon-slot="variability"'), 'the variability slider must lead with an icon');
assert.ok(/>\s*Variedade\s*</.test(section), 'the variability control name must be the short "Variedade"');
assert.ok(/title="Variabilidade do encaixe"/.test(section),
  'hovering the variability control must reveal its full name');
assert.ok(section.indexOf('variability') < section.indexOf('Variedade'), 'the variability icon comes before the name');
assert.ok(!/temperatura entre fidelidade/.test(html), 'the variability explanation must not be printed in the chrome');
console.log('✓ Variability control: icon, short name, tooltip, no explaining copy.');

// 3. The explanation moved into the information system, keyed by the same topic.
global.window = {};
window.StudioCommands = require(path.join(baseDir, 'core/studio_commands.js'));
global.document = { getElementById: () => null, addEventListener: () => {} };
eval(fs.readFileSync(path.join(baseDir, 'ui_info.js'), 'utf8'));

const topics = window.InfoUI.INFO_TOPICS;
const edgeTopic = topics['edge-match'];
assert.ok(edgeTopic, 'INFO_TOPICS must define the "edge-match" topic');
assert.ok(typeof edgeTopic.title === 'string' && edgeTopic.title.length > 0, 'the topic needs a title');
assert.ok(Array.isArray(edgeTopic.body) && edgeTopic.body.length >= 2, 'the topic needs bullet items');
assert.ok(edgeTopic.body.some((line) => line.includes('regiões de tinta')),
  'the explanation removed from the chrome must live in the topic body');
assert.ok(edgeTopic.body.some((line) => line.includes('Variedade')),
  'the variability tradeoff must live in the edge-match topic');
console.log('✓ The explanation is available in the info popover and the help menu.');

// 4. Every info trigger points at a topic that actually exists.
const triggerTopics = [...html.matchAll(/data-info-topic="([^"]+)"/g)].map((match) => match[1]);
assert.ok(triggerTopics.length >= 10, 'the interface must keep its info triggers');
const unknown = [...new Set(triggerTopics)].filter((topic) => !topics[topic]);
assert.deepStrictEqual(unknown, [], `Info triggers must resolve to a topic: ${JSON.stringify(unknown)}`);
console.log(`✓ All ${new Set(triggerTopics).size} info topics used by the interface exist.`);

// 5. Generated inspector chrome obeys the same rule as static markup.
const studioSource = fs.readFileSync(path.join(baseDir, 'core/subtile_studio_ui.js'), 'utf8');
const inspectorSource = studioSource.slice(studioSource.indexOf('function renderShapePropsPanel('), studioSource.indexOf('function renderLayersPanel('));
assert(!/Crie uma cópia para editar as formas desta peça|Selecione uma forma para editar geometria e aparência/.test(inspectorSource),
  'Inspector instructions belong in help, including dynamically generated HTML');
assert(topics['vector-editor'].body.some(line => line.includes('geometria e aparência')),
  'Selection guidance remains available through the editor info button');
assert(topics['subtile-library'].body.some(line => line.includes('peça vazia')),
  'D4 compatibility details remain available through info');
for (const match of inspectorSource.matchAll(/class="vec-subblock-title"[^>]*>([^<$]+)</g)) {
  assert(match[1].trim().length <= 20, `Inspector heading must be short: ${match[1]}`);
}
for (const id of ['gridSymmetryBadge', 'blockSymmetryBadge', 'subdivisionSummary', 'editScopeChip']) {
  assert(new RegExp(`id="${id}"[^>]*class="[^"]*\\bhidden\\b`).test(html),
    `${id} must not repeat the selected control in the permanent chrome`);
}
assert(!/Recolher Painel Lateral \(Tab\)/.test(html), 'Tab cycles scopes; it must not be advertised as dock collapse');
console.log('✓ Generated inspector copy, compact headings and redundant badges follow the Document panel rule.');

console.log('--- ALL UI MICROCOPY CHECKS PASSED! ---');
