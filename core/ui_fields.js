/** Accessible field names, numeric drafts and search feedback. No document state lives here. */
(function (root) {
  const integerIds = new Set(['canvasW', 'canvasH', 'gridRows', 'gridCols', 'gridMargin', 'paddingInput', 'seedInput', 'brushEditorRows', 'brushEditorCols', 'topBrushRows', 'topBrushCols']);
  const propertyNames = {x: 'Posição X', y: 'Posição Y', cx: 'Centro X', cy: 'Centro Y',
    w: 'Largura', h: 'Altura', width: 'Largura', height: 'Altura', rx: 'Raio horizontal', ry: 'Raio vertical',
    x1: 'Ponto inicial X', y1: 'Ponto inicial Y', x2: 'Ponto final X', y2: 'Ponto final Y',
    rotation: 'Rotação em graus', start: 'Ângulo inicial em graus', end: 'Ângulo final em graus',
    sides: 'Número de lados', starRatio: 'Proporção da estrela', innerRatio: 'Proporção do furo', mode: 'Modo do arco', radius: 'Raio dos cantos', rectRadius: 'Raio dos cantos', polygonSides: 'Número de lados', polygonStarRatio: 'Proporção da estrela', arcInnerRatio: 'Proporção do furo', arcMode: 'Modo do arco', lineWeight: 'Espessura do traço'};
  function numericError(field) {
    const raw = field.value.trim(), value = Number(raw);
    if (!raw || !Number.isFinite(value) || field.validity?.badInput) return 'Digite um número válido.';
    if ((integerIds.has(field.id) || field.dataset.sint || field.dataset.tdef === 'polygonSides') && !Number.isSafeInteger(value)) return 'Digite um número inteiro.';
    if (field.min !== '' && value < Number(field.min)) return `Valor mínimo: ${field.min}.`;
    if (field.max !== '' && value > Number(field.max)) return `Valor máximo: ${field.max}.`;
    return '';
  }
  function enhanceProperties(container) {
    container.querySelectorAll('.vec-prop-field').forEach(group => {
      const label = group.querySelector('label'), field = group.querySelector('input, select');
      if (!label || !field) return;
      const key = field.dataset.sprop || field.dataset.sint || field.dataset.sdeg || field.dataset.sstr || field.dataset.tdef;
      if (!field.id) field.id = `vecField-${key}`;
      label.htmlFor = field.id;
      if (field.id === 'vecPropStrokeW' && label.textContent !== 'Espess. %') label.textContent = 'Espess. %';
      const named = {vecPropNodeX: 'Nó X em unidades da peça', vecPropNodeY: 'Nó Y em unidades da peça',
        vecPropStrokeW: 'Espessura do traço em porcentagem da peça', vecPropStrokeCap: 'Ponta do traço', vecPropFillRule: 'Regra de preenchimento'};
      const coordinate = field.type === 'number' && !field.dataset.sint && !field.dataset.sdeg && !['starRatio','innerRatio','polygonSides','polygonStarRatio','arcInnerRatio'].includes(key);
      const name = named[field.id] || `${propertyNames[key] || label.textContent.trim()}${coordinate ? ' em unidades da peça' : ''}`;
      field.setAttribute('aria-label', name);
      group.title = name;
      if (field.type === 'number' && !group.querySelector('.property-steppers')) {
        const buttons = field.ownerDocument.createElement('span');
        buttons.className = 'property-steppers';
        for (const [direction, symbol, verb] of [[1, '+', 'Aumentar'], [-1, '−', 'Diminuir']]) {
          const button = field.ownerDocument.createElement('button');
          button.type = 'button'; button.textContent = symbol;
          button.title = `${verb} ${name}`; button.setAttribute('aria-label', button.title);
          button.disabled = field.disabled;
          button.addEventListener('click', event => {
            event.preventDefault();
            if (field.disabled || field.readOnly) return;
            if (!field.value) field.value = field.min || '0';
            direction > 0 ? field.stepUp() : field.stepDown();
            field.dispatchEvent(new Event('input', {bubbles: true}));
            field.dispatchEvent(new Event('change', {bubbles: true}));
          });
          buttons.appendChild(button);
        }
        group.appendChild(buttons);
      }
    });
  }
  function init(doc, {onCancel = () => {}} = {}) {
    if (doc.documentElement.dataset.fieldsReady) return;
    doc.documentElement.dataset.fieldsReady = 'true';
    const notices = doc.createElement('aside');
    notices.id = 'workspaceNotices';
    notices.setAttribute('aria-label', 'Avisos');
    notices.setAttribute('aria-live', 'polite');
    doc.body.appendChild(notices);
    doc.querySelectorAll('#right-dock .notice-banner, #utility-rail .notice-banner').forEach(notice => notices.appendChild(notice));
    const expand = doc.getElementById('btnOpenBrushPreview');
    if (expand) expand.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M3 3l6 6m12-6-6 6m6 12-6-6M3 21l6-6"/></svg>';
    const variants = doc.getElementById('panel-tile-d4-live');
    const dock = doc.getElementById('right-dock');
    if (variants && dock) {
      const rail = doc.createElement('aside'); rail.id = 'piecesUtilityRail';
      rail.setAttribute('aria-label', 'Painéis de peças');
      const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.className = 'rail-utility-btn';
      toggle.title = 'Variantes D4'; toggle.setAttribute('aria-label', 'Variantes D4');
      toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = 'D4';
      const flyout = doc.createElement('div'); flyout.id = 'piecesVariantsFlyout'; flyout.hidden = true;
      flyout.appendChild(variants); rail.append(toggle, flyout); dock.before(rail);
      toggle.addEventListener('click', () => { flyout.hidden = !flyout.hidden; toggle.setAttribute('aria-expanded', String(!flyout.hidden)); });
    }
    const rows = doc.getElementById('topBrushRows'), cols = doc.getElementById('topBrushCols');
    if (rows && cols) {
      let ratio = 1, locked = false;
      const lock = doc.createElement('button'); lock.type = 'button'; lock.id = 'brushRatioLock';
      lock.className = 'mini-btn'; lock.title = 'Manter proporção do pincel'; lock.setAttribute('aria-label', lock.title); lock.setAttribute('aria-pressed', 'false');
      lock.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
      rows.closest('.top-pattern-fields').appendChild(lock);
      lock.addEventListener('click', () => { locked = !locked; ratio = Number(rows.value) / Number(cols.value); lock.setAttribute('aria-pressed', String(locked)); });
      doc.addEventListener('change', e => {
        if (!locked || ![rows, cols].includes(e.target)) return;
        if (e.target === rows) cols.value = Math.max(1, Math.round(Number(rows.value) / ratio));
        else rows.value = Math.max(1, Math.round(Number(cols.value) * ratio));
      }, true);
    }
    const toolbar = doc.getElementById('left-toolbar');
    if (toolbar) {
      const toggle = doc.createElement('button'); toggle.type = 'button'; toggle.id = 'toggleToolbarColumns';
      toggle.title = 'Alternar uma ou duas colunas'; toggle.setAttribute('aria-label', toggle.title); toggle.setAttribute('aria-pressed', 'false');
      toggle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';
      toolbar.prepend(toggle);
      toggle.addEventListener('click', () => { const narrow = doc.body.classList.toggle('toolbar-single-column'); toggle.setAttribute('aria-pressed', String(narrow)); });
    }
    const variety = doc.querySelector('.edge-variability-control');
    const varietyIcon = variety?.querySelector('.edge-variability-icon');
    if (varietyIcon) variety.before(varietyIcon);
    const gridSelect = doc.getElementById('tileGridDivSelect');
    if (gridSelect) {
      const trigger = doc.createElement('button'); trigger.type = 'button'; trigger.className = 'tool-btn grid-choice-trigger';
      trigger.title = gridSelect.title; trigger.setAttribute('aria-label', gridSelect.getAttribute('aria-label') || gridSelect.title); trigger.setAttribute('aria-expanded', 'false');
      const menu = doc.createElement('div'); menu.id = 'gridChoiceMenu'; menu.hidden = true; menu.setAttribute('role', 'menu'); doc.body.appendChild(menu);
      const sync = () => { trigger.textContent = gridSelect.selectedOptions[0]?.textContent || 'Off'; };
      gridSelect.before(trigger); gridSelect.style.display = 'none'; sync();
      gridSelect.addEventListener('change', sync);
      trigger.addEventListener('click', () => {
        menu.hidden = !menu.hidden; trigger.setAttribute('aria-expanded', String(!menu.hidden));
        if (menu.hidden) return;
        menu.replaceChildren();
        for (const option of gridSelect.options) {
          const item = doc.createElement('button'); item.type = 'button'; item.textContent = option.textContent;
          item.setAttribute('role', 'menuitemradio'); item.setAttribute('aria-checked', String(option.selected));
          item.addEventListener('click', () => { gridSelect.value = option.value; gridSelect.dispatchEvent(new Event('change', {bubbles:true})); sync(); menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }); menu.appendChild(item);
        }
        const rect = trigger.getBoundingClientRect(); menu.style.left = (rect.right + 8) + 'px'; menu.style.top = Math.max(8, Math.min(rect.top, innerHeight - 260)) + 'px';
      });
      doc.addEventListener('click', e => { if (!menu.contains(e.target) && !trigger.contains(e.target)) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); } });
      trigger.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); } });
    }
    const paintReturn = doc.getElementById('btnTileTestInMosaic');
    const dockHeader = doc.getElementById('pieceUseFooter');
    if (paintReturn && dockHeader) { paintReturn.classList.add('tiles-mode-only'); paintReturn.title = 'Usar peça no mosaico'; paintReturn.setAttribute('aria-label', paintReturn.title); dockHeader.appendChild(paintReturn); }
    const drafts = new WeakMap();
    doc.addEventListener('click', e => {
      const button = e.target.closest?.('[data-brush-step]');
      if (!button) return;
      e.preventDefault();
      const field = doc.getElementById(button.dataset.brushField);
      if (!field || field.disabled) return;
      const next = Math.max(Number(field.min || 1), Math.min(Number(field.max || Infinity), Number(field.value || 1) + Number(button.dataset.brushStep) * Number(field.step || 1)));
      field.value = next;
      field.dispatchEvent(new Event('input', {bubbles: true}));
      field.dispatchEvent(new Event('change', {bubbles: true}));
    });
    const feedback = doc.createElement('div'); feedback.id = 'numericFieldFeedback'; feedback.className = 'field-feedback hidden';
    feedback.setAttribute('role', 'status'); doc.body.appendChild(feedback);
    const numeric = e => e.target?.matches?.('input[type="number"]') ? e.target : null;
    function clear(field) {
      field.removeAttribute('aria-invalid');
      const hints = (field.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== feedback.id);
      if (hints.length) field.setAttribute('aria-describedby', hints.join(' ')); else field.removeAttribute('aria-describedby');
      feedback.classList.add('hidden');
    }
    function validate(field) {
      const message = numericError(field);
      if (!message) { clear(field); return true; }
      field.setAttribute('aria-invalid', 'true');
      const hints = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)); hints.add(feedback.id);
      field.setAttribute('aria-describedby', [...hints].join(' '));
      feedback.textContent = message;
      feedback.classList.remove('hidden'); return false;
    }
    function cancel(field) { if (drafts.has(field)) field.value = drafts.get(field); onCancel(field); clear(field); }
    doc.addEventListener('focusin', e => { const field = numeric(e); if (field) drafts.set(field, field.value); }, true);
    doc.addEventListener('input', e => { const field = numeric(e); if (field && !validate(field)) e.stopImmediatePropagation(); }, true);
    doc.addEventListener('change', e => {
      const field = numeric(e); if (!field) return;
      if (!validate(field)) { e.stopImmediatePropagation(); return; }
      // Native blur may emit change again after Enter's explicit confirmation.
      if (drafts.get(field) === field.value) { e.stopImmediatePropagation(); return; }
      drafts.set(field, field.value);
    }, true);
    doc.addEventListener('blur', e => { const field = numeric(e); if (field && numericError(field)) cancel(field); }, true);
    doc.addEventListener('keydown', e => {
      const field = numeric(e); if (!field || !['Enter','Escape'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape') { cancel(field); return; }
      if (!validate(field)) return;
      if (field.value !== drafts.get(field)) field.dispatchEvent(new Event('change', {bubbles: true}));
      field.blur();
    }, true);
    const inspector = doc.getElementById('vecPropsContainer');
    if (inspector) {
      enhanceProperties(inspector);
      new MutationObserver(() => enhanceProperties(inspector)).observe(inspector, {childList: true, subtree: true});
    }
    for (const [id, targetId, selector, unit] of [
      ['tileSearchInput', 'familiesSwatchContainer', '.family-swatch-card', 'famílias'],
      ['editBrushSearchInput', 'editBrushPaletteContainer', '.tile-swatch-btn', 'peças'],
      ['libMgrSearchInput', 'libMgrTreeContainer', '.lib-family-row', 'famílias']
    ]) {
      const field = doc.getElementById(id), target = doc.getElementById(targetId); if (!field || !target) continue;
      const wrapper = doc.createElement('div'); wrapper.className = 'field-search'; field.before(wrapper); wrapper.appendChild(field);
      const clearButton = doc.createElement('button'); clearButton.type = 'button'; clearButton.className = 'search-clear';
      clearButton.textContent = '×'; clearButton.title = 'Limpar busca'; clearButton.setAttribute('aria-label', field.getAttribute('aria-label').replace(/^Buscar /, 'Limpar busca de ')); wrapper.appendChild(clearButton);
      const count = doc.createElement('span'); count.id = `${id}-results`; count.className = 'search-results'; count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); wrapper.appendChild(count);
      field.setAttribute('aria-describedby', count.id);
      function update() {
        clearButton.hidden = !field.value;
        const total = target.querySelectorAll(selector).length;
        const empty = Boolean(field.value.trim()) && total === 0;
        count.classList.toggle('is-empty', empty);
        count.textContent = empty ? 'Nenhum resultado' : `${total} ${total === 1 ? unit.slice(0, -1) : unit}`;
      }
      clearButton.addEventListener('click', () => { field.value = ''; field.dispatchEvent(new Event('input', {bubbles: true})); field.focus(); update(); });
      field.addEventListener('input', update);
      new MutationObserver(update).observe(target, {childList: true, subtree: true}); update();
    }
  }
  const api = {numericError, enhanceProperties, init};
  if (typeof module !== 'undefined') module.exports = api;
  if (root) root.UiFields = api;
})(typeof window !== 'undefined' ? window : null);
