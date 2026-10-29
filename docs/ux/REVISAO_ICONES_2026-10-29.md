# Revisão de ícones — sistema único, grade e semântica

Data: 29/10/2026. Escopo: **todos os ícones da aplicação** — inventário, redesenho dos glifos ambíguos,
unificação de duplicatas e um único registro como fonte da verdade.

Este documento registra a rodada. A revisão visual de 28/10 (`REVISAO_VISUAL_2026-10-28.md`) deixou
como próximo passo "revisar a iconografia em uma prancha única e aposentar o rótulo oculto onde o ícone
não for autoexplicativo"; é exatamente o que esta rodada executa, com números e contrato automatizado.

## 1. Resumo executivo

A aplicação não tinha um sistema de ícones: tinha 175 SVGs escritos à mão, 103 desenhos distintos e 48
nomes reutilizáveis. O mesmo comando aparecia com dois desenhos ("duplicar" com dois glyphs diferentes,
"folder" com duas geometrias, "lock" com duas espessuras), comandos diferentes usavam o mesmo desenho
("Ajustar" e "Igualar grade" eram o mesmo ícone de setas; "Blocos" e "Espelhos XY" eram o mesmo quadrado
com cruz) e cada tela escolhia seu próprio tamanho e traço (11 a 18 px; 1,5 a 2,5 de traço).

A rodada substituiu isso por:

- **um registro** de 110 ícones em `core/ui_format.js`, com grade 24 × 24, margem segura de 2 px,
  traço 1,75 em 16 px e peso óptico constante por tamanho;
- **slots no HTML**: o `index.html` não guarda caminho de ícone, apenas `data-icon-slot="nome"`;
  `UiFormat.hydrateIcons()` injeta o SVG canônico no boot;
- **zero SVGs de ícone** em `index.html`, `sketch.js` e `core/subtile_studio_ui.js`;
- **nove chevrons de painel** que eram o caractere `▾` viraram ícone do registro;
- **oito rótulos** que começavam com glifos (`⧉`, `↓`, `↑`, `⟳`, `⇄`, `⇅`, `✕`) foram limpos;
- **um contrato** (`tests/test_icon_system.js`) que reprova SVG manual, nome desconhecido, glyph
  duplicado sem alias e traço fora da escala.

## 2. Método

1. **Inventário automático** (`scratch/icon_inventory.js`): varredura de `<svg>` em `index.html`,
   `sketch.js`, `core/subtile_studio_ui.js` e `core/vector_boolean.js`, agrupando por geometria e
   registrando tamanho, viewBox, preenchimento, traço e o controle que hospeda cada glifo.
2. **Auditoria semântica**: cada ocorrência foi confrontada com o rótulo (`title`/`aria-label`) para
   achar colisões (um desenho, dois significados) e duplicatas (dois desenhos, um significado).
3. **Redesenho** na grade de 24 px, com prancha de contato (`scratch/icon_board.html`) renderizada em
   navegador headless para inspeção em 14/16/18/22 px e em zoom.
4. **Aplicação**: os 145 SVGs estáticos do `index.html` foram convertidos em slots; os 51 pontos de
   ícone em JS passaram a chamar `UiFormat.icon(nome, tamanho)`.
5. **Verificação**: prancha final, capturas da aplicação em 1440 × 900, `node tests/run_all.js`
   (54 suítes) e o novo contrato de ícones.

Limite declarado: as capturas são de Chromium headless (Edge), tema escuro único; não houve teste com
leitor de tela nem em toque.

## 3. Diagnóstico (antes)

| Medida | Antes |
|---|---|
| SVGs de ícone escritos à mão | **175** (145 no `index.html`, 14 em `sketch.js`, 14 em `core/subtile_studio_ui.js`, 1 template, 1 falso positivo) |
| Desenhos distintos | **103** para **48** nomes reutilizáveis |
| Tamanhos declarados | 11, 12, 13, 14, 15, 16, 18 px — e CSS sobrescrevendo para 11, 13, 15, 17 px |
| Traços | 1,5 · 1,6 · 1,7 · 1,75 · 1,8 · 2 · 2,5 |
| `stroke-linecap`/`linejoin` | ausentes em 43 SVGs |
| `aria-hidden` | ausente em 62 SVGs (ícones decorativos dentro de botões com rótulo) |
| Chevrons de painel | **9** caracteres `▾` |
| Rótulos iniciados por glifo | **8** (`⧉`, `↓`, `↑`, `⟳`, `⇄`, `⇅`, `✕`) |
| Fonte da verdade | nenhuma: cada tela desenhava o próprio SVG |

Colisões encontradas (mesmo desenho, significados diferentes):

- `expand` (setas para fora) era "Ajustar à grade", "Ampliar editor" e "Igualar grade";
- quadrado com cruz era "Blocos" (guia) e "Espelhos XY" (simetria);
- triângulo + eixo era "Espelhar" (ferramenta), `flipX`, `flipY` e "Simetria" — e os triângulos apontavam
  **para dentro**, o que se lê como "comprimir", não como "refletir";
- dois `folder` diferentes (um traço custom, um Feather), dois `edit` (lápis com e sem linha), dois
  `lock` (um preenchido a 14 px/2, um vazado a 15 px/1,7);
- "Limpar grade" usava a lixeira, "Limpar seleção" usava X e "Recusar" também usava X;
- `rotate` (seta circular aberta) e `reset` (outra seta circular aberta) eram indistinguíveis em 14 px;
- `lock` e `unlock` eram quase idênticos: o `unlock` desenhava o arco fechado, sem a abertura.

## 4. Direção adotada

**Um registro. Uma grade. Um nome por significado.**

| Regra | Valor |
|---|---|
| Grade | 24 × 24, área viva 20 × 20 (margem segura de 2 px) |
| Traço | `currentColor`; 1,75 em 16 px; 14 → 2 · 18 → 1,56 · 22 → 1,27 · 12 → 2,33 |
| Terminações | `stroke-linecap="round"`, `stroke-linejoin="round"` em todos |
| Tamanhos na UI | 12 (passos do documento) · 14 (cabeçalho de painel, listas) · 16 (padrão) · 18 (ferramentas e ações vetoriais) |
| Preenchimento | só para **resultado** (booleanas), **área preenchida** (fill/invert), **cópia espelhada** (flip) e a **caneta** (nib sólido, como no Illustrator) |
| Nomes | um nome = um significado; alias declarado no teste (`flipX`/`mirror`/`symmetry`) |
| HTML | `<span class="icon-slot" data-icon-slot="nome" data-icon-size="18">`, hidratado no boot |
| CSS | não define tamanho nem traço de ícone; só cor, opacidade, alinhamento e a rotação do chevron |

### Decisões por glifo ambíguo

| Controle | Antes | Depois | Por quê |
|---|---|---|---|
| Espelhar (ferramenta) | triângulos apontando para dentro + eixo tracejado | sólido à esquerda + cópia fantasma à direita + eixo tracejado | mostra a **reflexão** (original e cópia), não uma compressão |
| Preservar | asterisco de 8 pontas com setas nas pontas | floco de 6 pontas com hastes curtas | o símbolo de "congelar" fica legível em 18 px |
| Carimbo | alfinete com base pequena | base + corpo + cabo retangular | deixa de parecer "fixar" |
| Pincel | haste fina com gota solta | cerdas largas + cabo | distingue de "Caneta" no mesmo grupo |
| Ajustar | 4 setas para fora | moldura tracejada + conteúdo sólido | separa de "Ampliar" e de "Igualar grade" |
| Igualar grade | 4 setas para fora (igual a Ajustar) | moldura com duas barras iguais | passa a ter desenho próprio |
| Blocos (guia) | grade 3 × 3 | quadrado dividido em 2 × 2 | o bloco é o supertile; 3 × 3 confundia com a grade fina |
| Espelhos XY | quadrado + cruz sólida | quadrado + cruz tracejada | tracejado = eixo de espelho, não divisão de célula |
| Órbitas | círculo tracejado com seta interna | anel tracejado + anel interno + satélite | lê-se como órbita, não como alvo |
| Girar | arco de 270° com seta dentro | seta circular completa com cabeça no canto | cabe em 14 px |
| Restaurar giro | mesma seta circular de Girar | seta anti-horária + ponto central | separa "girar" de "voltar ao padrão" |
| Recortar | dois quadros sobrepostos | tesoura de recorte (crop) | mesma metáfora do Illustrator |
| Travar/Destravar | cadeado preenchido × vazado, traços diferentes | par vazado com eixo da chave; destravar com abertura | o estado é lido no contorno, não no peso |
| Seleção retangular | retângulo tracejado com cantos invisíveis | moldura tracejada + 4 alças sólidas | alças somem no fundo escuro quando são bolinhas de 1,4 px |
| Seleção por pincel | moldura + traço solto | moldura tracejada + ponta de pincel sólida | aproxima do pincel que ele ativa |

## 5. Antes e depois

![Prancha dos 110 ícones](evidencias/revisao-icones-2026-10-29/01_prancha_110_icones.png)

*Prancha completa: cada ícone em 14, 16, 18 e 22 px e em zoom. É a página `tools/icon_board.html`,
servida por `core/ui_format.js` com a raiz do projeto em um servidor estático.*

![Ferramentas antes e depois](evidencias/revisao-icones-2026-10-29/02_antes_depois_ferramentas.png)

*Comparação gerada a partir do `HEAD` (SVG inline original) e do registro atual. As linhas "Seleção
retangular" e "Seleção por pincel" mostram o SVG antigo sem as regras de CSS que ele dependia para
`fill`/`stroke` — que é, por si, o defeito: o desenho não era autossuficiente.*

![Ferramentas na aplicação](evidencias/revisao-icones-2026-10-29/04_ferramentas_18px.png)

*As dez ferramentas a 18 px dentro de alvos de 34 px, com traço 1,56.*

![Aplicação em 1440 × 900](evidencias/revisao-icones-2026-10-29/03_app_1440.png)

*Aplicação após a hidratação: todos os ícones vêm do registro; nenhum slot vazio.*

![Ações rápidas](evidencias/revisao-icones-2026-10-29/05_acoes_bulk_16px.png)

*Todos / Nenhum / Inverter / Sortear a 16 px: a moldura identifica a família "seleção", o miolo
distingue a ação.*

![Estúdio de peças](evidencias/revisao-icones-2026-10-29/06_estudio_pecas.png)

*Estúdio de peças: barra vetorial (ponteiro, ponteiro direto, caneta, formas, curva), Pathfinder
(`unite`/`subtract`/`intersect`/`exclude`) e camadas. Nenhum erro de console; todos os ícones
declaram `data-icon` do registro.*

As imagens ficam em `docs/ux/evidencias/revisao-icones-2026-10-29/`, diretório local ignorado pelo Git
(as rodadas anteriores seguem a mesma convenção: as capturas não entram no repositório).

## 6. O que mudou por arquivo

| Arquivo | Mudança |
|---|---|
| `core/ui_format.js` | registro `ICON_PATHS` com **110** ícones, escala `ICON_SIZES`, `icon(nome, tamanho)`, `iconSlot`, `hasIcon`, `iconNames` e `hydrateIcons`; `icon` rejeita nomes herdados de `Object.prototype` |
| `index.html` | 145 SVGs → 145 slots + 9 chevrons de painel = **153 slots**; rótulos sem glifos |
| `sketch.js` | `LOCK_ICON_SVG`, `UNLOCK_ICON_SVG`, `SYMMETRY_ICONS_SVG` e `EDIT_SCOPE_ICONS` passam a vir do registro; badge "PRESERVADO" usa o floco aos 12 px |
| `core/subtile_studio_ui.js` | Pathfinder, ícones de forma, olho/cadeado das camadas e `iconizePropertyActions` usam o registro (mapa de 20 comandos) |
| `style.css` | removidas as regras que fixavam tamanho e traço de ícone (11, 13, 15, 17 px; 1,5, 1,65, 1,7, 1,85); sobraram cor, opacidade, alinhamento e rotação |
| `tests/test_icon_system.js` | **novo contrato**: 110 nomes válidos, um glyph por significado, traço por tamanho, slots válidos, zero SVG manual, hidratação |
| `tests/test_visual_tokens.js` | a asserção do Pathfinder passou a comparar por `data-icon` e tamanho explícito |
| `tests/test_tile_studio_ui_contract.js` | o contexto de VM do Pathfinder recebe o módulo `ui_format` |
| `tests/run_all.js` | registra a 54ª suíte |
| `README.md` · `docs/MANUAL_MANUTENCAO.md` | seção de iconografia, contagem de suítes 44 → 54 e cobertura do novo teste |

## 7. Verificação

- `node tests/run_all.js` → **54/54** suítes. A suíte `test_spout_output.js` só não roda neste sandbox
  porque o runner usa pipes de processo, bloqueados pelo confinamento; ela passou a ser executada
  individualmente no fluxo normal.
- `node tests/test_icon_system.js` → 110 ícones, 153 slots, nenhum glyph duplicado, nenhum SVG manual.
- Hidratação medida no DOM real: `document.querySelectorAll('[data-icon-slot]').length === 0` após o
  boot e 358 SVGs de ícone renderizados (inclui os gerados por JS).
- Prancha e capturas acima, em Edge headless, 1440 × 900 e 3× de escala para inspeção.

## 8. Limites e dívida

1. **Tema único.** A grade e o traço foram calibrados no escuro; não há tema claro nem alto contraste.
2. **Ícones ainda são a única pista de algumas ferramentas.** O alvo e o desenho melhoraram, mas os
   nomes continuam em `title`/tooltip; rótulos visíveis seguem existindo só onde o layout já os tinha.
3. **`▾` de outros lugares.** O chevron de painel virou ícone; disclosables nativos (`<details>`) usam o
   marcador do navegador e ficam fora do registro.
4. **Sessão concorrente.** Durante a rodada, outra sessão alterou `index.html` e `style.css`; o passe de
   ícones foi reaplicado sobre o DOM mais novo e o contrato roda sobre o estado atual. Se aquele layout
   mudar de novo, `test_icon_system.js` acusa slot órfão imediatamente.
5. **Sem teste de reconhecimento com usuários.** A escolha dos glifos ambíguos foi feita por convenção
   (Illustrator/Figma/Lucide) e inspeção em três tamanhos, não por teste com pessoas.

## 9. Próximos passos sugeridos

1. Rodar o teste de reconhecimento das 10 ferramentas em uma prancha única (mesma grade óptica), agora
   que existe uma prancha para iterar.
2. Levar o mesmo contrato para os cursores de canvas (`style.css` ainda embute dois SVGs em `url(...)`).
3. Avaliar um segundo peso (traço 2,25) para 12 px, onde o traço derivado de 2,33 começa a fechar os vãos
   de ícones com muitos nós (floco, estrela do caleidoscópio).
4. Medir com usuários as duas jornadas centrais — gerar e ajustar uma região; editar uma peça — com os
   novos glifos de Espelhar, Carimbo e Preservar.

## 10. Caneta — SVG de origem (`pen-tool-svgrepo-com.svg`)

As tentativas anteriores (nib do Illustrator, losango, nib em traço) não fecharam. O glifo agora usa o
desenho do arquivo `pen-tool-svgrepo-com.svg` da raiz, **na íntegra**: um único `path` em 24 × 24,
preenchido, com `fill-rule="evenodd"` — corpo do nib, fenda, respiro circular e cabo, tudo esculpido no
mesmo contorno.

- o `d` do arquivo é copiado sem alteração (o viewBox de origem já é `0 0 24 24`);
- `fill="#000000"` vira `fill="currentColor"` e o traço fica em `none`;
- é o único glifo sólido do registro: o preenchimento é o que desenha a fenda e o respiro.

![Caneta — SVG de origem x registro](evidencias/revisao-icones-2026-10-29/10_caneta_svg.png)

*Esquerda: o arquivo `pen-tool-svgrepo-com.svg` renderizado. Direita: o registro em 220 e 110 px (acima)
e 32/22/18/16 px (abaixo).*

![Caneta na barra vetorial](evidencias/revisao-icones-2026-10-29/07_caneta_barra_vetorial.png)

*A caneta e o curvar a 18 px entre as demais ferramentas vetoriais.*

## 11. Espelhar — setas vazadas espelhadas

A captura enviada mostrava o glifo **anterior**: dois triângulos vazados apontando para **dentro**, com
eixo tracejado. A primeira correção usou uma seta sólida e uma cópia fantasma; a linguagem não era a da
referência. O registro agora mantém as **duas setas vazadas**, iguais, apontando para **fora**, com o
eixo tracejado entre elas. O mesmo desenho vale para `flipX`, `flipY` e `symmetry`, que são a mesma
família de espelhamento.

![Espelhar — captura x build](evidencias/revisao-icones-2026-10-29/09_espelhar_captura_x_build.png)

*Esquerda: a captura enviada (setas para dentro, glifo antigo). Direita: o registro atual, setas vazadas para fora.*

## 12. Curvar — novo glifo

O ícone anterior (arco + corda tracejada + dois pontos) lia como "segmento de círculo" e competia com
`shapeArc` no mesmo grupo. O registro `curve` agora é uma curva em S com dois nós preenchidos nas
extremidades — a leitura de "caminho curvo com âncoras" que o comando pede, sem confundir com o arco.

`M3.5 17.5C3.5 10.5 10 8 12 12s8.5 1.5 8.5-5.5` com nós em `(3,5; 17,5)` e `(20,5; 6,5)`.
