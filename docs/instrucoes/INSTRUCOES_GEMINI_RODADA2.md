# Instruções — Rodada 2: Redução de Densidade e Divulgação Progressiva

**Destinatário:** Gemini 3.8 Flash, no Antigravity  
**Repositório:** `C:\Users\hipstershiba\Documents\Processing\sketches\tilling_stripes`  
**Branch de trabalho:** `develop`  
**Estado de referência:** `38a99c5`  
**Objetivo principal:** reduzir a quantidade de informação sempre visível no painel **Editor** e no painel **Gerador**, movendo explicações para tooltips, ícones de informação (`ⓘ`) e um painel “Saiba mais”, sem esconder estado, ações ou avisos críticos.

Esta rodada não é um redesign visual completo. É uma reorganização da informação: **o que precisa estar sempre visível, o que pode aparecer no hover/focus e o que pertence a uma ajuda sob demanda**.

> Leia o documento inteiro antes de editar. Comece pelo inventário da seção 4 e implemente o componente da seção 5 antes de remover textos. Não declare a rodada concluída sem os critérios da seção 9 e as evidências da seção 10.

---

## 1. Contexto e problema atual

O app melhorou muito na rodada anterior: painéis contextuais, dica de escopo, paleta, reset 0°, aviso de “Iguais”, cursores e foco. Porém, o painel direito ficou **denso em texto explicativo**:

- o `#editScopeHint` exibe 2–3 linhas descrevendo o escopo;
- `#gridSymmetryDesc` e `#blockSymmetryDesc` exibem parágrafos inteiros no painel Gerador;
- a barra de status tem quatro “shortcut pills” (`B`, `R`, `S`, `G`);
- o seletor de centro tem seis botões espremidos em 350 px;
- o painel Editor acumula rótulos, subtítulos, dica, builder, busca e paleta;
- a barra superior corta ações em 1280/1440 (o botão Exportar fica fora da área visível).

O usuário não deve precisar ler um manual dentro do painel. A informação deve aparecer em camadas:

1. **Estado e ação** — sempre visíveis.
2. **Tooltip** — uma frase curta no hover/focus.
3. **Popover “Saiba mais”** — explicação completa, sob demanda.
4. **Ajuda geral** — atalhos e conceitos em um painel `?`.

**Avisos críticos continuam sempre visíveis** e não podem ser escondidos em tooltip: falha de quota, grade não quadrada para D4, incompatibilidade do escopo “Iguais”, combinação de simetria que reduz D4, e quebra manual de D4.

---

## 2. O que o relatório anterior ensinou

O relatório anterior é útil para entender as decisões de produto, mas contém afirmações que não correspondem ao código:

- o debounce de 300 ms **não foi adotado**; `scheduleSaveStudioStateToStorage` existe e nunca é chamado;
- o CI usa **apenas Node 20**, não 20 e 22;
- o README/manual **não** foram atualizados depois do Caleidoscópio e do fallback `#84`;
- `test_editor_ui_state.js` é estático e não valida a matriz em runtime;
- os screenshots são anteriores aos commits finais;
- “todas as 10 tarefas concluídas” não se sustenta enquanto o D4 global quebra em combinações de bloco e o editor não informa quebra de simetria.

**Regra desta rodada:** não repetir o padrão “concluído e validado” sem evidência. Se um item não foi feito, diga “não feito” e explique o motivo. O relatório final deve ser verificável por código, testes e screenshots.

---

## 3. Princípios de hierarquia da informação

### 3.1 Nível 0 — sempre visível

- Nome do controle e valor atual.
- Estado selecionado (ferramenta, escopo, simetria, tamanho).
- Ações primárias (Pincel, Girar, Clonar, Exportar).
- Avisos e erros acionáveis.
- Contagem/estado relevante (ex.: `1×1 • #2`, “D4 editado”).

### 3.2 Nível 1 — tooltip

- Uma frase, no máximo **80 caracteres**.
- Responde “o que isto faz?”.
- Aparece no hover e no focus por teclado.
- Não substitui `aria-label`; não use apenas `title` nativo para informações importantes.

### 3.3 Nível 2 — popover “Saiba mais”

- Aberto por um botão `ⓘ` ou link “Saiba mais”.
- Título + 2–4 bullets curtos, no máximo ~120 palavras.
- Pode conter tabela pequena (ex.: escopos) ou exemplo.
- Fecha com `Escape`, clique fora ou botão “Fechar”; devolve o foco ao gatilho.

### 3.4 Nível 3 — ajuda geral

- Botão `?` na barra de status.
- Um painel único com atalhos, conceitos e limitações.
- Substitui as quatro pills de atalho da barra de status.

### 3.5 Regra de duplicidade

O mesmo texto **não** deve aparecer simultaneamente como parágrafo visível e tooltip. Se a explicação está no popover, remova o parágrafo do painel. Mantenha apenas o rótulo/estado.

### 3.6 Regra de densidade

Por seção, no máximo **uma linha de ajuda visível** (fora de avisos). Se a frase passar de ~90 caracteres ou duas linhas, ela pertence ao popover. O painel Editor deve ficar visualmente mais curto, não apenas “mais organizado”.

---

## 4. Inventário de textos e ações

| Elemento | Hoje | Ação nesta rodada |
|---|---|---|
| `#editScopeHint` | Parágrafo de 2–3 linhas sob o grid de escopos | Remover o parágrafo. Adicionar um chip de estado (`Centro • 8 eixos`) e um `ⓘ` ao lado de “Escopo de Simetria”. O detalhe dos seis escopos vai para o popover `scopes`. |
| `#gridSymmetryDesc` | Parágrafo longo sempre visível | Ocultar/remover. Adicionar `ⓘ` ao lado de “1. Simetria da Grade”; manter os subtítulos curtos dos cards. O detalhe D4/Caleidoscópio/C4/D2 vai para `grid-symmetry`. |
| `#blockSymmetryDesc` | Parágrafo longo sempre visível | Ocultar. Adicionar `ⓘ` em “2. Simetria Interna”. O detalhe vai para `block-symmetry`. Se a combinação reduzir a simetria global, mostrar um aviso curto visível (`#blockSymmetryWarning`). |
| `#nonSquareGridNotice` | Aviso com ação “Igualar L×C” | **Manter visível.** É aviso acionável, não explicação. |
| `#sameTileNotice` | Frase longa | Encurtar para “Iguais exige pincel 1×1.” e adicionar “Saiba mais” para `same-tile`. Manter o aviso visível. |
| `#persistenceWarning` | Texto completo de falha de quota | **Manter visível.** Pode ter link “Saiba mais” para `persistence`, mas não esconder o aviso. |
| `#statusHoverInspector` | Texto inicial longo + texto dinâmico | Texto inicial: “Passe o cursor no mosaico.” O detalhe dinâmico pode continuar, mas em uma linha; ajuda em `inspect`. |
| `.status-right .shortcut-pill` | Quatro pills `B`, `R`, `S`, `G` | Remover. Substituir por um botão `?` “Ajuda e atalhos” (`#btnHelp`) que abre `shortcuts`. |
| `#canvasCenterSymControl` | 6 botões em 6 colunas, ~52 px cada | Passar para 3×2 ou dropdown compacto; usar rótulos curtos com tooltip; detalhe em `center-symmetry`. |
| Títulos longos de ferramentas/botões | `title` com frases completas | Encurtar para ≤80 caracteres e mover detalhe para `brush`/`rotate`/`stamp`. |
| Cards de simetria (Gerador) | Título + subtítulo + parágrafo | Manter título/subtítulo curto; remover parágrafo; `ⓘ` para detalhe. |
| `#status-right` em geral | Muitos atalhos e informações | Deixar só `?` e, se necessário, um indicador de zoom/estado. |
| `#editorToast` | Mensagens longas em alguns casos | Mensagens ≤100 caracteres; para detalhe, link “Saiba mais”. |

**Não remover:** valores, estados selecionados, contadores, botões de ação, avisos de erro/quota, o botão Exportar, os controles de simetria e o preview.

---

## 5. Componente de informação (implementação)

### 5.1 Arquivos

Sugestão de organização sem framework:

- `ui_info.js` (novo): conteúdo estático `INFO_TOPICS`, tooltip e popover.
- `style.css`: estilos de `.info-btn`, `.ui-tooltip`, `.info-popover`, `.help-panel`.
- `index.html`: um único `#infoPopover`, um `#uiTooltip`, `#btnHelp` e os gatilhos `ⓘ`; carregar `ui_info.js` antes de `sketch.js`.
- `sketch.js`: apenas chama `window.InfoUI.init()` e remove os textos antigos; não duplicar a lógica do popover.

### 5.2 Gatilho de informação

Use um botão real, não um `span` clicável:

```html
<button type="button"
        class="info-btn"
        data-info-topic="scopes"
        aria-label="Saiba mais sobre escopos de simetria"
        aria-haspopup="dialog"
        aria-expanded="false">i</button>
```

Regras:

- `ⓘ` ou `i` visível, 16–18 px, contraste adequado.
- `aria-expanded` alterna `true/false`.
- `aria-controls="infoPopover"`.
- Tooltip no hover/focus com uma frase curta; não use `title` como única fonte.
- Em touch, o clique abre o popover diretamente.

### 5.3 Popover único

```html
<div id="infoPopover" class="info-popover hidden" role="dialog" aria-modal="false"
     aria-labelledby="infoPopoverTitle">
  <div class="info-popover-header">
    <h3 id="infoPopoverTitle"></h3>
    <button type="button" id="infoPopoverClose" aria-label="Fechar ajuda">×</button>
  </div>
  <div id="infoPopoverBody" class="info-popover-body"></div>
</div>
```

Comportamento:

1. Abre ancorado ao gatilho, com `position: fixed`.
2. Largura máxima de 320 px; altura máxima de 55vh; rolagem interna.
3. Clamp nas bordas da viewport; se não couber abaixo, abre acima.
4. Fecha com `Escape`, clique fora, botão “Fechar” ou troca de workspace.
5. Devolve o foco ao gatilho ao fechar.
6. Não prende o foco como modal; é um popover não modal.
7. Em scroll/resize, reposiciona ou fecha; não deixa flutuando longe do gatilho.
8. `prefers-reduced-motion`: sem animação de escala/deslocamento.

### 5.4 Tooltip

```html
<div id="uiTooltip" class="ui-tooltip hidden" role="tooltip"></div>
```

- `data-tooltip="Uma frase curta"` nos controles.
- Mostrar no `pointerenter` e no `focusin`; esconder no `pointerleave` e `focusout`.
- Posição fixa acima/abaixo do elemento, clamp na viewport.
- Não usar tooltip para texto que precisa ser lido com o mouse parado por muito tempo; para isso, use o popover.
- Não usar `title` em elementos que já têm `data-tooltip` (evita tooltip duplicado).

### 5.5 Conteúdo

Crie `INFO_TOPICS` com, no mínimo:

```js
const INFO_TOPICS = {
  'grid-symmetry': { title: 'Simetria da grade', body: [/* bullets */] },
  'block-symmetry': { title: 'Simetria interna do bloco', body: [/* ... */] },
  'scopes': { title: 'Escopos de edição', body: [/* ... */] },
  'center-symmetry': { title: 'Simetria do centro', body: [/* ... */] },
  'brush': { title: 'Pincel e Supertile', body: [/* ... */] },
  'rotate': { title: 'Girar', body: [/* ... */] },
  'stamp': { title: 'Clonar / Carimbo', body: [/* ... */] },
  'same-tile': { title: 'Escopo Iguais', body: [/* ... */] },
  'd4-strict': { title: 'D4 estrito', body: [/* ... */] },
  'kaleidoscope': { title: 'Caleidoscópio livre', body: [/* ... */] },
  'persistence': { title: 'Salvamento automático', body: [/* ... */] },
  'shortcuts': { title: 'Atalhos e conceitos', body: [/* ... */] },
  'inspect': { title: 'Inspeção do mosaico', body: [/* ... */] }
};
```

Conteúdo deve ser **estático e seguro**; não interpolar dados do usuário. Use `textContent` ou HTML gerado apenas a partir desse objeto.

### 5.6 Acessibilidade

- `aria-label` em todos os `ⓘ` e no `?`.
- `aria-expanded` e `aria-controls` no gatilho.
- `role="dialog"` com `aria-labelledby` no popover.
- `role="tooltip"` no tooltip; o tooltip não recebe foco.
- `Escape` fecha; `Tab` continua navegando; foco volta ao gatilho.
- Contraste mínimo; não depender só de cor.
- Testar com teclado e com emulação touch.

---

## 6. Tarefas de UI

### R1 — Criar a infraestrutura de informação

**P0.** Implemente `ui_info.js`, `#infoPopover`, `#uiTooltip`, `#btnHelp` e os estilos. Adicione `INFO_TOPICS` com os tópicos da seção 5.5.

**Aceite:**

- `ⓘ` abre o popover correto; fecha com Escape/clique fora; foco retorna.
- Tooltip aparece no hover e no focus.
- Nenhum popover cortado em 1280×800 ou 1440×900.
- Sem erros no console.

### R2 — Simplificar “Escopo de Simetria” no Editor

**P0.** Remover `#editScopeHint` como parágrafo. Adicionar:

- `ⓘ` ao lado do label “Escopo de Simetria”;
- um chip de estado compacto no cabeçalho da seção, por exemplo `Centro • 8 eixos`;
- tooltip curto em cada card de escopo;
- detalhe dos seis escopos no popover `scopes`.

O chip deve refletir o escopo ativo e ser atualizado em `syncEditWorkspaceUI`.

**Aceite:**

- Nenhum parágrafo de 2–3 linhas no painel Editor.
- O chip mostra o escopo correto ao clicar e ao usar `1`–`6`.
- O popover `scopes` lista os seis escopos com uma linha cada.
- O texto “Centro do Canvas — Propaga...” não fica sempre visível.

### R3 — Simplificar as descrições de simetria no Gerador

**P0.** Ocultar `#gridSymmetryDesc` e `#blockSymmetryDesc` por padrão. Adicionar `ⓘ` nos títulos das seções 1 e 2.

- `grid-symmetry`: explicar D4 estrito, Caleidoscópio, C4 e D2 em 4 bullets.
- `block-symmetry`: explicar “Igual à Grade” x independente; mencionar que uma simetria de bloco menor pode reduzir a simetria global.
- Manter os badges `#gridSymmetryBadge` e `#blockSymmetryBadge`.
- Manter `#nonSquareGridNotice` visível quando aplicável.

**Aceite:**

- Nenhum parágrafo de descrição sempre visível.
- Cards continuam com título/subtítulo curto.
- O detalhe de cada modo está no popover correto.

### R4 — Barra de status e atalhos

**P0.** Remover as quatro pills `.shortcut-pill` de `#status-right`. Adicionar um botão `?` com `aria-label="Ajuda e atalhos"` que abre `shortcuts`.

- O popover deve listar: `B`, `R`, `S`, `V`, `H`, `Z`, `1`–`6`, `[`/`]`, `Ctrl+Z`, `Ctrl+Y`, `Tab`, `Space`, `0`.
- O texto inicial de `#statusHoverInspector` deve ser uma linha curta.
- O texto dinâmico de hover pode continuar, mas não deve ocupar várias linhas.

**Aceite:**

- `#status-right .shortcut-pill` não existe mais.
- `?` abre a ajuda; a lista de atalhos está correta.
- A barra de status fica visualmente mais limpa em 1280 e 1440.

### R5 — Avisos: manter visível o que é crítico

**P0.** Revisar todos os avisos:

| Aviso | Regra |
|---|---|
| `#persistenceWarning` | Sempre visível quando ativo; texto completo; link “Saiba mais” opcional. |
| `#nonSquareGridNotice` | Sempre visível; ação “Igualar L×C” preservada. |
| `#sameTileNotice` | Texto curto: “Iguais exige pincel 1×1.” + link “Por quê?”. |
| `#blockSymmetryWarning` (novo) | Visível quando a simetria do bloco reduz a simetria global; texto curto + `ⓘ`. |
| `#d4SymmetryWarning` (novo, se adotar aviso suave) | Visível quando uma pincelada em modo estrito quebra D4; botão “Desfazer” ou “Continuar”. |
| `#editorToast` | Mensagens ≤100 caracteres; detalhe no popover. |

**Aceite:**

- Nenhum aviso crítico é movido para tooltip.
- O usuário consegue entender e agir sem abrir ajuda.
- Textos de aviso não repetem o popover inteiro.

### R6 — Barra superior: reduzir ruído sem esconder ações

**P1.** A barra superior corta Exportar em 1440 e mais ainda em 1280. Reduza a densidade:

- Manter visíveis: workspace, W/H, linhas/colunas, seed, exportar.
- Mover ações secundárias (“Ajustar à Grade”, “Células 1:1”, talvez “Margem”) para um menu `⋯` “Mais ações” com tooltips.
- Não esconder o botão Exportar atrás de rolagem horizontal.
- Icon buttons devem ter `aria-label` e tooltip curto.

**Aceite:**

- Em 1280×800, Exportar e Seed são visíveis sem rolagem horizontal.
- “Ajustar à Grade” e “Células 1:1” continuam acessíveis pelo menu.
- Nenhuma ação é perdida.

### R7 — Seletor de centro com 6 opções

**P1.** O controle de 6 botões em 350 px está no limite. Trocar para 3×2 (duas linhas) ou dropdown compacto.

- Rótulos curtos: `Mandala`, `Caleid.`, `Giro 4×`, `Esp. XY`, `Esp. X`, `Esp. Y`.
- Tooltip de uma linha em cada.
- `ⓘ` com `center-symmetry`.

**Aceite:**

- Nenhum rótulo cortado em 1280×800.
- O estado ativo é inequívoco.
- O popover explica a diferença entre D4 estrito e Caleidoscópio.

### R8 — Contrato do D4 estrito e simetria de bloco

**P0 — gate funcional, não apenas UI.** O relatório anterior confirmou que a liberdade de edição foi intencional. Então escolha e documente um contrato:

**Opção preferida (liberdade com transparência):**

- Manter a pintura livre.
- Detectar quando uma pincelada em modo `mandala_d4` estrito quebra a invariância.
- Mostrar um aviso curto e não bloqueante: “Esta edição quebra o D4. Continuar?” com “Continuar” e “Desfazer”.
- Se continuar, exibir um badge `D4 editado` no painel até regenerar/undo.
- O popover `d4-strict` explica: “D4 é garantido na geração; a edição manual pode quebrar.”

**Alternativa (rigor total):**

- Reintroduzir o guard apenas nos modos estritos, bloqueando ou substituindo por tile compatível.
- O Caleidoscópio continua livre.

**Além disso, corrigir a simetria global com bloco independente:**

- Se `syncBlockSymmetry=false` e o bloco não contiver o grupo necessário, mostrar `#blockSymmetryWarning`: “Bloco Bilateral reduz a simetria global.”
- Ou restringir as opções de bloco às compatíveis.
- Adicionar teste para todas as combinações `grid x block` e para a rota de pintura.

**Aceite:**

- Nenhuma pincelada quebra D4 silenciosamente.
- Combinações de bloco incompatíveis não são apresentadas como D4 global sem aviso.
- `node tests/test_d4_invariance.js` continua passando; novos testes cobrem editor e combinações.

### R9 — Persistência: adotar o debounce e testar o código real

**P0.** O relatório afirma debounce de 300 ms, mas a função não é chamada. Corrija:

- Use `scheduleSaveStudioStateToStorage(250–300)` em edições contínuas (pintar, arrastar, sliders).
- Faça flush imediato em `beforeunload`, troca de ferramenta/escopo e ações estruturais.
- Garanta que o fallback de quota também seja acionado no flush.
- Extraia a lógica de histórico/persistência para funções puras em `core/` e importe nos testes; não duplique `saveWithFallback`/`migratePayloadHistories` nos testes.
- Teste `saveStudioStateToStorage`/`loadStudioStateFromStorage` com DOM/localStorage mockados.
- Corrija o caso em que o índice atual foi cortado: não basta clampar para 0; preserve o snapshot atual ou reinicie o histórico com aviso.

**Aceite:**

- Nenhum `save` completo a cada movimento de pincel em grades grandes.
- Testes chamam as funções reais do app.
- Cota, reload e undo/redo testados no fluxo real.

### R10 — Documentação, screenshots e relatório final

**P1.** Atualizar depois do último commit:

- README: 4 modos de simetria (`Mandala`, `Caleidoscópio`, `C4`, `D2`), 6 opções de centro, fallback `#84`, limites do editor, arquitetura de informação.
- Manual: remover a afirmação de que o editor sempre respeita estabilizadores; documentar o contrato escolhido em R8.
- Screenshots finais em 1440×900 e 1280×800 para Pincel, Girar e Clonar, agora com a UI compacta.
- Relatório final: não usar “10/10” se R8/R9 não estiverem concluídos; listar o que ficou pendente.

---

## 7. Copy curta — exemplos

Use como referência, não como texto imutável.

**Escopo (chip):**

- `Centro • 8 eixos`
- `Órbita • bloco+grade`
- `Bloco • 4 quadrantes`
- `Todos • grade inteira`
- `Livre • 1 célula`
- `Iguais • mesmo tile`

**Tooltip (≤80 caracteres):**

- “Propaga a edição em 8 direções ao redor do centro.”
- “Combina a simetria do bloco com a órbita da grade.”
- “Repete a edição em todos os blocos.”
- “Pinta apenas a célula sob o cursor.”
- “Substitui todas as ocorrências do mesmo tile.”

**Popover `scopes`:**

- Título: “Escopos de edição”
- Bullets: uma linha por escopo, com “use quando…”.
- No máximo 6 bullets.

**Popover `d4-strict`:**

- “D4 é garantido na geração.”
- “A edição manual pode quebrar a simetria; o app avisa e permite desfazer.”
- “Células sem tile compatível usam o vazio (#84).”
- “Para liberdade total, use Caleidoscópio.”

**Popover `kaleidoscope`:**

- “Modo permissivo: usa todos os tiles selecionados.”
- “Não garante invariância matemática de 8 eixos.”
- “Use para variedade visual, não para D4 estrito.”

---

## 8. O que não fazer

- Não esconder estado, valor selecionado ou ação primária.
- Não esconder avisos críticos em tooltip.
- Não manter o mesmo texto visível e no popover.
- Não usar apenas `title` nativo para conteúdo importante.
- Não criar 10 popovers diferentes; use um componente único.
- Não abrir popover que cubra o canvas inteiro ou saia da viewport.
- Não remover controles para “reduzir densidade” sem colocá-los em um menu acessível.
- Não alterar IDs existentes; adicione novos.
- Não alterar o catálogo de tiles/IDs nesta rodada.
- Não reescrever o app em framework.
- Não declarar concluído sem screenshots, testes e diff.
- Não repetir o erro do relatório anterior: “7/7 testes” não significa “10/10 tarefas”.

---

## 9. Critérios de aceite finais

- [ ] Nenhum parágrafo explicativo longo fica sempre visível no Editor ou no Gerador.
- [ ] `#editScopeHint` foi removido ou tem no máximo uma linha curta; o detalhe está no popover.
- [ ] `#gridSymmetryDesc` e `#blockSymmetryDesc` não ocupam espaço permanente.
- [ ] Existem `ⓘ` acessíveis para: simetria da grade, simetria do bloco, escopos, centro, pincel, girar, clonar, Iguais, D4 estrito, Caleidoscópio, persistência e atalhos.
- [ ] As quatro `.shortcut-pill` da barra de status foram substituídas por um `?`.
- [ ] O botão Exportar e a Seed são visíveis em 1280×800 sem rolagem horizontal.
- [ ] O seletor de centro não tem rótulos cortados.
- [ ] `#persistenceWarning`, `#nonSquareGridNotice` e `#sameTileNotice` continuam visíveis quando aplicáveis.
- [ ] Nenhuma pincelada quebra D4 estrito silenciosamente; há aviso/desfazer ou guard.
- [ ] Combinações de simetria de bloco incompatíveis têm aviso ou são restringidas.
- [ ] O debounce é realmente usado; o save não ocorre a cada movimento em grades grandes.
- [ ] Os testes de persistência chamam as funções reais do app.
- [ ] Testes existentes e novos passam; CI roda todos.
- [ ] README/manual descrevem 4 modos, 6 opções de centro, fallback e contrato D4.
- [ ] Screenshots finais de 1440×900 e 1280×800 foram geradas após o último commit.
- [ ] Não há erros no console; nenhum popover cortado.

---

## 10. Roteiro de validação

### 10.1 Browser

Use o browser do Antigravity, com servidor local:

```powershell
python -m http.server 8765
```

Teste em **1440×900** e **1280×800**.

**Cenário A — densidade do Editor**

1. Abra Editor → Pincel.
2. Confirme que não há parágrafo de escopo sempre visível.
3. Passe o mouse/focus no `ⓘ` de escopo; confirme tooltip.
4. Clique no `ⓘ`; confirme popover com os seis escopos.
5. Pressione `Escape`; confirme fechamento e foco no gatilho.
6. Repita para centro, pincel, girar e clonar.

**Cenário B — Gerador**

1. Abra Gerador.
2. Confirme que `#gridSymmetryDesc` e `#blockSymmetryDesc` não ocupam espaço.
3. Abra os `ⓘ` de simetria da grade e do bloco.
4. Confirme que os cards continuam legíveis e que o badge de simetria está correto.

**Cenário C — Status e atalhos**

1. Confirme que não existem as quatro pills `B/R/S/G`.
2. Clique em `?`; confirme a lista completa de atalhos.
3. Pressione `B`, `R`, `S`, `1`–`6`; confirme que continuam funcionando.

**Cenário D — Avisos**

1. Force quota no console; confirme `#persistenceWarning` visível e completo.
2. Grade não quadrada com D4; confirme `#nonSquareGridNotice` + botão.
3. Escopo Iguais + pincel 2×2; confirme aviso curto + “Saiba mais”.
4. Grade D4 + bloco Bilateral; confirme aviso de redução global.
5. Pinte em eixo no D4 estrito; confirme aviso/desfazer ou guard.

**Cenário E — Layout**

1. Em 1280×800, confirme Exportar/Seed visíveis.
2. Confirme que o painel direito não tem rolagem horizontal.
3. Confirme que o seletor de centro não corta rótulos.
4. Confirme que o canvas continua com área útil.

### 10.2 Testes automatizados

```powershell
node tests/test_tile_registry.js
node tests/test_mosaic_engine.js
node tests/test_state_persistence.js
node tests/test_d4_invariance.js
node tests/test_history_limits.js
node tests/test_persistence_quota.js
node tests/test_editor_ui_state.js
```

Adicione:

- `tests/test_info_ui_state.js` — estático: garante tópicos, gatilhos, `aria-*`, CSS e ausência das pills;
- `tests/test_d4_editor.js` — pinta em célula fixa e verifica aviso/bloqueio/estado;
- `tests/test_d4_block_combinations.js` — matriz grid × block;
- teste de persistência chamando as funções reais, não cópias.

Se o ambiente permitir browser automation, adicione um smoke de hover/click/Escape. Se não, registre a limitação.

### 10.3 Evidências

- Screenshots `editor_paint_1440x900.png`, `editor_rotate_1440x900.png`, `editor_stamp_1440x900.png` e as versões 1280×800, geradas após o último commit.
- Screenshot de um popover aberto e de um tooltip.
- `git diff --stat`.
- Resultado dos testes.

---

## 11. Ordem sugerida

1. R1 — componente de informação.
2. R2 — escopos do Editor.
3. R3 — descrições do Gerador.
4. R4 — status/atalhos.
5. R5 — avisos.
6. R8 — contrato D4/bloco.
7. R9 — debounce/testes reais.
8. R6/R7 — top bar e centro.
9. R10 — docs/screenshots/relatório.

Se o tempo acabar, **não declare concluído**. Entregue R1–R5 e reporte R8/R9 como pendentes; a densidade visual não justifica esconder os gates funcionais.

---

## 12. Formato da resposta final

Responda em português, com:

1. **Resumo** do que foi feito.
2. **Arquivos alterados**.
3. **Testes executados** (comando + resultado).
4. **Screenshots** (caminhos e resoluções).
5. **O que foi removido/movido** (lista de textos e para qual tópico).
6. **Pendências** e riscos.
7. **`git diff --stat`**.

Não escreva “10/10” ou “concluído e validado” se qualquer critério da seção 9 estiver aberto. O relatório anterior já mostrou o custo de declarar concluído antes da evidência.
