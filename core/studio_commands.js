// Shared names, shortcuts, availability and execution for the two editing contexts.
(function () {
  const tools = {
    mosaic: [
      ['inspect', 'Inspecionar', 'V', 'toolInspect'],
      ['paint', 'Pincel', 'B', 'toolPaint', 'Clique pinta; botão direito gira o pincel; Alt+arraste captura.'],
      ['rotate', 'Girar', 'R', 'toolRotate'],
      ['stamp', 'Carimbo', 'S', 'toolStamp', 'Alt+arraste captura; clique aplica.'],
      ['freeze', 'Preservar', 'F', 'toolFreeze', 'Preserva na próxima geração; permite edição manual. Shift+F limpa as preservações.'],
      ['pan', 'Mão', 'H', 'toolPan', 'Mover a visualização; Espaço ativa temporariamente.'],
      ['zoom', 'Zoom', 'Z', 'toolZoom', 'Clique aproxima; Alt+clique afasta.']
    ],
    tiles: [
      ['select', 'Seleção', 'V', 'vecToolSelect', 'Shift mantém proporção/ângulo; Alt escala pelo centro.'],
      ['direct', 'Editar pontos', 'A', 'vecToolDirect', 'Edita nós e alças Bezier.'],
      ['pen', 'Caneta', 'P', 'vecToolPen', 'Enter conclui; Escape cancela. Trocar ferramenta conclui um caminho válido, sem arrasto em andamento.'],
      ['rect', 'Retângulo', 'M', 'vecToolRect', 'Shift mantém 1:1; Alt desenha pelo centro.'],
      ['ellipse', 'Elipse', 'L', 'vecToolEllipse', 'Shift mantém 1:1; Alt desenha pelo centro.'],
      ['polygon', 'Polígono', 'G', 'vecToolPolygon'],
      ['arc', 'Arco/Fita', 'U', 'vecToolArc'],
      ['line', 'Linha', '\\', 'vecToolLine']
    ]
  };
  const definitions = [];
  for (const [context, entries] of Object.entries(tools)) {
    for (const [id, name, shortcut, control, detail = ''] of entries) definitions.push({
      context, id, name, shortcut, controls: [control], detail,
      label: context === 'mosaic' ? '.tool-grid-label' : 'span',
      available: ctx => ctx.hasTools !== false,
      execute: ctx => ctx.selectTool(id)
    });
  }
  const add = (context, id, name, shortcut, controls, execute, extra = {}) =>
    definitions.push({context, id, name, shortcut, controls, execute, ...extra});
  for (const context of ['mosaic', 'tiles']) {
    const target = context === 'mosaic' ? 'no mosaico' : 'na peça';
    add(context, 'undo', `Desfazer ${target}`, 'Ctrl+Z', [context === 'mosaic' ? 'btnEditUndo' : 'btnVecUndo'], ctx => ctx.undo(), {available: ctx => ctx.canUndo?.() !== false});
    add(context, 'redo', `Refazer ${target}`, 'Ctrl+Shift+Z', [context === 'mosaic' ? 'btnEditRedo' : 'btnVecRedo'], ctx => ctx.redo(), {aliases: ['Ctrl+Y'], available: ctx => ctx.canRedo?.() !== false});
    add(context, 'toggle', context === 'mosaic' ? 'Editar peças' : 'Voltar ao mosaico', 'Ctrl+E', ['btnStudioTilesMode'], ctx => ctx.toggle(), {label: '.studio-mode-btn-label'});
  }
  add('mosaic', 'generate', 'Gerar mosaico', 'G', ['btnRandomize'], ctx => ctx.generate());
  add('mosaic', 'eraser', 'Borracha', 'E', [], ctx => ctx.eraser());
  add('mosaic', 'swap', 'Inverter cores', 'X', ['btnSwapColors'], ctx => ctx.swap());
  add('tiles', 'duplicate', 'Duplicar formas', 'Ctrl+D', ['btnVecPropDuplicate'], ctx => ctx.duplicate(), {
    available: ctx => Boolean(ctx.canDuplicate?.()), unavailable: ctx => ctx.duplicateUnavailable?.()
  });
  add('tiles', 'copyEditable', 'Criar cópia editável', '', ['btnTileTopDuplicate', 'btnPropsDuplicateBuiltIn', 'btnNoticeDuplicateToEdit'], ctx => ctx.copyEditable(), {label: 'span'});
  add('tiles', 'finish', 'Concluir Caneta', 'Enter', [], ctx => ctx.finish(), {available: ctx => Boolean(ctx.canFinish?.())});
  add('tiles', 'cancel', 'Cancelar gesto ou limpar seleção', 'Escape', [], ctx => ctx.cancel());
  const get = (context, id) => definitions.find(command => command.context === context && command.id === id);
  function run(context, id, ctx) {
    const command = get(context, id);
    if (!command) return false;
    if (command.available && !command.available(ctx)) { command.unavailable?.(ctx); return false; }
    command.execute(ctx);
    return true;
  }
  function matches(shortcut, event) {
    if (!shortcut) return false;
    const parts = shortcut.toLowerCase().split('+');
    return event.key.toLowerCase() === parts[parts.length - 1] &&
      Boolean(event.ctrlKey || event.metaKey) === parts.includes('ctrl') &&
      Boolean(event.shiftKey) === parts.includes('shift') && !event.altKey;
  }
  function dispatch(context, event, ctx) {
    if (event.defaultPrevented || event.isComposing || event.repeat) return false;
    const command = definitions.find(item => item.context === context &&
      [item.shortcut, ...(item.aliases || [])].some(shortcut => matches(shortcut, event)));
    if (!command) return false;
    event.preventDefault(); run(context, command.id, ctx); return true;
  }
  function applyLabels(root, context) {
    for (const command of definitions.filter(item => item.context === context)) {
      for (const id of command.controls) {
        const el = root.getElementById(id);
        if (!el) continue;
        el.title = `${command.name}${command.shortcut ? ` (${command.shortcut})` : ''}${command.detail ? ` • ${command.detail}` : ''}`;
        if (command.label) {
          const label = el.querySelector?.(command.label);
          if (label) label.textContent = command.name;
          else if (command.id === 'copyEditable') el.textContent = command.name;
        }
      }
    }
  }
  const help = context => definitions.filter(item => item.context === context && item.shortcut)
    .map(item => `${item.shortcut}: ${item.name}${item.detail ? ` — ${item.detail}` : ''}.`);
  const StudioCommands = {definitions, tools, get, run, dispatch, applyLabels, help};
  if (typeof window !== 'undefined') window.StudioCommands = StudioCommands;
  if (typeof module !== 'undefined' && module.exports) module.exports = StudioCommands;
})();
