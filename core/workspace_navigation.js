// Application menus and the dedicated library view share the existing command handlers.
(function () {
  const win = typeof window !== 'undefined' ? window : null;
  const doc = typeof document !== 'undefined' ? document : null;
  let libraryOpen = false;
  let lastEditorFocus = null;
  let openIndex = -1;
  let initialized = false;
  let triggers = [];
  const byId = id => doc?.getElementById(id);
  const studio = () => win?.SubtileStudioUI;
  const tiles = () => doc?.body?.dataset.studioMode === 'tiles';
  const canEdit = () => tiles() && !libraryOpen;
  const guideControls = {
    mosaic:{axes:'toggleGuideAxes',blocks:'toggleGuideBlocks',pieces:'toggleGuideSubtiles',orbits:'toggleGuideOrbits'},
    tiles:{axes:'toggleTileGuideAxes',grid:'toggleTileGuideGrid',ports:'toggleTileGuidePorts',margin:'toggleTileGuidePadding',snap:'btnTileSnapToggle'}
  };
  const guideControlId = (mode,key) => guideControls[mode]?.[key] || null;
  function syncViews() {
    const current = libraryOpen ? 'library' : tiles() ? 'tiles' : 'mosaic';
    doc?.querySelectorAll('[data-studio-view]').forEach(button => {
      if (button.dataset.studioView === current) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }
  function menuStep(current, direction, length) {
    return length ? (current + direction + length) % length : -1;
  }
  function route(open) {
    if (!win?.history || !win.location) return;
    const url = win.location.pathname + win.location.search + (open ? '#biblioteca' : '');
    if (open) { if (win.location.hash !== '#biblioteca') win.history.pushState(null, '', url); }
    else if (win.location.hash === '#biblioteca') win.history.replaceState(null, '', url);
  }
  function refresh() {
    syncViews();
    if (!libraryOpen) return;
    const meta = win.TileRegistry?.getFamilyById(studio()?.state.selectedFamilyId);
    const title = byId('librarySelectionName');
    if (title) title.textContent = meta?.name || 'Selecione uma peça';
    const thumb = doc.querySelector('.lib-family-row.active .lib-family-thumb img');
    const preview = byId('librarySelectionPreview');
    if (preview) {
      if (thumb) {
        preview.classList.remove('hidden');
        if (preview.getAttribute('src') !== thumb.getAttribute('src')) preview.src = thumb.src;
        preview.dataset.familyId = studio()?.state.selectedFamilyId || '';
        preview.alt = meta?.name || 'Prévia da peça';
      } else if (preview.dataset.familyId !== studio()?.state.selectedFamilyId) preview.classList.add('hidden');
    }
    const edit = byId('btnEditLibraryPiece');
    if (edit) {
      edit.disabled = !meta;
      const label = typeof edit.querySelector === 'function' ? edit.querySelector('span:last-child') : null;
      if (label) label.textContent = meta?.builtIn || meta?.protected ? 'Inspecionar' : 'Editar';
      edit.title = meta?.builtIn || meta?.protected ? 'Inspecionar peça protegida' : 'Editar peça selecionada';
      edit.setAttribute('aria-label', edit.title);
    }
  }
  function openLibrary(updateRoute = true) {
    const page = byId('library-page');
    if (!page) return false;
    if (!libraryOpen) { lastEditorFocus = doc.activeElement; studio()?.prepareNavigation?.(); }
    libraryOpen = true;
    doc.body.classList.add('library-page-open');
    page.hidden = false; page.classList.remove('hidden');
    const panel = byId('panel-tile-library-mgr');
    if (panel) { panel.hidden = false; panel.setAttribute('role', 'region'); panel.removeAttribute('aria-labelledby'); panel.setAttribute('aria-label', 'Catálogo de peças'); }
    if (updateRoute) route(true);
    studio()?.refresh?.(); refresh();
    byId('libraryPageTitle')?.focus();
    return true;
  }
  function closeLibrary(updateRoute = true) {
    if (!libraryOpen) return;
    libraryOpen = false;
    const page = byId('library-page');
    if (page) { page.hidden = true; page.classList.add('hidden'); }
    doc.body.classList.remove('library-page-open');
    syncViews();
    if (updateRoute) route(false);
    studio()?.refresh?.();
    const target = lastEditorFocus?.isConnected && !lastEditorFocus.closest('[hidden], .hidden') ? lastEditorFocus : byId('menu-library');
    target?.focus();
  }
  function closeMenus(restoreFocus = false) {
    const previous = openIndex; openIndex = -1;
    triggers.forEach(trigger => {
      trigger.setAttribute('aria-expanded', 'false');
      const popup = byId(trigger.getAttribute('aria-controls'));
      if (popup) { popup.hidden = true; popup.classList.add('hidden'); }
    });
    if (restoreFocus && previous >= 0) triggers[previous]?.focus();
  }
  function control(item) {
    const target = item.dataset.menuTarget;
    if (item.dataset.menuAction === 'object') return doc.querySelector('#vecPropsContainer ' + target + ', #tilePathfinderContainer ' + target);
    if (item.dataset.menuAction === 'guide') return byId(guideControlId(tiles() ? 'tiles' : 'mosaic',target));
    return byId(target);
  }
  function available(item) {
    const action = item.dataset.menuAction;
    if (!action) return item.id !== 'btnExportSubtileSvg' || Boolean(win.TileRegistry?.getFamilyById(studio()?.state.selectedFamilyId));
    if (action === 'open-library' || action === 'help' || action === 'import-svg') return true;
    if (action === 'export-groups') return Boolean(win.LibraryExport && win.LibraryStore);
    if (action === 'close-library') return libraryOpen;
    if (action === 'library-click') return Boolean(control(item));
    if (action === 'tile-command') return canEdit() && studio()?.canRunCommand?.(item.dataset.menuTarget);
    if (action === 'undo' || action === 'redo') {
      if (libraryOpen) return false;
      if (tiles()) return Boolean(studio()?.canRunCommand?.(action));
      const target = byId(action === 'undo' ? 'btnEditUndo' : 'btnEditRedo');
      return Boolean(target && !target.disabled);
    }
    if (libraryOpen) return false;
    if (action === 'guide') return Boolean(control(item));
    if (action === 'object' && !canEdit()) return false;
    if (['btnTileSelectAll','btnTileDeselect','btnVecPropDelete','btnVecPropToPath'].includes(item.dataset.menuTarget) && !canEdit()) return false;
    if (item.dataset.menuTarget === 'btnExport' && tiles()) return false;
    const target = control(item);
    return Boolean(target && !target.disabled);
  }
  function syncMenus() {
    doc.querySelectorAll('#app-menubar .menu-command').forEach(item => {
      item.hidden = Boolean(item.dataset.menuMode && item.dataset.menuMode !== (tiles() ? 'tiles' : 'mosaic'));
      item.disabled = item.hidden || !available(item); item.setAttribute('aria-disabled', String(item.disabled));
      if (item.dataset.menuAction === 'guide') {
        item.setAttribute('role', 'menuitemcheckbox');
        const checked = Boolean(control(item)?.classList.contains('active'));
        item.setAttribute('aria-checked', String(checked));
      }
    });
  }
  function items(index = openIndex) {
    const popup = byId(triggers[index]?.getAttribute('aria-controls'));
    return popup ? Array.from(popup.querySelectorAll('.menu-command:not(:disabled):not([hidden])')) : [];
  }
  function openMenu(index, focusItem = false, last = false) {
    closeMenus(); syncMenus(); openIndex = index;
    const trigger = triggers[index];
    trigger.setAttribute('aria-expanded', 'true');
    const popup = byId(trigger.getAttribute('aria-controls')); popup.hidden = false; popup.classList.remove('hidden');
    triggers.forEach((el, i) => el.tabIndex = i === index ? 0 : -1);
    if (focusItem) { const list = items(index); (last ? list[list.length - 1] || trigger : list[0] || trigger).focus(); }
  }
  function execute(item) {
    const action = item.dataset.menuAction;
    if (action === 'open-library') return openLibrary();
    if (action === 'import-svg') { openLibrary(); return; }
    if (action === 'export-groups') return win.LibraryExport?.open();
    if (action === 'close-library') return closeLibrary();
    if (action === 'help') { closeLibrary(); byId('btnHelp')?.click(); return; }
    if (action === 'tile-command') { studio()?.runCommand?.(item.dataset.menuTarget); return; }
    if (action === 'undo' || action === 'redo') {
      if (tiles()) studio()?.runCommand?.(action);
      else byId(action === 'undo' ? 'btnEditUndo' : 'btnEditRedo')?.click();
      return;
    }
    if (action === 'library-click') openLibrary();
    control(item)?.click();
  }
  function onKey(event) {
    if (win?.LibraryExport?.isOpen()) return;
    if (event.key === 'F10' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); closeMenus(); triggers[0]?.focus(); return; }
    const inside = event.target.closest?.('#app-menubar');
    if (openIndex < 0 && !inside) {
      if (libraryOpen && event.key === 'Escape' && !event.target.closest?.('input,select,textarea') && !doc.querySelector('#subtileConfirmDialog:not(.hidden), #subtileImportDialog:not(.hidden)')) {
        event.preventDefault(); event.stopPropagation(); closeLibrary();
      }
      return;
    }
    const index = inside ? triggers.findIndex(el => el.parentElement.contains(event.target)) : openIndex;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenus(true); return; }
    if (event.key === 'Tab') { closeMenus(true); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopPropagation();
      const next = menuStep(index, event.key === 'ArrowRight' ? 1 : -1, triggers.length);
      if (openIndex >= 0) openMenu(next, true); else { triggers.forEach((el,i)=>el.tabIndex=i===next?0:-1); triggers[next].focus(); }
      return;
    }
    if (['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (openIndex < 0 || event.target === triggers[index]) { openMenu(index, true, event.key === 'ArrowUp' || event.key === 'End'); return; }
      const list = items(); const current = list.indexOf(doc.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : menuStep(current,event.key==='ArrowDown'?1:-1,list.length);
      list[next]?.focus();
    }
  }
  function init() {
    if (!doc || initialized) return;
    initialized = true; triggers = Array.from(doc.querySelectorAll('.app-menu-trigger'));
    if (typeof MutationObserver !== 'undefined') {
      new MutationObserver(syncViews).observe(doc.body, { attributes: true, attributeFilter: ['data-studio-mode'] });
    }
    doc.querySelectorAll('[data-studio-view]').forEach(button => {
      button.addEventListener('click', () => {
        closeMenus();
        const view = button.dataset.studioView;
        if (view === 'library') openLibrary();
        else {
          closeLibrary();
          if (view === 'tiles' && !tiles()) studio()?.openTilesStudio?.();
          if (view === 'mosaic' && tiles()) studio()?.closeTilesStudio?.();
          syncViews();
        }
      });
    });
    byId('btnOpenBrushPreview')?.addEventListener('click', () => byId('btnExpandBrushEditor')?.click());
    doc.querySelectorAll('[data-close-flyout]').forEach(button => {
      button.addEventListener('click', () => {
        const toggle = byId(button.dataset.closeFlyout);
        if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click();
        toggle?.focus();
      });
    });
    triggers.forEach((trigger, index) => {
      trigger.addEventListener('click', () => { if (openIndex === index) closeMenus(); else openMenu(index); });
      trigger.addEventListener('mouseenter', () => { if (openIndex >= 0 && openIndex !== index) openMenu(index); });
    });
    byId('app-menubar')?.addEventListener('click', event => {
      const item = event.target.closest('.menu-command'); if (!item || item.disabled) return;
      const trigger = triggers[openIndex];
      closeMenus(); if (item.dataset.menuAction) execute(item);
      if (doc.activeElement === item || item.contains(doc.activeElement)) trigger?.focus();
    });
    doc.addEventListener('pointerdown', event => { if (!event.target.closest?.('#app-menubar')) closeMenus(); }, true);
    doc.addEventListener('keydown', onKey, true);
    byId('btnCloseLibrary')?.addEventListener('click', () => closeLibrary());
    ['btnUseActiveInBrush', 'btnSoloActiveInMosaic'].forEach(id => {
      byId(id)?.addEventListener('click', () => {
        if (libraryOpen) { closeLibrary(); byId('btnStudioTilesMode')?.focus(); }
      }, true);
    });
    byId('btnEditLibraryPiece')?.addEventListener('click', () => {
      const id = studio()?.state.selectedFamilyId; closeLibrary(); studio()?.openTilesStudio?.(id); byId('btnStudioTilesMode')?.focus();
    });
    const followRoute = () => { if (win.location.hash === '#biblioteca') { if (!libraryOpen) openLibrary(false); } else closeLibrary(false); };
    win.addEventListener('popstate', followRoute); win.addEventListener('hashchange', followRoute);
    if (win.location.hash === '#biblioteca') openLibrary(false);
    syncViews();
  }
  const api = {init,openLibrary,closeLibrary,refresh,isLibraryOpen:()=>libraryOpen,menuStep,guideControlId};
  if (win) win.WorkspaceNavigation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (doc) { if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, {once:true}); else init(); }
})();
