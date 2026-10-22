/**
 * core/history_nav.js
 * Pure, testable logic for Generation History navigation with lazy edit preservation
 * and storage budget management.
 */

(function () {
  /**
   * Plans the restore action when navigating to targetEntry in generation history.
   * @param {Object} targetEntry - The history entry to navigate to.
   * @param {Object} currentContext - Context options, e.g. { isOverBudget: boolean }.
   * @returns {Object} { action: 'restore_snapshot', snapshot, frozenCells } | { action: 'regenerate', warning?: boolean }
   */
  function planRestore(targetEntry, currentContext = {}) {
    if (!targetEntry) {
      return { action: 'regenerate' };
    }

    if (targetEntry.cellsSnapshot) {
      if (currentContext.isOverBudget) {
        return { action: 'regenerate', warning: true, reason: 'over_budget' };
      }
      return {
        action: 'restore_snapshot',
        snapshot: targetEntry.cellsSnapshot,
        frozenCells: targetEntry.frozenCells || null
      };
    }

    return { action: 'regenerate' };
  }

  /**
   * Lazily captures a cells snapshot and frozenCells into a history entry if dirty (edited).
   * @param {Object} historyEntry - The history entry being exited.
   * @param {Object} mosaicData - Current mosaicData.
   * @param {Map|Array} frozenCells - Current frozenCells Map or serialized Array.
   * @param {number} editHistoryIndex - Current edit history index.
   * @param {Array} [savedEditHistory] - Current edit history stack.
   * @returns {boolean} True if snapshot was saved, false otherwise.
   */
  function saveLazyHistorySnapshot(historyEntry, mosaicData, frozenCells, editHistoryIndex, savedEditHistory) {
    if (!historyEntry || editHistoryIndex <= 0 || !mosaicData) {
      return false;
    }

    let cloneFn = null;
    if (typeof window !== 'undefined' && window.MosaicEngine && typeof window.MosaicEngine.cloneMosaicCellsSnapshot === 'function') {
      cloneFn = window.MosaicEngine.cloneMosaicCellsSnapshot;
    } else if (typeof require === 'function') {
      try {
        const engine = require('./mosaic_engine.js');
        cloneFn = engine.cloneMosaicCellsSnapshot;
      } catch (e) {}
    }

    if (!cloneFn) return false;

    historyEntry.cellsSnapshot = cloneFn(mosaicData);
    if (frozenCells instanceof Map) {
      historyEntry.frozenCells = Array.from(frozenCells.entries());
    } else if (Array.isArray(frozenCells)) {
      historyEntry.frozenCells = frozenCells.slice();
    } else {
      historyEntry.frozenCells = [];
    }

    historyEntry.isDirty = true;
    if (Array.isArray(savedEditHistory)) {
      historyEntry.savedEditHistory = savedEditHistory.slice(0, editHistoryIndex + 1);
      historyEntry.savedEditHistoryIndex = editHistoryIndex;
    }

    return true;
  }

  /**
   * Estimates total snapshot bytes across history and prunes oldest edited snapshots if exceeding maxBudgetBytes.
   * @param {Array} history - The history array.
   * @param {number} maxBudgetBytes - Maximum allowable bytes for snapshot cache.
   * @returns {number} Number of oldest snapshots pruned.
   */
  function pruneSnapshotsOverBudget(history, maxBudgetBytes = 500000) {
    if (!Array.isArray(history) || history.length === 0) return 0;

    let totalBytes = 0;
    const dirtyEntries = [];

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      if (entry && entry.cellsSnapshot) {
        const estBytes = JSON.stringify(entry.cellsSnapshot).length * 2;
        totalBytes += estBytes;
        dirtyEntries.push({ index: i, bytes: estBytes });
      }
    }

    let pruned = 0;
    while (totalBytes > maxBudgetBytes && dirtyEntries.length > 0) {
      const oldest = dirtyEntries.shift();
      const entry = history[oldest.index];
      if (entry) {
        delete entry.cellsSnapshot;
        delete entry.frozenCells;
        delete entry.savedEditHistory;
        delete entry.savedEditHistoryIndex;
        entry.isDirty = false;
        totalBytes -= oldest.bytes;
        pruned++;
      }
    }

    return pruned;
  }

  const HistoryNav = {
    planRestore,
    saveLazyHistorySnapshot,
    pruneSnapshotsOverBudget
  };

  if (typeof window !== 'undefined') {
    window.HistoryNav = HistoryNav;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryNav;
  }
})();
