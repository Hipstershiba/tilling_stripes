@echo off
chcp 65001 >nul
setlocal
set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
echo ============================================
echo  Ponte Spout - Tiling Stripes Studio
echo  Deixe esta janela aberta enquanto usar.
echo.
echo  Procure a linha:
echo    [spout] ponte ouvindo em ws://127.0.0.1:8766
echo ============================================
echo.
if exist "%PY%" (
  "%PY%" -u "%~dp0spout_bridge.py"
) else (
  echo Python 3.12 nao encontrado no caminho padrao; tentando py -3.12...
  py -3.12 -u "%~dp0spout_bridge.py"
)
echo.
echo A ponte foi encerrada. Pressione qualquer tecla para fechar.
pause >nul
