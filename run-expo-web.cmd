@echo off
setlocal

cd /d "%~dp0"

set "NODE_VERSION=v22.22.2"
set "NODE_FOLDER=node-%NODE_VERSION%-win-x64"
set "TOOLS_DIR=%CD%\.tools"
set "NODE_DIR=%TOOLS_DIR%\%NODE_FOLDER%"
set "NODE_EXE=%NODE_DIR%\node.exe"
set "NPM_CMD=%NODE_DIR%\npm.cmd"
set "CLI_PATH=%CD%\node_modules\expo\bin\cli"

if not exist "%NODE_EXE%" (
  echo Preparing local Node.js %NODE_VERSION%...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "$toolsDir = Join-Path (Get-Location) '.tools';" ^
    "$nodeVersion = 'v22.22.2';" ^
    "$zipName = 'node-' + $nodeVersion + '-win-x64.zip';" ^
    "$zipUrl = 'https://nodejs.org/dist/' + $nodeVersion + '/' + $zipName;" ^
    "$zipPath = Join-Path $toolsDir $zipName;" ^
    "$extractDir = Join-Path $toolsDir ('node-' + $nodeVersion + '-win-x64');" ^
    "New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null;" ^
    "if (-not (Test-Path $zipPath)) { Invoke-WebRequest $zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 120 };" ^
    "if (-not (Test-Path $extractDir)) { Expand-Archive -LiteralPath $zipPath -DestinationPath $toolsDir -Force }"
  if errorlevel 1 exit /b 1
)

if not exist "%CLI_PATH%" (
  echo Installing runtime dependencies...
  call "%NPM_CMD%" ci --omit=dev
  if errorlevel 1 exit /b 1
)

echo Starting Expo Web on http://127.0.0.1:8081/
"%NODE_EXE%" "%CLI_PATH%" start --web --host localhost --port 8081 --clear %*
