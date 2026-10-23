@echo off
rem Avvia la galleria delle carte e la apre nel browser (http://127.0.0.1:8765)
cd /d "%~dp0\..\.."
start "" http://127.0.0.1:8765
python tools\galleria\server.py
pause
