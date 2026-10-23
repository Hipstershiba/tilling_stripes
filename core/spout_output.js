/**
 * core/spout_output.js
 * Pure helpers for the Spout output. The browser cannot open a Spout sender by itself —
 * a local bridge (tools/spout_bridge.py) forwards frames to SpoutGL — so everything here is
 * about naming, frame size and cheap change detection.
 */

(function () {
  const SPOUT_DEFAULT_NAME = 'Tiling Stripes';
  const SPOUT_WS_URL = 'ws://127.0.0.1:8766';
  const SPOUT_MAX_NAME = 60;

  /**
   * Cleans a sender name: trims, collapses spaces, drops control characters and
   * falls back to the default when empty. Spout tolerant receivers show this name.
   */
  function sanitizeSenderName(raw) {
    const value = typeof raw === 'string' ? raw : '';
    const cleaned = value
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) return SPOUT_DEFAULT_NAME;
    return cleaned.slice(0, SPOUT_MAX_NAME);
  }

  /** Bytes per frame for a RGBA buffer. */
  function frameByteLength(width, height) {
    const w = Math.max(0, Math.floor(Number(width) || 0));
    const h = Math.max(0, Math.floor(Number(height) || 0));
    return w * h * 4;
  }

  /**
   * Cheap signature used to skip identical frames: samples every Nth byte instead of
   * hashing 1.4 MB per tick. Not cryptographic — a "did anything change?" probe.
   */
  function frameSignature(pixels, step = 997) {
    if (!pixels || !pixels.length) return 0;
    let acc = 0;
    for (let i = 0; i < pixels.length; i += step) {
      acc = (acc * 31 + pixels[i]) >>> 0;
    }
    return acc;
  }

  /** Payload for the bridge "start" message. */
  function buildStartMessage(name, width, height) {
    return JSON.stringify({
      type: 'start',
      name: sanitizeSenderName(name),
      width: Math.floor(Number(width) || 0),
      height: Math.floor(Number(height) || 0)
    });
  }

  /** True when a frame matches the announced geometry. */
  function isValidFrame(pixels, width, height) {
    return Boolean(pixels) && pixels.length === frameByteLength(width, height);
  }

  const SpoutOutput = {
    SPOUT_DEFAULT_NAME,
    SPOUT_WS_URL,
    SPOUT_MAX_NAME,
    sanitizeSenderName,
    frameByteLength,
    frameSignature,
    buildStartMessage,
    isValidFrame
  };

  if (typeof window !== 'undefined') {
    window.SpoutOutput = SpoutOutput;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpoutOutput;
  }
})();
