// tests/test_spout_output.js
// Pure helpers for the Spout output: sender naming, frame size and change detection.
// The native side (SpoutGL) lives in tools/spout_bridge.py and is exercised by its own client.

const assert = require('assert');
const path = require('path');

const Spout = require(path.join(__dirname, '../core/spout_output.js'));

console.log('--- Testing Spout output helpers ---');

// 1. Name sanitization
assert.strictEqual(Spout.sanitizeSenderName('  Tiling   Stripes  '), 'Tiling Stripes');
assert.strictEqual(Spout.sanitizeSenderName(''), Spout.SPOUT_DEFAULT_NAME);
assert.strictEqual(Spout.sanitizeSenderName('   '), Spout.SPOUT_DEFAULT_NAME);
assert.strictEqual(Spout.sanitizeSenderName(null), Spout.SPOUT_DEFAULT_NAME);
assert.strictEqual(Spout.sanitizeSenderName('a\u0000b'), 'a b', 'control characters become spaces');
assert.strictEqual(Spout.sanitizeSenderName('x'.repeat(200)).length, Spout.SPOUT_MAX_NAME, 'names are capped');
console.log(`✓ Sender names sanitized (default "${Spout.SPOUT_DEFAULT_NAME}", max ${Spout.SPOUT_MAX_NAME}).`);

// 2. Frame geometry
assert.strictEqual(Spout.frameByteLength(600, 600), 600 * 600 * 4);
assert.strictEqual(Spout.frameByteLength(0, 10), 0);
assert.strictEqual(Spout.frameByteLength('32', '16'), 32 * 16 * 4);
assert.ok(Spout.isValidFrame(new Uint8Array(32 * 16 * 4), 32, 16));
assert.strictEqual(Spout.isValidFrame(new Uint8Array(10), 32, 16), false);
assert.strictEqual(Spout.isValidFrame(null, 32, 16), false);
console.log('✓ Frame geometry and validation match RGBA (w*h*4).');

// 3. Change detection: identical content → same signature, one changed pixel → different
const a = new Uint8Array(64 * 64 * 4).fill(120);
const b = new Uint8Array(64 * 64 * 4).fill(120);
assert.strictEqual(Spout.frameSignature(a), Spout.frameSignature(b));
const c = b.slice();
c[997] = 200;
assert.notStrictEqual(Spout.frameSignature(a), Spout.frameSignature(c));
assert.strictEqual(Spout.frameSignature(new Uint8Array(0)), 0);
console.log('✓ frameSignature detects real changes and skips identical frames.');

// 4. Start message shape (what the bridge expects)
const msg = JSON.parse(Spout.buildStartMessage('  Minha Saída  ', 600, 600));
assert.deepStrictEqual(msg, { type: 'start', name: 'Minha Saída', width: 600, height: 600 });
const fallback = JSON.parse(Spout.buildStartMessage('', 1, 2));
assert.strictEqual(fallback.name, Spout.SPOUT_DEFAULT_NAME);
console.log('✓ Start message matches the bridge protocol.');

// 5. The bridge file exists and documents the same port
const fs = require('fs');
const bridge = fs.readFileSync(path.join(__dirname, '../tools/spout_bridge.py'), 'utf8');
assert.ok(bridge.includes('PORT = 8766'), 'bridge must listen on 8766');
assert.ok(bridge.includes(Spout.SPOUT_WS_URL.replace('ws://', '')), 'bridge host:port must match the client URL');
assert.ok(bridge.includes('SpoutGL'), 'bridge must use SpoutGL');
assert.ok(
  fs.existsSync(path.join(__dirname, '../tools/spout_bridge.cmd')),
  'the one-click launcher tools/spout_bridge.cmd must exist'
);
console.log('✓ Bridge exists, agrees with the client URL, and ships a one-click launcher.');

console.log('--- ALL SPOUT OUTPUT CHECKS PASSED! ---');
