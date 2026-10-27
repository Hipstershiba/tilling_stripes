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
      title: 'Simetria da Grade (Macro)',
      subtitle: 'Como os blocos do mosaico se relacionam',
      body: [
        'Mandala (D4 Estrito): 8 octantes com rigor matemático. Eixos sem tile invariante recebem o Tile Vazio (#84) como respiro.',
        'Caleidoscópio (Livre): 8 octantes com liberdade total. Espelha 100% dos tiles selecionados sem restrições de eixo.',
        'Rotacional (C4): 4 quadrantes girando continuamente 90° em sentido horário ao redor do centro.',
        'Bilateral (XY): 4 quadrantes com espelhamento clássico nos eixos horizontal e vertical.'
      ]
    },
    'block-symmetry': {
      title: 'Simetria Interna do Bloco',
      subtitle: 'Organização dos subtiles dentro de cada bloco',
      body: [
        'Igual à Grade: Cada bloco replica automaticamente o mesmo modo de simetria selecionado para a grade macro.',
        'Independente: Permite escolher uma simetria interna diferente para os 4 quadrantes de cada bloco.',
        'Atenção: Escolher uma simetria de bloco menor que a da grade (ex: Grade Mandala com Bloco Bilateral) reduz a simetria global resultante.'
      ]
    },
    'scopes': {
      title: 'Escopos de Edição',
      subtitle: 'Para onde sua pincelada ou giro se propaga',
      body: []
    },
    'center-symmetry': {
      title: 'Simetria pelo Centro do Canvas',
      subtitle: 'Propagação global ao redor do centro do mosaico',
      body: [
        'Mandala: Simetria radial em 8 direções ao redor do ponto central.',
        'Caleidoscópio: 8 direções radiais livres com todos os tiles.',
        'Giro 4×: Rotação contínua de 90° nos 4 quadrantes globais.',
        'Espelho XY: Reflexão horizontal e vertical simultânea.',
        'Espelho X / Y: Reflexão em um único eixo cartesiano (esquerda-direita ou topo-base).'
      ]
    },
    'brush': {
      title: 'Pincel e padrão de pincel',
      subtitle: 'Pintura livre e construtor de carimbos',
      body: [
        'Clique Esquerdo: Pinta a célula com o tile ou supertile ativo.',
        'Clique Direito: Gira o padrão do pincel em 90°.',
        'Alt + Clique/Arraste: captura uma região para o pincel; H/Espaço move a visualização.',
        'Tamanho: use − / + ou a roda sobre o canvas. O ajuste para nos limites; com ajuste ao bloco, avança um bloco por vez.',
        'Reset 0°: Restaura a orientação neutra (sem rotação) do supertile.'
      ]
    },
    'rotate': {
      title: 'Ferramenta Girar',
      subtitle: 'Rotação pontual ou em bloco de azulejos',
      body: [
        'Clique Esquerdo: Gira o azulejo ou região em 90° no sentido horário.',
        'Clique Direito: Cicla para a variação anterior ou gira no sentido anti-horário.',
        'Tamanho: use − / + ou a roda sobre o canvas. Ajustar ao bloco encaixa a área na grade; clique novamente para liberar o encaixe.',
        'Modo de Grupo: Permite girar cada célula individualmente ou girar o bloco como uma peça rígida.'
      ]
    },
    'stamp': {
      title: 'Carimbo',
      subtitle: 'Captura e replicação de regiões',
      body: [
        'Alt + Clique/Arraste: captura uma região, como no pincel. Solte e clique para aplicar. C permanece como alternativa; Esc cancela a captura.',
        'Clique Esquerdo: Carimba a estampa capturada respeitando o escopo ativo.',
        'Clique Direito: Gira a estampa em 90° antes de aplicar.',
        'Pincel e clone mantêm padrões próprios ao trocar de ferramenta. Ampliar editor abre uma área maior com paleta e edição lado a lado.'
      ]
    },
    'freeze': {
      title: 'Preservar peças',
      subtitle: 'Proteja suas regiões favoritas durante novas gerações',
      body: [
        'Imunidade à Geração: Subtiles travados não são alterados ao gerar novos mosaicos ou sortear novas sementes (G).',
        'Modos Congelar e Descongelar: Ação monotônica no canvas — o modo selecionado garante que todo clique adiciona ou todo clique remove.',
        'Tamanhos de Área: Permite travar regiões desde subtiles individuais (1×1) até blocos completos.',
        'Escopo de Simetria: Respeita diretamente o escopo ativo do Editor (1 a 6) para travar subtiles isolados (Livre) ou propagar pela órbita.',
        'Desfazer e Refazer: Suporta Ctrl+Z / Ctrl+Y para reverter alterações de travas a qualquer momento.'
      ]
    },
    'same-tile': {
      title: 'Escopo Iguais (Substituição Global)',
      subtitle: 'Troca inteligente de um azulejo em todo o mosaico',
      body: [
        'Substitui instantaneamente todas as cópias do azulejo sob o cursor pelo novo azulejo selecionado.',
        'Requer pincel unitário (1×1) para garantir substituição precisa um-para-um.',
        'Ideal para ajustar a paleta de cores ou o estilo de linhas sem redesenhar o mosaico.'
      ]
    },
    'd4-strict': {
      title: 'Mandala (D4 Estrito)',
      subtitle: 'Fechamento rigoroso no Grupo Diédrico D4',
      body: [
        'Garante simetria matemática rigorosa nos 8 octantes do quadrado.',
        'Células em eixos ou diagonais exigem tiles auto-invariantes sob rotação ou espelho.',
        'Quando a família escolhida não possui simetria no eixo, o motor usa o Tile Vazio (#84) como respiro geométrico.',
        'Edições manuais em eixos disparam aviso transparente, permitindo continuar ou desfazer.'
      ]
    },
    'kaleidoscope': {
      title: 'Caleidoscópio (Livre)',
      subtitle: 'Simetria radial estética e permissiva',
      body: [
        'Espelha e rotaciona livremente em 8 octantes com 100% dos tiles selecionados.',
        'Permite azulejos assimétricos nas diagonais sem forçar espaços vazios.',
        'Recomendado para composições ricas, fluidas e vibrantes sem regras restritivas.'
      ]
    },
    'persistence': {
      title: 'Salvamento Automático e Histórico',
      subtitle: 'Preservação de dados no navegador',
      body: [
        'Mosaico e biblioteca são salvos neste navegador. O status só confirma a revisão atual de ambos.',
        'Uma cópia íntegra em IndexedDB ou localStorage confirma o salvamento; cache reduzido só gera aviso se não houver cópia íntegra.',
        'Se nenhum armazenamento confirmar, o aviso permanece e permite tentar salvar novamente.',
        'Backup JSON protege a biblioteca. Exportar PNG/SVG guarda a imagem do mosaico, sem ser um backup editável do projeto.'
      ]
    },
    'shortcuts': {
      title: 'Atalhos e comandos por ambiente',
      subtitle: 'Mosaico e editor de peças',
      body: []
    },
    'inspect': {
      title: 'Inspeção do Mosaico',
      subtitle: 'Análise de coordenadas e composição',
      body: [
        'Passe o mouse sobre qualquer subtile do mosaico para ver em tempo real:',
        'Coordenadas de Bloco (L, C) e Subtile interno.',
        'ID do azulejo, nome da família e transformação geométrica ativa (0°, 90°, espelho).',
        'Identificador da órbita de simetria correspondente.'
      ]
    },
    'subtile-library': {
      title: 'Biblioteca de Subtiles e Famílias D4',
      subtitle: '1 Mestre Vetorial = 1 Família Fechada em D4',
      body: [
        'Cada família possui 1 desenho mestre normalizado em [-0.5, 0.5] e gera automaticamente 1, 2, 4 ou 8 variantes segundo sua simetria D4.',
        'Os 31 mestres originais (IDs #0 a #84) são protegidos para preservar saves; clique em "Criar cópia editável" para criar uma cópia editável.',
        'O Tile Vazio (#84) é o respiro matemático oficial de Mandala D4 e da Borracha.',
        'Ao excluir uma família customizada em uso, suas células no mosaico convertem-se com segurança para o Tile Vazio (#84).',
        'Na aba Biblioteca, conjuntos organizam famílias. Filtre por conjunto ou por Meus subtiles, use Localizar atual e arraste famílias entre conjuntos. Exportar/Importar (.json) mantém backups.'
      ]
    },
    'vector-editor': {
      title: 'Editor Vetorial de Subtiles',
      subtitle: 'Desenho normalizado em [-0.5, 0.5] com continuidade D4',
      body: [
        'Seleção (V): Move, redimensiona pelas 8 alças e gira formas (Shift mantém proporção / ângulos de 15°; Alt escala pelo centro).',
        'Seleção Direta (A): Edita nós e alças Bezier (Alt quebra simetria da alça; duplo-clique alterna Canto/Suave; Alt+Clique cria nó no segmento).',
        'Caneta (P): clique cria canto; arraste cria curvas; clicar no primeiro ponto fecha o contorno. Enter conclui aberto; Escape cancela. Trocar ferramenta conclui um caminho válido, exceto durante arrasto provisório.',
        'Primitivas: Retângulo (M), Elipse (L), Polígono/Estrela (G), Arco/Setor Anular de Fita (U) e Linha (\\).',
        'Ímã e Grade (1/2 a 1/16): A divisão 1/6 alinha exatamente bordas (±0.5), centro (0) e portas de fita Truchet (±1/6 e ±1/3).'
      ]
    },
    'vector-layers': {
      title: 'Booleanas, Camadas & SVG',
      subtitle: 'Pathfinder Bezier (Paper.js), Ordem Z e Intercâmbio Vetorial',
      body: [
        'Na aba Camadas, marque 2+ objetos nas caixas de seleção. No canvas, use V e Shift+clique ou Shift+arraste no vazio para adicionar à seleção. Todos (Ctrl+A) seleciona os objetos visíveis e destravados.',
        'O Pathfinder fica acima de Camadas e Propriedades: Unir, Subtrair Frente, Interseção e Excluir (XOR com furos par-ímpar). Ctrl+Z desfaz a operação.',
        'Transformações D4 na Seleção: Gire +90°/-90° ou espelhe Horizontal/Verticalmente em torno do centro (0, 0).',
        'Camadas (Formas): Arraste linhas para alterar a Ordem Z (topo da lista = frente), duplo-clique para renomear, oculte ou trave as formas.',
        'Importar e Exportar SVG: Converte <path>, <rect>, <circle>, <ellipse>, <polygon> e <line> normalizando o viewBox para [-0.5, 0.5], e exporta subtiles unitários limpos em .svg.'
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
      'Setas no canvas em Inspecionar: navegar gerações. Escape cancela o gesto e retorna o foco à ferramenta.',
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

    // Render body bullets safely
    popoverBodyEl.innerHTML = '';
    if (topicKey === 'shortcuts' && commands) {
      renderShortcutHelp(document.body.dataset.studioMode === 'tiles' ? 'tiles' : 'mosaic');
    } else if (data.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'info-popover-sub';
      sub.textContent = data.subtitle;
      popoverBodyEl.appendChild(sub);
    }

    if (topicKey !== 'shortcuts' && Array.isArray(data.body) && data.body.length > 0) {
      const ul = document.createElement('ul');
      ul.className = 'info-popover-list';
      for (const item of data.body) {
        const li = document.createElement('li');
        li.textContent = item;
        popoverBodyEl.appendChild(li);
      }
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
