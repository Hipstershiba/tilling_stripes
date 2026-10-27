/** Tracks durability of the latest document/library revisions, independently. */
(function () {
  function createSaveStatus() {
    const scopes = new Map(), listeners = new Set(), queues = new Map();
    const outcome = result => result === true || result?.success
      ? (result?.reduced || result?.mode === 'fallback_minimal' ? 'reduced' : 'full') : 'failed';
    function phase(record) {
      const values = Object.values(record.backends);
      if (values.includes('full')) return 'saved';
      if (values.includes('pending')) return 'pending';
      return values.includes('reduced') ? 'reduced' : 'failed';
    }
    function snapshot() {
      const entries = Array.from(scopes, ([scope, r]) => ({ scope, revision: r.revision,
        state: phase(r), backends: { ...r.backends }, reduction: r.reduction,
        failed: phase(r) === 'failed' || (phase(r) === 'pending' && r.priorFailure) }));
      const failed = entries.filter(r => r.failed).map(r => r.scope);
      const reduced = entries.filter(r => r.state === 'reduced').map(r => r.scope);
      const state = failed.length ? 'failed' : entries.some(r => r.state === 'pending') ? 'pending'
        : reduced.length ? 'reduced' : entries.length ? 'saved' : 'idle';
      const text = { idle: 'Sem alterações pendentes', pending: 'Salvando…', saved: 'Salvo neste navegador',
        reduced: 'Desenho salvo; histórico reduzido', failed: 'Não foi possível salvar' }[state];
      const details = failed.map(scope => scope === 'library'
        ? 'Não foi possível salvar a biblioteca neste navegador. Exporte um backup para proteger seus desenhos.'
        : 'Não foi possível salvar o mosaico neste navegador.').join(' ');
      return { state, text, details, failed, reduced, scopes: entries };
    }
    function emit() { const state = snapshot(); for (const fn of listeners) fn(state); }
    function begin(scope) {
      const old = scopes.get(scope);
      const record = { revision: (old?.revision || 0) + 1,
        priorFailure: old ? phase(old) === 'failed' || old.priorFailure : false,
        backends: { local: 'pending', indexed: 'pending' }, reduction: null };
      scopes.set(scope, record); emit(); return record;
    }
    function enqueue(key, write) {
      const task = (queues.get(key) || Promise.resolve()).then(write);
      // A failed write must not break the following revision's queue.
      const tail = task.catch(() => {});
      queues.set(key, tail);
      tail.then(() => { if (queues.get(key) === tail) queues.delete(key); });
      return task;
    }
    function save(scope, payload, writers) {
      const record = begin(scope);
      let copy;
      try { copy = JSON.parse(JSON.stringify(payload)); }
      catch (_) { record.backends = { local: 'failed', indexed: 'failed' }; emit(); return Promise.resolve(snapshot()); }
      const update = (backend, result) => {
        if (scopes.get(scope) !== record) return;
        record.backends[backend] = outcome(result);
        if (result?.reduction) record.reduction = result.reduction;
        if (['saved', 'reduced'].includes(phase(record))) record.priorFailure = false;
        emit();
      };
      try { update('local', writers.local?.(copy)); }
      catch (_) { update('local', { success: false }); }
      if (!writers.indexed) {
        update('indexed', { success: false });
        return Promise.resolve(snapshot());
      }
      return enqueue(scope, () => writers.indexed(copy)).then(
        result => { update('indexed', result); return snapshot(); },
        () => { update('indexed', { success: false }); return snapshot(); });
    }
    return { save, enqueue, snapshot, markPending: begin,
      subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); } };
  }
  const SaveStatus = createSaveStatus();
  SaveStatus.createSaveStatus = createSaveStatus;
  if (typeof window !== 'undefined') window.SaveStatus = SaveStatus;
  if (typeof module !== 'undefined' && module.exports) module.exports = SaveStatus;
})();
