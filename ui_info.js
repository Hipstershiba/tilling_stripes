/**
 * ui_info.js
 * Progressive disclosure information system for Tiling Stripes Studio v2.
 * Manages accessible tooltips, topic popovers, and help panels without DOM bloat.
 */

(function () {
  const commands = (typeof window !== 'undefined' && window.StudioCommands) ||
    (typeof require === 'function' ? require('./core/studio_commands.js') : null);
  const INFO_TOPICS = {
    'grid-symmetry': {
        "title": "Simetria da composição",
        "body": [
            "Mandala: oito setores com simetria rigorosa. Nos eixos, peças incompatíveis dão lugar à peça vazia.",
            "Caleidoscópio: espelha oito setores, permitindo peças assimétricas nos eixos.",
            "Rotacional: repete o desenho com giros de 90°.",
            "Bilateral: espelha na horizontal e na vertical."
        ]
    },
    'block-symmetry': {
        "title": "Simetria do bloco",
        "body": [
            "Igual à composição: usa a mesma simetria do mosaico em cada bloco.",
            "Independente: permite escolher outra simetria dentro dos blocos.",
            "Uma simetria interna diferente pode reduzir a simetria do resultado."
        ]
    },
    'scopes': {
        "title": "Onde a edição se repete",
        "body": []
    },
    'center-symmetry': {
        "title": "Simetria pelo centro",
        "body": [
            "Usa o centro do mosaico como referência, sem depender da divisão em blocos.",
            "Mandala e Caleidoscópio: oito direções; Giro 4×: giros de 90°.",
            "Espelho XY: horizontal e vertical. Espelho X ou Y: apenas um eixo."
        ]
    },
    'brush': {
        "title": "Pincel",
        "body": [
            "Clique ou arraste para pintar. O botão direito gira o padrão em 90°.",
            "Alt+arraste captura uma região. Ampliar editor permite montar o padrão com a paleta.",
            "Use − / + ou a roda para mudar o tamanho. Com encaixe ativo, o ajuste avança por blocos.",
            "0° remove giros e espelhamentos do padrão."
        ]
    },
    'rotate': {
        "title": "Girar",
        "body": [
            "Clique para girar 90°; botão direito gira no sentido contrário ou volta à variante anterior.",
            "Use − / + ou a roda para mudar a área. Ajustar ao bloco liga ou desliga o encaixe.",
            "Escolha entre girar cada peça ou girar o bloco inteiro."
        ]
    },
    'stamp': {
        "title": "Carimbo",
        "body": [
            "Alt+arraste captura; clique aplica. C também inicia a captura e Escape cancela.",
            "O botão direito gira a estampa em 90°. O escopo define onde ela se repete.",
            "Pincel e carimbo guardam padrões separados. Use Ampliar editor para editar a estampa."
        ]
    },
    'freeze': {
        "title": "Preservar peças",
        "body": [
            "As peças preservadas permanecem nas próximas gerações. Você ainda pode editá-las manualmente.",
            "Escolha preservar ou liberar e pinte a área desejada. Tamanho e escopo definem a região afetada.",
            "Shift+F libera todas. Ctrl+Z desfaz; Ctrl+Shift+Z refaz."
        ]
    },
    'same-tile': {
        "title": "Peças iguais",
        "body": [
            "Troca todas as peças do mosaico iguais à peça sob o cursor.",
            "Use um pincel de 1×1 para aplicar a substituição."
        ]
    },
    "d4-strict": {
        "title": "Mandala",
        "body": [
            "Mantém a simetria nos oito setores, inclusive nos eixos e diagonais.",
            "Quando uma peça não tem uma variante compatível com o eixo, entra a peça vazia (#84).",
            "Edições manuais podem quebrar essa simetria; o aviso permite continuar ou desfazer."
        ]
    },
    'kaleidoscope': {
        "title": "Caleidoscópio",
        "body": [
            "Espelha e gira o desenho em oito setores.",
            "Aceita peças assimétricas nos eixos, sem substituí-las pela peça vazia."
        ]
    },
    'persistence': {
        "title": "Salvamento e backup",
        "body": [
            "Mosaico e biblioteca são salvos neste navegador. O rodapé confirma quando ambos estão salvos.",
            "Se o salvamento falhar, use Tentar novamente no aviso.",
            "O backup JSON guarda a biblioteca. PNG e SVG exportam a imagem, sem guardar o projeto editável."
        ]
    },
    'shortcuts': {
        "title": "Atalhos e comandos",
        "body": []
    },
    'inspect': {
        "title": "Inspeção",
        "body": [
            "Passe o cursor sobre uma peça para consultar o bloco, a família, a orientação e a órbita no rodapé."
        ]
    },
    'subtile-library': {
        "title": "Biblioteca de peças",
        "body": [
            "Cada família reúne um desenho mestre e suas variantes de giro e espelho.",
            "As famílias originais são protegidas. Use Criar cópia editável para alterá-las.",
            "Conjuntos organizam famílias; arraste uma família para movê-la entre conjuntos.",
            "Ao excluir uma família em uso, suas peças no mosaico ficam vazias. Faça um backup JSON para guardar a biblioteca."
        ]
    },
    'vector-editor': {
        "title": "Ferramentas",
        "body": [
            "Seleção (V): mova, redimensione ou gire pelo centro da seleção. Alt+arraste duplica; Shift restringe o movimento.",
            "Seleção direta (A): ajuste nós e curvas. Arraste o corpo para mover o objeto inteiro; Alt+arraste o corpo duplica. Alt+clique no segmento insere um nó; duplo clique alterna canto e curva suave.",
            "Caneta (P): clique cria cantos; arraste cria curvas. Clique no início para fechar, Enter conclui e Escape cancela.",
            "Encaixe alinha o desenho à grade. A divisão 1/6 ajuda a conectar as fitas nas bordas."
        ]
    },
    'vector-layers': {
        "title": "Camadas e SVG",
        "body": [
            "Seleção: marque objetos nas camadas ou use Shift+clique no desenho. Ctrl+A seleciona todos os visíveis e destravados.",
            "Pathfinder: selecione duas ou mais formas para Unir, Menos frente, Interseção ou Excluir. Ctrl+Z desfaz.",
            "Ordem: o topo da lista fica à frente. Arraste para reordenar; duplo clique renomeia. Os ícones ocultam ou travam a forma.",
            "SVG: importe formas para editar ou exporte a peça atual. O desenho importado se ajusta aos limites da peça."
        ]
    }
};

  /**
   * Synchronizes scope descriptions in INFO_TOPICS strictly from window.MosaicEngine.EDIT_SCOPES.
   * Eliminates dual sources of truth and ensures shortcuts 1..6 match engine definitions.
   */
  function syncScopeTopics() {
    let engine = (typeof window !== 'undefined' && window.MosaicEngine) || null;
    if (!engine && typeof require === 'function') {
      try {
        const path = require('path');
        const fs = require('fs');
        const candidates = [
          path.join(process.cwd(), 'core/mosaic_engine.js'),
          path.join(__dirname, 'core/mosaic_engine.js'),
          path.join(__dirname, '../core/mosaic_engine.js')
        ];
        const engineFile = candidates.find(p => fs.existsSync(p));
        if (engineFile) {
          const coreDir = path.dirname(engineFile);
          if (typeof global !== 'undefined') {
            global.window = global.window || {};
            if (!global.window.D4Symmetry) {
              try { require(path.join(coreDir, 'd4_symmetry.js')); } catch (_) {}
            }
            if (!global.window.TileRegistry) {
              try { require(path.join(coreDir, 'tile_registry.js')); } catch (_) {}
            }
            require(engineFile);
            engine = global.window.MosaicEngine;
          }
        }
      } catch (_) {}
    }

    if (engine && engine.EDIT_SCOPES) {
      const scopes = Object.values(engine.EDIT_SCOPES)
        .sort((a, b) => Number(a.shortcut) - Number(b.shortcut));
      INFO_TOPICS.scopes.body = scopes.map((s) => `${s.name} (${s.shortcut}): ${window.UiFormat?.formatProductDescription(s.description) || s.description}`);

      const names = scopes.map(s => `${s.name} (${s.shortcut})`).join(', ');
      const scIndex = INFO_TOPICS.shortcuts.body.findIndex(l => l.includes('1 a 6') || l.includes('1-6') || l.includes('1–6'));
      const shortcutLine = `Q ou Tab (Shift para voltar): Ciclar escopos de edição 1 a 6 (${names}).`;
      if (scIndex >= 0) {
        INFO_TOPICS.shortcuts.body[scIndex] = shortcutLine;
      }
    } else {
      if (typeof console !== 'undefined' && console.error) {
        console.error('MosaicEngine.EDIT_SCOPES unavailable for syncScopeTopics');
      }
      INFO_TOPICS.scopes.body = [];
    }
  }

  function syncCommandTopics() {
    if (!commands) return;
    INFO_TOPICS.shortcuts.body = [
      'No mosaico:', ...commands.help('mosaic'),
      'Espaço: Mão temporária. 1: Zoom 100%; 0: Ajustar à janela.',
      'Roda no canvas: tamanho da ferramenta de edição; Ctrl+roda: zoom; Shift+roda: mover horizontalmente; Alt+roda: mover verticalmente.',
      'Ctrl+U alterna o encaixe nos blocos; Shift inverte momentaneamente o encaixe ao editar.',
      'Q ou Tab: ciclar escopos 1 a 6 (Shift inverte); Tab somente no canvas de edição. Em controles, Tab navega pelo foco.',
      'Setas no canvas em Inspeção: navegar gerações. Escape cancela o gesto e retorna o foco à ferramenta.',
      'Carimbo (S): C inicia a seleção; escolha retângulo, elipse ou losango. T alterna Estampar e Recortar e mover; clique define o destino. Mover usa células inteiras, sem repetir por simetria, e pode ser desfeito com Ctrl+Z.',
      'No editor de peças:', ...commands.help('tiles'),
      'Ctrl+D duplica formas selecionadas. Sem seleção, selecione formas; em peça protegida, use Criar cópia editável.',
      'Escape cancela Caneta/arrasto ou limpa a seleção, sem sair do editor. Ctrl+E ou Voltar ao mosaico muda de ambiente.',
      '; ou Ctrl+U: alternar encaixe na grade. H/Espaço: Mão; Z: Zoom.'
    ];
  }

  // Initial sync upon module evaluation
  syncCommandTopics();
  syncScopeTopics();

  let popoverEl = null;
  let popoverTitleEl = null;
  let popoverBodyEl = null;
  let popoverCloseBtn = null;
  let tooltipEl = null;
  let tooltipTrigger = null;
  let tooltipDescription = null;
  let activeTriggerEl = null;
  let isPopoverOpen = false;

  function init() {
    syncCommandTopics();
    syncScopeTopics();
    popoverEl = document.getElementById('infoPopover');
    popoverTitleEl = document.getElementById('infoPopoverTitle');
    popoverBodyEl = document.getElementById('infoPopoverBody');
    popoverCloseBtn = document.getElementById('infoPopoverClose');
    tooltipEl = document.getElementById('uiTooltip');

    if (!popoverEl || !tooltipEl) return;

    // Close button click
    popoverCloseBtn?.addEventListener('click', () => hidePopover());

    // Global click listener to open info topics and close when clicking outside
    document.addEventListener('click', (e) => {
      const infoBtn = e.target.closest('[data-info-topic]');
      if (infoBtn) {
        e.stopPropagation();
        const topic = infoBtn.dataset.infoTopic;
        if (isPopoverOpen && activeTriggerEl === infoBtn) {
          hidePopover();
        } else {
          showPopover(topic, infoBtn);
        }
        return;
      }

      if (isPopoverOpen && !popoverEl.contains(e.target)) {
        hidePopover();
      }
    });

    // Keyboard support: Escape closes popover
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isPopoverOpen) {
        e.preventDefault();
        hidePopover();
      }
    });

    // Close on resize or scroll outside popover to prevent detached floating
    window.addEventListener('resize', () => {
      if (isPopoverOpen) hidePopover();
      hideTooltip();
    }, { passive: true });

    // Tooltip event delegation (pointerenter / focusin / pointerleave / focusout)
    document.addEventListener('pointerenter', handleTooltipEnter, true);
    document.addEventListener('pointerleave', handleTooltipLeave, true);
    document.addEventListener('focusin', handleTooltipEnter, true);
    document.addEventListener('focusout', handleTooltipLeave, true);
  }

  function showPopover(topicKey, triggerEl) {
    if (!popoverEl || !INFO_TOPICS[topicKey]) return;

    const data = INFO_TOPICS[topicKey];
    popoverTitleEl.textContent = data.title;
    popoverEl.dataset.topic = topicKey;

    if (topicKey === 'shortcuts' && commands) {
      renderShortcutHelp(document.body.dataset.studioMode === 'tiles' ? 'tiles' : 'mosaic');
    } else {
      renderTopicBody(data);
    }

    // Set accessibility states
    if (activeTriggerEl && activeTriggerEl !== triggerEl) {
      activeTriggerEl.setAttribute('aria-expanded', 'false');
    }
    activeTriggerEl = triggerEl;
    if (activeTriggerEl) {
      activeTriggerEl.setAttribute('aria-expanded', 'true');
    }

    // Position popover relative to triggerEl
    popoverEl.classList.remove('hidden');
    isPopoverOpen = true;
    positionPopover(triggerEl);

    // Focus close button inside popover for keyboard accessibility
    popoverCloseBtn?.focus();
  }

  function renderTopicBody(data) {
    popoverBodyEl.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'info-popover-list';
    for (const item of data.body || []) {
      const row = document.createElement('li');
      row.textContent = item;
      list.appendChild(row);
    }
    popoverBodyEl.appendChild(list);
    popoverBodyEl.scrollTop = 0;
  }

  function renderShortcutHelp(context, restoreFocus = false) {
    popoverBodyEl.innerHTML = '';
    const choices = document.createElement('div');
    choices.className = 'help-contexts';
    for (const [id, label] of [['mosaic', 'Mosaico'], ['tiles', 'Editor de peças']]) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'help-context-button';
      button.textContent = label; button.dataset.helpContext = id;
      button.setAttribute('aria-pressed', String(id === context));
      button.addEventListener('click', event => {
        event.stopPropagation(); // The context redraw replaces the clicked node before document dismissal.
        renderShortcutHelp(id, true);
      });
      choices.appendChild(button);
    }
    popoverBodyEl.appendChild(choices);
    const toolIds = new Set(commands.tools[context].map(tool => tool[0]));
    for (const [label, tools] of [['Ferramentas', true], ['Ações', false]]) {
      const section = document.createElement('section'); section.className = 'help-command-section';
      const heading = document.createElement('h4'); heading.textContent = label; section.appendChild(heading);
      const list = document.createElement('dl'); list.className = 'help-command-list';
      for (const command of commands.definitions.filter(item => item.context === context && item.shortcut && toolIds.has(item.id) === tools)) {
        const key = document.createElement('dt'); const kbd = document.createElement('kbd');
        kbd.textContent = command.shortcut; key.appendChild(kbd);
        const text = document.createElement('dd'); text.textContent = command.name;
        list.appendChild(key); list.appendChild(text);
      }
      section.appendChild(list); popoverBodyEl.appendChild(section);
    }
    const notes = document.createElement('div'); notes.className = 'help-gesture-notes';
    const lines = context === 'mosaic' ? [
      'Alt+arraste captura. Shift inverte o encaixe; Ctrl+U alterna o encaixe nos blocos.',
      'Q ou Tab no canvas percorre os escopos; Shift inverte a ordem.',
      'Espaço move a vista. Ctrl+roda dá zoom; 0 ajusta e 1 retorna a 100%.'
    ] : [
      'Enter conclui a Caneta. Escape cancela o gesto ou limpa a seleção.',
      'Ctrl+D duplica formas selecionadas. Peça protegida: use Criar cópia editável.',
      'Shift mantém proporção; Alt desenha pelo centro. Ctrl+E volta ao mosaico.'
    ];
    for (const line of lines) { const p = document.createElement('p'); p.textContent = line; notes.appendChild(p); }
    popoverBodyEl.appendChild(notes);
    popoverBodyEl.scrollTop = 0;
    if (restoreFocus) choices.querySelector(`[data-help-context="${context}"]`)?.focus();
  }

  function positionPopover(triggerEl) {
    if (!popoverEl) return;
    const padding = 10;
    const popWidth = Math.min(popoverEl.dataset.topic === 'shortcuts' ? 440 : 360, window.innerWidth - padding * 2);
    popoverEl.style.width = `${popWidth}px`;

    if (!triggerEl) {
      // Center in screen if no trigger
      popoverEl.style.top = '50%';
      popoverEl.style.left = '50%';
      popoverEl.style.transform = 'translate(-50%, -50%)';
      return;
    }

    popoverEl.style.transform = 'none';
    const rect = triggerEl.getBoundingClientRect();
    const popHeight = popoverEl.offsetHeight || 220;

    let left = rect.left + rect.width / 2 - popWidth / 2;
    // Clamp horizontally
    left = Math.max(padding, Math.min(window.innerWidth - popWidth - padding, left));

    // Try below trigger first
    let top = rect.bottom + 6;
    if (top + popHeight > window.innerHeight - padding) {
      // Open above if does not fit below
      top = Math.max(padding, rect.top - popHeight - 6);
    }

    popoverEl.style.left = `${Math.round(left)}px`;
    popoverEl.style.top = `${Math.round(top)}px`;
  }

  function hidePopover() {
    if (!popoverEl || !isPopoverOpen) return;
    popoverEl.classList.add('hidden');
    isPopoverOpen = false;

    if (activeTriggerEl) {
      activeTriggerEl.setAttribute('aria-expanded', 'false');
      // Return focus to trigger element
      try { activeTriggerEl.focus(); } catch (_) {}
      activeTriggerEl = null;
    }
  }

  function handleTooltipEnter(e) {
    const el = e.target.closest?.('[data-tooltip], [title]');
    if (!el || el.closest('#infoPopover')) return;
    const text = el.dataset.tooltip || el.getAttribute('title');
    if (!text) return;
    showTooltip(text, el);
  }

  function handleTooltipLeave(e) {
    if (tooltipTrigger?.contains(e.target) && !tooltipTrigger.contains(e.relatedTarget)) {
      hideTooltip();
    }
  }

  function showTooltip(text, triggerEl) {
    if (!tooltipEl || isPopoverOpen) return;
    if (tooltipTrigger !== triggerEl) {
      hideTooltip();
      tooltipTrigger = triggerEl;
      tooltipDescription = triggerEl.getAttribute('aria-describedby');
      triggerEl.setAttribute('aria-describedby', [tooltipDescription, 'uiTooltip'].filter(Boolean).join(' '));
    }
    tooltipEl.textContent = text;
    tooltipEl.classList.remove('hidden');

    const padding = 8;
    const rect = triggerEl.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();

    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    left = Math.max(padding, Math.min(window.innerWidth - tipRect.width - padding, left));

    let top = rect.top - tipRect.height - 6;
    if (top < padding) {
      top = rect.bottom + 6;
    }

    tooltipEl.style.left = `${Math.round(left)}px`;
    tooltipEl.style.top = `${Math.round(Math.max(padding, Math.min(window.innerHeight - tipRect.height - padding, top)))}px`;
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.add('hidden');
    if (tooltipTrigger) {
      if (tooltipDescription) tooltipTrigger.setAttribute('aria-describedby', tooltipDescription);
      else tooltipTrigger.removeAttribute('aria-describedby');
      tooltipTrigger = null;
      tooltipDescription = null;
    }
  }

  const InfoUI = {
    init,
    initTopics: syncScopeTopics,
    showPopover,
    hidePopover,
    showTooltip,
    hideTooltip,
    INFO_TOPICS
  };

  if (typeof window !== 'undefined') {
    window.InfoUI = InfoUI;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = InfoUI;
  }
})();
