/**
 * core/ui_format.js
 * Pure UI formatters for Tiling Stripes Studio v2.
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

  // One stroke weight and viewBox for command icons; their buttons supply the name.
  const ICON_PATHS = {
    alignLeft: '<path d="M4 3v18M8 7h12v4H8zM8 15h8v4H8z"/>',
    alignCenterX: '<path d="M12 3v18M4 6h16v4H4zM7 14h10v4H7z"/>',
    alignRight: '<path d="M20 3v18M4 7h12v4H4zM8 15h8v4H8z"/>',
    alignTop: '<path d="M3 4h18M7 8h4v12H7zM15 8h4v8h-4z"/>',
    alignCenterY: '<path d="M3 12h18M6 4h4v16H6zM14 7h4v10h-4z"/>',
    alignBottom: '<path d="M3 20h18M7 4h4v12H7zM15 8h4v8h-4z"/>',
    up: '<path d="m6 10 6-6 6 6M12 4v16"/>',
    down: '<path d="m6 14 6 6 6-6M12 4v16"/>',
    left: '<path d="m14 6-6 6 6 6"/>',
    right: '<path d="m10 6 6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    edit: '<path d="m14 5 5 5M4 20l5-1L21 7l-4-4L5 15z"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
    undo: '<path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14"/>',
    redo: '<path d="m16 4 5 5-5 5M21 9H10a7 7 0 0 0 0 14"/>',
    swap: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    chevronRight: '<path d="m9 5 7 7-7 7"/>',
    chevronDown: '<path d="m5 9 7 7 7-7"/>',
    toFront: '<path d="M4 3h16M12 7v14m-6-8 6-6 6 6"/>',
    toBack: '<path d="M4 21h16M12 3v14m-6-6 6 6 6-6"/>'
  };
  function icon(name) {
    const paths = ICON_PATHS[name];
    return paths ? `<svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>` : '';
  }

  const UiFormat = {
    SCOPE_CHIP_LABELS,
    formatScopeChip,
    formatProductDescription,
    icon
  };

  if (typeof window !== 'undefined') {
    window.UiFormat = UiFormat;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UiFormat;
  }
})();
