$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $workspacePath
try {
    & .\.venv\Scripts\python.exe -m graphify update .
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao atualizar Graphify' }
    & .\.venv\Scripts\python.exe -m graphify export obsidian --dir _local/obsidian_vault
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao exportar vault Obsidian' }
} finally { Pop-Location }
