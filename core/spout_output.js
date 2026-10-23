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

  /**
   * Signature of the *artwork* (not of the screen): mosaic cells plus the layout parameters
   * that change the clean render. Used to re-render the Spout buffer only when the art changes,
   * ignoring pans, zooms, guide toggles and hover, which never reach the output.
   */
  function artifactSignature(mosaicData, layout) {
    const params = layout || {};
    let hash = 2166136261 >>> 0;
    const mix = (value) => {
      hash ^= (Number(value) | 0);
      hash = Math.imul(hash, 16777619) >>> 0;
    };
    const mixString = (text) => {
      const value = String(text == null ? '' : text);
      for (let i = 0; i < value.length; i++) mix(value.charCodeAt(i));
    };

    mix(params.width);
    mix(params.height);
    mix(params.margin);
    mix(Math.round((Number(params.paddingRatio) || 0) * 1000));
    mixString(params.fgColor);
    mixString(params.bgColor);

    if (!mosaicData || !mosaicData.grid) return hash;

    mix(mosaicData.rows);
    mix(mosaicData.cols);
    mix(mosaicData.subtilesPerSide);

    for (let r = 0; r < mosaicData.rows; r++) {
      for (let c = 0; c < mosaicData.cols; c++) {
        const block = mosaicData.grid[r][c];
        if (!block) continue;
        for (let sr = 0; sr < mosaicData.subtilesPerSide; sr++) {
          for (let sc = 0; sc < mosaicData.subtilesPerSide; sc++) {
            const cell = block.cells[sr][sc];
            if (!cell) continue;
            mix(cell.tileId);
            mixString(cell.transform);
          }
        }
      }
    }

    return hash;
  }

  const SpoutOutput = {
    SPOUT_DEFAULT_NAME,
    SPOUT_WS_URL,
    SPOUT_MAX_NAME,
    sanitizeSenderName,
    frameByteLength,
    frameSignature,
    artifactSignature,
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
