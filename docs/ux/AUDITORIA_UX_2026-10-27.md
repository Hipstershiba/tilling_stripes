# Auditoria de interface e experiência — Tiling Stripes Studio

Data: 27/10/2026. Base: checkout de `c3e9f33`, incluindo as alterações locais presentes durante a análise. Estado deste documento: diagnóstico e proposta; as correções abaixo ainda precisam ser implementadas.

**Prioridade confirmada pelo usuário: gerar mosaicos e fazer ajustes rápidos.** O editor de peças e a saída Spout continuam cobertos, mas não devem ditar a complexidade da experiência inicial.

Leia a execução em [PLANO_IMPLEMENTACAO_UI_UX.md](PLANO_IMPLEMENTACAO_UI_UX.md). Este diagnóstico contém evidências; o plano define decisões, sequência, arquivos, testes e critérios de aceite para um modelo de implementação.

## 1. Conclusão de design

A aplicação já possui uma base adequada: obra central, ferramentas à esquerda, propriedades à direita e controles de documento no topo. O principal problema é a falta de uma política única para ações, foco, nomes e estados. Há aparência de um editor gráfico profissional, mas o usuário ainda precisa conhecer a implementação para prever algumas operações.

O redesenho deve tornar previsível este ciclo:

**Escolher peças → gerar → ajustar com simetria → conferir → exportar.**

As prioridades são:

1. Garantir que o comando executado corresponda à intenção: borracha apaga, atalhos respeitam modificadores e diálogos isolam a edição.
2. Tornar salvamento e desfazer confiáveis e compreensíveis.
3. Unificar linguagem, tamanho de controles, foco, contraste e estados ativos.
4. Reduzir repetição de ações e texto permanente, preservando acesso às funções.
5. Aplicar divulgação progressiva ao editor vetorial, à matemática e à transmissão.

Minimalismo aqui significa reduzir decisões concorrentes e ambiguidade. Não significa esconder a geração, remover nomes de ferramentas ou apagar funções avançadas.

## 2. Método e limites da análise

Foram utilizados Graphify local, leitura direcionada dos fontes e contratos, revisão paralela de arquitetura/documentação, auditoria estática de acessibilidade e inspeção visual da aplicação no navegador.

- Ambiente visual observado: navegador Zen, janela de aproximadamente 2560 × 1040 pixels capturados, zoom do navegador em 90%. A captura inclui o ambiente do navegador; não é uma medição certificada de viewport CSS.
- Foi aberta uma origem local separada em `http://127.0.0.1:8878/`, evitando editar a sessão criativa já aberta em outra origem.
- Telas observadas: gerador do mosaico, entrada/retorno oferecido pelo editor de peças, abas Camadas e Propriedades, família padrão protegida.
- A inspeção visual foi amostral. Responsividade em telas pequenas, dispositivos de toque, leitores de tela e uso real de Spout não foram validados nesta rodada.
- Os casos `Ctrl+X` e atalhos no aviso de regeneração foram exercitados por um agente em execução isolada do listener atual com Node/VM. Isso comprova o roteamento do comando; não substitui teste de integração no navegador.
- O caso borracha após carimbo foi identificado pelo percurso de código e precisa de reprodução visual antes da correção.
- `node tests/run_all.js`: **45/45 suítes passaram**, em aproximadamente 18 segundos. Esse resultado é o baseline; não comprova ausência das falhas de UX registradas.
- Nenhum comportamento do aplicativo foi alterado nesta entrega. As mudanças autorais são documentação e índice; a sincronização do conhecimento pode atualizar arquivos gerados.

Referências `arquivo:linha` apontam para o checkout observado. O executor deve confirmar o símbolo, porque as linhas mudam após cada tarefa. Não usar números de linha como mecanismo de edição.

### Classificação da evidência

| Código | Significado |
|---|---|
| E | Comportamento exercitado em execução isolada nesta auditoria |
| C | Evidência diretamente no código/estrutura/cascata |
| V | Observação visual nesta auditoria |
| D | Contradição documental verificada |
| R | Recomendação de design; exige implementação e avaliação, não é um bug comprovado |
| H | Hipótese que precisa de medição ou reprodução |

P1 = risco de ação errada, recuperação insuficiente ou barreira importante. P2 = inconsistência frequente, custo de aprendizado ou atrito. P3 = refinamento posterior. Nenhum problema foi classificado como P0 sem demonstração de perda irrecuperável no cenário observado.

## 3. Estrutura atual e consequências para a interface

| Camada | Arquivos principais | Responsabilidade e cuidado na intervenção |
|---|---|---|
| Shell | `index.html`, `style.css` | Superfícies, controles, painéis, tema e responsividade. Preferir reorganização local e tokens a reescrita geral. |
| Coordenação do mosaico | `sketch.js` | Ferramentas, eventos, viewport, geração, histórico, feedback e Spout. É o principal ponto de dispersão das regras de interação. |
| Interface de peças | `core/subtile_studio_ui.js` | Biblioteca, propriedades, camadas, abas, modais e roteamento vetorial. A reconstrução de painéis afeta foco e custo de atualização. |
| Editor vetorial | `core/vector_editor.js`, `core/vector_boolean.js` | Gestos, pontos, caminhos, seleção, booleanas e SVG. Preservar geometria durante mudanças de apresentação. |
| Biblioteca | `core/tile_library.js`, `core/library_store.js`, `core/library_compiler.js`, `core/tile_registry.js` | Dados editáveis, compilação D4, IDs e remapeamento. Separar metadados de mudanças geométricas. |
| Matemática/geração | `core/d4_symmetry.js`, `core/d4_detect.js`, `core/mosaic_engine.js` | Simetria, estabilizadores, catálogo e composição. Não simplificar regras matemáticas para simplificar a interface. |
| Persistência/históricos | `core/state_persistence.js`, `core/document_snapshot.js`, `core/history_nav.js` | Durabilidade e restauração. Expor estado real, preservar compatibilidade. |
| Ajuda | `ui_info.js`, `core/ui_format.js` | Conteúdo contextual e nomes. Precisa compartilhar metadados com ações e atalhos. |
| Saída | `core/spout_output.js`, `tools/spout_bridge.py` | Saída limpa e integração externa. Manter diagnóstico técnico fora do fluxo comum. |

Os módulos puros são uma vantagem para testes. A fragilidade maior está na coordenação entre apresentação, comandos e estado. Não há justificativa nesta auditoria para trocar framework, converter toda a aplicação ou criar um novo sistema de janelas.

### As superfícies

Usar a expressão **quatro superfícies de controle em torno de um viewport**:

1. Topo: documento ou contexto da peça em edição.
2. Esquerda: ferramentas e ações persistentes.
3. Direita: propriedades do contexto ativo.
4. Rodapé: navegação, estado e saída.
5. O viewport central contém a obra; não é uma quinta superfície de controles.

O arranjo espacial é bom e deve continuar. A mudança necessária está na informação colocada em cada área e em quando ela aparece.

## 4. Jornadas e dificuldades

| Jornada | Situação atual | Experiência desejada |
|---|---|---|
| Primeira geração | Obra pronta e botão Gerar visível; termos como Padding, Swatches e Octantes exigem conhecimento prévio. | Uma ação primária Gerar, nomes de tarefa em português e explicação contextual curta para simetria. |
| Escolher repertório | Grupos, famílias, variantes, contadores, checkboxes e SOLO competem na mesma lista. | Seleção de peças compreensível por miniatura/família, com ações avançadas em nível secundário. |
| Corrigir uma região | Ferramenta, tamanho, snap e seis escopos interagem. | Preview mostra área e propagação; dock explica apenas as opções da ferramenta ativa. |
| Apagar após capturar | E pode manter carimbo maior que 1×1. | E sempre entra na borracha, com preview vazio e sessão do carimbo preservada para S. |
| Preservar uma área e gerar de novo | Travas e regeneração existem; conceitos podem parecer trava de edição. | “Preservar na geração” explica o efeito, e o desenho protegido continua identificável. |
| Recuperar uma alteração | Gerações e edições usam históricos distintos; nem toda mudança visual entra em undo. | Alvo de desfazer explícito e alterações de documento reversíveis por gesto. |
| Editar peça padrão | Proteção e cópia já existem, mas o convite se repete no topo, aviso e propriedades. | Uma ação principal “Criar cópia editável”; demais mensagens apenas explicam a proteção. |
| Organizar biblioteca | Várias ações pequenas por linha; duplicação pode sumir sob filtro. | Seleção visível, menu de ações, foco preservado, nova cópia revelada. |
| Exportar | PNG/SVG do mosaico e SVG/JSON da biblioteca têm acessos próximos/repetidos. | Rótulos anunciam o alvo: mosaico, peça ou biblioteca. |
| Usar ao vivo | Spout permanece no rodapé, mesmo desligado. | Acesso compacto quando desligado; configuração expandida e estado compreensível quando necessário. |

## 5. Catálogo de achados

### 5.1 Comandos, ferramentas e recuperação

| ID | Prioridade / evidência | Falha e referência | Impacto | Correção-alvo |
|---|---|---|---|---|
| UX-01 | P1 / E,C | `sketch.js:4640–4654` trata X antes de Ctrl/Meta/Alt. Ctrl+X também troca cores e cancela a ação padrão. | Uma intenção de recortar muda a arte; o mesmo acontece no ambiente vetorial. | Exigir combinação exata; compartilhar um comando de troca de cores entre botão e teclado. |
| UX-02 | P1 / E,C | Aviso de regeneração em `sketch.js:2984–3040`; listener `:4657–4687` só intercepta Escape. Undo e troca de cores podem executar atrás dele. | Documento muda enquanto o usuário decide como protegê-lo. | Infraestrutura única de modal, bloqueio de comandos externos, foco contido e restaurado. |
| UX-03 | P1 / C | E em `sketch.js:4774–4785` usa `selectBrushTile(84)`; `:2478–2492` mantém stamp e só troca padrão 1×1. | Carimbo maior pode continuar sendo aplicado enquanto o feedback diz Borracha. | Ativar paint/borracha explicitamente e preservar a sessão independente do carimbo. |
| UX-04 | P1 / C | Salvamento em `sketch.js:312–336` usa existência de IndexedDB para decidir avisos; rejeição assíncrona fica no console. | Falta de durabilidade pode parecer salvamento normal. | Agregar resultados reais dos dois backends e comunicar falha/recuperação. |
| UX-05 | P1 / C | `core/library_store.js:324–338` ignora erro de localStorage; sem IDB não apresenta falha. | Peças editadas podem existir somente em memória sem aviso. | Estado de salvamento da biblioteca coerente com o do documento; backup acessível em erro. |
| UX-06 | P1 / C,R | Cores e padding em `sketch.js:4035–4044`, `:4072–4093` não criam transações; snapshot em `core/document_snapshot.js:12–22` não coleta dimensões/cores. | Desfazer não corresponde à expectativa de um editor gráfico. | Transação por gesto; ampliar snapshot com campos opcionais e leitura de versões anteriores. |
| UX-07 | P2 / C,R | Ctrl+D em `core/subtile_studio_ui.js:3641–3651` duplica formas selecionadas ou, sem seleção, família inteira. | Uma diferença invisível de seleção muda a escala da operação. | Ctrl+D para formas; duplicação de família por ação explícita. |
| UX-08 | P2 / C,R | Escape em `core/subtile_studio_ui.js:3586–3596` conclui e grava Caneta. | “Cancelar” pode confirmar geometria. | Enter conclui caminho aberto; Escape cancela sessão ainda não confirmada. |
| UX-09 | P2 / C | Tab em `sketch.js:4741–4751` cicla escopo em edição e recolhe dock no gerador; em campos navega. | O mesmo atalho muda de significado sem sinalização clara. | Q é o atalho principal de escopo; Tab alias apenas no canvas de edição. Em controles, navegação normal. |
| UX-10 | P2 / C,R | Setas em `sketch.js:4835–4838` navegam gerações; undo no mosaico em `:4676` e na família em `core/subtile_studio_ui.js:3616`. | Foco em outro widget pode atingir o histórico errado; alvo de undo pouco evidente. | Navegação de gerações restrita ao seu contexto; tooltips com alvo e disponibilidade. |
| UX-11 | P2 / D,C | `ui_info.js:132` diz Shift “Forçar Ajuste”; `sketch.js:771` implementa inversão momentânea. README também conflita em Alt+arrasto. | Aprendizado contraditório de gestos essenciais. | Uma tabela por contexto; Shift inverte encaixe; Alt+arrasto captura, H/Espaço movem vista. |
| UX-39 | P1 / C,R | `core/mosaic_engine.js::applyFrozenCells`, `:294–302`, descarta preservações que não cabem após mudar linhas/colunas/subdivisão. | Uma promessa genérica de manter áreas preservadas seria incorreta em mudança de topologia. | Aviso contextual antes da mudança, com quantidade afetada; undo deve restaurar grade e preservações. Para apenas nova semente, manutenção continua válida. |

### 5.2 Unidade visual, linguagem e densidade

| ID | Prioridade / evidência | Falha e referência | Impacto | Correção-alvo |
|---|---|---|---|---|
| UX-12 | P1 / C | `style.css:5–26` não define `--border-light`, `--text-tertiary`, `--bg-hover`, usados sem fallback em `:881`, `:1935`, `:1958`, `:2413`, `:3201`, `:3876`, `:4568`. | Declarações CSS inválidas produzem estados e bordas inconsistentes. | Consolidar tokens semânticos e eliminar referências não resolvidas. |
| UX-13 | P2 / C,V | Texto muted `#6b7280` sobre painel `#232428` tem contraste calculado de 3,21:1. Títulos de 10px em `style.css:2793`; metadados de 9px em `:3158`. | Leitura difícil; em tela ampla já exige esforço visual. | Texto funcional com contraste ≥4,5:1 e escala tipográfica legível. |
| UX-14 | P2 / C,V | `.lib-mini-icon-btn` usa 19×19px em `style.css:3890`; ações adjacentes em `:3886`. | Erros de clique e aparência de painel técnico comprimido. | Alvos desktop de 28–32px e ações raras em menu Mais. |
| UX-15 | P2 / C | Tooltip em `style.css:2276–2279` usa nowrap, largura 290px e ellipsis. | Atalho ou instrução pode desaparecer justamente na ajuda. | Quebra de linha, limite pela viewport, texto completo e abertura por foco. |
| UX-16 | P2 / C,V | Artboard, Padding, Clip, Swatches, Sortear Mix e Exportar Custom em `index.html:28`, `:103`, `:132`, `:772`, `:794`, `:1251`. | Usuário traduz conceitos sem benefício funcional. | Glossário único: Prancheta, Espaçamento, Recortar, Peças permitidas etc. |
| UX-17 | P2 / V,C | Subtiles identifica um ambiente e uma guia em `index.html` (`btnStudioTilesMode` / `toggleGuideSubtiles`). | Dois controles com mesmo nome fazem coisas de níveis diferentes. | Ambiente “Editar peças”; guia “Grade de peças”. IDs permanecem. |
| UX-18 | P2 / V,C | Convite de duplicação no topo `index.html:118`, lateral `:542`, aviso `:1192`, propriedades em `core/subtile_studio_ui.js:1920`. | Muitas chamadas competem pela mesma decisão. | Um botão primário por contexto; mensagens secundárias sem repetir a ação. |
| UX-19 | P2 / C,V | SVG à esquerda `index.html:558/561` e em Camadas `:1144/1145`; backup também aparece como seção e ação rápida. | O usuário precisa distinguir destinos pela localização. | Lugar canônico para SVG da peça; backup da biblioteca fora da área de exportar arte. |
| UX-20 | P2 / V,R | Simetria global/interna, subdivisão por quadrante e catálogo expandido disputam o dock inicial. | Dificulta a geração rápida, sobretudo para iniciantes. | Manter simetria global e peças em primeiro nível; simetria interna independente como opção avançada. |
| UX-21 | P2 / V,C | Texto de ajuda permanente é repetido no dock; coordenadas normalizadas e IDs aparecem no rodapé (`core/subtile_studio_ui.js:1918–2031`). | Espaço usado para explicar implementação em vez da próxima ação. | Dica curta da ferramenta no status; matemática detalhada em ajuda/Variantes. |
| UX-22 | P2 / V,R | Muitos itens ativos recebem azul/ciano forte simultaneamente; o pasteboard pontilhado também compete com guias e obra. | Hierarquia de ação e navegação pouco clara. | Cor forte para seleção/ação primária; guias com estado neutro e marca; pasteboard visualmente discreto. |
| UX-23 | P2 / C,R | Botões de alinhamento usam glifos `⇤ ⇹ ⇥ ⤒ ⇳ ⤓` em `core/subtile_studio_ui.js:2015–2022`. | Semântica e desenho variam entre plataformas. | SVGs da mesma família visual, nomes acessíveis e tooltips objetivos. |

### 5.3 Acessibilidade, foco e biblioteca

| ID | Prioridade / evidência | Falha e referência | Impacto | Correção-alvo |
|---|---|---|---|---|
| UX-24 | P1 / C | Campos do topo `index.html:31`, `:42`, `:66`, `:77`, `:94`, `:104` não têm label associado; title está no contêiner. | Nome/unidade não são identificáveis de forma confiável por tecnologia assistiva. | Label ou aria-label explícito por input, sem trocar seus IDs. |
| UX-25 | P1 / C | Propriedades geradas em `core/subtile_studio_ui.js:2317–2345` têm labels irmãos sem for/id. | Coordenadas ficam sem nome programático. | Associação real e unidade explícita; IDs de campo estáveis. |
| UX-26 | P1 / C | `outline:none` posterior em `style.css:4255/4263` sobrepõe regra de foco `:2207–2211`. | Usuário de teclado perde indicação de posição em campos vetoriais. | Regra específica de focus-visible ao final da cascata. |
| UX-27 | P1 / C | `renderLayersPanel` captura foco somente do checkbox (`core/subtile_studio_ui.js:2468`), recria lista (`:2481`) e restaura só checkbox (`:2761`). | Selecionar/acionar linha pelo teclado perde foco. | Restaurar por ID de forma + ação; fallback para vizinho em remoção. |
| UX-28 | P1 / C | Biblioteca captura/restaura somente row (`core/subtile_studio_ui.js:1399`, `:1829`). | Renomear, reordenar ou duplicar interrompe navegação por teclado. | Preservar item, controle, seleção de texto e scroll, conforme operação. |
| UX-29 | P2 / C | Row de família `core/subtile_studio_ui.js:1616–1618` e camada `:2529–2553` são role=button contendo botões/checkbox. | Semântica interativa aninhada e ordem de foco confusas. | List/listitem com botão principal e ações irmãs; não trocar cegamente para option. |
| UX-30 | P2 / C | Buscas `index.html:781`, `:1232` dependem de placeholder. | Campo perde identificação ao digitar. | Nome acessível permanente, limpar busca e quantidade de resultados. |
| UX-31 | P2 / C | `handleDuplicateFamily`, `core/subtile_studio_ui.js:969–1004`, não revela cópia sob busca/filtro, ao contrário da criação (`:882–932`). | Ação parece falhar ou cópia parece desaparecer. | Reutilizar revelação existente, focar/rolar até cópia e informar que filtro foi limpo. |
| UX-32 | P2 / C,H | Toda `updateFamily` chega a compilação global em `core/library_store.js:343–346`, `:664`; refresh amplo em `core/subtile_studio_ui.js:2767–2780`. | Trabalho desnecessário e possível latência; duração atual não foi medida. | Ignorar no-op, separar metadados/geométricos, medir antes de introduzir cache. |

### 5.4 Responsividade e orientação de estado

| ID | Prioridade / evidência | Falha ou hipótese e referência | Impacto | Correção-alvo |
|---|---|---|---|---|
| UX-33 | P2 / H,C | Laterais e grupos de status não encolhem (`style.css:503`, `:633–639`, `:822`); centro some em `:707–717`. | Possível perda de contexto ou colisão em 1024/1280px e zoom alto. | Testar matriz de viewports; priorizar zoom, ferramenta e erros; recolher detalhes secundários. |
| UX-34 | P2 / H,C | Breakpoints em `style.css:2583`, `:2630` comprimem campos/texto do topo. | Pode evitar overflow à custa de legibilidade. | Reorganizar em duas linhas em largura compacta; não depender de fonte menor. |
| UX-35 | P2 / V,R | Spout desligado mantém campo de nome e “off” no rodapé. | Configuração especializada ocupa a linha comum de trabalho. | “Spout: desligado” compacto; expandir nome/configuração ao solicitar conexão. |
| UX-36 | P2 / R | Falta uma apresentação única do alvo da exportação e do estado de salvamento entre ambientes. | Confusão entre imagem exportada, biblioteca JSON e trabalho salvo neste navegador. | Rótulos explícitos e estado de durabilidade; não chamar PNG/SVG de backup do projeto. |
| UX-37 | P2 / R | Tamanho, encaixe e escopo podem mudar o alcance de uma pincelada sem explicação visual suficiente. | Medo de editar ou necessidade de desfazer repetidamente. | Preview de área/propagação e resumo “Pincel · 2×2 · Neste bloco”, mantendo os seis escopos existentes. |
| UX-38 | P3 / R | Primeiro uso depende de explorar os painéis e ajuda. | Demora para entender a sequência mínima. | Dica inicial dispensável: escolher peças, gerar e editar; sem tour modal obrigatório. |
| UX-40 | P2 / C,R | Roda livre altera tamanho em edição do mosaico (`sketch.js:4523–4533`), move vista em Inspecionar (`:4544–4548`) e dá zoom no editor de peças (`:4536–4541`). | Um gesto comum muda de função entre ambientes; pode alterar tamanho sem intenção. | Padronizar roda para mover vista, Ctrl+roda para zoom e tamanho por controle/+−. A ferramenta Zoom mantém roda para zoom. Tratar como mudança deliberada de interação e atualizar ajuda/testes. |

## 6. Falhas da documentação e orientação ao próximo modelo

| ID | Evidência | Problema | Correção |
|---|---|---|---|
| DOC-01 | README `:318` versus `:347`; Manual `:259` versus `:296` | Gerador recolhido e visível aparecem como regras simultâneas. | Especificação viva única: Gerador visível; Histórico recolhido separadamente. |
| DOC-02 | README `:58/200/203/207` =44, `:310` =45; Manual `:33` =44, `:251` =45; skill gate =36 | Contagens contraditórias. | Resultado observado é 45. Evitar repetir contagem fixa; runner é fonte da lista. |
| DOC-03 | README `:310`, Manual `:251` | Comando usa `venv`, que não existe neste checkout. | Caminho disponível é `.venv`; `scripts/sync_knowledge.ps1:5–7` já o usa. |
| DOC-04 | `docs/README.md:33–59` antes desta entrega | Índice prioriza rodadas antigas e uma auditoria da rodada 2 como autoridade geral. | Dar entrada para estado atual e plano; registros antigos continuam históricos. |
| DOC-05 | `tests/test_ui_control_registry.js:16–49` | “60 controles” pode ser interpretado como limite de todos os IDs da aplicação. | São exatamente 60 IDs legados obrigatórios, cada um único. Novos controles podem ter outros IDs únicos. |
| DOC-06 | README `:174–194`; Manual `:134–159` | Quatro superfícies versus cinco áreas sem distinção clara. | Quatro superfícies de controle em torno de um viewport. |
| DOC-07 | `index.html:7` versus relato em `CORRECOES_SUBTILE_STUDIO.md:21` | Título ainda “Mosaic Generator”, apesar de editor completo. | Título “Tiling Stripes Studio”; não prometer alteração que não existe. |
| DOC-08 | README `:90` versus `:326` | Alt+arrasto documentado como Pan e captura. | Uma tabela de gestos por ambiente; preservar Alt para captura no mosaico. |
| DOC-09 | README `:194`, Manual `:159` | Ganho de ~306px ao recolher tratado como universal. | Descrever tokens por modo e medir o resultado real por viewport. |

As fontes primárias da auditoria são o código atual, os contratos vigentes e os testes. Relatórios históricos ajudam a localizar regressões, mas não comprovam que uma falha continua aberta.

## 7. O que já funciona e deve ser preservado

- Gerador visível e Histórico recolhido são estados atuais (`index.html:395–429`). Não “corrigir” isso de volta para uma versão antiga.
- Exportação do mosaico já usa buffer limpo e dimensão nativa (`sketch.js:3995–4024`). Não reabrir a denúncia genérica de exportar o canvas com guias/zoom.
- Undo/redo já atravessa gerações com `DocumentSnapshot` (`sketch.js:3077–3103`). O problema atual é cobertura incompleta de alterações visuais, não inexistência de snapshots.
- Backup de biblioteca atual apenas exporta JSON (`core/subtile_studio_ui.js:618–621`). A falha histórica de limpar undo não está nessa implementação.
- Abas Camadas/Propriedades/Biblioteca/Variantes já existem, com setas, Home e End (`index.html:1076`; `core/subtile_studio_ui.js:3224`). Não criar outro conjunto paralelo.
- Importação e confirmação do editor de peças já têm `inert`, contenção de Tab, Escape e restauração de foco (`core/subtile_studio_ui.js:589–617`). Reutilizar.
- Mestres padrão são protegidos; cópias editáveis existem. Preservar integridade do catálogo canônico.
- Entrada/saída do editor de peças conserva ferramenta do mosaico (`core/subtile_studio_ui.js:432–449`).
- Navegação do histórico já tenta preservar edições e informa descarte por orçamento (`sketch.js:1358–1375`). Não simplificar removendo essa proteção.
- Metadados de família são movidos para Biblioteca na inicialização (`core/subtile_studio_ui.js:3231`). O HTML isolado não descreve toda a disposição final.

## 8. Direção visual inspirada no Illustrator

Adotar hierarquia espacial, familiaridade das ferramentas, propriedades contextuais e informação de estado. Não copiar integralmente menus, atalhos ou complexidade do Illustrator.

As referências consultadas são oficiais:

- [Visão geral do workspace do Illustrator](https://helpx.adobe.com/sg/illustrator/desktop/get-started/learn-the-basics/workspace-overview.html): organização da obra, ferramentas, painéis contextuais e barra de estado.
- [Seleção e uso de ferramentas](https://helpx.adobe.com/illustrator/desktop/get-started/learn-the-basics/select-and-use-tools-in-the-toolbar.html): descoberta de atalhos e opções vinculadas à ferramenta.
- [Atalhos padrão do Illustrator](https://helpx.adobe.com/illustrator/using/default-keyboard-shortcuts.html): referência de convenções, com diferenças que devem ser respeitadas. Tab, por exemplo, já tem contrato próprio neste aplicativo.

A proposta é uma interpretação para esta ferramenta generativa: documento sempre identificável, ação primária única por contexto, propriedades relevantes e controles secundários previsíveis. O catálogo D4 e a geração continuam sendo o centro do produto.

## 9. Resultado esperado e validação pendente

Ao final do plano, o usuário deve conseguir gerar, restringir famílias, pintar uma região, apagar, preservar células e exportar sem aprender IDs, coordenadas normalizadas ou detalhes de armazenamento.

A avaliação final deve cobrir:

1. Geração e ajustes pelo mouse, sem depender de atalhos.
2. Configurar, selecionar ferramentas/famílias, gerar, recuperar e exportar somente por teclado, com foco visível. Pintura e desenho espacial continuam usando ponteiro neste plano; edição espacial integral por teclado exige um contrato próprio e não é declarada como coberta.
3. Recuperação com undo/redo e falhas simuladas de armazenamento.
4. Relação previsível entre ferramenta, tamanho, encaixe e alcance da simetria.
5. Legibilidade e acesso em 1440×900, 1280×800, 1366×768, 1024×768 e zoom do navegador elevado.
6. Exportações limpas e Spout sem regressões; conexão real de Spout permanece uma validação específica do ambiente.

Não considerar o trabalho encerrado apenas porque a suíte de contratos passa ou porque uma captura de tela parece mais limpa. O critério é concluir as jornadas com comportamento consistente, proteção do trabalho e pouca ambiguidade.
