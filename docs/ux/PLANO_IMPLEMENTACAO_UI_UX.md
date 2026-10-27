# Plano executável de interface e experiência

Tiling Stripes Studio · 27/10/2026 · **Estado: execução iniciada; T01 concluída, T02–T17 pendentes.**

Prioridade confirmada pelo usuário: **gerar mosaicos e fazer ajustes rápidos**. Plataforma de referência: desktop, mouse e teclado, interface em português. Toque/mobile e um editor de janelas personalizáveis não fazem parte deste plano.

Evidências e limitações: [AUDITORIA_UX_2026-10-27.md](AUDITORIA_UX_2026-10-27.md). Os IDs UX/DOC abaixo remetem a esse documento.

## 1. Instrução de entrada para o modelo executor

Implemente uma tarefa por vez, na ordem de dependência. Não tente redesenhar toda a aplicação em uma única alteração. Primeiro corrija ações erradas, isolamento de diálogos e recuperação; depois organize a apresentação. O fluxo de mosaicos tem precedência sobre a expansão do editor vetorial.

Antes da primeira busca ou leitura de fonte para uma questão de código, consulte Graphify. Use query, explain ou path para chegar ao símbolo; depois leia somente o trecho necessário. Aplique essa mesma regra a subagentes que explorarem código.

Neste checkout o executável disponível é:

```powershell
.\.venv\Scripts\python.exe -m graphify query "pergunta ou símbolo" --budget 2000
.\.venv\Scripts\python.exe -m graphify explain "símbolo"
```

As instruções recebidas mencionam `venv`, mas essa pasta não existe na base auditada; `.venv` existe e é usada pelo script de sincronização. Se o ambiente mudar, confira o caminho real antes de executar.

Procedimento de cada tarefa:

1. Ler seu cartão neste plano e localizar os símbolos pelo grafo.
2. Conferir o estado atual e as alterações locais; não sobrescrever trabalho alheio.
3. Reproduzir o defeito quando houver roteiro. Se já foi corrigido, registrar a evidência e não refazer.
4. Implementar a menor mudança que cumpre a especificação.
5. Executar os testes indicados e conferir interação quando aplicável.
6. Registrar resultado, limitações e arquivos alterados no quadro de acompanhamento.

Na entrega de um lote com código, aplicar [.agents/skills/tiling-invariants-gate/SKILL.md](../../.agents/skills/tiling-invariants-gate/SKILL.md), executar o gate completo e sincronizar conhecimento. A indicação antiga de “36 suítes” na skill está desatualizada: o runner observado contém 45. Todas as suítes enumeradas pelo runner devem passar.

```powershell
node tests/run_all.js
```

```powershell
.\scripts\sync_knowledge.ps1
```

O segundo comando executa atualização AST e exportação Obsidian. O vault é `_local/obsidian_vault`; não inserir notas pessoais nas notas geradas. A entrega documental desta auditoria já foi sincronizada; repetir após futuras alterações.

## 2. Contratos que não podem ser quebrados

| Área | Contrato obrigatório |
|---|---|
| Layout | `#left-toolbar` → `#workspace-viewport` → `#right-dock`, com order 0/1/2. Quatro superfícies de controle: topo, esquerda, direita, status. |
| Dock | `#btnToggleRightDock` permanece dentro do dock; gaveta recolhida de 44px. Não criar um segundo sistema de painéis. |
| IDs legados | Preservar os **60 IDs da lista** de `tests/test_ui_control_registry.js`, uma ocorrência de cada no HTML. Não confundir com limite de 60 elementos/IDs no app inteiro. |
| Localização | Prancheta/grade/padding no topo; ferramentas e guias na esquerda; cores depois das ferramentas; geração, seed, histórico e exportação do mosaico na esquerda. Guias vêm depois de Zoom. |
| Proibições legadas | Não criar `#left-rail`, `#workspaceSwitcher` ou `#btnContextGenerator`; não duplicar seletor de ferramenta. |
| D4 | Preservar id, r90, r180, r270, mx, my, md, mad; quatro modos canônicos `mandala_d4`, `kaleidoscope`, `rotational_c4`, `bilateral_d2`. |
| Catálogo | Built-ins 0–84 protegidos, 31 famílias canônicas, vazio #84, estabilizadores e fechamento D4 intactos. Famílias customizadas continuam possíveis. |
| Persistência | Schema v3; chave `tiling_stripes_studio_v3_state`; IDB `TilingStripesDB_v1` / `studio_state`; oito funções puras exportadas de persistência permanecem. |
| Snapshots | Usar `DocumentSnapshot.collectParams` / `attachDocument` para atravessar gerações. Extensões devem ler snapshots antigos sem destruir dados. |
| Spout/exportação | Buffer limpo, tamanho nativo, sem guias/zoom/hover; WebSocket local 8766 e deduplicação por artifactSignature. |
| Documentação | README e Manual descrevem o comportamento final. Relatórios de rodadas anteriores são históricos. |

Minimalismo deve ser obtido por hierarquia, rótulos, agrupamento e estado contextual. Não remover um ID congelado para esconder redundância; mover o mesmo elemento quando permitido ou usar apresentação secundária. Elementos recolhidos não podem continuar no percurso de foco nem na árvore acessível.

## 3. Critérios de produto

Estes são alvos de aceite, não medições já realizadas:

- Gerar outro mosaico: um clique no botão persistente ou G no contexto permitido.
- Ativar pincel, girar, carimbar, preservar e navegar: um clique em ferramenta com nome visível.
- Usuário entende o alcance antes de pintar por preview e resumo de escopo.
- Nenhum comando de documento executa atrás de modal.
- Nenhum erro total de salvamento fica somente no console.
- Uma ação visual confirmada do documento corresponde a um passo de desfazer; arrasto de controle corresponde a um gesto.
- Exportação informa o alvo: mosaico PNG/SVG, peça SVG ou biblioteca JSON.
- Sem rolagem horizontal do documento nos tamanhos desktop de referência. Rolagem vertical dentro de listas é permitida e deve ser perceptível.
- Texto funcional normal com contraste mínimo de 4,5:1; indicadores/bordas essenciais com 3:1 em relação à área adjacente. Verificar os pares reais de cores.
- Teclado permite configurar, selecionar ferramentas/famílias, gerar, recuperar e exportar, com foco visível e restaurado após atualização. Pintura/desenho espacial usa ponteiro neste escopo; navegação/aplicação espacial integral por teclado permanece uma extensão a especificar separadamente.

## 4. Arquitetura de informação desejada

### 4.1 Mosaico

```text
┌ Topo: Prancheta [largura × altura] · Grade [linhas × colunas] · Margem · Espaçamento ┐
│ Esquerda                 │ Viewport: obra                     │ Direita             │
│ Ferramentas (2 colunas)  │ Preview de alcance da ferramenta   │ Título do contexto  │
│ Guias                    │                                    │ Opções essenciais   │
│ Cores                    │                                    │ Avançado recolhido  │
│ Gerar + semente          │                                    │                     │
│ Histórico recolhido      │                                    │                     │
│ Exportar mosaico         │                                    │                     │
└ Status: zoom · ferramenta/alcance · salvamento · Spout compacto · ajuda ───────────┘
```

Não adicionar tela inicial obrigatória. A obra já pronta ao abrir é um bom ponto de partida. Manter Gerar visível e Histórico recolhido. Exportação fica na esquerda, conforme contrato; não mover para o rodapé porque outro relatório antigo pediu isso.

**Direita no gerador:** Simetria da composição; peças permitidas; opções avançadas de estrutura. Dentro de estrutura, “Simetria dos blocos: Igual à composição” é o estado padrão apenas para documento novo. Documento restaurado mantém a simetria independente salva e deve apresentá-la sem exigir que o usuário a reative. Mostrar a lista completa de simetria interna ao escolher Independente ou ao restaurar esse estado. Subdivisão permanece acessível com explicação “Peças por bloco”; mostrar a dimensão resultante correta, preservando a regra N = 2 × subdivisão.

**Direita durante edição:** propriedades da ferramenta ativa. Geração permanece acessível pelo botão persistente à esquerda e por Inspecionar (V). Não adicionar outro botão “Gerador” duplicado.

### 4.2 Editor de peças

O botão existente `btnStudioTilesMode` passa a ter rótulo “Editar peças”; ao entrar vira “Voltar ao mosaico”. Manter o mesmo elemento e a ferramenta anterior restaurada ao sair. Não criar workspaceSwitcher.

Topo: nome da família, proteção/editabilidade, uma ação primária “Criar cópia editável” quando necessário, undo/redo e opções de preview.

Esquerda: ferramentas vetoriais, navegação e guias. Direita: reutilizar as abas existentes Camadas, Propriedades, Biblioteca e Variantes. A aba ativa não deve mudar ao selecionar uma forma; o conteúdo dela se atualiza. A criação/duplicação explícita de família pode abrir Biblioteca para revelar o resultado, com feedback.

O editor deve conservar espaço para a obra. Biblioteca completa, backup e importação não precisam aparecer expandidos ao mesmo tempo. SVG da peça fica em um lugar canônico; nenhum segundo painel deve repetir a lista completa de famílias.

### 4.3 Matriz contextual obrigatória

| Contexto | Dock mostra | Ação principal | O que fica secundário |
|---|---|---|---|
| Mosaico / Inspecionar | Simetria da composição + peças permitidas | Gerar, na esquerda | Simetria interna independente, detalhes D4 |
| Pincel | Peça/padrão, tamanho, alcance e encaixe | Pintar no canvas | Construção de padrão avançado, transformações detalhadas |
| Borracha | Tamanho, alcance, encaixe; estado “Borracha” | Apagar no canvas | Paleta de peças não precisa dominar o painel |
| Girar | Tamanho, alcance, modo geométrico/variante | Girar no canvas | Explicação algébrica |
| Carimbo sem captura | Estado Capturar ativado automaticamente + instrução “Arraste para capturar” | Capturar região | Transformações indisponíveis desabilitadas com motivo |
| Carimbo pronto | Miniatura, tamanho, alcance, Capturar novamente | Aplicar captura | Editor do padrão |
| Preservar | Preservar/liberar, tamanho, alcance, contagem | Marcar no canvas | Limpar todas as preservações com ação explícita |
| Mão / Zoom | Contexto anterior preservado, sem reset de formulário | Navegar no canvas | Não trocar para gerador sem motivo |
| Peça padrão protegida | Aba escolhida, leitura permitida | Criar cópia editável no topo | Ferramentas de escrita indisponíveis com motivo |
| Peça custom sem seleção | Propriedades da ferramenta / família na aba pertinente | Desenhar ou selecionar | Booleanas indisponíveis |
| Peça custom com seleção | Geometria/transformar na aba Propriedades | Editar seleção | Informações de estabilizador em Variantes |
| Modal | Conteúdo do diálogo, fundo inerte | Ação da decisão | Todos os comandos externos bloqueados |

Mão e Zoom são navegação, não confirmação/cancelamento do documento. Não apagar seleção, tamanho, filtro ou captura ao navegar.

## 5. Sistema visual

### 5.1 Tokens de referência

Reutilizar/renomear tokens atuais gradualmente. Os nomes abaixo são semânticos; não é exigido substituir toda a folha de estilos em um único lote.

| Papel | Valor inicial proposto | Uso |
|---|---|---|
| Pasteboard | `#17181b` | Área ao redor da obra; pontos podem ser removidos ou muito discretos. |
| Painel | `#242529` | Barras e dock, mesma família neutra. |
| Superfície elevada | `#2d2f34` | Popover/menu/diálogo. |
| Campo | `#1d1f23` | Input, select e campo de zoom. |
| Hover | `#353941` | Hover neutro, sem brilho ou animação chamativa. |
| Borda | `#484d57` | Separação funcional; usar borda de controle essencial com contraste verificado. |
| Texto principal | `#eceef2` | Nomes, valores e ações. |
| Texto secundário | `#b8bec9` | Ajuda curta e metadados úteis. |
| Texto discreto | `#a5adbb` | Informação menos frequente; também deve cumprir contraste se funcional. |
| Acento/foco | `#79adff` | Contorno de seleção, foco e controles prioritários. |
| Fundo selecionado | `#263d5b` | Estado ativo sem tingir todo o painel. |
| Aviso | `#e5bd70` | Atenção com texto/ícone; não usar como decoração. |
| Erro | `#ff9292` | Falha acompanhada de mensagem e ação. |

Os valores são ponto de partida. Não marcar contraste como aprovado sem calcular o par final e conferir controles/estados reais. As cores da obra são independentes do tema.

### 5.2 Escala e componentes

- Fonte: sistema operacional, sem importar outra família apenas para o redesenho.
- Texto de controles: 12–13px; valor principal: 13px; título de seção: 11–12px, peso 600. Informações de 9px não devem carregar instruções ou ações.
- Unidade de espaçamento: 4px; gaps comuns 8px; seção 12–16px. Reduzir linhas e caixas redundantes antes de comprimir fonte.
- Botão/input comum: 30–32px de altura. Ação pequena de lista: alvo mínimo 28×28px. Modo de toque não é pressuposto.
- Ícones: SVGs coerentes, 16px, traço e alinhamento consistentes. Evitar emoji e glifos como linguagem principal dos comandos.
- Borda de foco: 2px, com deslocamento visível. Distinguir foco, seleção, hover, desabilitado e erro.
- Botão primário: uma ação principal por agrupamento. Nem todo toggle ligado deve parecer botão primário.
- Acordeão: cabeçalho inteiro acionável, seta consistente, estado aria-expanded e conteúdo fora do foco quando fechado.
- Tooltip: “Nome (atalho)” + uma frase curta quando necessária. Aceitar quebra de linha; nunca reticências na instrução. Aparecer também por foco, não apenas hover.
- Campos numéricos: rótulo persistente e unidade; valor válido confirma em Enter ou ao perder foco, uma única vez. Escape restaura valor anterior ao foco, sem commit posterior no blur; setas alteram conforme step. Valor inválido mantém erro e não altera o documento, nem vira silenciosamente outro valor. Aplicar também às propriedades vetoriais.
- Desabilitado: aparência reconhecível e motivo acessível quando não for óbvio; não usar apenas baixa opacidade como explicação.

### 5.3 Glossário vinculante

| Atual | Rótulo desejado | Observação |
|---|---|---|
| Artboard | Prancheta | Largura/altura em px. |
| W / H | Larg. / Alt. | Nome acessível completo mesmo se visual compacto. |
| L / C | Linhas / Colunas | Não confundir L de largura com linhas. |
| Padding | Espaçamento | Tooltip: espaço interno das peças, em %. |
| Swatches Permitidos (Gerador) | Peças permitidas | Não confundir seleção para sorteio com pincel ativo. |
| Subtiles (ambiente) | Editar peças | Ação de navegação. |
| Subtiles (guia) | Grade de peças | Toggle de visualização. |
| Supertile | Bloco | “Padrão de pincel” quando se refere a uma captura/padrão, não ao bloco da grade. |
| Seed | Semente | Número reproduzível da geração. |
| Clonar / Stamp | Carimbo | Modo secundário: Capturar. |
| Travar subtiles | Preservar | Tooltip: preservar na próxima geração; não implica bloquear edição manual. |
| Pan | Mão | Tooltip: mover a visualização. |
| Snap / Ímã | Encaixe | “Encaixar nos blocos” ou “Encaixar na grade”, conforme ambiente. |
| SOLO | Isolar | Tooltip anuncia conjunto/família-alvo. |
| Sortear Mix | Sortear seleção | Não gerar automaticamente sem regra explícita de prévia/commit. |
| Clip | Recortar aos limites da peça | Oculta o que ultrapassa os limites na renderização e exportação, sem apagar formas. |
| Duplicar p/ Editar | Criar cópia editável | Uma ação primária por contexto protegido. |
| Nós | Editar pontos | Termo técnico pode aparecer na ajuda. |
| Exportar Custom | Exportar meus desenhos | Se o arquivo contém apenas famílias customizadas. Conferir escopo real. |
| off | Desligado | Status de Spout. |
| [-0.5,+0.5], H, id, r90, #84 | Ajuda avançada | Preservar IDs internos e acesso técnico quando útil; não usar como instrução básica. |

Não renomear nomes de famílias criadas pelo usuário nem traduções do conteúdo importado. Mudar apenas rótulos do produto. Não substituir identificadores internos de simetria pelo texto de interface.

## 6. Política de atalhos e gestos

### 6.1 Ordem de roteamento

Uma única política deve decidir se o evento pode chegar ao comando:

1. Se composição IME (`isComposing`) estiver ativa, não executar atalhos de documento.
2. Se existir modal, somente ações daquele modal. O bloqueio precisa ocorrer antes de X, undo e alternância de ambiente.
3. Em input, textarea, select ou contenteditable, preservar edição/navegação local. Não tratar apenas INPUT/SELECT/TEXTAREA como universo completo.
4. Componentes como abas/listas recebem seus próprios atalhos primeiro; evento já consumido (`defaultPrevented`) não é processado de novo.
5. Roteamento pelo ambiente, superfície focada e ferramenta. Combinações exigem modificadores exatos.
6. Chamar preventDefault apenas quando houver comando reconhecido e permitido. Atalho indisponível pode emitir feedback curto sem alterar o documento.
7. Eventos de repetição não repetem comandos discretos como gerar, trocar ambiente, abrir modal ou iniciar captura. Repetição de setas de incremento continua permitida onde fizer sentido.

Manter temporários (Espaço/Shift/Alt) com limpeza no keyup, perda de foco da janela e cancelamento de gesto. Não deixar Mão ou encaixe invertido “presos” após alternar janela.

O canvas precisa de um único ponto focável explícito, por exemplo `canvas-stage` com tabindex=0 e nome acessível; evitar dupla parada no contêiner e no canvas p5. Clique na área de trabalho e navegação por Tab podem dar foco a esse ponto. Capturar Tab/Shift+Tab para alcance só em edição do mosaico; **Escape, quando não houver gesto a cancelar, devolve foco à ferramenta ativa**, permitindo continuar a navegação normal por Tab. Mostrar essa saída na ajuda do canvas. Não criar armadilha de teclado em nome do alias legado.

### 6.2 Mosaico

Atalhos de letra abaixo valem no canvas/contexto de edição, fora de campos, listas e diálogos.

| Atalho | Comando | Regra |
|---|---|---|
| V | Inspecionar | Mostra contexto de geração; não apaga configurações de edição. |
| B | Pincel | Restaura último pincel não vazio e sua sessão. |
| E | Borracha | Ativa paint com vazio #84; segunda pressão continua borracha, sem alternância oculta. B retorna ao pincel. |
| R | Girar | Usa tamanho/alcance visíveis. |
| S | Carimbo | Restaura captura se existir; sem captura entra automaticamente em Capturar. |
| C | Capturar para carimbo | Inicia captura; Escape cancela sem perder captura anterior. |
| F | Preservar | Estado e alcance visíveis. |
| Shift+F | Limpar preservações | Uma ação reversível no histórico; feedback com quantidade. |
| H | Mão | Navegação persistente. |
| Espaço mantido | Mão temporária | Ao soltar restaura ferramenta/preview anterior. Não pode pintar ao terminar o pan. |
| Z | Zoom | Clique aproxima; Alt+clique afasta quando no Zoom. Não conflitar com captura no Carimbo. |
| 1 / Shift+1 | 100%, centralizado | Preservar contrato canônico. |
| 0 | Ajustar à janela | Não alterar dimensões do documento. |
| Q / Shift+Q | Próximo/anterior alcance | Seis escopos existentes; mostrar nome, não número técnico. |
| Tab / Shift+Tab | Alias de alcance | Só com foco explícito no canvas em edição; em controles sempre navega foco. Não recolher dock no gerador por Tab. |
| Ctrl+U | Encaixar nos blocos | Não alterar silenciosamente outra ferramenta; mostrar alteração de tamanho se a regra atual exigir. |
| Shift mantido | Inverter encaixe temporariamente | Ligado vira desligado e vice-versa; soltar restaura. |
| + / − | Tamanho da ferramenta | Só no canvas de edição; valor e preview atualizam. |
| [ / ] | Girar pincel/carimbo | Preservar orientação D4 e sessões independentes. |
| G | Gerar | Respeita preservações e proteção de edições; sem repetição automática por tecla mantida. |
| X | Trocar cores | Sem Ctrl/Meta/Alt; transação única, mesmo comando do botão. |
| A / Shift+B / M / O | Guias | Eixos / blocos / grade de peças / órbitas; não executam no ambiente vetorial. |
| Ctrl+Z / Ctrl+Shift+Z | Desfazer / refazer | Alvo mosaico explícito. Ctrl+Y pode permanecer alias de compatibilidade. |
| Ctrl+E | Editar peças / voltar | Fora de formulário/modal; botão oferece o mesmo resultado. |
| ? | Ajuda e atalhos | Por contexto; não altera documento. |

Aliases Ctrl+1/Ctrl+0 já existentes devem ser inventariados antes de mudança. Não ampliar atalhos que disputem ações reservadas do navegador. O conjunto canônico anunciado é 1/Shift+1/0; retirar alias legado só com teste de regressão e atualização de ajuda.

### 6.3 Editor de peças

| Atalho | Alvo e regra |
|---|---|
| V / A / P / M / L / G / U / barra invertida | Selecionar / Editar pontos / Caneta / Retângulo / Elipse / Polígono / Arco / Linha. Letras não acionam comandos do mosaico. |
| H / Espaço / Z / 1 / Shift+1 / 0 | Navegação, com o mesmo significado visual do mosaico. |
| Ctrl+C / Ctrl+V | Copiar/colar formas quando seleção/documento permitirem. Campos mantêm clipboard normal. |
| Ctrl+D | Duplicar formas selecionadas. Sem seleção, não criar família silenciosamente. |
| Ctrl+A | Selecionar formas editáveis/visíveis; em campo, selecionar texto. |
| Delete / Backspace | Excluir seleção editável; um passo de undo. Em campo, edição normal. |
| Ctrl+Z / Ctrl+Shift+Z | Histórico da família ativa, anunciado no tooltip; Ctrl+Y permanece alias de refazer. |
| Ctrl+U | Alternar encaixe na grade da peça; `;` permanece alias legado. Não aciona encaixe nos blocos do mosaico. |
| [ / ] | Variante anterior/próxima da família, conforme comportamento atual; não confundir com giro do pincel do mosaico. |
| Shift mantido | Restrições geométricas atuais: eixo/diagonal, proporções e incrementos angulares conforme gesto. Não inverter o encaixe vetorial por Shift; essa inversão pertence ao mosaico. |
| Ctrl+] / Ctrl+[ / com Shift | Ordem das formas, preservando os atalhos atuais; ações visíveis oferecem alternativa. |
| Enter | Concluir caminho aberto válido da Caneta. |
| Escape | Primeiro cancela gesto/sessão não confirmada; depois limpa seleção. Sem gesto/seleção, mantém ambiente e pode devolver foco à ferramenta ativa; sair usa botão Voltar ou Ctrl+E. |
| Tab | Navegar controles; setas/Home/End navegam abas conforme implementação existente. |

Mudanças deliberadas de UX: E deixa de alternar ocultamente entre pincel/borracha; Ctrl+D deixa de duplicar família sem seleção; Escape deixa de confirmar caminho e de sair do editor por pressões sucessivas. Atualizar testes, tooltip e ajuda desses comportamentos juntos; não apresentar a alteração como correção matemática.

### 6.4 Gestos

| Contexto | Gesto | Resultado |
|---|---|---|
| Mosaico / Pincel | Arrasto esquerdo | Um traço, uma transação; preview representa alcance. |
| Mosaico / Pincel | Botão direito | Girar orientação +90°, conforme função atual; impedir menu de contexto somente no canvas pertinente. |
| Mosaico / Girar | Esquerdo / direito | +90° / −90°. Modo variante deve ser explicitamente selecionado. |
| Mosaico / Carimbo | Arrasto em Capturar | Preview retangular; soltar confirma captura; não pinta no mesmo pointerup. |
| Mosaico / Pincel, Carimbo ou Inspecionar | Alt+arrasto | Captura de região, preservando o comportamento atual; não documentar como Pan nem ampliar para Girar/Preservar. |
| Navegação | Espaço+arrasto / botão do meio | Mover vista sem modificar obra. |
| Canvas | Ctrl+roda | Zoom ancorado no cursor, limites e consistência entre ambientes. |
| Canvas, exceto ferramenta Zoom | Roda livre / trackpad | Pan pelos deltas nativos nos dois ambientes. Não alterar tamanho da ferramenta nem dar zoom automaticamente ao entrar em peças. |
| Canvas | Shift+roda | Pan horizontal com roda vertical; preservar deltas nativos de trackpad quando já houver dois eixos. |
| Canvas, sem Ctrl/Meta e fora de Zoom | Alt+roda | Alias legado de pan vertical, mantido. Alt+arrasto continua captura apenas nos contextos definidos acima. |
| Canvas / Zoom ativo | Roda livre | Zoom; exceção explícita por ferramenta, com cursor de Zoom. Ctrl/Meta+roda também dá zoom. |
| Mosaico / Preservar | Clique/arrasto direito | Ação inversa do modo selecionado: Preservar vira Liberar e vice-versa, monotônica durante o arrasto. |
| Biblioteca | Clique principal | Selecionar família; ações irmãs não selecionam/duplicam incidentalmente. |
| Camadas | Clique / Shift+clique | Seleção / adição ou remoção; lista e canvas refletem a mesma seleção. |

**Mudança deliberada da roda:** a implementação atual usa roda livre para tamanho no mosaico e para zoom em peças. O destino acima padroniza navegação entre ambientes. Tamanho continua rápido por +/− e pelo campo do dock; não remover os helpers de tamanho se ainda forem úteis para controles. T10 implementa essa política e atualiza os testes do comportamento anterior com justificativa, sem enfraquecer invariantes.

No editor vetorial, o comportamento atual permite suspender encaixe por Meta durante certos gestos (`core/vector_editor.js:2075`, `:2353`). É um detalhe legado, não o atalho principal anunciado no Windows. O botão Encaixe e Ctrl+U devem oferecer operação completa; não atribuir Shift/Ctrl a um novo bypass sem verificar conflitos com seleção e restrições geométricas.

## 7. Estados, mensagens e recuperação

### 7.1 Salvamento

Documento e biblioteca podem ter operações assíncronas separadas, mas devem usar a mesma linguagem:

| Estado | Texto | Regra |
|---|---|---|
| Alteração pendente | Salvando… | Enquanto durabilidade ainda não foi confirmada. |
| Ao menos um backend íntegro confirmou o estado atual | Salvo neste navegador | Não afirmar que foi salvo em arquivo ou nuvem. |
| Cache reduzido / histórico truncado | Desenho salvo; histórico reduzido | Explicar exatamente o que foi preservado. |
| Nenhum backend confirmou | Não foi possível salvar | Aviso persistente e ação disponível para proteger o conteúdo. |
| Nova gravação íntegra após erro | Salvo neste navegador | Remover aviso obsoleto só após confirmação, não ao tentar novamente. |

Associar cada pedido a uma revisão para que uma gravação antiga concluída fora de ordem não anuncie sucesso do documento mais recente. Também garantir ordenação de escrita por destino ou revisão persistida: uma escrita antiga não pode sobrescrever dados mais recentes. Testar pedidos A/B com conclusões B/A e recarregar para recuperar B.

Documento e biblioteca são escopos de durabilidade separados. Um status global “Salvo neste navegador” exige confirmação da revisão atual de **todos os escopos alterados**; sucesso do mosaico não oculta falha da biblioteca. Se cache reduzido e IndexedDB íntegro confirmam a mesma revisão, o resultado é íntegro; “histórico reduzido” só se aplica se nenhuma cópia íntegra daquela revisão foi salva. Não engolir falha do localStorage ou tratar `indexedDB !== undefined` como sucesso. Não serializar informações técnicas no texto comum da interface; detalhes podem existir em Ajuda/diagnóstico.

Backup JSON existente protege a biblioteca. Ele não deve ser descrito como backup completo do mosaico editável. Caso não exista exportação de projeto completo, informar o limite e abrir tarefa separada para esse formato; não inventar suporte neste redesenho.

### 7.2 Mensagens concretas

| Situação | Texto sugerido |
|---|---|
| Nova semente, sem mudança de grade | “Gerar novamente pode substituir seus ajustes. As áreas preservadas serão mantidas.” Botões “Cancelar” e “Gerar novamente”. |
| Reduzir grade/subdivisão com preservações afetadas | “N preservações não cabem na nova grade e serão removidas.” Botões “Cancelar” e “Alterar grade”. Calcular N antes de confirmar; Desfazer restaura grade e preservações. Não prometer manutenção de todas as áreas nesse cenário. |
| Família padrão | “Peça padrão protegida. Crie uma cópia para editar.” A ação principal fica no topo. |
| Filtro limpo ao duplicar | “Cópia criada. A busca foi limpa para mostrar o resultado.” |
| Carimbo vazio | “Arraste uma região para capturar.” |
| Preservação | “12 peças preservadas na geração.” |
| Simetria estrita reduzida por edição | “Este ajuste reduziu a simetria da composição.” Oferecer Desfazer; detalhes D4 no popover. |
| Biblioteca sem resultado | “Nenhuma família encontrada.” Ação “Limpar busca”. |
| Falha total de biblioteca | “Não foi possível salvar a biblioteca neste navegador. Exporte um backup para proteger seus desenhos.” |
| Falha total de mosaico | “Não foi possível salvar o mosaico neste navegador.” Oferecer tentativa e exportação PNG/SVG com escopo explicado; não prometer recuperação editável por imagem. |
| Spout sem bridge | “Sem conexão com a saída local.” Ação “Como conectar”. |

Mensagens curtas não devem encobrir estado importante com toast transitório. Falha de salvamento persiste até recuperação/decisão; confirmações comuns podem sumir e ser anunciadas discretamente por aria-live polite. Não anunciar cada frame, mousemove ou porcentagem de zoom contínua.

## 8. Backlog executável

Baseline de todas as tarefas: alterações locais existentes preservadas, suíte atual passando, plano ainda não aplicado. Os testes novos devem demonstrar comportamento que poderia falhar; evitar testes que apenas procuram nomes de funções no fonte.

### T01 — Fixar baseline e mapa de ações

**Prioridade:** P1 · **Depende de:** nada · **Cobre:** preparação para UX-01 a UX-40.

Arquivos: runner de testes, `sketch.js::initStudioUI`, `core/subtile_studio_ui.js::handleKeyDown`, `ui_info.js` e registro de controles.

1. Salvar status do checkout e saída dos testes, sem reset/checkout sobre mudanças locais.
2. Enumerar ações por ambiente: nome, botão/ID, tecla, alvo, disponibilidade, alteração de documento ou navegação.
3. Inventariar listeners duplicados e aliases. Usar a tabela da seção 6 como política de destino.
4. Registrar capturas reais de gerador/pincel/carimbo/preservação/editor em tamanhos de referência. Capturas futuras devem ir à pasta de evidências do projeto, com viewport/zoom informados.

**Aceite:** baseline reproduzível, cada ação principal com um destino identificado. Não alterar UI nesta tarefa. Teste existente: `node tests/run_all.js`.

### T02 — Isolar modais e corrigir roteamento de teclado

**Prioridade:** P1 · **Depende de:** T01 · **Cobre:** UX-01, UX-02, UX-09, UX-10, UX-11, aviso de UX-39.

Arquivos/símbolos: `sketch.js` listener keydown em `initStudioUI`, `requestParamChangeWithGuard`, `closeDirtyGuard`; `core/subtile_studio_ui.js::enterModal` e saída correspondente.

1. Expor/reutilizar um estado comum de modal e ciclo de foco. Não criar apenas um segundo booleano desconectado.
2. Aplicar inércia do fundo, Tab cíclico, Escape cancela, restauração ao acionador. Evitar tornar o próprio diálogo inerte.
3. Colocar guarda de modal antes de X e de qualquer comando de documento/ambiente.
4. Reconhecer modificadores exatos, contenteditable, IME, evento já consumido e repetição de comandos discretos.
5. X sem modificadores chama a ação de troca; Ctrl+X/Alt+X não trocam cores. Não implementar recorte vetorial novo apenas para corrigir Ctrl+X.
6. Tab fora do canvas navega foco; no canvas de edição preserva alias de escopo; no gerador não recolhe mais dock. Setas em widgets não navegam gerações.
7. Diferenciar nova semente e mudança de topologia na proteção de edições. Antes de reduzir grade/subdivisão, calcular preservações que deixam de caber e informar a remoção; não usar promessa genérica de manter todas.
8. Tornar área de trabalho focável com nome claro e uma única parada. Depois de cancelar eventual gesto, Escape devolve foco à ferramenta ativa; Tab deixa de ficar capturado. Testar entrada por teclado e saída, não apenas clique.

**Teste comportamental novo:** abrir dirty guard; disparar X/G/Ctrl+Z/Ctrl+E de cada botão; documento, geração e ambiente permanecem iguais. Escape fecha sem aplicar. Fechar retorna foco. Em contenteditable, letras/clipboard não atingem canvas. X executa uma vez; Ctrl+X zero. Tecla G mantida gera uma vez.

**Teste de navegador:** percorrer todos os diálogos com Tab/Shift+Tab; fundo não recebe cliques/teclas; leitor de árvore identifica título e ação. Reusar cobertura de `test_dirty_guard.js`, `test_info_aria.js` e testes de Subtiles quando pertinente; não enfraquecer contratos para acomodar falha.

### T03 — Tornar borracha, pincel e carimbo previsíveis

**Prioridade:** P1 · **Depende de:** T02 · **Cobre:** UX-03, parte UX-37.

Arquivos/símbolos: `sketch.js::selectBrushTile`, `activateStudioTool`, `currentBrushSession`, `beginCloneCapture`, `cancelCloneCapture`, ramo E/B/S do teclado e sincronização do dock.

1. Criar ação `activateEraser` ou equivalente; entrar em paint antes de escolher #84.
2. Manter uma sessão do último pincel não vazio e uma do carimbo. Não substituir a captura ao escolher borracha. Ao ativar carimbo sem captura, entrar automaticamente no estado Capturar; depois de capturar, mudar para Aplicar.
3. E sempre seleciona borracha; B restaura pincel; S restaura carimbo. Estado visual deve identificar Borracha mesmo sem oitavo botão registrado.
4. Cancelar captura/gesto temporário ao trocar ferramenta, sem confirmar pintura por pointerup residual.
5. Botão, tecla e paleta chamam ações compartilhadas; feedback deve refletir ferramenta real.

**Reprodução/aceite:** capturar 2×2 → E → preview #84 → arrastar apaga → S restaura captura 2×2 → B restaura último pincel. Repetir E não volta ao pincel. Ctrl+Z restaura apagamento. Testar com seis escopos, borda e encaixe, sem modificar a álgebra.

**Verificação:** `test_brush_sizing_snap.js`, testes de edição D4 e regressão nova exercitando a sequência, mais teste visual. Se percurso atual não reproduzir, registrar antes de modificar.

### T04 — Publicar o estado real de salvamento

**Prioridade:** P1 · **Depende de:** T01 · **Cobre:** UX-04, UX-05, parte UX-36.

Arquivos/símbolos: `sketch.js::saveStudioStateToStorage`, `flushSaveStudioStateToStorage`; `core/library_store.js::persistCurrentDoc`, `commitDoc`; `core/state_persistence.js`; aviso/status existente.

1. Fazer cada backend devolver resultado explícito: íntegro, reduzido ou falha, com revisão correspondente.
2. Agregar estado do documento e da biblioteca sem substituir sucesso novo por erro antigo nem vice-versa. O estado global só é íntegro quando todos os escopos alterados confirmam suas revisões atuais.
3. Usar mensagens da seção 7; falha total persistente, fallback com informação exata sobre redução.
4. Oferecer ações realmente existentes: tentar salvar, backup da biblioteca, exportar mosaico. Diferenciar durabilidade de imagem exportada.
5. Não mudar schema/chaves nem introduzir login/servidor/sincronização em nuvem.
6. Serializar gravações por backend/destino ou proteger a revisão persistida, além do feedback. Pedido antigo concluído depois não pode substituir o conteúdo novo recuperado no próximo boot.

**Matriz de teste:** LS ok/IDB ok; LS falha/IDB ok; LS ok/IDB falha; ambos falham; IDB ausente/LS falha; cache reduzido/IDB íntegro; recuperação posterior; callbacks fora de ordem; documento salvo/biblioteca falhando. Pedidos A/B, conclusão B/A, recarregar recupera B. Nenhum cenário de falha total pode anunciar Salvo; cache reduzido com cópia IDB íntegra não deve anunciar perda de histórico.

**Verificação:** testes de persistência, quota, scheduler, IndexedDB e biblioteca; teste novo com rejeição real das Promises simuladas. O teste deve verificar mensagem/estado final, não apenas console.

### T05 — Completar desfazer para alterações do documento

**Prioridade:** P1 · **Depende de:** T02, T03, T04 · **Cobre:** UX-06, parte UX-10, recuperação de UX-39.

Arquivos/símbolos: `core/document_snapshot.js`, `sketch.js::pushEditHistorySnapshot`, `undoMosaicEdit`, `redoMosaicEdit`, handlers de cor/padding/dimensões, geração e restauração.

1. Listar mutações: células, preservações, cor, tamanho de prancheta, margem, espaçamento, grade e simetria. Definir quais já usam snapshot para não duplicar passos. No editor de peças, incluir recorte aos limites (`clipToTile`) na transação da família, pois afeta renderização e exportação, não apenas preview.
2. Ampliar parâmetros com largura/altura e cores de forma opcional. Snapshot antigo sem campo usa estado/restauração compatível e não zera o documento.
3. Iniciar transação antes da primeira mudança real; commit ao terminar gesto/confirmar campo. Preview de cor/slider não gera dezenas de entradas.
4. Cancelamento restaura estado anterior e não acrescenta undo. No-op não cria entrada.
5. Undo/redo restaura campos, valores da UI, geometria, preview e saída limpa; nova edição invalida redo.
6. Navegação, foco, filtro, seleção e zoom ficam fora do histórico do documento.

**Aceite:** cor → undo/redo; X → undo/redo; padding → undo/redo; dimensão → undo/redo; gesto de 30 eventos → um undo; geração após edição → undo volta com parâmetros corretos; payload antigo restaura. Reduzir grade/subdivisão com preservação na borda informa remoção; undo restaura topologia e preservações. Preservar orçamento e limites existentes.

**Verificação:** `test_document_snapshot.js`, `test_multistep_undo.js`, `test_regeneration_capture.js`, testes de histórico/persistência e regressões comportamentais novas. Esta é a tarefa mais sensível; não misturar com refatoração ampla de UI.

### T06 — Unificar ações, ajuda e nomes de comandos

**Prioridade:** P2 · **Depende de:** T02, T03 · **Cobre:** UX-07 a UX-11, UX-16, UX-17, UX-23.

Arquivos: `sketch.js`, `core/subtile_studio_ui.js`, `ui_info.js`, `core/ui_format.js`, `index.html`. Um módulo pequeno de ações/metadados pode ser criado se reduzir duplicação; não adicionar framework.

1. Centralizar nome, atalho, contexto, disponibilidade e callback das ações principais. UI e ajuda devem consumir a mesma definição quando possível.
2. Aplicar glossário sem alterar IDs ou conteúdo do usuário.
3. Ctrl+D só duplica formas. Em padrão protegido, apontar à ação visível Criar cópia editável; sem seleção custom, feedback curto “Selecione formas para duplicar”.
4. Enter conclui Caneta; Escape cancela a sessão não confirmada. Não sair do editor por Escape sem seleção. Troca de ferramenta pode manter conclusão de caminho válido já definida pelo editor, mas precisa ser documentada e não confirmar mero preview de arrasto.
5. Corrigir Shift/Alt e alvo de undo nos tooltips. Manter letras contextuais distintas dos dois ambientes.

**Aceite:** botão/atalho/ajuda concordam; Ctrl+D sem seleção não cria família; Escape não grava caminho em andamento; Ctrl+E e Voltar preservam sessão do mosaico; G em peças continua Polígono, A continua pontos.

### T07 — Consolidar tokens e componentes visuais

**Prioridade:** P2, com correção P1 dos tokens inválidos · **Depende de:** T01 · **Cobre:** UX-12, UX-13, UX-14, UX-15, UX-22, UX-23.

Arquivos: `style.css`, ícones e classes existentes em `index.html` e UI gerada.

1. Definir ou substituir todos os tokens não resolvidos identificados. Verificar referências CSS com valores computados.
2. Aplicar escala da seção 5 a botão, campo, toggle, menu, aba, tooltip, toast e aviso. Evitar adicionar uma camada final de overrides para cada caso; consolidar regras concorrentes do componente afetado.
3. Substituir glifos de comando por SVG coerente; manter nome acessível.
4. Legibilidade antes de densidade: aumentar texto funcional e alvo de ações pequenas; reduzir repetição/caixas para compensar espaço.
5. Uniformizar hover/ativo/foco/desabilitado/erro; preservar diferença entre foco e seleção.

**Aceite visual:** mesmas dimensões e estados em gerador/pincel/editor/listas; nenhum token sem definição; tooltip não corta atalho; contraste calculado dos pares reais; captura antes/depois no mesmo viewport e zoom.

### T08 — Corrigir nomes acessíveis e foco dos controles

**Prioridade:** P1 · **Depende de:** T07 · **Cobre:** UX-24, UX-25, UX-26, UX-30.

Arquivos: inputs do topo em `index.html`; campos de `renderShapePropsPanel`; regras `.vec-prop-field`; buscas.

1. Label associado para cada campo; nome completo e unidade. Preservar IDs legados.
2. Gerar IDs estáveis de propriedades ou envolver input em label. Não gerar colisões ao trocar família/seleção.
3. Corrigir cascata de focus-visible após regras que removem outline; não desligar outline globalmente.
4. Nomear buscas independentemente do placeholder; botão Limpar acessível e quantidade de resultados.
5. Implementar confirmação/cancelamento numérico sem aceitar NaN/infinito/dimensões inválidas; usar limites do domínio atual.

**Aceite:** árvore acessível identifica largura em px, altura em px, linhas, colunas, margem, espaçamento e coordenadas; Tab mostra foco em todos; Escape numérico restaura sem alteração; buscar e limpar não dispara atalhos do canvas.

### T09 — Simplificar o gerador e a seleção de peças

**Prioridade:** P2 · **Depende de:** T06, T07, T08 · **Cobre:** UX-16, UX-17, UX-20, UX-21.

Arquivos/símbolos: geração em `index.html`, `sketch.js::buildSymmetryPanelUI`, `renderSwatchesPanel`, formatadores e ajuda.

1. Rótulo Simetria da composição. Manter quatro opções com nome e miniatura consistentes; descrição matemática no popover.
2. Simetria do bloco mostra Igual à composição por padrão somente em documento novo; documento restaurado mantém e apresenta a opção independente salva. A lista independente é progressiva, preservando controles existentes e sem resetar dados ao abrir painel.
3. Mostrar “Bloco com N×N peças”, sem trocar o significado do valor de subdivisão. Não confundir botão 2×2 por quadrante com bloco total 2×2.
4. Peças permitidas: família selecionável com estado total/parcial/vazio e contador compreensível. Variantes em segundo nível; expandir ao solicitar ou buscar.
5. Isolar é explícito e reversível; todos/nenhum/inverter atuam no escopo claramente anunciado. Antes de mudar esse escopo, localizar a semântica atual e manter consistência entre nome e efeito.
6. Busca inclui famílias/peças e revela correspondências. Não duplicar biblioteca de edição dentro do gerador.
7. Gerar e semente permanecem visíveis à esquerda; não mostrar botão secundário de Gerar em cada seção.

**Aceite:** uma pessoa consegue gerar usando só quatro decisões de primeiro nível: simetria, grade/dimensão, peças, Gerar. No caso padrão, não precisa abrir opções internas D4. Seleção parcial não parece família desabilitada.

### T10 — Padronizar propriedades das ferramentas rápidas

**Prioridade:** P2 · **Depende de:** T03, T06, T07 · **Cobre:** UX-20, UX-21, UX-37, UX-40.

Arquivos/símbolos: `sketch.js::syncEditWorkspaceUI`, `getToolSizeInfo`, `syncCanvasCursor`, preview/hover e painéis da edição no HTML.

1. Ordem fixa: ferramenta/tile ou captura → tamanho → alcance da simetria → encaixe → opções avançadas.
2. Mesmo componente para tamanho e alcance nas ferramentas que compartilham comportamento; valores por sessão devem sobreviver à troca de ferramenta.
3. Explicar os seis escopos com rótulo curto e ajuda. Manter IDs/semântica atuais, sem reduzir opções matemáticas.
4. Preview no canvas representa footprint e propagação reais. Diferenciar região de origem, cópias simétricas e áreas preservadas sem ocultar a obra.
5. Status compacto: “Pincel · 2×2 · Dentro do bloco · Encaixe ligado”. Inspeção detalhada aparece por solicitação/hover, sem repetir texto longo permanente.
6. Carimbo distingue Capturar e Aplicar; Preservar distingue Preservar e Liberar. Não usar o mesmo estilo/label para estados opostos.
7. Padronizar a roda conforme seção 6.4: pan nos dois ambientes, Ctrl/Meta+roda ou Zoom ativo para zoom. +/− e campo continuam alterando tamanho. O handler do canvas não intercepta roda de painéis/listas; manter Shift+roda horizontal e Alt+roda vertical. Atualizar tooltip/ajuda e testes da mudança deliberada.

**Aceite:** preview e área modificada coincidem nos seis escopos, bordas e encaixe invertido; Mão/Zoom não resetam painel nem ferramenta anterior; operação gera um undo; preservações continuam funcionando entre gerações. Roda livre navega igual nos dois ambientes e não altera tamanho; Ctrl+roda ancora zoom no cursor; +/− mantém controle rápido de tamanho no mosaico; listas rolam normalmente.

### T11 — Tornar histórico e exportação compreensíveis

**Prioridade:** P2 · **Depende de:** T04, T05, T06 · **Cobre:** UX-10, UX-19, UX-36.

Arquivos: histórico/seed/exportação em `index.html`, `sketch.js::restoreGenerationHistory`, `syncEditUndoUI`, handlers de exportação.

1. Manter histórico recolhido e navegação anterior/próxima junto à semente; estado atual selecionado e rótulos completos.
2. Desfazer no mosaico e Geração anterior são comandos distintos, com tooltip indicando alvo; não fundir pilhas como atalho de implementação.
3. Não navegar gerações por setas disparadas em botão, aba, lista ou formulário não relacionado. Na lista de gerações, setas seguem a seleção local.
4. Rotular Exportar mosaico; formato PNG/SVG existente. Depois da exportação, feedback não afirma salvamento editável.
5. Backup da biblioteca identifica JSON/biblioteca e sai da leitura visual de exportar arte; acesso rápido pode permanecer secundário/recolhido.
6. Preservar buffers nativos limpos. Não inserir guias, seleção ou margem de preview na saída.

**Aceite:** gerar A → editar → gerar B → voltar A mantém edição conforme contrato; undo/redo alvo correto; PNG/SVG mantêm dimensões e aparência sem zoom/guias; lista/ícones não disparam downloads duplicados.

### T12 — Remover redundância no editor de peças

**Prioridade:** P2 · **Depende de:** T06, T07 · **Cobre:** UX-18, UX-19, UX-21.

Arquivos: topo e ações SVG/biblioteca em `index.html`; `renderShapePropsPanel` e init das abas em `core/subtile_studio_ui.js`.

1. Uma ação Criar cópia editável no topo para família protegida. Aviso e propriedades explicam proteção sem repetir outro grande botão.
2. Duplicar família customizada é ação de biblioteca. Duplicar formas é ação da seleção.
3. SVG da peça tem acesso canônico na seção de arquivo do editor à esquerda; comandos duplicados em Camadas são removidos da apresentação ou recolhidos como aliases, após conferir registro legado.
4. Biblioteca completa fica na aba Biblioteca existente. O acordeão lateral pode ser acesso compacto/atalho para essa aba, não segunda árvore completa.
5. Arquivos/backup não ocupam vários lugares expandidos. Manter backup rápido secundário se ajudar recuperação de erro.
6. Mover detalhes D4 para Variantes/ajuda; status usa nome da família, ferramenta e zoom.

**Aceite:** em cada contexto há uma ação principal para copiar padrão; import/export anuncia peça; abas continuam navegáveis; nenhum ID congelado foi apagado/duplicado; seleção de aba não muda inesperadamente ao editar.

### T13 — Corrigir interação de biblioteca e camadas

**Prioridade:** P1 foco, P2 densidade · **Depende de:** T07, T08, T12 · **Cobre:** UX-14, UX-27, UX-28, UX-29, UX-31.

Arquivos/símbolos: `core/subtile_studio_ui.js::renderLibraryManagerTree`, `renderLayersPanel`, `handleDuplicateFamily`, `revealLibraryItems`. Não usar `renderAssetFamilyList` de `_legacy/sketch.js` como implementação atual.

1. Substituir row interativa aninhada por listitem/grupo com botão de seleção principal e controles irmãos. Não usar role=option com botões internos sem padrão composto adequado.
2. Seleção e foco têm identidade estável: família/forma + ação. Se reconstruir, restaurar foco e scroll pelo ID; quando item some, focar vizinho ou cabeçalho.
3. Ações frequentes visíveis; renomear/mover/duplicar/excluir em menu Mais de alvo confortável. Visibilidade e trava de camada continuam acessíveis diretamente.
4. Alternativa de teclado a drag-and-drop continua disponível. Reordenação confirma posição e preserva foco na ação/linha.
5. Após duplicação, reutilizar revelação de criação: limpar busca/filtro incompatível com mensagem, abrir Biblioteca, selecionar/rolar/focar cópia.
6. Não apagar filtros silenciosamente ao selecionar uma família existente. Apenas ação que cria item pode revelar resultado e anunciar mudança de filtro.

**Aceite:** buscar termo incompatível → duplicar → cópia visível/focada; Enter seleciona e mantém foco; renomear duas famílias seguidas por teclado; mover camada repetidamente sem cair no body; ações não selecionam outra linha; excluir move foco para vizinha. DnD e botões produzem mesma ordem.

### T14 — Ajustar responsividade sem miniaturizar a UI

**Prioridade:** P2 · **Depende de:** T07 a T13 · **Cobre:** UX-33, UX-34, parte UX-35.

Arquivos: breakpoints e larguras em `style.css`; topo/status/dock em `index.html`.

1. Medir primeiro overflow real. As hipóteses UX-33/34 não são bugs reproduzidos nesta auditoria.
2. Em largura compacta, topo pode usar duas linhas: prancheta/grade na primeira, margem/espaçamento na segunda. Preservar controles na superfície correta.
3. Dock mantém larguras coerentes por ambiente e gaveta 44px. Usar recolhimento existente; não criar painel sobreposto que esconda botões sem saída clara.
4. Status prioriza zoom, ferramenta/alcance e erro de salvamento. Detalhes de coordenadas/órbita podem ir ao popover; falha de salvamento nunca pode sumir por breakpoint.
5. Se grupos de status precisarem quebrar linha, recalcular área útil do viewport. Não encobrir obra com barra de altura não contabilizada.
6. Aumentar fonte/zoom do navegador não pode exigir precisão de alvo de 19px. Listas têm rolagem vertical própria com cabeçalho/ação acessíveis.

**Matriz:** 1920×1080, 1440×900, 1366×768, 1280×800, 1024×768 a 100%; 1280×800 a 125%; 1440×900 a 200%. A 200% admite reorganização/rolagem vertical, mas não perda de funções/foco.

**Aceite:** sem overflow horizontal do documento, sem botões sobrepostos, todos os controles acessíveis, erro visível e canvas navegável. Verificar `scrollWidth <= clientWidth` no documento e no topo quando houver acesso DOM; captura sozinha não comprova a medida.

### T15 — Compactar Spout e completar feedback contextual

**Prioridade:** P2 · **Depende de:** T04, T07, T14 · **Cobre:** UX-35, UX-36, UX-38.

Arquivos: status em `index.html`, `sketch.js::syncSpoutUI`, ajuda e UI de persistência.

1. Spout desligado: nome/status compacto e controle de ativação. Nome da saída/configuração expande no mesmo agrupamento/popover ao solicitar.
2. Manter `spoutToggle` e `spoutName` únicos. Campo escondido não recebe foco; ativar restaura nome anterior.
3. Estados: Desligado, Conectando, Conectado, Sem conexão. Erro oferece instrução local sem jargão de WebSocket no texto principal.
4. Dica inicial dispensável com três ações do fluxo de mosaico. Não abrir modal de tour, não bloquear canvas e não repetir em todo reload.
5. Usar aria-live para mudanças relevantes, sem anunciar frames/mousemove.

**Aceite:** controles compactos não desconectam saída ao fechar popover; troca de ambiente não interrompe o mosaico transmitido; nome persistido; falha e reconexão compreensíveis. Integração real usa skill `spout-bridge-runner` quando for executar/depurar o bridge; não alegar teste GPU apenas com mocks.

### T16 — Reduzir trabalho global da biblioteca com medição

**Prioridade:** P2 após UX principal · **Depende de:** T13 · **Cobre:** UX-32.

Arquivos/símbolos: `core/library_store.js::updateFamily`, `commitDoc`, `core/library_compiler.js::compileLibrary`, refresh da UI.

1. Medir renomear, reordenar, alterar campo e arrastar forma, com biblioteca padrão e cenários de 150/300 famílias customizadas. Registrar hardware/quantidade real de variantes.
2. Ignorar atualizações sem mudança; não compilar geometria para nome/ordem/grupo quando não afetam catálogo/remap.
3. Separar atualização de metadados e geometria com invalidação correta. Não pular libraryRevision quando assinantes precisam de novo rótulo/ordem.
4. Atualizar painéis necessários e preservar foco. Só depois considerar cache por assinatura geométrica/família.
5. Não adiar persistência indefinidamente por otimização. Preservar flush e recuperação.

**Aceite:** no-op não compila; renomear não recompila geometria; edição geométrica produz mesmas variantes/remap do compilador integral; resultado/export/geração matematicamente iguais. Meta inicial: feedback local no próximo frame e operação discreta comum ≤100ms na máquina medida; se não atingida, documentar medições e próximo gargalo.

### T17 — Consolidar documentação viva e encerrar regressões

**Prioridade:** P2 · **Depende de:** tarefas implementadas do lote · **Cobre:** DOC-01 a DOC-09.

Arquivos: `README.md`, `docs/MANUAL_MANUTENCAO.md`, `docs/README.md`, ajuda, testes de docs; skill gate somente para corrigir contagem, respeitando política de edição do ambiente.

1. Reescrever seções de estado atual sem empilhar changelogs contraditórios. Relatórios históricos permanecem intactos.
2. Corrigir comando `.venv`, título do app, superfícies, Gerador visível/Histórico recolhido e descrição de 60 IDs legados.
3. Descrever atalhos por contexto e diferenças deliberadas de E/Ctrl+D/Escape/Tab; ajuda usa mesmos metadados das ações.
4. Remover contagens repetidas de suítes ou derivá-las do runner. Toda a lista deve passar; não exigir artificialmente um número antigo.
5. Registrar o que foi implementado, adiado ou já resolvido no quadro abaixo, com teste/evidência. Não chamar proposta de comportamento entregue.
6. Executar gate, sincronização e revisão visual final do fluxo prioritário.

**Aceite:** um modelo que lê apenas entrada atual + manual + plano encontra uma regra única por ação, sem precisar decidir qual rodada histórica seguir. Links locais válidos; código e documentação concordam.

## 9. Sequência de entrega

| Lote | Tarefas | Resultado verificável |
|---|---|---|
| A — Integridade da interação | T01, T02, T03, T04 | Sem ação atrás de modal, Ctrl+X correto, borracha previsível, falha de salvamento visível. |
| B — Recuperação e consistência | T05, T06 | Undo cobre alterações comuns; ações/atalhos/ajuda têm política única. |
| C — Fluxo principal | T07, T08, T09, T10, T11 | Gerar e ajustar com interface legível, contexto claro e exportação identificada. |
| D — Editor e telas compactas | T12, T13, T14, T15 | Redundâncias removidas, foco preservado, espaço bem usado, Spout discreto. |
| E — Desempenho e fechamento | T16, T17 | Atualizações locais eficientes, documentação coerente e gate final. |

T07 pode ser desenvolvido depois do baseline em paralelo às correções funcionais, desde que agentes não editem as mesmas regiões. T04 e T02 também são separáveis por responsabilidade. T05 exige atenção dedicada. Não iniciar otimização de compilador para adiar correções P1.

## 10. Roteiro final de aceite manual

Executar com dados de teste numa origem separada; não substituir a biblioteca criativa do usuário. Apagar dados reais ou restaurar padrão não é necessário para comprovar UX.

| Caso | Passos | Resultado esperado |
|---|---|---|
| QA-01 Geração rápida | Abrir → escolher família → Gerar → trocar semente | Obra atualiza, botão permanece alcançável, seleção e parâmetros são compreensíveis. |
| QA-02 Pincel e alcance | B → peça → tamanho → Q pelos seis escopos → pintar | Preview e resultado coincidem; um undo por traço. |
| QA-03 Borracha/carimbo | Capturar 2×2 → E → apagar → S → aplicar | Apaga vazio #84; captura recuperada intacta. |
| QA-04 Preservar | F → marcar → G → liberar região → G; depois reduzir grade com preservação na borda | Nova semente mantém preservadas; redução informa as que deixam de caber; undo restaura grade e preservações. |
| QA-05 Modais | Editar → alterar parâmetro destrutivo → X/G/undo/Tab | Fundo imóvel e inerte; foco contido; Cancelar conserva documento. |
| QA-06 Undo de aparência | Trocar cor → espaçamento → dimensão → desfazer/refazer | Cada gesto restaura documento e campos corretos. |
| QA-07 Histórico | Gerar A → pintar → gerar B → anterior/próxima | Alvo claro, edições preservadas conforme contrato, sem saltos por setas em widgets. |
| QA-08 Copiar padrão | Editar peças → padrão protegido → Criar cópia | Uma ação principal, cópia revelada e editável, canônico intacto. |
| QA-09 Caneta/Escape | Desenhar caminho não confirmado → Esc; repetir → Enter | Esc cancela; Enter conclui; ambiente não fecha inesperadamente. |
| QA-10 Biblioteca | Buscar → duplicar → renomear/reordenar por teclado | Resultado visível, foco/scroll estáveis, sem seleção incidental. |
| QA-11 Camadas | Tab → linha → Enter → mover duas vezes → alternar visibilidade | Foco não some; canvas/lista concordam; nenhuma ação de mosaico dispara. |
| QA-12 Exportação | Mosaico PNG/SVG, peça SVG, biblioteca JSON | Destinos corretos, buffers limpos, dimensões nativas; download não limpa undo. |
| QA-13 Salvamento | Falhar ambos backends → editar → recuperar gravação | Falha persistente e escopo claro; sucesso somente após confirmação da revisão atual. |
| QA-14 Navegação | Roda/trackpad, Shift+roda, Ctrl+roda nos dois ambientes; H/Espaço → trocar janela → voltar | Roda move vista, Ctrl+roda dá zoom, tamanho não muda incidentalmente; nenhum modificador preso, pintura residual ou reset de contexto. |
| QA-15 Layout | Matriz T14 em ambos ambientes e dock aberto/recolhido | Sem colisão ou função inacessível; texto e foco legíveis. |
| QA-16 Spout | Conectar bridge → editar mosaico → entrar em peças → desconectar | Saída limpa e estável; status correto; contexto de edição não troca a obra transmitida. |

QA-16 requer ambiente real e skill do bridge; registrar “não executado” se indisponível. Não substituir teste real por uma afirmação baseada em leitura do código.

## 11. Quadro de acompanhamento

Preencher ao implementar; todos os itens começam como planejados. “Já resolvido” exige referência à implementação e reprodução/teste atual.

| Tarefa | Estado inicial | Evidência necessária para concluir |
|---|---|---|
| T01 | Concluída em 27/10/2026 | [Baseline, mapa, 45/45 suítes e cinco capturas 1440×900](T01_BASELINE_E_MAPA_ACOES.md). |
| T02 | Planejada | Regressões de roteamento + foco modal real. |
| T03 | Planejada | Captura 2×2 → E → S e testes de edição. |
| T04 | Planejada | Matriz de backends, ordem de callbacks e recuperação. |
| T05 | Planejada | Undo por gesto, snapshot antigo e geração. |
| T06 | Planejada | Tabela de comandos refletida em UI/ajuda e testes. |
| T07 | Planejada | Tokens resolvidos, contraste e estados visuais. |
| T08 | Planejada | Nomes acessíveis, foco e campos inválidos. |
| T09 | Planejada | Fluxo de gerar sem abrir matemática avançada. |
| T10 | Planejada | Matriz de ferramentas/preview/alcance. |
| T11 | Planejada | Gerações editadas e quatro alvos de exportação. |
| T12 | Planejada | Uma ação principal por contexto; IDs preservados. |
| T13 | Planejada | Foco em listas e cópia sob filtro. |
| T14 | Planejada | Matriz de viewport/zoom com medidas. |
| T15 | Planejada | Feedback, saída compacta e conexão/reconexão quando disponível. |
| T16 | Planejada | Medição antes/depois e equivalência matemática. |
| T17 | Planejada | Docs coerentes, gate completo e conhecimento sincronizado. |

## 12. O que não adicionar neste plano

- Menus completos ou todos os atalhos do Illustrator apenas por semelhança visual.
- Painéis flutuantes personalizáveis, múltiplos documentos, novo framework ou sistema de plugins.
- Novos presets/famílias para compensar dificuldade de encontrar os existentes.
- Segundo modo de ferramenta, segundo gerador ou segundo catálogo completo.
- Nova migração de schema/IDs canônicos como consequência de mudança de rótulo.
- Formato de projeto editável novo sem inventário/contrato próprio. É uma oportunidade de produto separada, não um recurso já confirmado nesta auditoria.
- Testes que só verificam a existência de uma função e são apresentados como prova de fluxo completo.

## 13. Prompt de implementação para copiar

> Trabalhe no Tiling Stripes Studio seguindo `docs/ux/PLANO_IMPLEMENTACAO_UI_UX.md` e a auditoria associada. Priorize gerar mosaicos e fazer ajustes rápidos. Execute apenas a próxima tarefa planejada cujas dependências já estejam concluídas, começando por T01. Antes de buscar/ler fonte consulte Graphify usando o Python local disponível; preserve alterações locais. Implemente os critérios do cartão, não um redesenho genérico. Mantenha os 60 IDs legados, as quatro superfícies de controle, a álgebra D4, schema v3 e saídas limpas. Comprove o comportamento com testes adequados e interação real quando exigida. Aplique tiling-invariants-gate, rode todas as suítes, sincronize conhecimento, atualize o quadro e relate exatamente o que foi concluído ou permanece pendente. Não altere relatórios históricos nem declare como implementado algo que só foi planejado.
