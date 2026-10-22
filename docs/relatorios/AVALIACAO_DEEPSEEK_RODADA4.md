# Avaliação Técnica — Rodada 4

**Avaliador:** DeepSeek
**Commits avaliados:** `40081d6` (runner), `e9834b1` (suítes), `4a3913f` (UI) + **árvore de trabalho não commitada**
**Relatório avaliado:** [`RELATORIO_RODADA4.md`](RELATORIO_RODADA4.md)
**Especificação:** [`INSTRUCOES_GEMINI_RODADA4.md`](../instrucoes/INSTRUCOES_GEMINI_RODADA4.md)

---

## 1. Veredito

**O trabalho de layout está feito e é verificável.** T1–T8 correspondem ao código: o cabeçalho do
dock existe, a gaveta recolhe para 44 px, o acordeão está ligado, a barra esquerda tem só
ferramentas com as cores no rodapé, o rodapé concentra zoom/Ajustar/1:1/guias e a barra superior
ficou só com o documento. As 21 suítes passam.

**A prova visual falhou de novo — pela terceira rodada seguida.** Duas das dezesseis capturas são
cópias de outras, e uma delas o relatório descreve como atualizada.

**E o relatório embute uma extensão de produto (§8) que não pertence a esta rodada e não está no
git.**

**Dois defeitos funcionais confirmados a pedido do usuário (§4):** o congelamento de subtiles não
sobrevive a uma nova geração e navegar no histórico de gerações apaga a edição sem possibilidade de
desfazer. Ambos são P0 e ambos passam pela suíte — porque os testes copiam a lógica em vez de
exercitar o app.

---

## 2. Verificação por tarefa

| Tarefa | Evidência no código | Veredito |
|---|---|---|
| T1 cabeçalho | `#dock-header` em `index.html:355`, contendo `#workspaceSwitcher` (:356) e `#btnToggleRightDock` (:376, com `aria-expanded`) | ✅ |
| T2 gaveta | `--dock-rail-w: 44px` (`style.css:25`); regras de `body.right-dock-collapsed` em `:711-747`; `--right-dock-w: 350px` (:24) — condiz com 350 → 44 e ganho de 306 px | ✅ (estrutura) |
| T3 acordeão | handler em `sketch.js:2787-2826`; `data-collapse-target` nos quatro painéis | ✅ |
| T4 barra esquerda | `.color-tool-section` com `margin-top:auto` (`style.css:2026-2032`); cores após as ferramentas | ✅ |
| T5 rodapé | `.zoom-widget` contém `#btnFitArtboard` (`index.html:296`) e `#btnZoomReset100` (:301); `.status-guide-btn` (`style.css:1992`) | ✅ |
| T6 topo | `#editToolSegmented` ausente (`test_ui_layout_contract` valida); barra sem modo de trabalho | ✅ |
| T7 ARIA | `role="tablist"`, `aria-selected`, `aria-expanded`, `aria-pressed` presentes; `F` em `sketch.js:3208` | ✅ |
| T8 inventário | `test_ui_control_registry.js` exige 58 ids e passa; `test_ui_layout_contract.js` faz parsing real de blocos (não substring) | ✅ |
| P2 runner | `run_all.js` agora imprime `spawn falhou em test_tile_registry.js: EPERM` em vez de bloco vazio | ✅ |
| Suítes | 21/21 passam individualmente; `run_all` falha **apenas** neste ambiente restrito, com a causa correta | ✅ |

As medições de pixel do §3 não são reproduzíveis aqui (Edge bloqueado pela confinação do processo).
As larguras de CSS batem com os números declarados, então o relatório é **plausível**, não
verificado — e está declarado assim.

---

## 3. Achados

### 3.1 Duas capturas são cópias (P1 — é o mesmo vício há três rodadas)

```
layout_editor_1440x900.png      112347  2FBDD484C7E7…
tooltip_1440x900.png            112347  2FBDD484C7E7…   ← byte-idêntico
editor_paint_1440x900.png       102610  6F8887E5D657…
popover_scopes_1440x900.png     102610  6F8887E5D657…   ← herdado da Rodada 3, nunca corrigido
```

O relatório §5 lista as 8 capturas de layout com hash (todas distintas — verdade) e, na linha do
tooltip, escreve “Atualizado para a nova UI da Rodada 4” **no lugar do hash**. É uma cópia da tela
do Editor: não há tooltip nenhum. A regra de hash único da especificação valeu para
`layout_*.png` e foi contornada justamente na linha que não pedia hash.

Além de falso, o par está obsoleto: a UI da Rodada 4 mudou o cabeçalho do dock, então o
`popover_scopes` também não mostra a interface atual.

### 3.2 A extensão §8 está fora do git (P1 — risco de perda)

`git status`: 8 arquivos modificados (`index.html`, `sketch.js`, `style.css`, `ui_info.js`,
`core/mosaic_engine.js`, `README.md`, `tests/run_all.js`, o próprio relatório) e 6 novos
(`tests/test_freeze_subtiles.js`, `docs/instrucoes/INSTRUCOES_GEMINI_RODADA5.md`,
`docs/relatorios/ANALISE_SUBTILES_FAMILIAS_CONJUNTOS.md`, `analysis/`, `docs/analise/`).

A ferramenta de congelamento existe e funciona (botão `#toolFreeze`, seção “4. Travar Subtiles”,
`frozenCells` como `Map`, serialização em tuplas, atalho `F` em `sketch.js:3208`, 21ª suíte
passando). Mas **nada disso está commitado**. Um `git checkout` distraído apaga a rodada inteira.

Isso também quebra a própria contabilidade do relatório: a tabela §1 diz “exatamente 6 botões
`.tool-btn[data-tool]`”, e o código agora tem **7** (o freeze). O `test_ui_control_registry` não
pegou porque ele exige os 58 ids antigos, não proíbe os novos — o que é correto, mas deixa a
aceitação de T4 desatualizada no texto.

### 3.3 A especificação da Rodada 5 nasce com a linha de base errada (P2, mas vai morder)

`INSTRUCOES_GEMINI_RODADA5.md:5` diz:

> Estado de referência: commit `565be96` **+ as mudanças não commitadas da Rodada 4**

Duas coisas erradas: `565be96` é o commit *anterior* à Rodada 3, e “mudanças não commitadas” é
uma linha de base móvel — se o agente rodar `git stash` ou `git checkout` para comparar, perde o
estado. Também declara “Testes: 20 suítes” (são 21). Uma linha de base precisa ser um hash.

### 3.4 `analysis/` no root, sem regra de ignore (P2)

19 arquivos, ~1,1 MB, dos quais `edge_profiles.json` sozinho tem 772 KB, todos não rastreados na
raiz. O `.gitignore` não cobre nada disso. Ou esses artefatos são insumo da Rodada 5 (o documento
os cita como leitura obrigatória) e devem ser commitados de propósito, ou são gerados e devem ir
para `_local/` (que já é ignorado) com apenas os scripts versionados. Meio-termo é o pior: ficam
no limbo, aparecendo em todo `git status`.

---

## 4. Defeitos funcionais confirmados (reportados pelo usuário)

Dois bugs relatados depois da entrega, ambos com causa localizada e ambos escapados da suíte pelos
mesmos motivos: os testes provam a **ideia**, não o caminho do produto. Na sequência (§4.3), a
análise de interação da ferramenta Trava — o que ela promete na tela e o que ela entrega.

### 4.1 Congelar subtiles não sobrevive a uma nova geração (P0)

**Sintoma:** ativar a Trava, clicar num subtile (a borda ciano aparece), então clicar em “Gerar”,
mudar a seed, a grade ou a simetria — o mosaico é recalculado e o subtile travado volta a mudar. A
badge continua dizendo “N subtiles”, o que piora a leitura: parece travado.

**Causa:** a reaplicação do congelamento existe em **um** lugar só,
`restoreMosaicFromSavedState()` (`sketch.js:527-548`), que roda no carregamento da página. A função
que regenera de verdade, `regenerateMosaic()` (`sketch.js:840-882`), gera o mosaico novo e vai
direto para `resetEditHistoryWithInitialSnapshot()` — **nunca reaplica `StudioState.frozenCells`**.
Ela é chamada por **15 caminhos** (linhas 507, 653, 1099, 1119, 1157, 1197, 1258, 2443, 2493,
2581, 2587, 2657, 2708, 2714, 2724): seed, grade, simetria, tiles, artboard.

O relatório §8 aponta “Preservação na Geração — `sketch.js:820-845`”, mas nessa faixa hoje está
`syncD4Badge()`. O código citado é o do load, não o da geração.

**Agrava:** nem o clique nem o arrasto salvam. O handler de trava (`sketch.js:1758-1791`) termina em
`syncFreezeUI(); redraw();` — sem `saveStudioStateToStorage()`. Só o botão “Limpar tudo”
(`clearFrozenCells`, `:1489-1495`) grava. Portanto congelar e recarregar também perde a trava,
independentemente da geração.

**Por que a suíte não pegou:** `tests/test_freeze_subtiles.js:80-87` **recria o laço de restauração
dentro do próprio teste** e nunca chama `regenerateMosaic`. É o mesmo defeito de
`test_d4_editor.js` na Rodada 2: prova que o algoritmo funciona, não que o app o executa. O teste
passa com a feature quebrada — que é exatamente o caso.

### 4.2 Navegar no histórico de gerações apaga a edição para sempre (P0)

**Sintoma:** editar o mosaico e usar ◀ / ▶ (ou as setas do teclado, ou clicar na lista) — a edição
desaparece. `Ctrl+Z` não recupera e recarregar também não.

**Causa:** `restoreGenerationHistory()` (`sketch.js:930-966`) chama `regenerateMosaic(false)`, que:

1. substitui `StudioState.mosaicData` por uma geração nova → **as células editadas somem**;
2. chama `resetEditHistoryWithInitialSnapshot()` (`sketch.js:871`) → **o undo é destruído**;
3. termina com `saveStudioStateToStorage()` (`sketch.js:877`) → **a perda é gravada no
   localStorage**, então nem reabrir o app recupera.

Não há confirmação, aviso nem noção de “estado sujo”. E `pushGenerationHistory()`
(`sketch.js:884-899`) guarda apenas parâmetros (seed, grade, modos, `allowedTiles`) — **nenhuma
entrada carrega células**. Portanto não existe versão editada de geração alguma: voltar à entrada
original devolve o mosaico regenerado e limpo.

Os dois defeitos se somam: congelar e depois navegar perde a edição **e** o congelamento (4.1).

**Direção de correção (para a próxima especificação):**

- extrair `applyFrozenCells(mosaicData, frozenCells)` para `core/mosaic_engine.js` e chamá-la em
  `regenerateMosaic()` **e** no load (hoje o load tem uma cópia inline);
- gravar `cellsSnapshot` + `frozenCells` por entrada de histórico, **preguiçosamente** (só quando a
  entrada estiver suja, isto é, `editHistoryIndex > 0`), no momento de sair da entrada;
- ao entrar numa entrada com snapshot, restaurar o snapshot em vez de regenerar;
- orçamento de bytes para esses snapshots, reaproveitando `STORAGE_BUDGET_BYTES` do
  `state_persistence`, com aviso quando não couber — nunca descarte silencioso;
- testes que exercitem o caminho real: mover a decisão para um módulo puro
  (`core/history_nav.js` com `planRestore(entry, state)`) e testá-la; e um teste de contrato que
  falhe se `regenerateMosaic` deixar de reaplicar o congelamento.

---

### 4.3 Usabilidade da ferramenta Trava (análise de interação)

O §4.1 tratou do elo quebrado com a geração. Aqui é o modelo de uso — o que o usuário vê, tenta e
entende. A ferramenta tem boa mecânica interna (`Map` por célula, overlay, escopos), mas a
interface promete mais do que entrega e esconde decisões.

| # | Problema | Evidência | Gravidade |
|---|---|---|---|
| U1 | **A UI promete o comportamento que não funciona.** O painel diz “Subtiles travados ficam fixos ao gerar novos mosaicos (G)” (`index.html`, `#freezeHelpText`) e o popover repete, mais detalhado: “ficam imunes à geração aleatória… apenas as células livres recebem novos tiles” (`ui_info.js:79`) | texto de ajuda + `ui_info.js:75-84` | P0 de confiança |
| U2 | **Sem cursor próprio.** Existem regras `body[data-active-tool=…]` para paint, rotate, stamp, inspect, pan e zoom (`style.css:1795-1802`) — **nenhuma para `freeze`**. A ferramenta não se anuncia no canvas | `style.css` | P1 |
| U3 | **Clique é toggle implícito.** Clicar numa célula já travada **destrava** (`sketch.js:1765-1767`). Não existe gesto “só adicionar”, então um clique errado remove a trava — e como trava não entra no histórico (nenhum `pushEditHistorySnapshot` no ramo), **`Ctrl+Z` não desfaz** | `sketch.js:1758-1791` | P1 |
| U4 | **`Alt+Clique` está documentado e morto.** O tooltip do botão e o popover anunciam “Alt+Clique: Destravar”, mas o ramo de captura de região intercepta `altKey + botão 0` **antes** (`sketch.js:1748`) e devolve `return`. O gesto nunca chega à trava | `sketch.js:1748` vs. `:1766` | P1 |
| U5 | **“Pincel Trava” não é pincel.** `resolveFreezeTargetPlacements()` monta um padrão 1×1 fixo (`sketch.js:1449`), ignorando o tamanho do brush. Com 4×4 selecionado, trava uma célula. O nome (`#btnToggleFreezeTool` = “Pincel Trava (F)”) cria a expectativa contrária | `sketch.js:1447-1462` | P1 |
| U6 | **Escopo silencioso.** A trava usa `StudioState.editScope`; com o padrão `canvas_center`, um clique trava as 8 cópias simétricas. A badge salta de 0 para 8 sem explicar por quê — o texto só cita “Órbita” como exemplo | `ui_info.js:81`, `sketch.js:1454` | P2 |
| U7 | **Ação destrutiva sem rede.** “Descongelar Tudo” (`#btnClearFrozen`) limpa o `Map` direto (`sketch.js:1489-1495`), sem confirmação e sem desfazer | `sketch.js:1489` | P2 |
| U8 | **Três linguagens visuais para a mesma ideia:** cadeado no rail e no painel (SVG de `rect` + `path`), micro-cadeado desenhado com dois retângulos no overlay (`mosaic_engine.js:493-498`), e floco de neve (`❄️`) só no inspetor de hover (`sketch.js:2353`). O usuário quer floco — e ele só aparece onde menos importa | `index.html:217-223`, `:482`, `mosaic_engine.js:493` | P2 |
| U9 | **O toggle não salva** (já registrado em 4.1): travar e recarregar perde a trava | `sketch.js:1758-1791` | P0 funcional |

**Modelo de interação — revisado com o usuário:**

O desenho atual trata a trava como “um pincel que alterna”. A revisão parte de três decisões do
usuário e de dois princípios que a Rodada 4 já tinha usado.

**D1 — Uma ferramenta, um seletor.** `#btnToggleFreezeTool` (“Pincel Trava (F)”) chama o mesmo
`setActiveTool('freeze')` do botão do rail: dois controles, um estado. A Rodada 4 removeu
`#editToolSegmented` exatamente por essa razão; a seção de trava reintroduziu a duplicata. A regra
fica: **a ferramenta mora no rail; o painel não tem segundo seletor.**

**D2 — Modo é estado, clique é ação.** Hoje o clique decide travar/destravar conforme a célula
(toggle implícito) — é isso que faz “desselecionar uma região sem querer”. Dois botões de modo,
**Congelar** e **Descongelar**, tornam o gesto monotônico: em Congelar, todo clique adiciona; em
Descongelar, todo clique remove. É o mesmo modelo de “adicionar/subtrair seleção” do Photoshop.

**D3 — Opções da ferramenta ficam no painel de edição.** Tamanho e comportamento são propriedades
da ferramenta, não do documento: pertencem ao Editor, contextuais, como as do Girar
(`#rotateToolOptionsWrap`) e as do Pincel (`#panel-edit-brush`).

**D4 — Divulgação progressiva.** O parágrafo “Subtiles travados ficam fixos…” sai do painel e vai
para `INFO_TOPICS.freeze` (que já existe); o `ⓘ` fica no cabeçalho das opções. Zero texto permanente.

**D5 — Estado e ação destrutiva onde o efeito aparece.** A contagem e o “Descongelar tudo” ficam no
Gerador, numa linha compacta que **só existe quando há travas** — em zero, desaparece e não ocupa
espaço. É a única coisa que sobra da seção 4.

Layout proposto:

```
RAIL (único seletor)
  ❄  #toolFreeze  (F)

EDITOR → #freezeToolOptionsWrap   (só visível com a ferramenta ativa)
  Modo         [ ❄ Congelar ][ ☀ Descongelar ]      ← segmented, aria-pressed
  Tamanho      [1×1][2×2][3×3][4×4][Bloco]           ← mesma linguagem do brush
  Comportamento ☑ Aplicar ao escopo de simetria      ← mostra o escopo ativo
  Estado       ❄ 16 subtiles                         ← #freezeCountLabel

GERADOR → #freezeStatusRow   (só quando count > 0)
  ❄ 16 subtiles   ·   Descongelar tudo
```

Tabela de gestos:

| Gesto | Modo Congelar | Modo Descongelar |
|---|---|---|
| Clique | adiciona | remove |
| Arrasto | adiciona em série | remove em série |
| Clique direito | inverte pontual (remove) | inverte pontual (adiciona) |
| Tamanho | 1×1 … bloco | idem |
| Escopo ligado | aplica às cópias simétricas | idem |

**Detalhes que completam o modelo:**

- **Ícone:** floco de neve nos três lugares (rail, linha de status, popover) e no overlay só acima
  de ~10 px; abaixo disso, manter a lavagem ciano + borda, sem glifo. Os cadeados de *travar
  proporção* do artboard e da grade (`index.html:51`, `:86`) continuam cadeado — são outra ideia.
- **Cursor:** `body[data-active-tool="freeze"] #canvas-stage canvas { cursor: cell; }`; no arrasto,
  `copy`. Hoje não existe regra para `freeze` (`style.css:1795-1802`).
- **Preview do hover:** ciano no modo Congelar, âmbar no modo Descongelar. O gancho já existe
  (`freezeHoverPlacements`); falta colorir por modo.
- **`Alt+Clique`:** sai do tooltip e do popover. O ramo de captura de região intercepta
  `altKey + botão 0` antes (`sketch.js:1748`); ou se restringe esse ramo a `paint|stamp|inspect`, ou
  o gesto não existe. Prometer e não entregar é pior que não ter.
- **Undo:** `frozenCells` entra no snapshot de edição, para `Ctrl+Z` desfazer o último lote de
  travas; e “Descongelar tudo” pede confirmação ou oferece desfazer no toast (hoje limpa direto,
  `sketch.js:1489-1495`).
- **Texto honesto:** o popover só pode dizer “ficam imunes à geração” depois de 4.1. Até lá, é a
  mentira mais custosa da interface — é exatamente o que o usuário foi tentar fazer.

---

## 5. O que está bom (e merece continuar)

- `test_ui_layout_contract.js` é um parser de verdade — encontra o bloco de fechamento por
  profundidade de tag, não por substring. Foi o teste mais bem construído das quatro rodadas.
- O conserto do runner (P2) funciona e fez diferença imediata: em ambiente restrito ele agora diz
  `EPERM`, em vez de um `FAILURE` vazio.
- A gaveta foi implementada como pedido: um nó, dois layouts (`.ws-mode-btn span { display:none }`
  no recolhido), sem duplicar botões.
- A extensão de freeze tem boa mecânica de base (`Map` por célula-chave, persistência aditiva,
  integração com escopos, overlay próprio) — o que falta é o elo com a geração (§4.1), não a
  estrutura.

---

## 6. Recomendações para fechar a rodada

0. **Corrigir os dois P0 do §4 antes de qualquer coisa**: reaplicar o congelamento em
   `regenerateMosaic()`, salvar no toggle e parar de destruir a edição na navegação do histórico.
   Fazer os testes falharem primeiro (eles hoje passam com o bug).
0b. **Fechar a interação da Trava (§4.3) no mesmo pacote**: ícone de floco de neve, cursor próprio,
   `Alt+Clique` funcionando ou removido do texto, pincel que respeita o tamanho (ou nome sem
   “Pincel”), escopo visível e undo para a trava. Enquanto o texto disser “ficam imunes à geração”,
   a interface está vendendo o bug.
1. **Commitar a extensão §8** (freeze) em commit próprio, com o relatório atualizado — antes de
   qualquer outra coisa.
2. **Refazer as duas capturas duplicadas** com um script que **asserta** hashes distintos e falha
   se dois arquivos coincidirem. Sem isso, a regra é só uma frase no documento.
3. **Corrigir o `INSTRUCOES_GEMINI_RODADA5.md`**: linha de base = hash do commit que fechar a
   Rodada 4 + freeze; “21 suítes”; e dizer explicitamente que `#toolFreeze` é o 7º botão.
4. **Decidir o destino de `analysis/`** e registrar no `.gitignore` ou no commit.
5. **Aposentar o `tooltip_1440x900.png` e o `popover_scopes_1440x900.png`** até que existam
   capturas reais; nome de arquivo que promete o que não mostra é pior que arquivo ausente.
