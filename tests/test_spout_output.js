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

// 4b. Artwork signature: only the art invalidates a frame (not pan/zoom/guides)
const mosaic = {
  rows: 1,
  cols: 1,
  subtilesPerSide: 2,
  grid: [[{
    cells: [
      [{ tileId: 1, transform: 'id' }, { tileId: 2, transform: 'r90' }],
      [{ tileId: 3, transform: 'id' }, { tileId: 4, transform: 'mx' }]
    ]
  }]]
};
const layout = { width: 600, height: 600, margin: 24, paddingRatio: 0.05, fgColor: '#e2e0dc', bgColor: '#0c0c0e' };
const artSig = Spout.artifactSignature(mosaic, layout);

assert.strictEqual(artSig, Spout.artifactSignature(mosaic, { ...layout }), 'same art, same signature');
assert.strictEqual(artSig, Spout.artifactSignature(JSON.parse(JSON.stringify(mosaic)), layout), 'copy of the art, same signature');

const repainted = JSON.parse(JSON.stringify(mosaic));
repainted.grid[0][0].cells[0][0].tileId = 9;
assert.notStrictEqual(artSig, Spout.artifactSignature(repainted, layout), 'a repainted cell invalidates the frame');

const rotated = JSON.parse(JSON.stringify(mosaic));
rotated.grid[0][0].cells[1][1].transform = 'my';
assert.notStrictEqual(artSig, Spout.artifactSignature(rotated, layout), 'a rotated cell invalidates the frame');

assert.notStrictEqual(artSig, Spout.artifactSignature(mosaic, { ...layout, fgColor: '#ffffff' }), 'color change invalidates');
assert.notStrictEqual(artSig, Spout.artifactSignature(mosaic, { ...layout, margin: 30 }), 'margin change invalidates');
assert.notStrictEqual(artSig, Spout.artifactSignature(mosaic, { ...layout, width: 800 }), 'artboard change invalidates');
assert.notStrictEqual(artSig, Spout.artifactSignature(mosaic, { ...layout, libraryRevision: 1 }), 'live tile library edit invalidates');
console.log('✓ Artwork signature follows the mosaic and tile library revision, not the viewport.');

const rebase = JSON.parse(JSON.stringify(mosaic));
rebase.grid[0][0].cells[0][0].baseTileId = 77;
assert.notStrictEqual(artSig, Spout.artifactSignature(rebase, layout), 'changing the actual base renderer invalidates');
assert.notStrictEqual(artSig, Spout.artifactSignature(mosaic, {...layout, margin: 24.5}), 'subpixel margin changes invalidate');
assert.notStrictEqual(artSig, Spout.artifactSignature(mosaic, {...layout, paddingRatio: 0.0501}), 'small padding changes invalidate');
assert.strictEqual(artSig, Spout.artifactSignature(mosaic, {...layout, zoomPercent: 200, panOffsetX: 50, guides: {showSubtileGrid: true}}), 'viewport and guides never invalidate artwork');
const renderList = {...mosaic, blocks: [{...mosaic.grid[0][0], row: 0, col: 0}]};
const listSig = Spout.artifactSignature(renderList, layout);
const changedList = JSON.parse(JSON.stringify(renderList));
changedList.blocks[0].cells[0][0].baseTileId = 77;
assert.notStrictEqual(listSig, Spout.artifactSignature(changedList, layout), 'signature must follow the renderer block list');

// Exercise the real browser controller with a graphics and socket test double.
const vm = require('vm');
const source = require('fs').readFileSync(path.join(__dirname, '../sketch.js'), 'utf8');
const section = source.slice(source.indexOf('let spoutSocket = null;'), source.indexOf('function pushGenerationHistory()'));
const sockets = [], intervals = new Map(), renders = [];
let nextTimer = 1;
class FakeSocket {
  static OPEN = 1;
  constructor() { this.readyState = 1; this.bufferedAmount = 0; this.sent = []; sockets.push(this); }
  send(data) { this.sent.push(data); }
  close() { this.readyState = 3; }
}
const state = {width: 2, height: 2, margin: 0, paddingRatio: 0, fgColor: '#fff', bgColor: '#000', spoutEnabled: true, spoutName: 'Test', mosaicData: null};
let graphicCount = 0, removedCount = 0;
const context = vm.createContext({
  StudioState: state, WebSocket: FakeSocket, Uint8Array,
  document: {getElementById: () => null, activeElement: null},
  setInterval(fn) { const id = nextTimer++; intervals.set(id, fn); return id; },
  clearInterval(id) { intervals.delete(id); }, setTimeout() { return nextTimer++; }, clearTimeout() {},
  createGraphics(width, height) {
    graphicCount++;
    return {width, height, pixels: new Uint8Array(width * height * 4), pixelDensity(n) {assert.strictEqual(n, 1);},
      push() {}, pop() {}, loadPixels() {}, remove() {removedCount++;}};
  },
  window: {SpoutOutput: Spout, TileRegistry: {libraryRevision: 0}, MosaicEngine: {
    renderMosaicToContext(g, doc, config) { renders.push({g, doc, config}); g.pixels.fill(doc.grid[0][0].cells[0][0].baseTileId || 1); },
    renderGuidesAndOverlays() { throw new Error('Spout must never render guides'); },
    renderEditScopeAndGhostOverlay() { throw new Error('Spout must never render editing overlays'); }
  }}
});
vm.runInContext(section, context);
context.startSpoutOutput();
const firstSocket = sockets[0]; firstSocket.onopen();
assert.strictEqual(intervals.size, 1, 'pump starts even before a mosaic exists');
assert.strictEqual(firstSocket.sent.length, 0);
state.mosaicData = JSON.parse(JSON.stringify(mosaic));
context.spoutPump();
assert.strictEqual(firstSocket.sent.length, 2, 'first mosaic sends start and frame after an empty connection');
context.spoutPump();
assert.strictEqual(firstSocket.sent.length, 2, 'unchanged art is not resent');
state.guides = {showSubtileGrid: true}; state.zoomPercent = 300;
context.spoutPump(); assert.strictEqual(firstSocket.sent.length, 2);
state.mosaicData.grid[0][0].cells[0][0].baseTileId = 8;
context.spoutPump(); assert.strictEqual(firstSocket.sent.length, 3, 'base tile edit sends a fresh frame');
firstSocket.bufferedAmount = 100;
state.mosaicData.grid[0][0].cells[0][0].baseTileId = 9; context.spoutPump();
state.mosaicData.grid[0][0].cells[0][0].baseTileId = 10; context.spoutPump();
assert.strictEqual(firstSocket.sent.length, 3, 'congested connection must not queue stale frames');
firstSocket.bufferedAmount = 0; context.spoutPump();
assert.strictEqual(firstSocket.sent.at(-1)[0], 10, 'after draining, send the latest edit');
state.width = 3; context.spoutPump();
assert.strictEqual(JSON.parse(firstSocket.sent.at(-2)).width, 3);
assert.strictEqual(firstSocket.sent.at(-1).length, 3 * 2 * 4);
assert.strictEqual(graphicCount, 2); assert.strictEqual(removedCount, 1);
// Run the actual name-change listener: the bridge resets its sender on start.
const renameListener = source.slice(source.indexOf("  spoutNameInput?.addEventListener('change'"), source.indexOf('\n  syncSpoutUI();', source.indexOf("  spoutNameInput?.addEventListener('change'")));
context.spoutNameInput = {value: 'Renamed', addEventListener(_event, fn) {context.rename = fn;}};
context.saveStudioStateToStorage = () => {};
vm.runInContext(renameListener, context);
context.rename();
assert.strictEqual(JSON.parse(firstSocket.sent.at(-2)).name, 'Renamed');
assert.ok(firstSocket.sent.at(-1) instanceof Uint8Array, 'renaming must resend the unchanged image');
context.stopSpoutOutput(); context.startSpoutOutput();
const secondSocket = sockets[1]; secondSocket.onopen();
firstSocket.onclose();
assert.strictEqual(intervals.size, 1, 'a late old close must not stop the new pump');
const before = secondSocket.sent.length;
state.bgColor = '#123456'; context.spoutPump();
assert.strictEqual(secondSocket.sent.length, before + 1);
assert.ok(renders.every(r => !('guides' in r.config) && !('zoomPercent' in r.config)));
context.stopSpoutOutput();
console.log('✓ Spout controller: late mosaic, edits, deduplication, congestion, resize, rename, reconnect and clean output verified.');

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

const {spawnSync} = require('child_process');
const python = process.platform === 'win32'
  ? path.join(__dirname, '../.venv/Scripts/python.exe') : 'python3';
const bridgeTest = spawnSync(python, [path.join(__dirname, 'test_spout_bridge.py')], {encoding: 'utf8', timeout: 10000});
assert.strictEqual(bridgeTest.status, 0, bridgeTest.stderr || String(bridgeTest.error));
console.log('✓ Bridge ownership: an old connection cannot stop or overwrite the reconnected sender.');

console.log('--- ALL SPOUT OUTPUT CHECKS PASSED! ---');
