---
name: graphify
description: >-
  Use this skill when exploring the codebase architecture, querying relationships or call paths between functions/modules, tracing data flow, or incrementally updating the AST knowledge graph and Obsidian exports in this workspace.
---

# Graphify Codebase Navigator

This skill guides the agent on how to use the local **Graphify** knowledge graph generated for `tiling_stripes`. It eliminates blind searches and full-file token consumption by querying the project's Abstract Syntax Tree (AST) directly.

## Execution Environment

All Graphify commands in this repository MUST be executed using the project's local virtual environment:

```powershell
# Command prefix
.\.venv\Scripts\python.exe -m graphify <subcommand>
```

---

## 1. Fast Path — Querying the Existing Graph

The pre-built graph is located in `graphify-out/graph.json` (1,800+ nodes, 3,300+ edges).

### A. Natural Language Query (BFS Traversal)
Use when asking how a feature works, what calls a function, or how two modules connect:
```powershell
.\.venv\Scripts\python.exe -m graphify query "<sua pergunta ou símbolo>"
```
*Tip: Add `--budget 1500` to limit token output, or `--dfs` for a deep linear trace.*

### B. Finding the Shortest Path Between Nodes
Use when analyzing coupling between two components (e.g. how `sketch.js` reaches `tile_registry.js`):
```powershell
.\.venv\Scripts\python.exe -m graphify path "sketch.js" "tile_registry.js"
```

### C. Explaining a Symbol or File
Use to inspect the neighbors, callers, and dependencies of a specific function or file:
```powershell
.\.venv\Scripts\python.exe -m graphify explain "generateMosaic"
```

---

## 2. Updating the Knowledge Graph

Whenever significant code changes or refactors are made:

1. **Incremental Update (AST only, no LLM required):**
   ```powershell
   .\.venv\Scripts\python.exe -m graphify update .
   ```
   This updates `graphify-out/graph.json` and `graphify-out/GRAPH_REPORT.md` in seconds.

2. **Re-export to Obsidian Vault:**
   To synchronize the local Obsidian vault located in `_local/obsidian_vault`:
   ```powershell
   .\.venv\Scripts\python.exe -m graphify export obsidian --dir _local/obsidian_vault
   ```
