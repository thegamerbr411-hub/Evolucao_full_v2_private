# INFRA GOOGLE OAUTH

## Funcao

Autenticacao Google no app React Native/Expo com retorno para o app Android.

## Mapeamento atual

- Android client id (google-services): 910587302920-4sls8n06ol9vsedteutiur8mnvdg553q.apps.googleusercontent.com
- Web client id (google-services): 910587302920-1rg2n0809vbpqqi3i1tsvs2qptqngtml.apps.googleusercontent.com
- app scheme: evolucao
- package: com.tipolt.evolucaofullv2

## Redirect esperado no Android

- com.googleusercontent.apps.[prefixo-do-android-client-id]:/oauthredirect

## Erros historicos observados

- invalid_request: Custom URI scheme is not enabled for your Android client.
- invalid_request: Custom scheme URIs are not allowed for WEB client type.
- invalid_request: Code Challenge must be base64 encoded.

## Causas tipicas

- usar redirect custom de web client no fluxo Android.
- misturar client_id Android/Web de forma incorreta.
- PKCE/responseType incompativeis com a configuracao ativa.

## Regra de ouro

1. app.json scheme e package corretos.
2. AndroidManifest contem intent-filter para scheme do app e googleusercontent.
3. google-services.json contem oauth_client tipo 1 (android) e tipo 3 (web).
4. teste runtime real em device com retorno ao app.

## Prevencao de regressao

Rodar scripts/check-oauth.ps1 e registrar resultado em docs/ULTIMO_ESTADO_ESTAVEL.md.
