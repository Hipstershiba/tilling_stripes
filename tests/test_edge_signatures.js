// tests/test_edge_signatures.js
// Proves the tile preprocessing: every side gets a fill/background signature and
// those signatures behave consistently under D4 orientation changes.

const assert = require('assert');
const path = require('path');

global.window = {};
require(path.join(__dirname, '../core/d4_symmetry.js'));
require(path.join(__dirname, '../core/tile_registry.js'));
const EdgeSignatures = require(path.join(__dirname, '../core/tile_edge_signatures.js'));

console.log('--- Testing tile edge signatures ---');

const totalTiles = window.TileRegistry.TILE_RENDERERS.length;
assert.ok(totalTiles >= 85, 'the built-in catalog must be available');

const starts = Date.now();
const profiles = [];
for (let id = 0; id < totalTiles; id++) profiles.push(EdgeSignatures.getTileProfile(id));
const elapsed = Date.now() - starts;
console.log(`✓ Pre-processed ${profiles.length} tiles in ${elapsed}ms.`);

for (const profile of profiles) {
  assert.strictEqual(profile.resolution, EdgeSignatures.EDGE_RESOLUTION);
  for (const side of EdgeSignatures.SIDES) {
    const sig = profile.sides[side];
    assert.ok(sig, `tile #${profile.tileId} is missing side ${side}`);
    assert.strictEqual(sig.bits.length, EdgeSignatures.EDGE_RESOLUTION);
    assert.ok(sig.id.startsWith('E'), 'side id must be stable and non-empty');
    assert.ok(sig.fillId.startsWith('F'));
    assert.ok(sig.bgId.startsWith('B'));
    assert.ok(sig.coverage >= 0 && sig.coverage <= 1);
  }
}
console.log('✓ Every tile has four sides with fill/background ids.');

const horizontal = EdgeSignatures.getTileProfile(0);
const vertical = EdgeSignatures.getTileProfile(1);

function approx(value, expected, tolerance, message) {
  assert.ok(Math.abs(value - expected) <= tolerance, `${message}: got ${value}, expected ${expected}`);
}

approx(horizontal.sides.left.coverage, 1 / 3, 0.03, 'horizontal stripe crosses left edge');
approx(horizontal.sides.right.coverage, 1 / 3, 0.03, 'horizontal stripe crosses right edge');
approx(horizontal.sides.top.coverage, 0, 0.01, 'horizontal stripe does not touch top edge');
approx(horizontal.sides.bottom.coverage, 0, 0.01, 'horizontal stripe does not touch bottom edge');
approx(vertical.sides.left.coverage, 0, 0.01, 'vertical stripe does not touch left edge');
approx(vertical.sides.top.coverage, 1 / 3, 0.03, 'vertical stripe crosses top edge');
console.log('✓ Fill/background masks match the known geometry of tiles #0 and #1.');

const leftRuns = horizontal.sides.left.regionRuns.map((run) => run.ink);
assert.ok(leftRuns.includes('F:LR'), 'the stripe region must be tagged as crossing left and right');
assert.ok(leftRuns.includes('B:LRT') || leftRuns.includes('B:LR'), 'background regions must be tagged too');
console.log('✓ Connected region tags describe the fill and background regions touching the side.');

const same = EdgeSignatures.scoreSide(horizontal.sides.right, horizontal.sides.left);
const crossed = EdgeSignatures.scoreSide(horizontal.sides.right, vertical.sides.left);
const empty = EdgeSignatures.getTileProfile(window.TileRegistry.CANONICAL_EMPTY_TILE_ID);
const emptySame = EdgeSignatures.scoreSide(empty.sides.left, empty.sides.right);
const emptyFill = EdgeSignatures.scoreSide(empty.sides.left, horizontal.sides.left);
assert.ok(same > 0.98, `matching horizontal stripes must score high, got ${same}`);
assert.ok(crossed < 0.25, `perpendicular stripes must score low, got ${crossed}`);
assert.strictEqual(emptySame, 0, `two empty sides must not outrank real ink continuity, got ${emptySame}`);
assert.ok(emptyFill < 0.15, `empty against ink must score low, got ${emptyFill}`);
console.log(`✓ Edge scores: same=${same.toFixed(3)} crossed=${crossed.toFixed(3)} empty=${emptySame.toFixed(3)}.`);

const rotated = EdgeSignatures.getOrientedProfile(0, 'r90');
approx(rotated.sides.left.coverage, 0, 0.01, 'rotated horizontal stripe leaves the left edge empty');
approx(rotated.sides.top.coverage, 1 / 3, 0.03, 'rotated horizontal stripe crosses the top edge');
const rotatedMatchesVertical = EdgeSignatures.scoreSide(rotated.sides.top, vertical.sides.top);
assert.ok(rotatedMatchesVertical > 0.98, `r90 of #0 must match #1, got ${rotatedMatchesVertical}`);
const r180 = EdgeSignatures.getOrientedProfile(0, 'r180');
assert.ok(EdgeSignatures.scoreSide(r180.sides.left, horizontal.sides.left) > 0.98, 'r180 must preserve a centred stripe');
console.log('✓ D4 remapping of signatures matches the catalog variants.');

const cacheBefore = EdgeSignatures.getTileProfile(0);
assert.strictEqual(cacheBefore, horizontal, 'profiles are cached per tile');
EdgeSignatures.warm([2, 3, 4]);
assert.ok(EdgeSignatures.getTileProfile(2).sides.left.id, 'warm() fills the cache');
console.log('✓ Profile cache and warm-up work.');

console.log('--- ALL EDGE SIGNATURE CHECKS PASSED! ---');
