# Workspace Tiling Stripes Studio

Use o Python local para todas as operações Graphify: `.\venv\Scripts\python.exe -m graphify`.
O vault do Obsidian fica em `_local/obsidian_vault`; abra essa pasta como vault.
Após alterações, execute `scripts/sync_knowledge.ps1` para atualizar o AST e exportar as notas.
Notas pessoais devem ficar fora das notas geradas; `INICIO_WORKSPACE.md` é o ponto de entrada local.
Aplique `.agents/skills/tiling-invariants-gate/SKILL.md` antes de entregar código.

## Interface (regra fixa)

Nenhum texto explicativo permanente na tela. A ordem é sempre ícone → nome curto (o mais curto que continue intuitivo). O nome completo aparece no hover (`title`/`data-tooltip`) e o detalhe fica atrás de um botão de info (`data-info-topic` → `INFO_TOPICS` em `ui_info.js`) ou do menu Ajuda. Avisos só aparecem quando um estado impede a ação e dizem apenas o necessário; diálogos com `role="dialog"` podem explicar a decisão. `node tests/test_ui_microcopy.js` reprova rótulo estático acima de 64 caracteres e ícone fora de ordem.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
