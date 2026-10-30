// tests/test_icon_system.js
// Guards the single-source icon system: registry invariants, rendered markup,
// static slots in index.html and the absence of hand-written SVGs elsewhere.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '..');
const format = require('../core/ui_format.js');
const html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');

console.log('--- Testing shared icon system ---');

// 1. Registry names are unique, lowercase camelCase and resolve to markup.
const names = format.iconNames();
assert(names.length >= 80, `Icon registry is unexpectedly small (${names.length})`);
for (const name of names) {
  assert(/^[a-z][a-zA-Z0-9]*$/.test(name), `Icon name must be camelCase: ${name}`);
  assert(format.hasIcon(name));
  assert(format.icon(name).length > 0, `Icon must render: ${name}`);
}
assert.equal(new Set(names).size, names.length, 'Icon names are unique');

// 2. One glyph, one meaning. Aliases are explicit and intentional.
const ALIAS_GROUPS = [['flipX', 'mirror', 'symmetry']];
const sameAliasGroup = (a, b) => ALIAS_GROUPS.some((group) => group.includes(a) && group.includes(b));
const glyphOwners = new Map();
for (const name of names) {
  const glyph = format.ICON_PATHS[name];
  assert(!glyphOwners.has(glyph) || sameAliasGroup(name, glyphOwners.get(glyph)),
    `Icon "${name}" duplicates the glyph of "${glyphOwners.get(glyph)}" without an alias entry`);
  glyphOwners.set(glyph, name);
}

// 3. Rendered markup invariants.
const defaultMarkup = format.icon('plus');
assert(defaultMarkup.includes('viewBox="0 0 24 24"'));
assert(defaultMarkup.includes('stroke-width="1.75"'), '16px icons keep the 1.75 stroke');
assert(defaultMarkup.includes('stroke-linecap="round"') && defaultMarkup.includes('stroke-linejoin="round"'));
assert(defaultMarkup.includes('aria-hidden="true"') && defaultMarkup.includes('focusable="false"'));
assert(defaultMarkup.includes('data-icon="plus"'));
assert(defaultMarkup.includes('width="16"') && defaultMarkup.includes('height="16"'));
for (const [size, stroke] of [[12, '2.33'], [14, '2'], [18, '1.56'], [22, '1.27']]) {
  const markup = format.icon('plus', size);
  assert(markup.includes(`width="${size}"`) && markup.includes(`height="${size}"`));
  assert(markup.includes(`stroke-width="${stroke}"`), `${size}px icons use a ${stroke} optical stroke`);
}
assert.equal(format.icon('<script>'), '', 'Unknown icon names cannot inject markup');
assert.equal(format.icon('constructor'), '', 'Prototype keys are not icons');
assert.equal(format.icon(''), '');

// 4. Static slots in index.html: valid names, system sizes, no leftover SVGs.
const slots = [...html.matchAll(/data-icon-slot="([^"]+)"(?: data-icon-size="(\d+)")?/g)];
assert(slots.length >= 100, `index.html must use icon slots (found ${slots.length})`);
for (const [, name, size] of slots) {
  assert(format.hasIcon(name), `index.html references an unknown icon: ${name}`);
  if (size) assert(['12', '14', '18'].includes(size), `Icon size must come from the scale: ${size}`);
}
assert(!/<svg\b/.test(html), 'index.html must not carry hand-written SVG icons');
assert(!/stroke-width=/.test(html), 'index.html must not set icon strokes');

// 5. Only the registry defines SVG markup.
const sources = ['sketch.js', 'core/subtile_studio_ui.js', 'core/vector_boolean.js'];
for (const rel of sources) {
  const code = fs.readFileSync(path.join(baseDir, rel), 'utf8');
  assert(!/<svg\b[^>]*class="ui-icon"/.test(code), `${rel} must use UiFormat.icon instead of inline icon SVG`);
}

// 6. Hydration contract: slots carry the registry name and the size scale only.
assert.strictEqual(typeof format.hydrateIcons, 'function');
assert.strictEqual(typeof format.iconSlot, 'function');
assert(format.iconSlot('plus').includes('data-icon-slot="plus"'));
assert(format.iconSlot('plus', 18).includes('data-icon-size="18"'));
assert.strictEqual(format.hydrateIcons(), 0, 'Hydration without a DOM is a no-op');

console.log(`✓ ${names.length} registered icons, ${slots.length} hydrated slots, no duplicated glyphs.`);
console.log('--- ALL ICON SYSTEM CHECKS PASSED! ---');
