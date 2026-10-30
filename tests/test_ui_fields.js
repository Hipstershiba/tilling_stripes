const assert = require('assert');
const {numericError, enhanceProperties, init} = require('../core/ui_fields.js');
function field(id, value, min = '', max = '', dataset = {}) {
  return {id, value, min, max, dataset, type: 'number', attributes: {},
    matches: () => true, getAttribute(key) {return this.attributes[key] || null;},
    setAttribute(key, value) {this.attributes[key] = value;}, removeAttribute(key) {delete this.attributes[key];}};
}
for (const value of ['', 'NaN', 'Infinity', '1e999', '-1', '99', '4097', '200.5']) {
  assert(numericError(field('canvasW', value, '100', '4096')), `Reject invalid dimension: ${value}`);
}
assert.equal(numericError(field('canvasW', '900', '100', '4096')), ''); // step 50 is a button increment, not a restriction.
assert.equal(numericError(field('vecField-x', '-0.25')), '');
assert(numericError(field('vecField-rx', '0', '0.01')));
assert(numericError(field('toolSides', '3.5', '3', '16', {tdef: 'polygonSides'})));
assert(numericError(field('seedInput', '9007199254740992')));
const nodes = ['x', 'y', 'rx', 'rotation', 'polygonSides'].map(key => {
  const input = field('', '0', '', '', key === 'rotation' ? {sdeg: key} : key === 'polygonSides' ? {tdef: key} : {sprop: key});
  const label = {textContent: key};
  return {input, label, querySelector(selector) {return selector === 'label' ? label : input;}};
});
const container = {querySelectorAll: () => nodes}; enhanceProperties(container);
const ids = nodes.map(n => n.input.id); assert.equal(new Set(ids).size, ids.length);
for (const node of nodes) assert.equal(node.label.htmlFor, node.input.id);
assert(nodes[0].input.attributes['aria-label'].includes('unidades da peça'));
assert(nodes[3].input.attributes['aria-label'].includes('graus'));
enhanceProperties(container); assert.deepEqual(nodes.map(n => n.input.id), ids);
// Exercise production capture handlers against draft/preview state and simulated native change.
const handlers = {}, feedback = {id: '', classList: {add() {}, remove() {}}, setAttribute() {}};
const doc = {documentElement: {dataset: {}}, body: {appendChild() {}}, createElement: () => feedback,
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener(name, callback) {handlers[name] = callback;}};
let preview = 5, cancelCount = 0, commits = 0;
init(doc, {onCancel() {preview = 5; cancelCount++;}});
const input = field('paddingInput', '5', '0', '25'); input.setAttribute('aria-describedby', 'originalHint');
function send(type, key) {
  const e = {target: input, key, prevented: false, stopped: false,
    preventDefault() {this.prevented = true;}, stopImmediatePropagation() {this.stopped = true;}};
  handlers[type](e); return e;
}
input.dispatchEvent = event => {if (!send(event.type).stopped) commits++;};
input.blur = () => send('blur');
send('focusin'); input.value = '12'; if (!send('input').stopped) preview = 12;
send('keydown', 'Escape'); assert.equal(input.value, '5'); assert.equal(preview, 5); assert.equal(commits, 0);
input.value = ''; assert(send('input').stopped); assert.equal(input.attributes['aria-invalid'], 'true');
assert(send('change').stopped); send('blur'); assert.equal(input.value, '5'); assert.equal(preview, 5);
assert.equal(input.attributes['aria-describedby'], 'originalHint'); assert(!input.attributes['aria-invalid']);
input.value = '15'; send('keydown', 'Enter'); assert.equal(commits, 1);
assert(send('change').stopped, 'Native change after Enter must not confirm twice');
input.value = '20'; send('keydown', 'Escape'); assert.equal(input.value, '15'); assert.equal(commits, 1);
assert.equal(cancelCount, 3);
console.log('✓ Numeric drafts reject invalid/domain values; Enter commits once, Escape/invalid blur cancel; stable property labels retain units.');
