# Documentação — Tiling Stripes Studio

Índice do acervo documental. **Nenhum `.md` fica solto na raiz além do `README.md`.**

```
docs/
├── README.md                  este índice
├── MANUAL_MANUTENCAO.md       arquitetura, álgebra D4, persistência e regras de manutenção
├── instrucoes/                o que foi pedido em cada rodada
├── relatorios/                o que foi entregue e o que foi auditado
└── analise/                   pranchas da análise de famílias e conjuntos
```

---

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

## Pranchas (`analise/`)

As imagens da análise ficam em [`analise/`](analise/): atlas das 31 famílias, prancha das 10 famílias propostas, painéis dos 9 conjuntos, matriz família × conjunto e prova de emendas.

---

## Como ler este acervo

1. **Para entender o app:** comece pelo [README](../README.md) e depois pelo
   [manual](MANUAL_MANUTENCAO.md).
2. **Para retomar o trabalho:** leia a instrução da rodada em aberto e o relatório da rodada
   anterior.
3. **Para saber em quem confiar:** `relatorios/` é o que o agente de implementação *declarou*;
   `AVALIACAO_DEEPSEEK_RODADA2.md` é o que foi *verificado*. Quando os dois divergirem, vale a
   auditoria — e a rodada 3 nasceu exatamente dessa divergência.

## Notas de manutenção

- Especificações e relatórios são **registro histórico**: não os reescreva depois do fato. Correção
  de conteúdo vai no documento vivo (`README.md`, `MANUAL_MANUTENCAO.md`) ou em relatório novo.
- Relatórios antigos contêm links `file:///c:/Users/hipstershiba/...` e caminhos de outra máquina.
  São preservados como registro; use os caminhos relativos deste índice.
- Screenshots de evidência ficam em [`tests/screenshots/`](../tests/screenshots/), não aqui.
