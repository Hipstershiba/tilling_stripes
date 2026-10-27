# Documentação — Tiling Stripes Studio

Índice do acervo documental. **Nenhum `.md` fica solto na raiz além do `README.md`.**

```
docs/
├── README.md                  este índice
├── MANUAL_MANUTENCAO.md       arquitetura, álgebra D4, persistência e regras de manutenção
├── ux/                       auditoria e plano executável de interface/experiência
├── instrucoes/                o que foi pedido em cada rodada
├── relatorios/                o que foi entregue e o que foi auditado
└── analise/                   pranchas da análise de famílias e conjuntos
```

---

## Interface e experiência — plano atual

A revisão de 27/10/2026 prioriza **gerar mosaicos e fazer ajustes rápidos**, conforme orientação do usuário. É uma especificação de melhorias; não representa correções já implementadas.

- [Auditoria geral de UI/UX](ux/AUDITORIA_UX_2026-10-27.md) — estrutura, jornadas, 40 achados e oportunidades de interface/experiência, 9 problemas documentais, evidências e limites da análise.
- [Plano executável de implementação](ux/PLANO_IMPLEMENTACAO_UI_UX.md) — decisões de design, glossário, atalhos, estados, 17 tarefas com dependências/testes e roteiro de aceite.

Para implementar essa revisão, comece pelo plano e confirme o estado atual do código. Relatórios e instruções de rodadas anteriores são registros históricos; uma falha descrita neles pode já ter sido corrigida.

## Especificações (`instrucoes/`)

| Documento | Rodada | Objetivo |
|---|---|---|
| [INSTRUCOES_GEMINI_38_FLASH.md](instrucoes/INSTRUCOES_GEMINI_38_FLASH.md) | 1 | Usabilidade do painel Editor, persistência, correção D4 |
| [INSTRUCOES_GEMINI_RODADA2.md](instrucoes/INSTRUCOES_GEMINI_RODADA2.md) | 2 | Divulgação progressiva, densidade de UI, contrato D4 no editor, debounce |
| [INSTRUCOES_GEMINI_RODADA3.md](instrucoes/INSTRUCOES_GEMINI_RODADA3.md) | 3 | Fechar o que foi declarado pronto (debounce, chip, chave de storage, ajuda) com prova que falha no baseline |
| [INSTRUCOES_GEMINI_RODADA4.md](instrucoes/INSTRUCOES_GEMINI_RODADA4.md) | 4 | Arquitetura de informação das barras: modo no cabeçalho do dock, gaveta de 44 px, acordeão de painéis, cores no rodapé esquerdo, zoom/Ajustar/1:1 juntos |
| [INSTRUCOES_GEMINI_RODADA4_1.md](instrucoes/INSTRUCOES_GEMINI_RODADA4_1.md) | 4.1 | Correção cirúrgica: trava sobrevivendo à geração, histórico sem perder edição, e redesenho da integração da Trava (modo, tamanho, escopo, undo) |
| [INSTRUCOES_GEMINI_RODADA4_2.md](instrucoes/INSTRUCOES_GEMINI_RODADA4_2.md) | 4.2 | Segurança do documento: snapshot antes de gerar, aviso de edições em risco e `Ctrl+Z` atravessando a geração |
| [INSTRUCOES_GEMINI_RODADA6.md](instrucoes/INSTRUCOES_GEMINI_RODADA6.md) | 6 | Geografia invertida: faixa esquerda reservada, canvas, ferramentas à direita, painel contextual; exportar no rodapé, guias de volta, respiro numérico, wheel e switches |
| [INSTRUCOES_GEMINI_RODADA5.md](instrucoes/INSTRUCOES_GEMINI_RODADA5.md) | 5 | Gramática de conjuntos, 10 famílias novas (IDs 85–103), UI de conjuntos e ajustes de harmonia |

## Relatórios e auditorias (`relatorios/`)

| Documento | Autor | Conteúdo |
|---|---|---|
| [RELATORIO_IMPLEMENTACAO_INSTRUCOES.md](relatorios/RELATORIO_IMPLEMENTACAO_INSTRUCOES.md) | Antigravity | Entrega da Rodada 1 |
| [RELATORIO_DEEPSEEK_RODADA2.md](relatorios/RELATORIO_DEEPSEEK_RODADA2.md) | Antigravity | Entrega da Rodada 2 |
| [AVALIACAO_DEEPSEEK_RODADA2.md](relatorios/AVALIACAO_DEEPSEEK_RODADA2.md) | DeepSeek | Auditoria da Rodada 2: 4 afirmações do relatório não se sustentam no código, com arquivo:linha |
| [RELATORIO_RODADA3.md](relatorios/RELATORIO_RODADA3.md) | Antigravity | Entrega da Rodada 3 |
| [AVALIACAO_DEEPSEEK_RODADA3.md](relatorios/AVALIACAO_DEEPSEEK_RODADA3.md) | DeepSeek | Auditoria da Rodada 3: tarefas confirmadas no código; uma captura de prova duplicada e um defeito no runner |
| [RELATORIO_RODADA4.md](relatorios/RELATORIO_RODADA4.md) | Antigravity | Entrega da Rodada 4: reorganização das quatro superfícies, gaveta com régua de 44 px e acordeão |
| [AVALIACAO_DEEPSEEK_RODADA4.md](relatorios/AVALIACAO_DEEPSEEK_RODADA4.md) | DeepSeek | Auditoria da Rodada 4: layout confirmado no código; duas capturas duplicadas, a extensão de freeze fora do git e dois P0 funcionais (freeze não sobrevive à geração; histórico apaga a edição) |
| [ANALISE_SUBTILES_FAMILIAS_CONJUNTOS.md](relatorios/ANALISE_SUBTILES_FAMILIAS_CONJUNTOS.md) | DeepSeek | Análise de sinergia/harmonia dos 85 subtiles, 31 famílias e 9 conjuntos; 10 famílias propostas |
| [AVALIACAO_GEMINI_RODADA6_E_4_2.md](relatorios/AVALIACAO_GEMINI_RODADA6_E_4_2.md) | Gemini | Auditoria das Rodadas 4.2/6: contradição spec × teste, camada 3 fantasma e capturas duplicadas |
| [AVALIACAO_DEEPSEEK_RODADA6_E_LAYOUT.md](relatorios/AVALIACAO_DEEPSEEK_RODADA6_E_LAYOUT.md) | DeepSeek | Auditoria do HEAD pós-pivô: UI 1440 confirmada; P0 no snapshot de geração, camada 3 ausente, testes não probatórios e docs desatualizados |
| [ANALISE_CRITICA_APLICACAO.md](relatorios/ANALISE_CRITICA_APLICACAO.md) | DeepSeek | Análise crítica do estado atual (HEAD `255e5d0`): dirty guard morto, IDB sobrescrito pelo cache local, exportação não-plotter, acessibilidade e desempenho |

## Pranchas (`analise/`)

As imagens da análise ficam em [`analise/`](analise/): atlas das 31 famílias, prancha das 10 famílias propostas, painéis dos 9 conjuntos, matriz família × conjunto e prova de emendas.

---

## Como ler este acervo

1. **Para entender o app:** comece pelo [README](../README.md) e depois pelo
   [manual](MANUAL_MANUTENCAO.md).
2. **Para executar a revisão de interface:** leia o [plano de UI/UX](ux/PLANO_IMPLEMENTACAO_UI_UX.md)
   e sua auditoria; as tarefas ainda planejadas estão indicadas no quadro de acompanhamento.
3. **Para retomar outra rodada:** identifique a instrução vigente e confira no código o que
   já foi implementado. Relatórios e auditorias antigos descrevem a base de sua própria rodada;
   não são uma comprovação automática do estado atual.

## Notas de manutenção

- Especificações e relatórios são **registro histórico**: não os reescreva depois do fato. Correção
  de conteúdo vai no documento vivo (`README.md`, `MANUAL_MANUTENCAO.md`) ou em relatório novo.
- Relatórios antigos contêm links `file:///c:/Users/hipstershiba/...` e caminhos de outra máquina.
  São preservados como registro; use os caminhos relativos deste índice.
- Screenshots de evidência ficam em [`tests/screenshots/`](../tests/screenshots/), não aqui.
