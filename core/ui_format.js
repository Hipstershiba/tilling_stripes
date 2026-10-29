/**
 * core/ui_format.js
 * Pure UI formatters for Tiling Stripes Studio v2.
 *
 * The icon registry below is the single source of truth for every glyph in the
 * application. Rules for new entries:
 *   1. 24 × 24 viewBox, artwork inside a 20 × 20 live area (2 px safe margin).
 *   2. Stroke-only geometry in `currentColor`, 1.75 at 16 px (scaled by size).
 *   3. Fill is reserved for "result / selected / mirrored copy" semantics.
 *   4. One name = one meaning; never reuse a glyph for a second concept.
 * `tests/test_icon_system.js` enforces the registry and the static markup.
 */

(function () {
  const SCOPE_CHIP_LABELS = {
    canvas_center: (pat) => 'Centro • 8 eixos',
    orbit_sym:     (pat) => 'Órbita • bloco+grade',
    block_sym:     (pat) => 'Bloco • 4 quadrantes',
    all_blocks:    (pat) => 'Todos • grade inteira',
    single:        (pat) => 'Livre • 1 célula',
    same_tile:     (pat) => 'Iguais • mesmo tile'
  };

  function formatScopeChip(scopeId, pattern) {
    const fn = SCOPE_CHIP_LABELS[scopeId];
    if (!fn) return '';
    const base = fn(pattern);
    // pincel multi-célula no escopo Iguais é bloqueado; sinalize no chip
    if (scopeId === 'same_tile' && pattern && (pattern.rows > 1 || pattern.cols > 1)) {
      return `${base} • pincel ${pattern.rows}×${pattern.cols}`;
    }
    return base;
  }

  // Only product descriptions pass through this formatter; never family/user names.
  function formatProductDescription(text) {
    return String(text).replace(/\bsupertiles\b/gi, 'blocos').replace(/\bsupertile\b/gi, 'bloco')
      .replace(/\bsubtiles\b/gi, 'peças').replace(/\bsubtile\b/gi, 'peça').replace(/\bcanvas\b/gi, 'prancheta');
  }

  // ---------------------------------------------------------------------------
  // Icon registry
  // ---------------------------------------------------------------------------
  const ICON_PATHS = {
    // -- Comandos básicos ----------------------------------------------------
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    chevronUp: '<path d="m5 15 7-7 7 7"/>',
    chevronDown: '<path d="m5 9 7 7 7-7"/>',
    chevronLeft: '<path d="m15 5-7 7 7 7"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    up: '<path d="M12 20V4M5 11l7-7 7 7"/>',
    down: '<path d="M12 4v16M5 13l7 7 7-7"/>',
    left: '<path d="M20 12H4M11 5l-7 7 7 7"/>',
    right: '<path d="M4 12h16M13 5l7 7-7 7"/>',
    undo: '<path d="M8 4 3 9l5 5"/><path d="M3 9h11.5a5.25 5.25 0 0 1 0 10.5H9"/>',
    redo: '<path d="m16 4 5 5-5 5"/><path d="M21 9H9.5a5.25 5.25 0 0 0 0 10.5H15"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.7-6.4L3 8"/><path d="M3 3.5V8h4.5"/><path d="M12 7.5V12l3 2"/>',
    swap: '<path d="M3.5 8h17M15.5 3.5 20 8l-4.5 4.5"/><path d="M20.5 16h-17M8.5 11.5 4 16l4.5 4.5"/>',
    cycle: '<path d="M3.5 8.5A8.5 8.5 0 0 1 18 5.5"/><path d="M18 1.5v4.5h-4.5"/><path d="M20.5 15.5A8.5 8.5 0 0 1 6 18.5"/><path d="M6 22.5v-4.5h4.5"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3.1-6.8L3 8"/><path d="M3 3.5V8h4.5"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-3.1-6.8L21 8"/><path d="M21 3.5V8h-4.5"/>',
    rotateCCW: '<path d="M3 12a9 9 0 1 0 3.1-6.8L3 8"/><path d="M3 3.5V8h4.5"/>',
    nodePlus: '<path d="M3 16h18"/><circle cx="12" cy="16" r="2.2" fill="currentColor" stroke="none"/><path d="M12 5v5M9.5 7.5h5"/>',
    fit: '<rect x="2.5" y="2.5" width="19" height="19" rx="2.5" stroke-dasharray="2.5 2.5" opacity=".5"/><rect x="7" y="7" width="10" height="10" rx="1.5"/>',
    expand: '<path d="M9.5 3.5H3.5v6M14.5 3.5h6v6M9.5 20.5h-6v-6M14.5 20.5h6v6"/><path d="m3.5 3.5 5.5 5.5M20.5 3.5 15 9M3.5 20.5 9 15M20.5 20.5 15 15"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none"/>',

    // -- Objetos e estados ----------------------------------------------------
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M16 8.5v-2a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5"/>',
    edit: '<path d="M4 20l4.5-1L20 7.5 16.5 4 5 15.5z"/><path d="m14.5 6 3.5 3.5"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7"/><path d="M10 11v5.5M14 11v5.5"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V6.5a4 4 0 0 1 8 0V10"/><path d="M12 14.5v2"/>',
    unlock: '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V6.5a4 4 0 0 1 7.6-1.8"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/><path d="m3.5 3.5 17 17"/>',
    isolate: '<rect x="3.5" y="3.5" width="7" height="7" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="3.5" width="7" height="7" rx="1" stroke-dasharray="2 2" opacity=".45"/><rect x="3.5" y="13.5" width="7" height="7" rx="1" stroke-dasharray="2 2" opacity=".45"/><rect x="13.5" y="13.5" width="7" height="7" rx="1" stroke-dasharray="2 2" opacity=".45"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5" stroke-dasharray="2.5 2.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
    capture: '<path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" stroke="none"/>',
    all: '<path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M3 16v3.5A1.5 1.5 0 0 0 4.5 21H8M16 21h3.5a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="m8 12 3 3 5.5-5.5"/>',
    none: '<path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M3 16v3.5A1.5 1.5 0 0 0 4.5 21H8M16 21h3.5a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="m8.5 8.5 7 7M15.5 8.5l-7 7"/>',
    invert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
    fill: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 13h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor" stroke="none"/>',
    toFront: '<path d="M4 3.5h16"/><path d="M12 21V8"/><path d="m6 14 6-6 6 6"/>',
    toBack: '<path d="M4 20.5h16"/><path d="M12 3v13"/><path d="m6 10 6 6 6-6"/>',
    dice: '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.4" fill="currentColor" stroke="none"/>',
    random: '<path d="M3 6.5h3l11 11h4M3 17.5h3l3.5-3.5M13.5 8.5 17 6.5h4"/><path d="m18 3.5 2.5 3-2.5 3M18 14l2.5 3-2.5 3"/>',
    equalize: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 9.5h8M8 14.5h8"/>',

    // -- Ferramentas ----------------------------------------------------------
    cursor: '<path d="m4 3 6.8 17 2.5-7.1 7.2-2.5z"/>',
    cursorFilled: '<path d="m4 3 6.8 17 2.5-7.1 7.2-2.5z" fill="currentColor" stroke="none"/>',
    pen: '<path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" stroke="none" d="M1.29289 1.29289C1.55303 1.03276 1.92083 0.945902 2.25287 1.03233L16.7347 4.52794C17.0542 4.60506 17.3154 4.83427 17.4334 5.14104L19.8572 11.443L22 13.5858C22.7811 14.3669 22.7811 15.6332 22 16.4142L16.4142 22C15.6332 22.7811 14.3669 22.7811 13.5858 22L11.443 19.8572L5.14104 17.4334C4.83427 17.3154 4.60506 17.0542 4.52794 16.7347L1.03233 2.25287C0.945902 1.92083 1.03276 1.55303 1.29289 1.29289ZM8.87889 10.2931L3.80604 5.22025L6.34893 15.7551L12.359 18.0667C12.4896 18.1169 12.6082 18.194 12.7071 18.2929L15 20.5858L20.5858 15L18.2929 12.7071C18.194 12.6082 18.1169 12.4896 18.0667 12.359L15.7551 6.34893L5.22025 3.80604L10.2931 8.87889C10.354 8.93977 10.4054 9.00654 10.4473 9.07736C10.6228 9.02698 10.8083 9 11 9C12.1046 9 13 9.89543 13 11C13 12.1046 12.1046 13 11 13C9.89543 13 9 12.1046 9 11C9 10.8083 9.02698 10.6228 9.07736 10.4473C9.00654 10.4054 8.93977 10.354 8.87889 10.2931Z"/>',
    selectRect: '<rect x="5.5" y="6.5" width="13" height="11" rx="0.5" stroke-dasharray="3.5 2.5"/><rect x="2.5" y="3.5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/><rect x="17.5" y="3.5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/><rect x="2.5" y="16.5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/><rect x="17.5" y="16.5" width="4" height="4" rx="0.5" fill="currentColor" stroke="none"/>',
    selectBrush: '<rect x="3" y="3" width="12.5" height="12.5" rx="1" stroke-dasharray="3.5 2.5"/><path d="M21.4 9.6 13.6 17.4l-4 .9.9-4 7.8-7.8a2 2 0 0 1 2.8 2.8z" fill="currentColor" stroke="none"/>',
    brush: '<path d="M18.4 2.6 14 7l-1.6-1.6a2 2 0 0 0-2.8 0L8 7l9 9 1.6-1.6a2 2 0 0 0 0-2.8L17 10l4.4-4.4a2.1 2.1 0 1 0-3-3z"/><path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>',
    erase: '<path d="m3.5 14.5 11-11 8 8-10 10H9z"/><path d="M8.5 9.5l8 8M12 21.5h9.5"/>',
    stamp: '<path d="M4 20.5h16"/><rect x="4.5" y="14.5" width="15" height="4.5" rx="1.2"/><path d="M9 14.5v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/><rect x="9.5" y="3.8" width="5" height="4.6" rx="1"/>',
    snowflake: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8"/><path d="M10.7 4 12 5.5l1.3-1.5M10.7 20 12 18.5l1.3 1.5M18.3 17.1l-.7-1.8 2-.4M5.7 6.9 6.4 8.7l-2 .4M18.3 6.9l-.7 1.8 2 .4M5.7 13.4l.7 1.9-2 .3"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4.5a2 2 0 0 0-4 0V10"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="7"/><path d="m20.5 20.5-5.5-5.5M10.5 7.5v6M7.5 10.5h6"/>',
    snap: '<path d="M4 3.5v8a8 8 0 0 0 16 0v-8h-3v8a5 5 0 0 1-10 0v-8z"/><path d="M4 7h3M17 7h3"/>',
    clip: '<path d="M6.5 2.5v14a1.5 1.5 0 0 0 1.5 1.5h14"/><path d="M2.5 6.5h14a1.5 1.5 0 0 1 1.5 1.5v14"/>',

    // -- Formas vetoriais -----------------------------------------------------
    shapeRect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
    shapeEllipse: '<ellipse cx="12" cy="12" rx="8.5" ry="6.5"/>',
    shapePolygon: '<path d="m12 3 7.8 4.5v9L12 21l-7.8-4.5v-9z"/>',
    shapeTriangle: '<path d="M12 4 20.5 19.5H3.5z"/>',
    shapeArc: '<path d="M4 20A11.5 11.5 0 0 1 20 4"/>',
    shapeLine: '<path d="M4 20 20 4"/><circle cx="4" cy="20" r="1.6" fill="currentColor" stroke="none"/><circle cx="20" cy="4" r="1.6" fill="currentColor" stroke="none"/>',
    curve: '<path d="M3.5 17.5C3.5 10.5 10 8 12 12s8.5 1.5 8.5-5.5"/><circle cx="3.5" cy="17.5" r="1.7" fill="currentColor" stroke="none"/><circle cx="20.5" cy="6.5" r="1.7" fill="currentColor" stroke="none"/>',
    presetStripeH: '<rect x="2.5" y="8" width="19" height="8" rx="1"/>',
    presetStripeV: '<rect x="8" y="2.5" width="8" height="19" rx="1"/>',
    presetArcTL: '<path d="M3 21A18 18 0 0 1 21 3"/>',
    presetPieTL: '<path d="M3 3a18 18 0 0 1 18 18H3z" fill="currentColor" stroke="none"/>',
    distributeH: '<path d="M3 3.5v17M21 3.5v17M8 6.5v11M16 6.5v11"/>',
    distributeV: '<path d="M3.5 3h17M3.5 21h17M6.5 8h11M6.5 16h11"/>',
    pathClosed: '<path d="M5 5h14v14H5z"/><circle cx="5" cy="5" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="5" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="19" r="1.7" fill="currentColor" stroke="none"/><circle cx="5" cy="19" r="1.7" fill="currentColor" stroke="none"/>',
    pathOpen: '<path d="M5 5v14h14"/><circle cx="5" cy="5" r="1.7" fill="currentColor" stroke="none"/><circle cx="5" cy="19" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="19" r="1.7" fill="currentColor" stroke="none"/>',

    // -- Alinhamento ----------------------------------------------------------
    alignLeft: '<path d="M4 3.5v17"/><rect x="7.5" y="6" width="11" height="4.5" rx="1"/><rect x="7.5" y="13.5" width="7" height="4.5" rx="1"/>',
    alignCenterX: '<path d="M12 3.5v17"/><rect x="4" y="6" width="16" height="4.5" rx="1"/><rect x="7.5" y="13.5" width="9" height="4.5" rx="1"/>',
    alignRight: '<path d="M20 3.5v17"/><rect x="5.5" y="6" width="11" height="4.5" rx="1"/><rect x="9.5" y="13.5" width="7" height="4.5" rx="1"/>',
    alignTop: '<path d="M3.5 4h17"/><rect x="6" y="7.5" width="4.5" height="11" rx="1"/><rect x="13.5" y="7.5" width="4.5" height="7" rx="1"/>',
    alignCenterY: '<path d="M3.5 12h17"/><rect x="6" y="4" width="4.5" height="16" rx="1"/><rect x="13.5" y="7.5" width="4.5" height="9" rx="1"/>',
    alignBottom: '<path d="M3.5 20h17"/><rect x="6" y="5.5" width="4.5" height="11" rx="1"/><rect x="13.5" y="9.5" width="4.5" height="7" rx="1"/>',

    // -- Espelhamento e transformação ----------------------------------------
    flipX: '<path d="M12 2.5v19" stroke-dasharray="2.5 2.5" opacity=".55"/><path d="M9.5 5 3.5 12l6 7z"/><path d="M14.5 5l6 7-6 7z"/>',
    flipY: '<path d="M2.5 12h19" stroke-dasharray="2.5 2.5" opacity=".55"/><path d="M5 9.5 12 3.5l7 6z"/><path d="M5 14.5l7 6 7-6z"/>',
    mirror: '<path d="M12 2.5v19" stroke-dasharray="2.5 2.5" opacity=".55"/><path d="M9.5 5 3.5 12l6 7z"/><path d="M14.5 5l6 7-6 7z"/>',
    symmetry: '<path d="M12 2.5v19" stroke-dasharray="2.5 2.5" opacity=".55"/><path d="M9.5 5 3.5 12l6 7z"/><path d="M14.5 5l6 7-6 7z"/>',

    // -- Simetria D4 ----------------------------------------------------------
    mandala: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17M5.7 5.7l12.6 12.6M18.3 5.7 5.7 18.3"/>',
    kaleidoscope: '<path d="m12 2.5 2.6 6.1 6.6.6-5 4.4 1.5 6.5L12 16.8l-5.7 3.3 1.5-6.5-5-4.4 6.6-.6z"/>',
    bilateral: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17" stroke-dasharray="2.5 2"/>',
    sync: '<path d="M9.5 14.5a4.5 4.5 0 0 0 6.4.4l2.5-2.5a4.5 4.5 0 0 0-6.4-6.4l-1.4 1.4"/><path d="M14.5 9.5a4.5 4.5 0 0 0-6.4-.4l-2.5 2.5a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4"/>',

    // -- Escopos de edição ----------------------------------------------------
    scopeCanvas: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M3.5 12h17"/>',
    scopeOrbit: '<path d="m12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z"/>',
    scopeBlock: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/><rect x="3.5" y="3.5" width="8.5" height="8.5" fill="currentColor" fill-opacity=".28" stroke="none"/>',
    scopeAll: '<rect x="3" y="3" width="5.2" height="5.2" rx="0.8"/><rect x="9.4" y="3" width="5.2" height="5.2" rx="0.8"/><rect x="15.8" y="3" width="5.2" height="5.2" rx="0.8"/><rect x="3" y="9.4" width="5.2" height="5.2" rx="0.8"/><rect x="9.4" y="9.4" width="5.2" height="5.2" rx="0.8"/><rect x="15.8" y="9.4" width="5.2" height="5.2" rx="0.8"/><rect x="3" y="15.8" width="5.2" height="5.2" rx="0.8"/><rect x="9.4" y="15.8" width="5.2" height="5.2" rx="0.8"/><rect x="15.8" y="15.8" width="5.2" height="5.2" rx="0.8"/>',
    scopeSingle: '<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="2.5 2.5"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/>',
    scopeSame: '<path d="M3.5 8h13M13 4.5 16.5 8 13 11.5"/><path d="M20.5 16h-13M11 12.5 7.5 16l3.5 3.5"/>',

    // -- Guias visuais --------------------------------------------------------
    axes: '<path d="M12 2.5v19M2.5 12h19" stroke-dasharray="3.5 2"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/>',
    grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17"/>',
    blocks: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/>',
    pieces: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/>',
    ports: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><circle cx="3.5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="3.5" r="1.8" fill="currentColor" stroke="none"/><circle cx="20.5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="20.5" r="1.8" fill="currentColor" stroke="none"/>',
    padding: '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><rect x="7.5" y="7.5" width="9" height="9" rx="1" stroke-dasharray="2.5 2"/>',
    orbits: '<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.5"/><circle cx="12" cy="12" r="3"/><circle cx="17.7" cy="6.3" r="1.9" fill="currentColor" stroke="none"/>',
    tiles: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><path d="M13.5 17h7M17 13.5v7"/>',
    layers: '<path d="m12 2.5 8.5 4.5L12 11.5 3.5 7z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 17 8.5 4.5 8.5-4.5"/>',
    sliders: '<path d="M4 7h8M18 7h2M4 12h3M11 12h9M4 17h9M19 17h1"/><circle cx="15.5" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15.5" cy="17" r="2"/>',

    // -- Geração de mosaico ---------------------------------------------------
    edgeJoin: '<rect x="2.6" y="5.4" width="8.2" height="13.2" rx="1.4"/><rect x="13.2" y="5.4" width="8.2" height="13.2" rx="1.4"/><path d="M10.8 9.4h2.4M10.8 12h2.4M10.8 14.6h2.4"/>',

    // -- Arquivos e biblioteca ------------------------------------------------
    folder: '<path d="M3.5 7.5V6A1.5 1.5 0 0 1 5 4.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 8.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    folderPlus: '<path d="M3.5 7.5V6A1.5 1.5 0 0 1 5 4.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 8.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M12 10.5v5M9.5 13h5"/>',
    book: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8.5 3.5v17"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    file: '<path d="M6.5 3.5h6.5l5 5V19a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z"/><path d="M13 3.5v5h5"/>',
    import: '<path d="M12 3.5v11.5M7.5 10.5 12 15l4.5-4.5M3.5 16v3a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3"/>',
    export: '<path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5M3.5 16v3a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3"/>',

    // -- Operações booleanas --------------------------------------------------
    unite: '<path d="M3.5 3.5h12v5h5v12h-12v-5h-5z" fill="currentColor" stroke="none"/>',
    subtract: '<rect x="8.5" y="8.5" width="12" height="12" stroke-dasharray="2 2" opacity=".45"/><path d="M3.5 3.5h12v5h-7v7h-5z" fill="currentColor" stroke="none"/>',
    intersect: '<rect x="3.5" y="3.5" width="12" height="12" opacity=".45"/><rect x="8.5" y="8.5" width="12" height="12" opacity=".45"/><path d="M8.5 8.5h7v7h-7z" fill="currentColor" stroke="none"/>',
    exclude: '<path fill="currentColor" fill-rule="evenodd" stroke="none" d="M3.5 3.5h12v12h-12zM8.5 8.5h12v12h-12z"/>'
  };

  const ICON_SIZES = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22 };
  const BASE_SIZE = 16;
  const BASE_STROKE = 1.75;
  const SLOT_ATTRIBUTE = 'data-icon-slot';

  function normalizeSize(value) {
    if (value === null || value === undefined || value === '') return BASE_SIZE;
    if (typeof value === 'string' && ICON_SIZES[value]) return ICON_SIZES[value];
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return BASE_SIZE;
    return Math.min(48, Math.max(10, Math.round(numeric)));
  }

  // Optical weight stays constant: a smaller glyph gets a slightly heavier stroke.
  function strokeFor(size) {
    const raw = (BASE_STROKE * BASE_SIZE) / size;
    return String(Math.round(raw * 100) / 100);
  }

  /**
   * Returns the canonical SVG markup for an icon name.
   * Unknown or hostile names return '' so markup can never be injected.
   * @param {string} name
   * @param {number|string|{size?: number|string, className?: string}} [options]
   */
  function icon(name, options) {
    if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(ICON_PATHS, name)) return '';
    const paths = ICON_PATHS[name];
    if (typeof paths !== 'string') return '';
    const opts = typeof options === 'object' && options !== null ? options : { size: options };
    const size = normalizeSize(opts.size);
    const className = opts.className ? `ui-icon ${opts.className}` : 'ui-icon';
    return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeFor(size)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-icon="${name}">${paths}</svg>`;
  }

  function hasIcon(name) { return Object.prototype.hasOwnProperty.call(ICON_PATHS, name); }

  function iconNames() { return Object.keys(ICON_PATHS).sort(); }

  /** Static markup for an icon slot that `hydrateIcons` replaces on boot. */
  function iconSlot(name, size) {
    const dimension = normalizeSize(size);
    return `<span class="icon-slot" ${SLOT_ATTRIBUTE}="${name}" data-icon-size="${dimension}"></span>`;
  }

  /** Replaces every `[data-icon-slot]` placeholder with its canonical SVG. */
  function hydrateIcons(root) {
    if (typeof document === 'undefined') return 0;
    const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
    const slots = scope.querySelectorAll(`[${SLOT_ATTRIBUTE}]`);
    let filled = 0;
    for (const slot of slots) {
      const markup = icon(slot.getAttribute(SLOT_ATTRIBUTE), {
        size: slot.getAttribute('data-icon-size')
      });
      if (!markup) continue;
      slot.outerHTML = markup;
      filled += 1;
    }
    return filled;
  }

  const UiFormat = {
    SCOPE_CHIP_LABELS,
    ICON_PATHS,
    ICON_SIZES,
    SLOT_ATTRIBUTE,
    formatScopeChip,
    formatProductDescription,
    icon,
    iconNames,
    iconSlot,
    hasIcon,
    hydrateIcons
  };

  if (typeof window !== 'undefined') {
    window.UiFormat = UiFormat;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UiFormat;
  }

  // Static markup carries `<span data-icon-slot="name">` placeholders so the
  // registry stays the only source of truth; fill them as soon as the DOM exists.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => hydrateIcons(), { once: true });
    } else {
      hydrateIcons();
    }
  }
})();
