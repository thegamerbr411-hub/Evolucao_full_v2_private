# INFRA RELEASE

## Objetivo
Padronizar release Android e validacoes obrigatorias pre e pos deploy.

## Fluxo recomendado
1. Rodar checks de infraestrutura.
2. Validar OAuth em runtime real.
3. Validar login/reset/admin/export beta.
4. Gerar build preview.
5. Repetir smoke manual visual com scrcpy aberto.
6. So entao promover para release.

## Build atual
- app version: 1.2.4
- Android versionName: 1.2.4
- versionCode atual: 17
- EAS appVersionSource: remote

## Regras
- Incrementar versionCode a cada release Android.
- Nao mudar package/scheme sem atualizar OAuth/Firebase.
- Nao publicar sem resultado dos scripts de check.

## Comandos uteis
- powershell -ExecutionPolicy Bypass -File .\scripts\check-infra.ps1
- powershell -ExecutionPolicy Bypass -File .\scripts\check-oauth.ps1
- powershell -ExecutionPolicy Bypass -File .\scripts\check-render-config.ps1

## Gate de release
Release somente com:
- health ok
- oauth ok em runtime real
- export beta ok
- sem blocker P0/P1 aberto.