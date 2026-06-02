@echo off
title HIFZ TRACKER 2.0 — Launcher

echo.
echo  ========================================
echo    HIFZ TRACKER 2.0  ^|  ZaryahPlus
echo  ========================================
echo.

:: ── Kill any previous instances on our ports ──────────────────────────────
echo [1/4] Clearing old processes on ports 8081 and 3000...

for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8081 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /T /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /T /F >nul 2>&1
)

echo Done.
echo.

:: ── Start Backend (FastAPI + uvicorn with --reload) ───────────────────────
echo [2/4] Starting backend on http://127.0.0.1:8081  (with auto-reload)...
start "HIFZ Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8081 --reload --reload-exclude \"*.db\" --reload-exclude \"*.db-journal\""

:: ── Give uvicorn a moment to boot ─────────────────────────────────────────
echo [3/4] Waiting for backend to start...
timeout /t 3 /nobreak >nul

:: ── Start Frontend (Python HTTP server) ───────────────────────────────────
echo [4/4] Starting frontend on http://localhost:3000 ...
start "HIFZ Frontend" cmd /k "cd /d "%~dp0frontend" && python -m http.server 3000"

:: ── Open browser ──────────────────────────────────────────────────────────
timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo.
echo  ========================================
echo   Backend  : http://127.0.0.1:8081
echo   Frontend : http://localhost:3000
echo   API Docs : http://127.0.0.1:8081/docs
echo  ========================================
echo.
echo  Both servers are running in separate windows.
echo  Close those windows to stop the servers.
echo.
pause
