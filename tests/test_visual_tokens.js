// Guard unresolved CSS roles and measurable contrast regressions in the UI palette.
const assert = require('assert');
const fs = require('fs');
const css = fs.readFileSync(require.resolve('../style.css'), 'utf8');
const definitions = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map(m => [m[1], m[2].trim()]));
const inlineSources = ['../index.html', '../sketch.js', '../core/subtile_studio_ui.js']
  .map(file => fs.readFileSync(require.resolve(file), 'utf8')).join('\n');
for (const [, token] of (css + inlineSources).matchAll(/var\((--[\w-]+)/g)) {
  assert(definitions.has(token), `Undefined CSS token ${token}`);
}
function resolve(token, seen = new Set()) {
  assert(!seen.has(token), `Cyclic token ${token}`); seen.add(token);
  const value = definitions.get(token);
  const alias = /^var\((--[\w-]+)\)$/.exec(value);
  return alias ? resolve(alias[1], seen) : value;
}
function luminance(hex) {
  const rgb = hex.replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(resolve(a)), y = luminance(resolve(b));
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
const backgrounds = ['--bg-panel', '--bg-panel-header', '--bg-control', '--bg-control-hover', '--bg-selected'];
for (const bg of backgrounds) {
  for (const text of ['--text-primary', '--text-secondary', '--text-muted'])
    assert(contrast(text, bg) >= 4.5, `${text} on ${bg}: ${contrast(text, bg).toFixed(2)} < 4.5`);
  for (const indicator of ['--border-focus', '--border-control'])
    assert(contrast(indicator, bg) >= 3, `${indicator} on ${bg}: ${contrast(indicator, bg).toFixed(2)} < 3`);
}
for (const [text, bg] of [['--accent-amber', '--bg-warning'], ['--color-error', '--bg-error'], ['--text-primary', '--bg-primary']])
  assert(contrast(text, bg) >= 4.5, `${text} on ${bg} must remain readable`);
assert(parseFloat(resolve('--control-h')) >= 30);
assert(parseFloat(resolve('--action-size')) >= 28);
assert(parseFloat(resolve('--font-ui')) >= 12);
const format = require('../core/ui_format.js');
for (const name of ['alignLeft', 'alignCenterX', 'alignRight', 'alignTop', 'alignCenterY', 'alignBottom', 'copy', 'edit', 'trash', 'undo', 'redo']) {
  const markup = format.icon(name);
  assert(markup.includes('viewBox="0 0 24 24"') && markup.includes('stroke-width="1.75"'));
  assert(markup.includes('aria-hidden="true"') && markup.includes('focusable="false"'));
}
assert.equal(format.icon('<script>'), '', 'Unknown icon names cannot inject markup');
console.log('✓ CSS tokens resolve; text ≥4.5:1 and essential control/focus indicators ≥3:1 across semantic surfaces.');
console.log('✓ Shared type/target scale and command SVG safety verified.');

// Production tooltip handlers keep the whole instruction and restore ARIA hints.
const vm = require('vm');
const source = fs.readFileSync(require.resolve('../ui_info.js'), 'utf8');
const attributes = {title: 'Pincel (B) • Alt+arraste captura; Shift inverte o encaixe.', 'aria-describedby': 'existingHint'};
const trigger = {dataset: {}, getAttribute: key => attributes[key] || null,
  setAttribute(key, value) {attributes[key] = value;}, removeAttribute(key) {delete attributes[key];},
  closest(selector) {return selector === '#infoPopover' ? null : trigger;}, contains: node => node === trigger,
  getBoundingClientRect: () => ({left: 1390, top: 880, width: 32, bottom: 900})};
let hidden = true;
const tooltip = {style: {}, classList: {add() {hidden = true;}, remove() {hidden = false;}},
  getBoundingClientRect: () => ({width: 360, height: 80})};
const context = {window: {innerWidth: 1440, innerHeight: 900}, tooltipEl: tooltip,
  tooltipTrigger: null, tooltipDescription: null, isPopoverOpen: false};
vm.createContext(context);
for (const name of ['handleTooltipEnter', 'handleTooltipLeave', 'showTooltip', 'hideTooltip']) {
  const start = source.indexOf(`  function ${name}(`);
  vm.runInContext(source.slice(start, source.indexOf('\n  }', start) + 4), context);
}
context.handleTooltipEnter({target: trigger});
assert.equal(hidden, false); assert.equal(tooltip.textContent, attributes.title);
assert.equal(attributes['aria-describedby'], 'existingHint uiTooltip');
assert.equal(tooltip.style.left, '1072px'); assert.equal(tooltip.style.top, '794px');
context.handleTooltipLeave({target: trigger, relatedTarget: null});
assert.equal(hidden, true); assert.equal(attributes['aria-describedby'], 'existingHint');
console.log('✓ Tooltip title/focus path preserves full text, viewport bounds and prior accessible descriptions.');

// Render the production help and exercise a context change before document dismissal.
class HelpNode {
  constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; }
  set innerHTML(value) { this.children = []; }
  appendChild(node) { this.children.push(node); return node; }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  focus() { this.focused = true; }
  querySelector(selector) { return this.children.find(node => selector.includes(`"${node.dataset.helpContext}"`)); }
}
const helpBody = new HelpNode('body');
const helpContext = { document: {createElement: tag => new HelpNode(tag)}, popoverBodyEl: helpBody,
  commands: require('../core/studio_commands.js') };
vm.createContext(helpContext);
const helpStart = source.indexOf('  function renderShortcutHelp(');
vm.runInContext(source.slice(helpStart, source.indexOf('\n  }', helpStart) + 4), helpContext);
helpContext.renderShortcutHelp('mosaic');
const flatten = node => [node, ...node.children.flatMap(flatten)];
let nodes = flatten(helpBody);
assert(nodes.some(node => node.tag === 'dd' && node.textContent === 'Pincel'));
assert(!nodes.some(node => node.tag === 'dd' && node.textContent === 'Caneta'));
let stopped = false;
helpBody.children[0].children[1].listeners.click({stopPropagation() { stopped = true; }});
nodes = flatten(helpBody);
assert(stopped, 'Replacing a context button must not trigger outside-click dismissal');
assert(nodes.some(node => node.tag === 'dd' && node.textContent === 'Caneta'));
assert(!nodes.some(node => node.tag === 'dd' && node.textContent === 'Pincel'));
assert(helpBody.children[0].children[1].focused, 'Focus follows the replacement context button');
assert.equal(helpBody.children[0].children[1].attributes['aria-pressed'], 'true');
assert.equal(helpBody.scrollTop, 0);
console.log('✓ Help separates catalog contexts and keeps the popover open and focused when switching.');

// Generic topics must use a real list; stray li elements bypass spacing and semantics.
const topicStart = source.indexOf('  function renderTopicBody(');
vm.runInContext(source.slice(topicStart, source.indexOf('\n  }', topicStart) + 4), helpContext);
helpContext.renderTopicBody({body: ['Selecionar formas.', 'SVG: <path> permanece texto.']});
assert.equal(helpBody.children.length, 1);
assert.equal(helpBody.children[0].tag, 'ul');
assert.equal(helpBody.children[0].children.length, 2);
assert(helpBody.children[0].children.every(node => node.tag === 'li'));
assert.equal(helpBody.children[0].children[1].textContent, 'SVG: <path> permanece texto.');
helpContext.renderTopicBody({body: ['Outro tópico.']});
assert.equal(helpBody.children[0].children.length, 1, 'Opening a new topic replaces the old list');
assert.equal(helpBody.scrollTop, 0);
console.log('✓ Generic information topics keep list semantics, literal text and reset scrolling.');
const propertySource = fs.readFileSync(require.resolve('../core/subtile_studio_ui.js'), 'utf8');
const actionKeys = ['unite', 'subtract', 'intersect', 'exclude', 'btnPropsDuplicateBuiltIn', 'btnVecPropDuplicate'];
const propertyButtons = actionKeys.map(key => ({id: key.startsWith('btn') ? key : '',
  dataset: key.startsWith('btn') ? {} : {boolOp: key}, classList: {add() {}},
  setAttribute() {}, getAttribute() {return '';}, textContent: '', innerHTML: ''}));
const propertyContext = vm.createContext({uiFormat: format, document: {querySelectorAll: () => propertyButtons}});
const iconStart = propertySource.indexOf('  function iconizePropertyActions()');
vm.runInContext(propertySource.slice(iconStart, propertySource.indexOf('\n  function refresh()', iconStart)) + '\niconizePropertyActions();', propertyContext);
for (let i = 0; i < propertyButtons.length; i++) {
  const key = actionKeys[i];
  const expectedName = key.startsWith('btn') ? 'copy' : key;
  assert(propertyButtons[i].innerHTML.startsWith(format.icon(expectedName, 18)),
    `Property rendering must retain the shared filled/copy icon: ${key}`);
  assert(propertyButtons[i].innerHTML.includes(`data-icon="${expectedName}"`),
    `Property action must name its registry icon: ${key}`);
}
assert(format.icon('intersect').includes('fill="currentColor"'));
assert(format.icon('exclude').includes('fill-rule="evenodd"'));
assert.notEqual(propertyButtons[2].innerHTML, propertyButtons[3].innerHTML);
console.log('✓ Property actions retain distinct filled boolean results and the library copy icon.');

assert(!propertyButtons[4].innerHTML.includes('class="icon-label"'),
  'The protected-piece copy action must show its label, matching the Library copy action');
