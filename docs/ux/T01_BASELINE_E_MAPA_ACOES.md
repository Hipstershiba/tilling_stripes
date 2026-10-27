# T01 — Baseline e mapa de ações

Concluída em 27/10/2026. Base Git: `c3e9f33`, mais alterações locais anteriores. Nenhuma mudança funcional faz parte desta etapa.

## Evidências e reprodução

Os arquivos em `evidencias/` são locais e ignorados pelo Git. Capturas, logs e o patch de baseline permanecem no computador onde foram gerados; os links abaixo não fazem parte de um clone novo. Somente os registros textuais de decisão e aceite são versionados.

- Estado inicial: [status-inicial.txt](evidencias/T01/status-inicial.txt).
- Diferenças rastreadas anteriores: [alteracoes-preexistentes.patch.gz](evidencias/T01/alteracoes-preexistentes.patch.gz). O arquivo gzip contém o patch e preserva o contexto de execução; não aplicar sobre o checkout atual. Os arquivos não rastreados constam do status, mas não estão neste patch.
- Suíte completa: [testes-baseline.txt](evidencias/T01/testes-baseline.txt), 45/45 aprovadas, saída 0. Os testes validam contratos existentes, não o aceite das correções futuras.
- Servidor de teste: `.\.venv\Scripts\python.exe -m http.server 8874 --bind 127.0.0.1`; abrir `http://127.0.0.1:8874/`. Origem distinta das sessões 5500/8878. Não limpar armazenamento da sessão criativa.
- Capturas reais no navegador integrado: viewport CSS 1440×900, DPR 1, zoom do navegador 100%, zoom da obra 100%, seed 1024, grade 3×3. O navegador retornou imagens JPEG de 1404×900 para o viewport configurado em 1440×900; os nomes indicam a configuração solicitada, não uma medição do bitmap. Nenhum traço foi aplicado. As capturas registram estados de ferramenta; não comprovam o comportamento de pintura.

| Contexto | Captura |
|---|---|
| Gerador / Inspecionar | [gerador](evidencias/T01/gerador-1440x900.jpg) |
| Pincel | [pincel](evidencias/T01/pincel-1440x900.jpg) |
| Carimbo sem captura | [carimbo](evidencias/T01/carimbo-1440x900.jpg) |
| Preservação | [preservação](evidencias/T01/preservacao-1440x900.jpg) |
| Editor / mestre protegido / Camadas | [editor](evidencias/T01/editor-1440x900.jpg) |

A matriz compacta e zoom elevado continua em T14. Não foram feitos testes reais de Spout, leitor de tela ou falha de armazenamento nesta tarefa.

## Mapa atual das ações principais

Este mapa registra o comportamento existente. A política desejada está na seção 6 do plano; diferenças abaixo continuam pendentes.

| Ambiente / ação | Botão ou entrada | Tecla / gesto atual | Destino | Disponibilidade / efeito |
|---|---|---|---|---|
| Mosaico: gerar | btnRandomize / seedInput | G / mudar seed | triggerRandomSeed → regenerateMosaic | Novo documento de geração; G também pode repetir |
| Mosaico: inspecionar | toolInspect | V | activateStudioTool(inspect) | Contexto do gerador; não pinta |
| Mosaico: pincel | toolPaint / paleta | B / arrastar | activateStudioTool(paint), selectBrushTile | Altera células, respeita escopo/encaixe |
| Mosaico: borracha | sem botão próprio | E | selectBrushTile(84 ou anterior) | Alterna vazio/anterior; defeito de sessão previsto em T03 |
| Mosaico: girar | toolRotate | R / clique direito inverte | activateStudioTool(rotate) | Altera células |
| Mosaico: carimbo | toolStamp / Capturar região | S / C / Alt+arrasto | beginCloneCapture, finishCanvasRegionCapture | Captura ou aplica padrão; transformação por colchetes |
| Mosaico: preservar | toolFreeze | F / Shift+F / Delete | activateStudioTool(freeze), clearFrozenCells | Marca preservações para geração; Delete depende de freeze |
| Mosaico: escopo | controles contextuais | Q / Shift+Q / Tab | cycleEditScope | Seis escopos; Tab também recolhe dock no gerador |
| Mosaico: tamanho / encaixe | controles do pincel | +, − / roda / Ctrl+U / Shift segurado | cycleActiveToolSize, stepToolSizeFromWheel, isEffectiveBrushSnap | Shift inverte encaixe; roda muda tamanho em ferramentas de edição |
| Mosaico: undo/redo | btnEditUndo / btnEditRedo | Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z | undoMosaicEdit / redoMosaicEdit | Histórico de edição, incluindo gerações; cobertura de aparência pendente T05 |
| Mosaico: histórico | btnPrevSeed / btnNextSeed | ← / → | restoreGenerationHistory | Navega gerações, distinto de undo |
| Mosaico: cores | fgColorPicker / bgColorPicker / btnSwapColors | X | handlers em initStudioUI | Muda aparência; X aceita modificadores indevidos |
| Mosaico: dimensões / grade | canvasW/H, gridRows/Cols, margin, padding | campos e steppers | applyCanvasDimensions / applyGridDimensions / applyPaddingValue | Altera documento; undo e guardas serão revistos |
| Mosaico: famílias permitidas | tileSearchInput / seleção / Todos/Nenhum/Inverter/Mix | busca e cliques | renderSwatchesPanel / regenerateMosaic | Busca filtra; seleção regenera |
| Mosaico: exportar | exportFormatSelect / btnExport | clique | renderMosaicToContext | PNG/SVG limpo em dimensão nativa; não é backup do projeto |
| Ambos: mover vista | toolPan / btnTileViewPan | H / Espaço / botão do meio / arrastar | applyPanTransform | Navegação; não altera arte |
| Ambos: zoom | toolZoom / botões / preset | Z / Ctrl+roda / 0 / 1 / Ctrl+0/1 | setZoomPercent / fitArtboardToWindow / resetZoom100 | Navegação; roda livre no editor também dá zoom |
| Ambos: dock / ajuda / guias | btnToggleRightDock / btnHelp / toggles | Tab contextual / ? / A,M,O,Shift+B no mosaico | toggleRightDock / InfoUI / click dos toggles | Apresentação; A/M são vetoriais dentro do editor |
| Ambos: trocar ambiente | btnStudioTilesMode | Ctrl+E | toggleTilesStudio | Preserva ferramenta do mosaico ao voltar |
| Ambos: Spout | spoutToggle / spoutName | clique / campo | startSpoutOutput / stopSpoutOutput | Saída local; conexão real não exercitada |
| Peças: selecionar/desenhar | vecToolSelect/Direct/Pen/Rect/Ellipse/Polygon/Arc/Line | V,A,P,M,L,G,U,barra invertida | setVectorTool | Escrita depende de família editável |
| Peças: concluir/cancelar | canvas / diálogos | Enter / Escape | finalizePenPath / limpar seleção / closeTilesStudio | Escape atualmente pode confirmar Caneta; T06 corrige |
| Peças: copiar/colar/duplicar | seleção / ação de duplicar família | Ctrl+C/V/D/A | operações VectorEditor / handleDuplicateFamily | Ctrl+D sem seleção duplica família; ambiguidade em T06 |
| Peças: undo/redo | btnVecUndo / btnVecRedo | Ctrl+Z/Y/Shift+Z | handleVecUndo / handleVecRedo | Histórico vetorial, consumido antes do mosaico |
| Peças: ordem / precisão | ações de camadas / propriedades | Ctrl+[ ou ] (+Shift) / setas (+Shift) | reorderShapeZ / translateShape / movePathNodes | Altera seleção em família editável |
| Peças: encaixe | btnTileSnapToggle / tileGridDivSelect | ; / Ctrl+U | estado VectorEditor | Encaixe vetorial, separado do mosaico |
| Peças: biblioteca / arquivo | Biblioteca, Arquivos SVG, Backup / ações da família | ações explícitas | SubtileStudioUI / LibraryStore | Criar, duplicar, renomear, importar SVG/JSON e exportar peça/biblioteca |
| Diálogos: decidir | dirtyGuardDialog / subtileConfirmDialog / subtileImportDialog | Escape / Tab | closeDirtyGuard / closeConfirmModal / closeImportModal | Editor já tem infraestrutura de inércia/foco; dirty guard não isola comandos globalmente |

## Listeners e aliases a revisar

Localizados por Graphify e confirmados nos trechos de `initStudioUI`, `SubtileStudioUI.handleKeyDown` e registro de controles:

1. O keydown global de `initStudioUI` processa X antes do dirty guard e antes do editor. O botão de troca de cores repete lógica e segue um caminho de salvamento diferente. T02 deve compartilhar a ação.
2. O mesmo listener encaminha para `SubtileStudioUI.handleKeyDown` e só depois trata undo do mosaico. Ctrl+E é global no handler do editor; letras vetoriais consomem G/A/M/V em peças.
3. Há filtros para INPUT/SELECT/TEXTAREA e Espaço/Enter em BUTTON; contenteditable, composição IME, defaultPrevented, repeat e modificadores exatos ainda precisam de política comum.
4. keyup em initStudioUI atualiza modificadores; outro keyup global sincroniza cursor. blur cancela gesto e limpa estados temporários. Não remover esses listeners como se fossem necessariamente duplicação defeituosa.
5. Wheel e mousedown de navegação estão no pasteboard; mousemove/mouseup globais fecham pan/gestos. Mouseup também encaminha ao editor e finaliza captura/pintura.
6. Padding liga input e change à mesma aplicação; steppers emitem ambos. T05 deve tratar como um gesto e evitar snapshots duplicados.
7. Undo aceita Ctrl+Y e Ctrl+Shift+Z; zoom aceita 0/1 e Ctrl+0/1; Tab tem dois destinos; Ctrl+U muda encaixe conforme ambiente. Os aliases precisam permanecer explícitos na ajuda.
8. As abas do editor já possuem setas/Home/End próprios; setas globais de histórico não podem escapar de widgets. A biblioteca/camadas têm listeners próprios de seleção e ações; revisão de foco/semântica em T13.

## Passagem para T02

Próxima etapa: isolar modais e corrigir roteamento do teclado. Nenhum achado UX foi marcado como corrigido por uma captura ou por testes existentes. Preservar as alterações locais listadas no baseline e fazer o próximo commit somente com o escopo de T02, sua regressão e a atualização do quadro.

Sincronização: `scripts/sync_knowledge.ps1` terminou com saída 0. AST atualizado e vault exportado; seis notas preexistentes foram preservadas pelo exportador por não serem de sua autoria.
