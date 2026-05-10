# INFRA FIREBASE

## Funcao

Fornecer identidade Google/Firebase, projeto mobile e artefatos Android.

## Projeto atual

- project_id: t-evo-b069a
- project_number: 910587302920
- Android package: com.tipolt.evolucaofullv2

## Arquivos chave

- android/app/google-services.json
- app.json (package/scheme/version)

## SHA e assinaturas

Firebase deve manter SHA-1 e SHA-256 validos para assinatura debug/release.
Mudanca de keystore sem atualizar SHA gera falha de login Google e push/auth.

## O que quebra se alterar errado

- package name divergente: app perde vinculacao do Firebase.
- google-services.json desatualizado: oauth/auth quebram.
- SHAs faltando: Google login falha no device.

## Validacao rapida

1. package em app.json e google-services.json deve ser igual.
2. web client e android client presentes no google-services.json.
3. login Google inicia consent sem invalid_request.

## Prevencao de regressao

Rodar scripts/check-oauth.ps1 e scripts/check-env.ps1 antes de build/release.
