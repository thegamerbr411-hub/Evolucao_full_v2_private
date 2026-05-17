# Google OAuth `invalid_client` — checklist (Android release)

**Evidência típica:** HTTP 401 `invalid_client` na troca de código ou no browser Google.

## Hipótese mais comum (release)

O APK **release** assina com **keystore diferente** do debug. O **SHA-1 / SHA-256** desse keystore **não** está no cliente OAuth **Android** do Google Cloud / Firebase para o package `com.tipolt.evolucaofullv2`.

## O que fazer (consola Google / Firebase)

1. Obter SHA do keystore de **release** (o mesmo do CI ou `android/app`):
   - `keytool -list -v -keystore <release.keystore> -alias <alias>`
2. Firebase Console → Definições do projeto → a tua app Android → adicionar impressões digitais **SHA-1** e **SHA-256**.
3. Google Cloud Console → APIs e serviços → Credenciais → cliente OAuth tipo **Android** → mesmo package + SHA.
4. Descarregar **google-services.json** atualizado para `android/app/` (se o pipeline não o gerar).
5. Garantir que `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` (e Web client se usado no backend) correspondem ao projeto certo.

## Patch no código (já aplicado)

- Troca PKCE (`exchangeCodeAsync`) usa o **mesmo** `clientId` que o pedido de autorização (`clientIdForOAuth`), evitando `invalid_client` por **mismatch de client** entre authorize e token.

## Ícone genérico

`app.json` já define `icon` / `splash` / `adaptiveIcon`. É preciso **APK novo** (`expo prebuild --clean` + build release) e, no device, **desinstalar** a app antiga se o launcher cachear ícone.
