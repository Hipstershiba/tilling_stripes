/** Accessible field names, numeric drafts and search feedback. No document state lives here. */
(function (root) {
  const integerIds = new Set(['canvasW', 'canvasH', 'gridRows', 'gridCols', 'gridMargin', 'paddingInput', 'seedInput', 'brushEditorRows', 'brushEditorCols']);
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
      const named = {vecPropNodeX: 'Nó X em unidades da peça', vecPropNodeY: 'Nó Y em unidades da peça',
        vecPropStrokeW: 'Espessura do traço em unidades da peça', vecPropStrokeCap: 'Ponta do traço', vecPropFillRule: 'Regra de preenchimento'};
      const coordinate = field.type === 'number' && !field.dataset.sint && !field.dataset.sdeg && !['starRatio','innerRatio','polygonSides','polygonStarRatio','arcInnerRatio'].includes(key);
      field.setAttribute('aria-label', named[field.id] || `${propertyNames[key] || label.textContent.trim()}${coordinate ? ' em unidades da peça' : ''}`);
    });
  }
  function init(doc, {onCancel = () => {}} = {}) {
    if (doc.documentElement.dataset.fieldsReady) return;
    doc.documentElement.dataset.fieldsReady = 'true';
    const drafts = new WeakMap();
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
