@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
title Evolucao - Gerador de Release APK

echo.
echo ================================================
echo   Evolucao - Gerar Release APK
echo ================================================
echo.

if not exist "android\gradlew.bat" (
  echo [ERRO] Arquivo android\gradlew.bat nao encontrado.
  goto :fail
)

cd /d "android"
echo [1/3] Executando build release...
call gradlew.bat assembleRelease --no-daemon
if errorlevel 1 (
  echo [ERRO] Build release falhou.
  goto :fail
)

cd /d "%~dp0"
set "APK_SOURCE=android\app\build\outputs\apk\release\app-release.apk"
if not exist "%APK_SOURCE%" (
  echo [ERRO] APK nao encontrado em: %APK_SOURCE%
  goto :fail
)

if not exist "build-output" mkdir "build-output"

echo [2/3] Copiando APK para build-output...
copy /Y "%APK_SOURCE%" "build-output\app-release.apk" >nul

for /f %%i in ('powershell -NoProfile -Command "(Get-Date).ToString('yyyyMMdd-HHmmss')"') do set "TS=%%i"
copy /Y "%APK_SOURCE%" "build-output\app-release-!TS!.apk" >nul

echo [3/3] Concluido com sucesso.
echo.
echo APK principal:
echo   %CD%\build-output\app-release.apk
echo.
echo Copia versionada:
echo   %CD%\build-output\app-release-!TS!.apk
echo.
echo Dica: para instalar no celular, use o script scripts\release-local-install.ps1
goto :end

:fail
echo.
echo Processo interrompido.

:end
echo.
if /I "%~1"=="--no-pause" (
  exit /b
)
pause
exit /b
