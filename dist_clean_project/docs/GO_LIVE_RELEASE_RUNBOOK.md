# Go-Live Runbook (Evolucao Full V2)

## 1) Pre-flight local

1. Instale dependencias: `npm install`
2. Rode a suite principal: `npm run test:all`
3. Rode teste de API dashboard: `npm --prefix dashboard test`
4. Rode validacao de producao: `npm run qa:prod:check`
5. Verifique relatorio: `artifacts/production-check.json`

## 2) Build Android para publicacao

1. Gere APK release (sanidade local):
   - `cd android`
   - `./gradlew.bat assembleRelease`
2. Gere AAB para Play Console:
   - `./gradlew.bat bundleRelease`
3. Artefato final:
   - `android/app/build/outputs/bundle/release/app-release.aab`

## 3) Variaveis obrigatorias (app)

Definir no ambiente de build/CI:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_QA_API_BASE_URL`
- `EXPO_PUBLIC_QA_CLIENT_ID`
- `EXPO_PUBLIC_QA_API_KEY`
- `EXPO_PUBLIC_APP_VERSION`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

## 4) Variaveis obrigatorias (backend Render)

- `NODE_ENV=production`
- `ENABLE_QA_LOCAL_BYPASS=0`
- `ADMIN_USER`
- `ADMIN_PASS`
- `JWT_SECRET`
- `DEFAULT_CLIENT_ID`
- `CLIENT_API_KEYS`
- `APP_API_KEY`

## 5) Hardening antes de abrir para usuarios

1. Rotacionar segredos fracos (nao usar `123456` ou `super_secret`).
2. Confirmar `ENABLE_QA_LOCAL_BYPASS=0` em producao.
3. Validar login admin + token client no dashboard web.
4. Validar login Google no app com OAuth real configurado.

## 6) Play Console

1. Upload do `app-release.aab`.
2. Completar ficha da loja (descricao, categoria, contato, privacidade).
3. Subir icone/splash finais de marca.
4. Revisar politicas e classificacao de conteudo.
5. Publicar em teste fechado e validar metricas basicas (crash-free, login, treino, sync).
