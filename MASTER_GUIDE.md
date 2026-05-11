# MASTER GUIDE OPERACIONAL - EVOLUCAO

## 0) Objetivo deste guia
Este documento foi feito para operacao real, inclusive por quem nao e da area tecnica.

Com ele, voce consegue:
1. entender a infraestrutura;
2. subir e monitorar os servicos;
3. corrigir problemas comuns sem quebrar o sistema;
4. gerar APK e reinstalar release;
5. operar Render, GitHub Actions, Firebase e OAuth;
6. seguir um processo de qualidade sem PASS falso.

## 1) Visao geral do sistema (linguagem simples)
1. Frontend (app): e o aplicativo Android que o usuario abre no celular.
2. Backend (API): e o servidor que recebe login, social, ranking, admin, etc.
3. Render: e onde o backend fica hospedado na internet.
4. Firebase: e a plataforma de autenticacao e servicos de apoio (projeto do app).
5. GitHub Actions: e o robo de automacao que compila e valida o projeto no GitHub.
6. OAuth Google: e a integracao de login com Google.
7. APK: e o arquivo de instalacao Android da release.
8. Banco/dados: o backend mantém dados de usuarios e fluxos de dominio.
9. OCR: recurso que le imagem e extrai dados de texto/nutricao.
10. Coach: tela/fluxo de acompanhamento e recomendacao.
11. Admin: painel com funcoes internas (usuario, codigo PRO, dados de conta, etc).

## 2) Mapa da infraestrutura
1. App mobile (React Native + Expo): roda no dispositivo.
2. API backend (Node/Express): [backend/server.js](backend/server.js).
3. Deploy backend (Render): configurado por [render.yaml](render.yaml).
4. CI/CD (GitHub):
	1. CI geral: [.github/workflows/test.yml](.github/workflows/test.yml)
	2. Release APK: [.github/workflows/release-apk-on-push.yml](.github/workflows/release-apk-on-push.yml)
5. OAuth/Google client IDs:
	1. android: EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
	2. web: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
6. Firebase config (app): variaveis EXPO_PUBLIC_FIREBASE_* no [.env](.env).

### URLs importantes
1. API producao: https://evolucao-api-dou2.onrender.com
2. Health API: https://evolucao-api-dou2.onrender.com/health
3. Health API alias: https://evolucao-api-dou2.onrender.com/api/health
4. Render dashboard: servico evolucao-api-dou2
5. GitHub Actions workflow release: Release APK on Push

### Variaveis criticas
1. Backend:
	1. JWT_SECRET
	2. RESEND_API_KEY
	3. PASSWORD_RESET_URL
2. App/Firebase:
	1. EXPO_PUBLIC_FIREBASE_API_KEY
	2. EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
	3. EXPO_PUBLIC_FIREBASE_PROJECT_ID
	4. EXPO_PUBLIC_FIREBASE_APP_ID
3. OAuth:
	1. EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
	2. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
	3. EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID
4. Versao publica:
	1. EXPO_PUBLIC_APP_VERSION

## 3) Tutoriais passo a passo

### 3.1 Reiniciar backend no Render
1. Abrir dashboard do Render.
2. Entrar no servico evolucao-api-dou2.
3. Ir em Manual Deploy.
4. Acionar deploy da revisao desejada.
5. Validar logs e health.

### 3.2 Ver logs e saber se API caiu
1. Abrir Render > Logs.
2. Filtrar por error, exited, status, EADDRINUSE.
3. Rodar health check:
	1. browser: /health
	2. opcional: /api/health
4. Se /health nao responder 200, tratar como incidente.

### 3.3 Validar health endpoint por script
1. No terminal, na raiz do projeto:
2. executar: npm run ops:health:smoke
3. esperar status:
	1. /health = 200
	2. /api/health = 200
	3. /auth/login-password = 400
	4. /api/auth/login-password = 400

### 3.4 Gerar APK nova release
1. Atualizar versao Android em [android/app/build.gradle](android/app/build.gradle):
	1. versionCode +1
	2. versionName nova versao
2. Atualizar EXPO_PUBLIC_APP_VERSION em [.env](.env).
3. Rodar gate de release:
	1. npm run release:gate
4. Gerar APK:
	1. npm run release:apk
5. Artefato final:
	1. [build-output/app-release.apk](build-output/app-release.apk)

### 3.5 Instalar APK no dispositivo
1. Conectar celular com depuracao USB ligada.
2. Rodar:
	1. npm run release:install
3. Confirmar abertura do app apos instalacao.

### 3.6 Rodar pipeline GitHub Actions
1. Fazer push no branch evolucao-app.
2. Abrir Actions > Release APK on Push.
3. Verificar se job build-release-apk ficou green.
4. Baixar artifact APK do run.

### 3.7 Verificar OAuth quebrado
1. Erros comuns:
	1. Custom URI scheme not enabled
	2. invalid_request
2. Validar variaveis Google no [.env](.env).
3. Validar cliente Android no Google Cloud.
4. Validar que [src/services/authService.js](src/services/authService.js) usa:
	1. androidClientId no Android
	2. web/expo client no fluxo web
5. Rodar preflight:
	1. npm run ops:preflight

### 3.8 Trocar variavel critica sem quebrar
1. Alterar variavel no lugar correto:
	1. app: [.env](.env)
	2. backend deploy: Render env
2. Nao commitar segredo sensivel.
3. Rodar:
	1. npm run ops:preflight
	2. npm run release:gate

### 3.9 Reverter deploy
1. Render > Events.
2. Encontrar ultimo deploy green.
3. Usar Rollback.
4. Validar /health e smoke remoto.

### 3.10 Limpar app e relogar Google
1. Limpar dados:
	1. adb -s SERIAL shell pm clear com.tipolt.evolucaofullv2
2. Abrir app.
3. Repetir login Google real.
4. Validar se session e perfil carregam sem erro.

### 3.11 Teste rapido social
1. Logar conta A e conta B.
2. Fazer convite/aceite.
3. Ver feed e ranking.
4. Confirmar XP atualizou.

### 3.12 Teste rapido OCR
1. Abrir tela OCR.
2. Capturar imagem real.
3. Validar retorno e sem crash.

## 4) Comandos importantes (o que faz, quando usar, risco, esperado)
1. npm run ops:preflight
	1. faz: valida infra, oauth, pipeline, env e arquivos criticos.
	2. usar: antes de deploy/release.
	3. risco: baixo.
	4. esperado: SUMMARY Preflight operacional PASS.
2. npm run release:gate
	1. faz: check-env + preflight + smoke local + smoke remoto.
	2. usar: antes de gerar APK final.
	3. risco: baixo.
	4. esperado: PASS Gate de release aprovado.
3. npm run release:apk
	1. faz: compila APK release local.
	2. usar: gerar artefato para distribuicao.
	3. risco: medio (demora e pode falhar por ambiente).
	4. esperado: APK em build-output/app-release.apk.
4. npm run release:install
	1. faz: compila e instala no dispositivo conectado.
	2. usar: homologacao local rapida.
	3. risco: medio (dependencia de ADB/device).
	4. esperado: app abre no device.
5. npm run test:basic
	1. faz: smoke local do backend (health + rotas essenciais).
	2. usar: validar backend apos alteracoes.
	3. risco: baixo.
	4. esperado: [test:basic] ok.
6. npm run ops:health:smoke
	1. faz: smoke remoto no Render.
	2. usar: validar producao apos deploy.
	3. risco: baixo.
	4. esperado: SMOKE PASS.
7. adb devices
	1. faz: lista dispositivos conectados.
	2. usar: antes de instalar APK.
	3. risco: baixo.
	4. esperado: serial em status device.

## 5) Anti-quebra (obrigatorio)

### Nao alterar sem extremo cuidado
1. [render.yaml](render.yaml): rootDir, buildCommand, startCommand, healthCheckPath.
2. [backend/server.js](backend/server.js): rotas base e aliases /api.
3. [src/services/authService.js](src/services/authService.js): escolha de client por plataforma no OAuth.
4. [.github/workflows/release-apk-on-push.yml](.github/workflows/release-apk-on-push.yml): fluxo de build APK.
5. [android/app/build.gradle](android/app/build.gradle): versionCode/versionName e assinatura.

### O que quebra cada area
1. OAuth quebra quando:
	1. client_id errado para Android.
	2. fluxo Android usa cliente web com URI custom.
2. Release APK quebra quando:
	1. gradlew/SDK/JDK faltando.
	2. workflow CI depende de segredo inexistente.
3. Render quebra quando:
	1. rootDir ou comando de start incorreto.
	2. env critica ausente.
4. CI quebra quando:
	1. workflow com passos obsoletos.
	2. preflight falha.
5. Login quebra quando:
	1. OAuth invalido.
	2. backend auth fora.
6. PRO quebra quando:
	1. codigo teste removido sem substituicao.
	2. contexto nao expoe funcoes de ativacao.
7. Social quebra quando:
	1. API social indisponivel.
	2. convites sem IDs validos.

### Checklist obrigatorio antes de commit/deploy/release
1. npm run ops:preflight passou.
2. npm run release:gate passou.
3. logs sem erro critico novo.
4. auth email e Google sem regressao conhecida.
5. reopen app validado (fechar/abrir e sessao ok).
6. evidencias registradas (log, screenshot, status).

## 6) Deu ruim - recuperacao rapida

### 6.1 API caiu
1. sintoma: /health sem 200.
2. causa provavel: deploy ruim/env faltando.
3. resolver:
	1. checar logs Render.
	2. validar render.yaml.
	3. rollback do ultimo deploy green.

### 6.2 App nao loga
1. sintoma: login falha em loop.
2. causa provavel: backend/auth ou token invalido.
3. resolver:
	1. validar /health.
	2. rodar ops:health:smoke.
	3. testar login-password com payload valido.

### 6.3 OAuth 400/404
1. sintoma: tela de erro Google invalid_request.
2. causa provavel: client Android/web incorreto.
3. resolver:
	1. conferir IDs no Google Cloud e .env.
	2. conferir authService por plataforma.
	3. rebuild e novo teste real.

### 6.4 GitHub Actions falhou
1. sintoma: run vermelho em < 1 min.
2. causa provavel: preflight/env/workflow.
3. resolver:
	1. abrir run e identificar step exato.
	2. corrigir no YAML.
	3. push novo e validar run green.

### 6.5 APK nao gera
1. sintoma: assembleRelease falha.
2. causa provavel: JDK/SDK/Gradle ou dependencia.
3. resolver:
	1. rodar release:gate.
	2. validar android/gradlew e Java 17.
	3. repetir release:apk.

### 6.6 Render restart loop
1. sintoma: deploy sobe e cai em seguida.
2. causa provavel: start command/env quebrado.
3. resolver:
	1. confirmar npm ci + npm start.
	2. confirmar rootDir backend.
	3. rollback se necessario.

### 6.7 Variaveis sumiram
1. sintoma: falha em auth/email/OCR.
2. causa provavel: segredo removido no painel.
3. resolver:
	1. reconfigurar env no Render/Firebase.
	2. rodar check-env e preflight.

### 6.8 Build quebra apos mudanca
1. sintoma: CI vermelho sem alteracao de produto.
2. causa provavel: alteracao em arquivo critico.
3. resolver:
	1. comparar diff dos arquivos criticos.
	2. restaurar parte quebrada.
	3. validar gate novamente.

## 7) Padrao operacional oficial
1. nunca usar fake validation para marcar qualidade.
2. nunca mascarar PASS parcial como PASS final.
3. QA humano obrigatorio para fluxos criticos.
4. reopen do app obrigatorio na homologacao.
5. evidencia obrigatoria por fase.
6. release so com checklist completo.
7. logs obrigatorios em incidentes.
8. rollback documentado quando acionado.

## 8) Protecoes implementadas contra regressao
1. pinagem de Node em [.nvmrc](.nvmrc) e [backend/.nvmrc](backend/.nvmrc).
2. pinagem de runtime no Render em [render.yaml](render.yaml).
3. aliases /api no backend para reduzir quebra por path.
4. preflight operacional: [scripts/ops-preflight.mjs](scripts/ops-preflight.mjs).
5. smoke remoto: [scripts/ops-health-smoke.ps1](scripts/ops-health-smoke.ps1).
6. gate de release: [scripts/release-gate.ps1](scripts/release-gate.ps1).
7. pipeline APK com Gradle local no runner (sem dependencia obrigatoria de Expo token).
8. CI com preflight obrigatorio antes de seguir.

## 9) Processo de release final (sem PASS falso)
1. atualizar versao Android e app version.
2. rodar release gate.
3. gerar APK.
4. instalar em device real.
5. validar:
	1. abertura app;
	2. login;
	3. reopen;
	4. PRO;
	5. social basico;
	6. OCR basico.
6. registrar evidencias e riscos restantes.

## 10) Versao atual de release local
1. versionName: 1.2.6
2. versionCode: 19
3. APK final local: [build-output/app-release.apk](build-output/app-release.apk)
