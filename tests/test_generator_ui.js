const assert = require('assert'), fs = require('fs'), vm = require('vm');
const source = fs.readFileSync(require.resolve('../sketch.js'), 'utf8');
const fn = name => {const start = source.indexOf(`function ${name}(`); return source.slice(start, source.indexOf('\n}', start) + 2);};
class Element {
  constructor(tag) {this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.classList = {toggle() {}};}
  set innerHTML(value) {this.children = [];}
  set textContent(value) {this.text = value;}
  get textContent() {return (this.text || '') + this.children.map(c => c.textContent).join('');}
  appendChild(el) {this.children.push(el); return el;}
  prepend(el) {this.children.unshift(el);}
  setAttribute(key, value) {this.attributes[key] = value;}
  addEventListener(key, callback) {this.listeners[key] = callback;}
  focus() {doc.activeElement = this;}
  querySelectorAll() {return flatten(this).filter(el => el.dataset.generatorFocus);}
  click() {this.listeners.click?.();}
}
const flatten = root => [root, ...root.children.flatMap(flatten)];
const container = new Element('div'), counter = new Element('span');
const doc = {activeElement: null, createElement: tag => new Element(tag), getElementById: id => id === 'familiesSwatchContainer' ? container : id === 'activeTilesCounter' ? counter : null};
const families = [{id: 'a', name: 'Fita', tileIds: [0,1]}, {id: 'b', name: 'Cruz', tileIds: [2]}];
const state = {allowedTiles: new Set([0,2]), searchQuery: '', thumbnailCache: new Map()};
let generations = 0;
const context = {document: doc, StudioState: state, window: {TileRegistry: {TILE_RENDERERS: [0,1,2], TILE_NAMES: ['Fita horizontal','Fita vertical','Cruz'], getOrderedGroupedFamilies: () => [{id:'g',name:'Grupo',families}]}}, regenerateMosaic() {generations++;}};
vm.createContext(context);
vm.runInContext('const generatorUiState = {expanded: new Set(), isolation: null};\n' + ['sameGeneratorTiles','toggleGeneratorIsolation','renderSwatchesPanel'].map(fn).join('\n'), context);
const control = key => flatten(container).find(el => el.dataset.generatorFocus === key);
const variants = id => flatten(container).find(el => el.id === 'generatorVariants-' + id);
context.renderSwatchesPanel();
assert.equal(control('a:toggle').attributes['aria-checked'], 'mixed');
assert.equal(control('b:toggle').attributes['aria-checked'], 'true');
assert(variants('a').hidden); control('a:expand').click(); assert(!variants('a').hidden); assert.equal(generations, 0);
control('a:expand').click(); assert(variants('a').hidden);
state.searchQuery = '#1'; context.renderSwatchesPanel(); assert(!variants('a').hidden); assert(!control('b:toggle')); assert(control('tile:1'));
state.searchQuery = ''; context.renderSwatchesPanel(); assert(variants('a').hidden, 'Search does not persist expansion');
control('a:expand').click(); control('family:a:solo').click(); assert.deepEqual([...state.allowedTiles], [0,1]);
control('family:a:solo').click(); assert.deepEqual([...state.allowedTiles], [0,2]);
control('family:a:solo').click(); control('group:g:solo').click(); assert.deepEqual([...state.allowedTiles], [0,1,2]);
control('group:g:solo').click(); assert.deepEqual([...state.allowedTiles], [0,2], 'Switching isolation retains the original selection');
control('family:a:solo').click(); state.allowedTiles = new Set([2]); context.renderSwatchesPanel();
control('family:a:solo').click(); control('family:a:solo').click(); assert.deepEqual([...state.allowedTiles], [2], 'Manual changes invalidate stale isolation');
control('a:toggle').focus(); control('a:toggle').click(); assert.equal(doc.activeElement.dataset.generatorFocus, 'a:toggle');
assert.equal(control('a:toggle').attributes['aria-checked'], 'true');
// Direct block choices keep saved independent settings, without document mutation.
const summary = new Element('span'), pills = ['sync','mandala_d4','rotational_c4'].map(key => {const el = new Element('button');el.dataset.blockMode=key;return el;});
const symState = {gridSymmetryMode:'mandala_d4', blockSymmetryMode:'rotational_c4', syncBlockSymmetry:false, rows:3, cols:3, subdivision:2};
const sym = {StudioState:symState, window:{D4Symmetry:{SYMMETRY_MODES:{mandala_d4:{name:'Mandala'},rotational_c4:{name:'Rotacional'}}}}, document:{querySelectorAll:selector=>selector.includes('blockSymmetryGrid')?pills:[],getElementById:id=>id==='subdivisionSummary'?summary:null}};
vm.createContext(sym); vm.runInContext(fn('syncSymmetryPanelUI'), sym);
const before = JSON.stringify(symState); sym.syncSymmetryPanelUI(); assert.equal(pills[2].attributes['aria-pressed'],'true'); assert.equal(JSON.stringify(symState),before);
symState.syncBlockSymmetry=true; sym.syncSymmetryPanelUI(); assert.equal(pills[0].attributes['aria-pressed'],'true'); assert.equal(summary.textContent,'Bloco com 4×4 peças');
console.log('✓ Generator: tri-state families, progressive variants/search, focus, reversible isolation and restored block symmetry.');
