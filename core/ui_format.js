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

  const UiFormat = {
    SCOPE_CHIP_LABELS,
    formatScopeChip
  };

  if (typeof window !== 'undefined') {
    window.UiFormat = UiFormat;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = UiFormat;
  }
})();
