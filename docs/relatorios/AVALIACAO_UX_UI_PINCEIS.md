# Avaliação de UX/UI e padronização dos tamanhos

Data: 27/10/2026. Escopo: ferramentas de edição do mosaico, navegação, indicação de estado e ajuste de tamanho.

## Método

Leitura dos caminhos de interação e inspeção da interface aberta em Zen Browser, com zoom do navegador em 90%. Foram observadas a disposição em uma janela larga e em uma janela compacta, a área do giro e sua mudança para 2×2 pelo botão de aumentar. A inspeção não constitui teste de usabilidade com usuários nem validação completa de todas as resoluções.

## Avaliação

A organização esquerda → canvas → propriedades à direita é coerente. Os pares de ferramentas e as guias manuais tornaram a navegação mais previsível. O principal problema era a inconsistência de uma mesma ação: mudar tamanho tinha regras, controles e explicações diferentes entre ferramentas.

| Achado | Impacto para o usuário | Tratamento |
|---|---|---|
| Girar/Travar davam a volta na lista de tamanhos | Aumentar podia diminuir abruptamente | Passos crescentes/decrescentes com limites; sem ciclo |
| Pintar tinha −/+ e outras ferramentas só presets | Era necessário reaprender o controle | Mesmo padrão − / medida / +, com presets como atalhos |
| Botões de tamanho não indicavam limites | Cliques sem efeito pareciam falha | Desativação visual nos limites |
| “3 subtiles” acompanhava “3×3” | Confusão entre lado e quantidade total | Unidade explícita: subtiles, linhas × colunas |
| Carimbo retangular podia ser exibido como 1×1 | Previsão incorreta da área que seria aplicada | Dimensões reais preservadas na indicação |
| Histórico parcial da roda podia passar para outra ferramenta | Primeiro gesto podia mudar tamanho inesperadamente | Acúmulo reiniciado por ferramenta, direção e intervalo; normalização de eventos em linhas/páginas |
| Escopos ainda anunciavam teclas 1–6 nos tooltips | Ajuda conflitava com o zoom e Q/Tab | Tooltips corrigidos para Q/Tab e Shift |
| Travar mostrava também paleta de pintura | Controles sem relação com a tarefa | Paleta de pincel ocultada durante a trava |
| Tamanho não era anunciado de forma acessível | Leitores de tela tinham pouco feedback | Rótulos explícitos e anúncio da medida |

## Comportamento entregue

Pintar/Carimbo e Girar crescem até o maior lado do mosaico, em subtiles. Travar cresce até um bloco, de acordo com a implementação de seleção da trava. Com ajuste do pincel ao bloco, cada passo corresponde a um bloco. Os presets “Bloco” continuam disponíveis explicitamente. Os caminhos de mouse e teclado usam a mesma ação de tamanho.

As teclas + e − ajustam a ferramenta ativa no mosaico, fora de campos de texto. A roda sobre o canvas faz o mesmo; Ctrl/Cmd + roda mantém zoom. Os colchetes continuam girando a orientação do pincel.

## Prioridades seguintes de interface

1. **Legibilidade:** muitos rótulos ainda têm 9–10 px. A ampliação deve ser acompanhada de uma revisão de espaço em telas compactas, e não aplicada como aumento global sem medir o layout.
2. **Histórico:** a lista extensa repete a mesma seed e cria ruído. Agrupar por geração ou oferecer busca tornaria a recuperação mais rápida.
3. **Descoberta de escopos:** “Centro”, “Órbita”, “Bloco” e “Todos” exigem conhecimento prévio; uma pequena ilustração de área afetada ajudaria iniciantes.
4. **Consistência de termos:** consolidar “tile/azulejo”, “snap/ajuste” e “supertile/bloco”, com nomenclatura estável na interface e ajuda.
5. **Avaliação com usuários:** medir tempo e erros em pintar, redimensionar, capturar carimbo, trocar escopo e recuperar uma edição; isso é necessário para avaliar facilidade de uso além da inspeção técnica.

## Verificação

A suíte de tamanho cobre limites, passos por bloco, ferramentas Girar/Travar, blocos pequenos, carimbos retangulares e desativação do botão no mínimo. A suíte completa do workspace deve passar antes da entrega. A conferência no navegador confirmou a presença dos novos controles e o tamanho 2×2 após aumentar o giro.

## Ampliação do editor, clone e cursores

O editor de pincel agora abre em popup pelo botão Ampliar editor. O mesmo conjunto de controles é transferido para o popup, com canvas de maior resolução, paleta ao lado, foco contido e retorno por Concluir/Esc. O tamanho visual é limitado para preservar o canvas quadrado e o mapeamento correto dos cliques. A revisão no navegador confirmou a abertura do popup.

A seleção de ferramentas passa por uma transição única que conclui edições pendentes e cancela gestos de captura/pintura anteriores. Pintor e clone guardam padrões independentes na sessão. Capturar tem entrada C, saída automática para aplicar ao soltar e cancelamento sem perder o clone anterior. A captura por blocos foi corrigida para arrasto em sentido inverso. Alterar ferramenta durante a captura impede que mouseup aplique uma seleção da ferramenta anterior.

Os cursores passam a refletir o estado: rotação circular, borracha, captura com mira, aplicação com cópia, zoom afastando com Alt e navegação com mão aberta/fechada. Pan e Espaço têm prioridade sobre ferramentas vetoriais; escopos incompatíveis mostram ação indisponível. O ajuste por roda e teclado também funciona no editor ampliado.

Verificação adicional: testes de captura/cancelamento, retorno entre pintor e clone, captura reversa por blocos, roda com inversão de direção e prioridade dos cursores. Correção posterior: os padrões independentes passam a ser persistidos no campo opcional `brushToolSessions` do payload v3, incluindo restauração quando o app foi fechado em Clone. A captura com Alt entra em Clone antes de substituir o padrão ativo. Saves antigos sem pincel separado usam um pincel normal 1×1 e preservam a captura na sessão de Clone.

## Revisão do editor e atalho Alt

O editor recebeu controles próprios de linhas/colunas, tinta selecionada, borracha, limpeza, desfazer/refazer e cancelamento. A paleta no popup apenas escolhe a tinta; pintar uma célula não substitui o restante do padrão. Redimensionar preserva as células existentes e adiciona espaço vazio. Cancelar/Esc restaura o estado anterior à abertura, e Concluir mantém a edição. O canvas recebe foco para que Ctrl+Z opere no histórico do pincel após editar dimensões. Alt dentro da grade amostra uma célula sem pintar.

No Clone, Alt+clique/arraste é o gesto principal de captura, seguido de aplicação ao soltar. O clique normal sem captura orienta o usuário a usar Alt. A troca persistente Capturar/Aplicar foi substituída por uma ação de captura e instrução curta; C permanece como alternativa. A prévia sem fonte mostra Aguardando captura.

Verificações: fluxo real do editor com escolha de tinta, preservação do conteúdo ao redimensionar e cancelamento conferidos no navegador. Os testes automatizados exercitam pintura por célula, redimensionamento retangular, borracha, histórico, cancelamento e o caminho real de Alt no canvas do mosaico.
