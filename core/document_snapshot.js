/**
 * core/document_snapshot.js
 * Pure helpers for document-level undo.
 *
 * A cell snapshot alone is not enough to undo a destructive regeneration: the cells belong
 * to a set of parameters (grid, seed, symmetry, palette). Restoring cells without the
 * parameters can leave the document inconsistent. These helpers collect, apply and attach
 * the parameter side of a snapshot, so `Ctrl+Z` can cross a "Gerar".
 */

(function () {
  const PARAM_FIELDS = [
    'rows',
    'cols',
    'subdivision',
    'seed',
    'gridSymmetryMode',
    'blockSymmetryMode',
    'syncBlockSymmetry',
    'margin',
    'paddingRatio'
  ];

  /**
   * Collects the document parameters from a StudioState-like object.
   */
  function collectParams(state) {
    if (!state) return null;
    const params = {};
    for (const field of PARAM_FIELDS) {
      params[field] = state[field];
    }

    if (state.allowedTiles instanceof Set) {
      params.allowedTiles = Array.from(state.allowedTiles).sort((a, b) => a - b);
    } else if (Array.isArray(state.allowedTiles)) {
      params.allowedTiles = state.allowedTiles.slice();
    } else {
      params.allowedTiles = [];
    }

    return params;
  }

  /**
   * Applies collected parameters back onto a StudioState-like object.
   * Ignores unknown fields and never removes fields that are absent from the document.
   */
  function applyParams(state, documentParams) {
    if (!state || !documentParams) return false;

    for (const field of PARAM_FIELDS) {
      if (documentParams[field] !== undefined) {
        state[field] = documentParams[field];
      }
    }

    if (Array.isArray(documentParams.allowedTiles)) {
      state.allowedTiles = new Set(
        documentParams.allowedTiles.filter((id) => Number.isInteger(id) && id >= 0)
      );
    }

    return true;
  }

  /**
   * Attaches the parameter record to a cells snapshot, producing a document snapshot.
   */
  function attachDocument(cellsSnapshot, documentParams) {
    if (!cellsSnapshot || typeof cellsSnapshot !== 'object') return null;
    if (documentParams) {
      cellsSnapshot.document = documentParams;
    }
    return cellsSnapshot;
  }

  /**
   * True when the snapshot carries document parameters (i.e. it can cross a generation).
   */
  function hasDocument(snapshot) {
    return Boolean(snapshot && snapshot.document && typeof snapshot.document === 'object');
  }

  const DocumentSnapshot = {
    PARAM_FIELDS,
    collectParams,
    applyParams,
    attachDocument,
    hasDocument
  };

  if (typeof window !== 'undefined') {
    window.DocumentSnapshot = DocumentSnapshot;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentSnapshot;
  }
})();
