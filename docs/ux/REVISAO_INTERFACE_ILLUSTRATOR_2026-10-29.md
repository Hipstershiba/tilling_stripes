# Revisão da interface — referência Illustrator

Data: 29/10/2026. Escopo: revisão da organização de ferramentas, menus e propriedades na versão local, incluindo alterações que já estavam presentes no workspace. Não altera o produto.

Método: inspeção da estrutura HTML, regras de layout e navegação; consulta ao grafo do projeto e à documentação oficial da Adobe. Esta é uma avaliação estrutural. Não houve inspeção visual no navegador, medição de contraste, teste com usuários ou validação de dimensões em tela; os riscos de espaço abaixo precisam dessa confirmação.

## Parecer

A geografia atual já está alinhada ao Illustrator. A maior oportunidade é melhorar a previsibilidade: comandos equivalentes devem ocupar lugares equivalentes, os ícones precisam ser reconhecíveis e a barra superior deve deixar claro o contexto da ação. Uma mudança completa da disposição teria pouco benefício e prejudicaria a memória espacial.

Referências: [área de trabalho](https://helpx.adobe.com/au/illustrator/desktop/get-started/learn-the-basics/workspace-overview.html), [painel Propriedades](https://helpx.adobe.com/ca/illustrator/desktop/get-started/learn-the-basics/properties-panel-overview.html). A Adobe usa propriedades contextuais; neste projeto, o contrato determina contexto no topo e dock estático à direita. A inspiração deve respeitar essa diferença.

## Achados e prioridades

### 1. Alta — comandos equivalentes mudam de posição entre ambientes

No mosaico, Desfazer/Refazer ficam junto às abas Simetria/Escopo (`index.html`, `propertiesTabs`). No editor de peças, ficam na barra superior (`vec-undo-group`). Isso exige reaprender a localização ao trocar de ambiente e associa histórico a uma seção de propriedades.

Recomendação: manter os botões existentes por compatibilidade e criar acesso visual equivalente nos dois ambientes, reutilizando os mesmos comandos. O menu Editar deve continuar sendo a referência comum. Evitar mais de um conjunto visível por ambiente. Antes de mover controles, conferir os testes do registro congelado.

### 2. Alta — promessa dos atalhos precisa ser inequívoca

O botão de recolher o dock anuncia “Tab” no hover (`btnToggleRightDock`), enquanto o contrato canônico reserva Tab/Q ao ciclo de escopo. O código também contém tratamento de Tab para escopo (`cycleEditScope`). A dica pode induzir uma ação diferente da esperada.

Recomendação: retirar Tab dessa dica e preservar os atalhos canônicos. Mostrar atalhos de ferramenta de forma uniforme nos hovers: “Pincel (B)”, “Girar (R)”, “Carimbo (S)”, “Preservar (F)”, “Mão (H)” e “Zoom (Z)”. Alguns hovers atuais mostram apenas o nome; Espelhar já informa O. Confirmar cada associação no comportamento antes de publicá-la.

Não adotar o Tab do Illustrator para esconder painéis: ele conflita com o contrato deste projeto.

### 3. Média — barra superior tem papéis diferentes nos dois ambientes

O mosaico identifica a ferramenta e expõe suas opções. Em peças, `topBarTilesControls` reúne identidade do ativo, cópia editável, histórico, repetição, recorte e retorno à pintura.

Recomendação: no editor de peças, organizar visualmente três grupos curtos: peça ativa; opções da ferramenta/seleção; prévia. Manter a identificação da peça compacta. Garantir que selecionar Caneta, Seleção direta ou uma forma torne evidente quais opções estão disponíveis, sem trocar automaticamente as abas do dock.

### 4. Média — vocabulário fragmenta o modelo mental

A interface combina “Peças”, “Subtile”, “Tile”, “Carimbo” e “Clonar”. Exemplo: `toolStamp` tem nome interno visível Carimbo e hover Clonar; o menu Biblioteca usa “Importar subtile”.

Recomendação: usar “Peça” como unidade para o usuário e “Carimbo” como ferramenta. “Biblioteca” é o catálogo; “Conjunto” agrupa peças; “Pincel” é o padrão aplicado. Manter os termos técnicos na ajuda quando necessários. Nomes curtos na tela e nomes completos com atalhos no hover, sem frases explicativas permanentes.

### 5. Média — ferramentas, guias e estados devem ser distinguíveis

A coluna esquerda usa botões semelhantes para ferramentas exclusivas e guias que podem coexistir. O agrupamento já existe, inclusive separação de Mão/Zoom, e deve ser preservado.

Recomendação: conferir visualmente três estados diferentes: ferramenta selecionada, guia ligada e controle em foco pelo teclado. Organizar por seleção → criação/edição → transformação/preservação → navegação. Manter duas colunas e não esconder ferramentas frequentes em menus de pressão longa sem uma alternativa clara.

### 6. Média — pouco espaço pode comprometer os painéis internos

Os flyouts abrem à esquerda do trilho e podem ter até 320 px; suas listas e a paleta usam mínimos de altura de 120 px. A barra superior reduz espaços em 1180 e 980 px. Isso indica pontos para inspeção, não prova de sobreposição.

Recomendação: verificar 1366×768, 1440×900 e 1920×1080, incluindo zoom do navegador a 125%. Testar dock aberto/recolhido e flyout aberto. Gerar e Exportar devem permanecer acessíveis; apenas listas e corpos internos devem rolar. O flyout precisa continuar aberto durante interação com o canvas.

## Disposição recomendada

| Superfície | Conteúdo |
| --- | --- |
| Menus globais | Arquivo · Editar · Objeto · Exibir · Biblioteca · Ajuda |
| Barra superior | Ferramenta ativa e opções imediatas; contexto compacto da peça no editor |
| Coluna esquerda | Ferramentas em duas colunas, navegação, guias e amostras |
| Centro | Prancheta como foco visual, pan e zoom |
| Trilho direito | Histórico · Peças · Documento · Biblioteca |
| Dock direito | Gerar/semente; Simetria/Escopo; Pincel; Exportar |

Preservar a biblioteca em página própria: comparar, buscar e organizar ativos demanda área maior. Preservar menus como acesso completo e painéis como acesso frequente. Não acrescentar menus vazios apenas para copiar o Illustrator.

## Sequência sugerida para implementação

1. Corrigir dicas de atalhos e uniformizar nomes.
2. Harmonizar histórico e grupos da barra superior entre ambientes.
3. Refinar estados, separadores e densidade após inspeção visual.
4. Validar fluxos completos: gerar → pintar → desfazer → exportar; biblioteca → editar peça → testar no mosaico → voltar.

Critérios: ferramenta ativa identificável; propriedades estáveis ao trocar ferramenta; foco visível; menu navegável por teclado; nenhuma frase explicativa permanente; acesso a Gerar/Exportar sem rolagem do dock inteiro; 60 controles preservados; suíte de invariantes aprovada antes de entregar alterações de código.
