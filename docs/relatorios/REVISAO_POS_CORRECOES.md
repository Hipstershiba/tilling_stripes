# Revisão pós-correções — Subtile Studio (27/10/2026)

**Base da revisão anterior:** `REVISAO_GEMINI_ARGON_SUBTILES.md`  
**Commits novos considerados:** `e703ba7`, `e077e4e`, `3914415`, `c3e9f33`  
**Working tree:** 6 arquivos modificados não commitados (`core/subtile_studio_ui.js`, `core/vector_editor.js`, `index.html`, `sketch.js`, `docs/MANUAL_MANUTENCAO.md`, `tests/test_subtile_review_regressions.js`)  
**Método:** leitura do diff, 45 suítes executadas individualmente, inspeção no Edge 155 headless via CDP em 1440×900 e 1280×800, medições de layout, interação real, teste de SVG e medição de desempenho. Nenhum código de produção foi alterado por esta revisão.

---

## 1. Veredito

**Houve melhoria substancial.** Os três bloqueadores P0 da revisão anterior foram corrigidos e verificados no navegador:

- a biblioteca voltou a ser visível e rolável em 1440 e 1280;
- Pan/Zoom não travam mais a edição vetorial, e a ferramenta anterior do mosaico é restaurada ao sair;
- a seleção é limpa ao trocar de família.

A interface saiu de **5/10 para aproximadamente 7,5/10** e agora é **usável**, com ressalvas. Não é um "pronto para produção": ainda há um **novo bug funcional de duplo zoom**, o desempenho de edição continua alto (**~190 ms** por alteração) e sobraram inconsistências de acessibilidade e documentação.

| Área | Antes | Agora | Comentário |
|---|---:|---:|---|
| Motor D4 / catálogo | 9 | 9 | Continua sólido; 45/45 testes. |
| Biblioteca | 3 | 8 | Tabs, árvore rolável, scroll preservado. |
| Navegação Pan/Zoom | 3 | 8 | Estado e retorno corrigidos; duplo zoom novo. |
| Editor / seleção | 6 | 8 | Seleção entre famílias corrigida. |
| Desempenho | 3 | 5 | Miniaturas em cache; store ainda recompila tudo. |
| Acessibilidade | 4 | 6 | Rows focáveis; papéis aninhados e excesso de tabs. |
| Documentação | 4 | 6 | Chave e banco corrigidos; contagens e título ainda errados. |
| Testes | 5 | 6 | 45 suítes; ainda sem teste de navegador. |

**Conclusão:** as correções atacaram exatamente os pontos certos e a maior parte do diagnóstico foi resolvida. O que resta é mais estreito, mas ainda relevante. Eu classificaria como **aprovado com ressalvas**, não como "fechado".

---

## 2. O que foi corrigido de fato

### 2.1 Biblioteca utilizável (P0-1 resolvido)

Medições reais:

| Métrica | Antes | Depois |
|---|---:|---:|
| Altura da lista da biblioteca em 1440×900 | 57 px | **401 px** |
| Altura da lista em 1280×800 | 0 px | **261 px** |
| `scrollHeight` da árvore em 1440 | 570 px (sem rolagem) | **1.486 px** |
| `flex-shrink` dos blocos de grupo | 1 | **0** |
| Rolagem real | não rolava | **rola; `scrollTop` preservado no refresh** |

O dock agora tem abas **Camadas / Propriedades / Biblioteca / Variantes** ([index.html:1074](index.html#L1074-L1079)), cada painel ocupa a área disponível e a biblioteca recebe altura própria ([style.css:4627-4659](style.css#L4627-L4659)). O `flex-shrink:0` foi aplicado aos blocos ([style.css:4510](style.css#L4510)).

**Evidência:** [biblioteca em 1440](assets/revisao_pos_correcoes/03_biblioteca_1440.png), [biblioteca em 1280](assets/revisao_pos_correcoes/04_biblioteca_1280.png).

Ainda há um ponto de atrito: a aba padrão é **Camadas**, então a biblioteca exige um clique. Isso é aceitável, mas para o fluxo de criação talvez "Biblioteca" ou "Propriedades" fosse um padrão melhor.

### 2.2 Pan/Zoom não travam mais a edição (P0-2 resolvido)

- `openTilesStudio` guarda a ferramenta anterior e entra em `inspect` ([core/subtile_studio_ui.js:415-444](core/subtile_studio_ui.js#L415-L444)).
- `closeTilesStudio` restaura a ferramenta anterior ([core/subtile_studio_ui.js:446-465](core/subtile_studio_ui.js#L446-L465)).
- `setVectorTool` força `inspect` quando está no modo tiles ([core/subtile_studio_ui.js:499-521](core/subtile_studio_ui.js#L499-L521)).
- Pan e Zoom viraram botões alternáveis com `aria-pressed` e classe ativa ([core/subtile_studio_ui.js:486-497](core/subtile_studio_ui.js#L486-L497), [core/subtile_studio_ui.js:3357-3368](core/subtile_studio_ui.js#L3357-L3368)).

Teste real:

```text
Pan clicado: activeTool=pan, aria-pressed=true, active=true
Seleção clicada: activeTool=inspect, vectorTool=select
Zoom clicado: activeTool=zoom, aria-pressed=true
Seleção clicada: activeTool=inspect
```

O teste `test_subtile_review_regressions` cobre o estado e a restauração da ferramenta. **Resolvido.**

### 2.3 Seleção não vaza mais entre famílias (P0-3 resolvido)

O editor passou a ter `currentFamilyId` explícito ([core/vector_editor.js:1544](core/vector_editor.js#L1544)), e `resetTransientForFamilySwitch` compara esse id, não `workingFamilyId` ([core/vector_editor.js:1990-2001](core/vector_editor.js#L1990-L2001)). Ele limpa seleção, nós, caneta, arrasto e guias.

Verificação no navegador pela troca de família no DOM, com clique real no canvas:

```text
Família A selecionada; clique no canvas; selectedShapeIds=['s1']
Clique em Família B
Resultado: selectedShapeIds=[], selectedNodes=[], penSession=null, família=B
```

O teste automatizado cobre o mesmo caminho. **Resolvido.**

### 2.4 SVG unitário (P1-2 resolvido)

A exportação usa `paddingRatio: 0` por padrão ([core/subtile_studio_ui.js:772-781](core/subtile_studio_ui.js#L772-L781)). O round-trip medido agora é:

```text
Antes:  largura 1.0000, altura 0.3333
Depois: largura 1.0000, altura 0.3333
```

A diferença residual é apenas arredondamento numérico (altura 0,3333 e centro em -5e-7). **Resolvido.**

### 2.5 Modais com foco contido (P1-4 resolvido)

O novo `enterModal`/`leaveModal` aplica `inert` nos irmãos do diálogo, prende Tab/Shift+Tab, trata Escape no próprio diálogo, foca "Cancelar" inicialmente e restaura o foco ([core/subtile_studio_ui.js:588-617](core/subtile_studio_ui.js#L588-L617)).

Teste real:

```text
Foco inicial: btnSubtileConfirmCancel
Tab: btnSubtileConfirmOk (dentro do diálogo)
Fechar: foco voltou para btnResetLibraryDefaults
```

**Resolvido.**

### 2.6 Ajuda corrigida (P1-7 resolvido)

O runtime agora exibe "Q ou Tab ... Ciclar escopos de edição 1 a 6", em vez de "1 a 6: Seleciona Escopo". A linha anterior, que era substituída por `syncScopeTopics`, foi corrigida. O teste também foi ajustado.

A redação ainda é ambígua ("1 a 6" pode ser lida como teclas), mas não é mais factualmente falsa. **Considero resolvido, com ajuste de texto recomendado.**

### 2.7 Rodapé e barra superior (P2-2 resolvido)

- O chip órfão `P 5 %` não aparece mais no modo Subtiles; a barra superior fica só com os controles contextuais.
- Cores foi marcada como `mosaic-mode-only` e não aparece antes de Vetor ([index.html:367-387](index.html#L367-L387)).
- A seção Gerador/Histórico foi movida para um `details` "Geração e histórico"; Exportar ficou visível.

**Evidência:** [mosaico 1440](assets/revisao_pos_correcoes/01_mosaico_1440.png), [camadas 1440](assets/revisao_pos_correcoes/02_camadas_1440.png).

### 2.8 Outras melhorias confirmadas

- **Persistência v3:** chave canônica `tiling_stripes_studio_v3_state`, banco `TilingStripesDB_v1`/`studio_state`, com leitura e migração da chave/banco antigos ([core/state_persistence.js:8-9](core/state_persistence.js#L8-L9), [core/state_persistence.js:238-239](core/state_persistence.js#L238-L239)).
- **SOLO com dirty guard:** usa `requestParamChangeWithGuard` ([core/subtile_studio_ui.js:3480-3494](core/subtile_studio_ui.js#L3480-L3494)).
- **Importação mais segura:** começa em "Mesclar", "Substituir" pede segunda confirmação e baixa backup ([core/subtile_studio_ui.js:662-733](core/subtile_studio_ui.js#L662-L733)).
- **Aviso de falha de IndexedDB da biblioteca:** evento e mensagem na UI ([core/library_store.js:333-338](core/library_store.js#L333-L338), [core/subtile_studio_ui.js:3212-3217](core/subtile_studio_ui.js#L3212-L3217)).
- **Scroll/foco da biblioteca preservados** entre refreshes ([core/subtile_studio_ui.js:1396-1397](core/subtile_studio_ui.js#L1396-L1397), [core/subtile_studio_ui.js:1825-1826](core/subtile_studio_ui.js#L1825-L1826)).
- **Camadas/olho/cadeado em SVG**, com `aria-label` ([core/subtile_studio_ui.js:2702-2724](core/subtile_studio_ui.js#L2702-L2724)).
- **45/45 suítes passam.**

---

## 3. Crítica dos pontos restantes e novos problemas

### 3.1 Novo bug funcional: clique com a ferramenta Zoom aplica zoom duas vezes

Este é o achado mais importante desta rodada. O clique com a ferramenta Zoom no modo Subtiles aumentou o zoom de **100% para 150%**, não para 125%.

Causa: o mesmo clique é tratado em dois lugares:

- `handleCanvasMouseDown` trata `activeTool === 'zoom'` e chama `setZoomPercent` ([sketch.js:2760-2767](sketch.js#L2760-L2767)).
- O evento continua borbulhando até o `pasteboard`, que também trata `activeTool === 'zoom'` e chama `setZoomPercent` de novo ([sketch.js:4507-4512](sketch.js#L4507-L4512)).

Teste real, clicando no botão Zoom pela UI e disparando um `mousedown` no canvas:

```text
Antes: zoom=100, tool=zoom, aria-pressed=true
Depois de um clique: zoom=150
```

O mesmo ocorre com Alt/botão direito (duas reduções). O teste automatizado novo não cobre isso porque só verifica strings do código-fonte, não o evento real.

**Correção:** remover o bloco de zoom de `handleCanvasMouseDown` (deixar o `pasteboard` tratar), ou chamar `e.stopPropagation()` no canvas. Adicionar um teste de navegador que dispare o evento e valide 100 para 125.

### 3.2 Desempenho: a miniatura ficou rápida, mas a edição continua lenta

O cache de miniaturas funcionou: `buildTileThumbnails` caiu de **69,4 ms** para **0,6 ms** com 90 tiles. Porém a operação completa de edição ainda leva:

```text
Alternâncias de visibilidade: 184,7 / 180,1 / 191,8 ms
buildTileThumbnails:          0,6 ms
renderSwatchesPanel:          1,3 ms
renderEditBrushPalette:       0,9 ms
SubtileStudioUI.refresh:      5,9 ms
LibraryStore.updateFamily:  190,4 ms  (no-op com as mesmas shapes)
```

O gargalo agora é o **store**: cada edição de forma recompila a biblioteca inteira (`compileLibrary` + detecção D4 de todas as famílias). O cache de thumbnails foi otimizado, mas não resolve o custo dominante.

**Crítica:** o relatório de correções diz que o cache evita "renderizar novamente o catálogo inteiro"; isso é verdade para as miniaturas, mas não para a compilação. A sensação de edição ainda é de ~0,2 s de travamento por ajuste. Um editor vetorial precisa de algo abaixo de 50 ms.

**Correção:** separar `updateFamilyShapes` de `updateFamilyMetadata` para não recompilar todas as famílias; ou cachear o compilado e recompilar apenas a família alterada; medir com 150 e 300 tiles. O novo teste não mede desempenho.

### 3.3 Backup da biblioteca limpa todo o histórico vetorial

`backupLibrary` baixa o JSON e, em seguida, faz:

```js
ve.state.currentFamilyId = null;
ve.state.histories.clear();
```

([core/subtile_studio_ui.js:618-624](core/subtile_studio_ui.js#L618-L624))

Esse backup é chamado antes de **importar**, **excluir família** e **restaurar padrão** ([core/subtile_studio_ui.js:710](core/subtile_studio_ui.js#L710), [1035](core/subtile_studio_ui.js#L1035), [1067](core/subtile_studio_ui.js#L1067)). Consequências:

- uma importação **Mesclar**, que pode ser aditiva, apaga o undo de todas as famílias;
- se a importação falhar depois do backup, o undo já foi perdido;
- se o navegador bloquear o download, o usuário não recebe o backup, mas o histórico é limpo do mesmo jeito.

O backup externo é uma boa rede de segurança, mas não deveria destruir o undo em memória. O correto é limpar o histórico apenas das famílias realmente afetadas ou invalidar tudo **somente após** a operação concluir com sucesso.

### 3.4 Acessibilidade: houve avanço, mas os papéis estão errados e o Tab ficou enorme

As linhas de família e de camada agora são focáveis e respondem a Enter/Espaço ([core/subtile_studio_ui.js:1607-1620](core/subtile_studio_ui.js#L1607-L1620), [2519-2533](core/subtile_studio_ui.js#L2519-L2533)), e os botões de olho/cadeado têm `aria-label`. Isso é positivo.

Porém:

- ambas usam `role="button"` e contêm **outros botões e checkbox** dentro; isso é um aninhamento interativo inválido para leitores de tela;
- a árvore da biblioteca tem **163 paradas de Tab** com 33 famílias (linha + até quatro ações + grupos), o que torna a navegação por teclado exaustiva;
- os botões de alinhamento continuam apenas com `title` e glifos `⇤ ⇹ ⇥ ⤒ ⇳ ⤓`, sem `aria-label` ([core/subtile_studio_ui.js:2014-2019](core/subtile_studio_ui.js#L2014-L2019));
- linhas de camada de família built-in são focáveis, mas o clique/ação não existe (somente leitura), criando uma parada de teclado sem efeito.

**Correção:** usar `role="option"`/`listitem` com `aria-selected` (não `button`), remover as ações internas do fluxo de Tab (revelar no hover/foco da linha ou usar roving tabindex), e dar `aria-label` aos alinhamentos. O teste de 45 suítes não cobre tab order.

### 3.5 Emojis: o ponto específico foi corrigido, a política não foi fechada

Os três emojis coloridos que apontei (`U+1F441`, `U+1F512`, `U+1F513`) foram removidos dos botões de camada e da ajuda; olho/cadeado agora são SVG ([core/subtile_studio_ui.js:2702-2724](core/subtile_studio_ui.js#L2702-L2724)). O teste novo verifica exatamente esses três codepoints.

Ainda assim:

- o glifo `U+270E` (lápis) continua sendo usado nos botões de renomear grupo/família ([core/subtile_studio_ui.js:1573](core/subtile_studio_ui.js#L1573), [1786](core/subtile_studio_ui.js#L1786)) e aparece no texto renderizado;
- o `README.md` ainda tem emojis nas linhas 84 a 91;
- o teste de política cobre só três codepoints; não pega `U+270E`, `U+270B` nem futuros emojis.

Se a regra é "nenhum emoji na interface", ela está cumprida para os emojis coloridos principais, mas **não está institucionalizada**. Troque o lápis por SVG e amplie o teste para uma propriedade Unicode de pictograma/emoji.

### 3.6 Documentação: melhorou, mas ainda há contradições claras

**Corrigido:**

- `GEMINI.md` agora fala em 45 suítes, chave v3 e banco TilingStripesDB_v1/studio_state.
- README e manual usam a chave v3 e o banco novo.
- O manual cita 17 tópicos.
- A linha de atalhos foi corrigida para Q/Tab.

**Ainda errado:**

| Item | Problema |
|---|---|
| Número de suítes | README linhas 200, 203 e 207 dizem **44**; o mesmo README diz **45** na linha 310. O manual repete 44 nas linhas 222/227 e 45 na linha 251. |
| Contagem de controles | `GEMINI.md:21` e `README.md:238` dizem **60**; o `index.html` atual tem **270 IDs únicos**. O próprio README linha 310 tenta explicar que os 60 são do mosaico, mas o teste e o GEMINI continuam falando em "exatamente 60". |
| Título da página | `CORRECOES_SUBTILE_STUDIO.md:21` afirma "título da página atualizado"; `index.html:7` continua "Tiling Stripes Studio — Mosaic Generator". |
| Pan com Alt+arrasto | `README.md:90` ainda promete `Alt + Arrasto` para pan; o código usa Alt+arrasto para capturar região, não para pan. O manual corrigiu essa linha; o README não. |
| Largura do dock | `README.md:194` e o manual falam em ~306 px liberados; no modo tiles o dock agora usa `clamp(360px, 30vw, 460px)` (432 px em 1440 e 384 px em 1280). |
| Preview | O manual ainda chama de "preview de vizinhos"; o README já admite que os 8 vizinhos repetem a transformação do mestre. |

**Crítica:** o agente corrigiu a persistência e as contagens de testes no `GEMINI`, mas não fez uma varredura final de consistência. O `test_docs_consistency` continua sem validar contagens, título, largura de dock ou a chave canônica real. Um teste de documentação que só procura duas strings antigas não protege contra esse tipo de regressão.

### 3.7 Busca/filtro ao duplicar família

`handleCreateFamily` e `handleCreateGroup` chamam `revealLibraryItems`, que limpa busca/filtro e muda para a aba Biblioteca ([core/subtile_studio_ui.js:879-889](core/subtile_studio_ui.js#L879-L889)). `handleDuplicateFamily` **não** chama ([core/subtile_studio_ui.js:966-1001](core/subtile_studio_ui.js#L966-L1001)). Se houver uma busca ativa, a cópia pode ser criada mas não aparecer na lista, e o usuário fica sem feedback visual da nova família. Também não há `revealLibraryItems` após excluir a última família de um filtro "Meus subtiles".

### 3.8 A aba padrão e o fluxo de descoberta

O dock abre em **Camadas**, não em Biblioteca. Para um usuário que entra no Estúdio para criar uma família, isso adiciona um clique e esconde a ação principal. A aba Biblioteca é clara, mas o primeiro contato ainda é uma lista de camadas de um mestre protegido (somente leitura). Talvez a aba inicial devesse ser Biblioteca ou Propriedades, ou o seletor de família deveria estar no topo.

### 3.9 O "Gerador" ficou escondido no mosaico

Na barra esquerda do mosaico, "Geração e histórico" virou um `<details>` fechado por padrão ([index.html:391-430](index.html#L391-L430)). O botão "Gerar Mosaico" e a seed, que são ações primárias do app, agora exigem um clique para aparecer, embora haja espaço vertical de sobra em 1440. Isso reduz a descoberta da função principal. A divulgação progressiva é bem-vinda para histórico e backup, mas não para a ação de gerar.

### 3.10 Testes: 45 verdes, mas o bug novo escapou

Os 45 testes passam, e a nova suíte cobre seleção, Pan/Zoom, snap, storage v3 e alguns contratos de HTML. Mas:

- o duplo zoom é um bug de interação real e não é coberto;
- não há teste de layout real (alturas/scroll) nem de tab order;
- o teste de emoji cobre três codepoints;
- o teste de documentação continua fraco;
- o teste de help só verifica a presença de "1 a 6", não a instrução Q/Tab;
- o novo teste usa várias asserções de string (`includes`) que quebram com refatorações legítimas.

O próprio `CORRECOES_SUBTILE_STUDIO.md` reconhece que a validação visual não foi repetida. Esta revisão confirma que a validação visual era necessária: o duplo zoom só aparece no navegador.

### 3.11 Aviso de persistência da biblioteca é parcial

O evento `library-persistence-error` cobre falha do IndexedDB ([core/library_store.js:333-338](core/library_store.js#L333-L338)). Se o `localStorage` falhar por quota **e** o IndexedDB não estiver disponível, o `catch` do `localStorage` continua silencioso ([core/library_store.js:315-331](core/library_store.js#L315-L331)). O aviso também não é limpo após um save posterior bem-sucedido. A mensagem é melhor que nada, mas não cobre todos os caminhos.

### 3.12 UI e CSS

- O CSS novo foi anexado ao final do arquivo com regras que sobrescrevem regras anteriores do mesmo seletor (`#libMgrTreeContainer` aparece com `min-height:280`, `flex:0 0 280`, depois `min-height:180`, `flex:1 1 auto`). Funciona, mas é frágil.
- `#right-dock` em modo tiles passou a 432/384 px; o README/manual continuam citando 350 e ~306 px.
- A tipografia de 9 a 10,5 px não foi tratada; ainda é pequena.
- A consolidação de ações duplicadas (duplicar família em cinco lugares, importar/exportar SVG em dois) permanece, como o próprio relatório admite.

---

## 4. Comparativo objetivo antes/depois

| Ponto | Antes | Depois |
|---|---|---|
| Biblioteca 1440 | 57 px, sem rolagem | 401 px, rolagem e scroll preservado |
| Biblioteca 1280 | 0 px | 261 px, rolagem |
| Blocos de grupo | `flex-shrink:1`, cortados | `flex-shrink:0`, completos |
| Pan seguido de Seleção | `activeTool=pan`, edição morta | `activeTool=inspect`, edição ativa |
| Seleção entre famílias | `s1` vazava | seleção limpa |
| SVG export/import | largura 0,9000 | largura 1,0000 |
| Foco em modal | escapava para `fgColorPicker` | permanece no diálogo e volta ao gatilho |
| Ajuda de escopos | "1 a 6: seleciona" | "Q ou Tab ..." |
| Topo em tiles | chip `P 5 %` órfão | oculto |
| Cores em tiles | antes de Vetor | oculta |
| Performance | 278 a 319 ms | 180 a 192 ms (ainda alto) |
| Thumbnails | 69,4 ms | 0,6 ms |
| Zoom por clique | 100 para 125 | **100 para 150 (novo bug)** |
| Título da página | Mosaic Generator | **Mosaic Generator (não corrigido)** |

---

## 5. Prioridades recomendadas

| Prioridade | Ação | Motivo |
|---|---|---|
| P1 | Corrigir o duplo zoom | Regressão funcional nova e visível. |
| P1 | Separar compilação de shapes da compilação da biblioteca | 190 ms por edição ainda é travamento. |
| P1 | Não limpar todo o histórico no `backupLibrary` | Perda de undo em importação mesclada/falha. |
| P2 | Revisar papéis ARIA e tab order | 163 paradas e botões aninhados. |
| P2 | Fechar a política de emojis | `U+270E` e README; teste mais amplo. |
| P2 | Varredura final de documentação | 44/45, 60/270, título, Alt+arrasto, dock. |
| P2 | `revealLibraryItems` em duplicar/excluir | Cópia pode ficar invisível sob filtro. |
| P2 | Aba inicial do Estúdio | Biblioteca/Propriedades antes de Camadas de built-in. |
| P2 | Reavaliar "Geração e histórico" fechado | Ação primária escondida. |
| P2 | Teste de navegador no CI ou script de fumaça | O duplo zoom prova que testes estáticos não bastam. |
| P2 | Undo de biblioteca completo | Ainda não existe; backup não substitui. |

---

## 6. Evidências visuais

### Mosaico em 1440: modo Subtiles na barra esquerda e gerador/histórico recolhidos

![Mosaico 1440](assets/revisao_pos_correcoes/01_mosaico_1440.png)

### Camadas em 1440: dock com abas e estado da seleção

![Camadas 1440](assets/revisao_pos_correcoes/02_camadas_1440.png)

### Biblioteca em 1440: lista visível, metadata e rolagem

![Biblioteca 1440](assets/revisao_pos_correcoes/03_biblioteca_1440.png)

### Biblioteca em 1280: lista visível e rolável

![Biblioteca 1280](assets/revisao_pos_correcoes/04_biblioteca_1280.png)

---

## 7. Conclusão

As correções foram **boas e direcionadas**. Os três bloqueadores caíram, a biblioteca voltou a existir, o Pan/Zoom voltou a ser previsível, a seleção não vaza mais e o SVG deixou de encolher. O trabalho de tabs e acessibilidade tem mérito.

A crítica principal é que a rodada seguinte introduziu um **bug de duplo zoom** e não resolveu o gargalo real de desempenho, que é a recompilação da biblioteca inteira a cada forma editada. Também ficaram pontas de acessibilidade (papéis e tab order), documentação contraditória e a política de emojis incompleta.

Se o duplo zoom e o custo de compilação forem corrigidos, e a documentação for varrida, o Estúdio passa de "usável com ressalvas" para "pronto para uso interno". No estado atual, eu o liberaria para uso supervisionado, não para produção.
