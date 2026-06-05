/**
 * gcode-exporter.js — Ender 3 V2 pen‑plotter GCode generation
 *
 * Configuration UI and conversion logic.
 * Inspired by https://github.com/FabianScheidt/illustrator-paths-to-gcode
 * — the same Marlin/Marlin‑flavoured GCode that works on an Ender 3 V2
 * configured as a pen plotter.
 */

// ─── Default config (Ender 3 V2 pen plotter) ───────────────────────────────
const GCODE_DEFAULT_CONFIG = {

    // Bed dimensions (mm)
    bedWidth: 220,
    bedHeight: 220,

    // Offset of the pen holder relative to the origin (mm)
    penOffsetX: 35,
    penOffsetY: 23,

    // Z height when drawing (pen touching paper)
    drawHeight: 0.3,
    // Z height when moving between paths (pen lifted)
    liftHeight: 2.3,
    // Z height for initial clearance / loading paper
    highHeight: 30,

    // Feed rates (mm/min)
    drawFeed: 2000,
    liftFeed: 6000,

    // Pen control mode
    // 'z'     — use Z‑axis moves to lift/lower the pen
    // 'servo' — use M3 (pen down) / M5 (pen up) for a servo on Ender 3 fan port
    penMode: 'z',

    // Canvas → bed scaling
    // 'fit'    — scale to fit the bed, preserving aspect ratio
    // 'stretch'— scale to fill the bed (ignores aspect ratio)
    // 'scale'  — use a manual scale factor (pixels → mm)
    fitMode: 'fit',
    // Manual scale (mm per canvas‑unit) — only used when fitMode === 'scale'
    manualScale: 0.1,

    // GCode header/footer
    enableHome: true,     // emit G28 at start
    enableEndPause: true, // emit M0 after drawing (wait for user)
};

// ─── UI helpers (bind DOM controls to the config object) ───────────────────

const GCODE_CONFIG_STORAGE_KEY = 'tilling_stripes_gcode_config_v1';

/**
 * Load saved config from localStorage, falling back to defaults.
 */
function gcodeLoadConfig() {
    let cfg = {};
    try {
        const raw = localStorage.getItem(GCODE_CONFIG_STORAGE_KEY);
        if (raw) cfg = JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return { ...GCODE_DEFAULT_CONFIG, ...cfg };
}

/**
 * Persist config to localStorage.
 */
function gcodeSaveConfig(cfg) {
    try {
        localStorage.setItem(GCODE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    } catch (_) { /* ignore */ }
}

/**
 * Read current values from the DOM back into the config object.
 * Call this just before generating GCode.
 */
function gcodeReadDomConfig() {
    const cfg = gcodeLoadConfig();

    if (document.getElementById('gcodeBedW'))
        cfg.bedWidth = parseFloat(document.getElementById('gcodeBedW').value) || 220;
    if (document.getElementById('gcodeBedH'))
        cfg.bedHeight = parseFloat(document.getElementById('gcodeBedH').value) || 220;
    if (document.getElementById('gcodeOffsetX'))
        cfg.penOffsetX = parseFloat(document.getElementById('gcodeOffsetX').value) || 35;
    if (document.getElementById('gcodeOffsetY'))
        cfg.penOffsetY = parseFloat(document.getElementById('gcodeOffsetY').value) || 23;
    if (document.getElementById('gcodeDrawZ'))
        cfg.drawHeight = parseFloat(document.getElementById('gcodeDrawZ').value) || 0.3;
    if (document.getElementById('gcodeLiftZ'))
        cfg.liftHeight = parseFloat(document.getElementById('gcodeLiftZ').value) || 2.3;
    if (document.getElementById('gcodeDrawFeed'))
        cfg.drawFeed = parseFloat(document.getElementById('gcodeDrawFeed').value) || 2000;
    if (document.getElementById('gcodeLiftFeed'))
        cfg.liftFeed = parseFloat(document.getElementById('gcodeLiftFeed').value) || 6000;
    if (document.getElementById('gcodePenMode'))
        cfg.penMode = document.getElementById('gcodePenMode').value;
    if (document.getElementById('gcodeFitMode'))
        cfg.fitMode = document.getElementById('gcodeFitMode').value;
    if (document.getElementById('gcodeManualScale'))
        cfg.manualScale = parseFloat(document.getElementById('gcodeManualScale').value) || 0.1;
    if (document.getElementById('gcodeEnableHome'))
        cfg.enableHome = document.getElementById('gcodeEnableHome').checked;
    if (document.getElementById('gcodeEnableEndPause'))
        cfg.enableEndPause = document.getElementById('gcodeEnableEndPause').checked;

    gcodeSaveConfig(cfg);
    return cfg;
}

/**
 * Update DOM form fields from the config object.
 */
function gcodeWriteDomConfig(cfg) {
    const s = (id, val) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!val;
        else el.value = val;
    };
    s('gcodeBedW', cfg.bedWidth);
    s('gcodeBedH', cfg.bedHeight);
    s('gcodeOffsetX', cfg.penOffsetX);
    s('gcodeOffsetY', cfg.penOffsetY);
    s('gcodeDrawZ', cfg.drawHeight);
    s('gcodeLiftZ', cfg.liftHeight);
    s('gcodeDrawFeed', cfg.drawFeed);
    s('gcodeLiftFeed', cfg.liftFeed);
    s('gcodePenMode', cfg.penMode);
    s('gcodeFitMode', cfg.fitMode);
    s('gcodeManualScale', cfg.manualScale);
    s('gcodeEnableHome', cfg.enableHome);
    s('gcodeEnableEndPause', cfg.enableEndPause);
}

/**
 * Called once on page load to restore the saved config into the UI.
 */
function gcodeInitUI() {
    const cfg = gcodeLoadConfig();
    gcodeWriteDomConfig(cfg);

    // Wire up "Reset to defaults"
    const resetBtn = document.getElementById('gcodeResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            gcodeSaveConfig(GCODE_DEFAULT_CONFIG);
            gcodeWriteDomConfig(GCODE_DEFAULT_CONFIG);
        });
    }

    // Show/hide manual scale field
    const fitSelect = document.getElementById('gcodeFitMode');
    const scaleRow = document.getElementById('gcodeScaleRow');
    if (fitSelect && scaleRow) {
        const toggle = () => {
            scaleRow.style.display = fitSelect.value === 'scale' ? '' : 'none';
        };
        fitSelect.addEventListener('change', toggle);
        toggle();
    }
}

// ─── GCode generation ──────────────────────────────────────────────────────

/**
 * Compute the scale factor from canvas (pixel) units to bed (mm) units.
 *
 * @param {number} canvasW  – canvas width  in pixels
 * @param {number} canvasH  – canvas height in pixels
 * @param {object} cfg      – export config (fitMode, manualScale, bedW, bedH)
 * @returns {number} mm per canvas‑unit
 */
function gcodeComputeScale(canvasW, canvasH, cfg) {
    if (cfg.fitMode === 'scale') {
        return cfg.manualScale;
    }
    if (cfg.fitMode === 'stretch') {
        // We'll handle stretch per-axis in the mapper
        return 1; // handled per-axis
    }
    // 'fit' — scale to fit the bed, preserving aspect ratio
    const usableW = cfg.bedWidth - cfg.penOffsetX;
    const usableH = cfg.bedHeight - cfg.penOffsetY;
    if (canvasW <= 0 || canvasH <= 0) return 1;
    return Math.min(usableW / canvasW, usableH / canvasH);
}

/**
 * Build a function that maps canvas (pixel) coords to bed (mm) coords.
 * Returns a function: (px, py) => [mmX, mmY]
 *
 * The canvas origin (0,0) is top‑left in p5; we flip Y so the drawing
 * appears right‑side‑up on the printer bed.
 */
function gcodeBuildMapper(canvasW, canvasH, cfg) {
    const scaleX = cfg.fitMode === 'stretch'
        ? (cfg.bedWidth - cfg.penOffsetX) / canvasW
        : gcodeComputeScale(canvasW, canvasH, cfg);
    const scaleY = cfg.fitMode === 'stretch'
        ? (cfg.bedHeight / canvasH) // no horizontal offset on Y
        : scaleX;

    return (px, py) => [
        px * scaleX + cfg.penOffsetX,
        // Flip Y: canvas 0 = top, printer bed 0 = front
        (canvasH - py) * scaleY + cfg.penOffsetY,
    ];
}

/**
 * Generate GCode from a list of polylines.
 *
 * @param {{points:[number,number][], closed:boolean}[]} pathData
 * @param {number} canvasW
 * @param {number} canvasH
 * @param {object} cfg – export config (from gcodeReadDomConfig)
 * @param {object} meta – export metadata (seed, basename, etc.)
 * @returns {string} complete GCode program
 */
function gcodeGenerate(pathData, canvasW, canvasH, cfg, meta) {
    const map = gcodeBuildMapper(canvasW, canvasH, cfg);
    const lines = [];

    // ── Header ──
    lines.push('; tilling_stripes GCode export');
    lines.push(`; seed: ${meta.seed || '?'}`);
    lines.push(`; canvas: ${canvasW}x${canvasH} px`);
    lines.push(`; grid: ${meta.currentRows || '?'}x${meta.currentCols || '?'}`);
    lines.push(`; margin: ${meta.margin || 0}`);
    lines.push(`; fit: ${cfg.fitMode}`);
    lines.push(`; pen_mode: ${cfg.penMode}`);
    lines.push(';');
    lines.push(`; Printer: Ender 3 V2 (pen plotter)`);
    lines.push(`; Draw feed: ${cfg.drawFeed} mm/min`);
    lines.push(`; Draw height: ${cfg.drawHeight} mm`);
    lines.push(`; Lift height: ${cfg.liftHeight} mm`);
    lines.push('');

    // Marlin flavour
    lines.push(';FLAVOR:Marlin');
    if (cfg.enableHome) {
        lines.push('G28 ; Home all axes');
    }
    lines.push('G21 ; Set units to mm');
    lines.push('G90 ; Absolute positioning');

    // Initial lift
    lines.push(`G0 Z${cfg.highHeight.toFixed(3)} ; Raise pen for loading`);
    lines.push('M0 ; Insert paper then click');

    // Pen down initialisation
    if (cfg.penMode === 'servo') {
        lines.push('M5 ; Pen up (servo off)');
    } else {
        lines.push(`G0 Z${cfg.liftHeight.toFixed(3)} ; Pen up`);
    }
    lines.push('');

    // ── Paths ──
    let pathCount = 0;
    let pointCount = 0;

    for (const path of pathData) {
        if (path.points.length < 2) continue;

        const first = map(path.points[0][0], path.points[0][1]);
        const feedStr = pathCount === 0 ? ` F${cfg.liftFeed}` : '';

        // Move to start (rapid, pen up)
        lines.push(
            `G0${feedStr} X${first[0].toFixed(3)} Y${first[1].toFixed(3)} ; Move to start`
        );

        // Lower pen
        if (cfg.penMode === 'servo') {
            lines.push('M3 S255 ; Pen down');
        } else {
            lines.push(`G0 Z${cfg.drawHeight.toFixed(3)} ; Lower pen`);
        }

        // Draw the path
        for (let i = 1; i < path.points.length; i++) {
            const pt = map(path.points[i][0], path.points[i][1]);
            const f = i === 1 ? ` F${cfg.drawFeed}` : '';
            lines.push(`G1${f} X${pt[0].toFixed(3)} Y${pt[1].toFixed(3)}`);
        }

        // Lift pen
        if (cfg.penMode === 'servo') {
            lines.push('M5 ; Pen up');
        } else {
            lines.push(`G0 Z${cfg.liftHeight.toFixed(3)} ; Lift pen`);
        }
        lines.push('');

        pathCount++;
        pointCount += path.points.length;
    }

    lines.push(`; Total paths: ${pathCount}, total points: ${pointCount}`);

    // ── Footer ──
    if (cfg.penMode === 'servo') {
        lines.push('M5 ; Pen up');
    } else {
        lines.push(`G0 Z${cfg.highHeight.toFixed(3)} ; Raise pen`);
    }

    if (cfg.enableEndPause) {
        lines.push('M0 ; Drawing complete — remove paper');
    }

    lines.push('M84 ; Disable steppers');
    lines.push('M2 ; End of program');
    lines.push('');

    return lines.join('\n');
}

/**
 * High‑level export: collect paths from tiles, convert, download.
 *
 * @param {object[]} tiles – array of Supertile/Tile objects with renderVector
 * @param {number} canvasW
 * @param {number} canvasH
 */
function gcodeExportTiles(tiles, canvasW, canvasH) {
    const cfg = gcodeReadDomConfig();

    // 1. Collect paths from the tile graph
    const collector = new PathCollector(canvasW, canvasH);
    for (const tile of tiles) {
        if (typeof tile.renderVector === 'function') {
            tile.renderVector(collector, 'black');
        }
    }
    const pathData = collector.getPathData();

    if (pathData.length === 0) {
        alert('No paths collected — nothing to export.');
        return;
    }

    // 2. Build metadata
    const timestamp = new Date();
    const ts = timestamp.getFullYear()
        + String(timestamp.getMonth() + 1).padStart(2, '0')
        + String(timestamp.getDate()).padStart(2, '0') + '-'
        + String(timestamp.getHours()).padStart(2, '0')
        + String(timestamp.getMinutes()).padStart(2, '0')
        + String(timestamp.getSeconds()).padStart(2, '0');

    // Read seed from the global variable (injected by sketch.js)
    const seed = typeof window !== 'undefined' && window.seed !== undefined ? window.seed : 0;

    // Try to read grid rows/cols from DOM
    let currentRows = 0, currentCols = 0;
    const rowsEl = document.getElementById('gridRows');
    const colsEl = document.getElementById('gridCols');
    if (rowsEl) currentRows = parseInt(rowsEl.value, 10) || 0;
    if (colsEl) currentCols = parseInt(colsEl.value, 10) || 0;

    const margin = typeof window !== 'undefined' && window.margin !== undefined ? window.margin : 0;

    const basename = `tilling_stripes_seed-${seed}_canvas-${canvasW}x${canvasH}_grid-${currentRows}x${currentCols}_margin-${margin}_${ts}`;
    const meta = { seed, basename, currentRows, currentCols, margin };

    // 3. Generate GCode
    const gcode = gcodeGenerate(pathData, canvasW, canvasH, cfg, meta);

    // 4. Download
    const blob = new Blob([gcode], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `${basename}.gcode`;
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}