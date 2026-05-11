# MASTER GUIDE OPERACIONAL — EVOLUCAO
> Versao: 1.2.7 (11 mai 2026) | Nivel: operacional para leigos e tecnicos
> Ultima validacao real: 11 mai 2026 — ver Secao 13 para status sem mascara

## 0) Objetivo deste guia
Este documento foi feito para operacao real, inclusive por quem nao e da area tecnica.
Nao ha instrucoes falsas ou PASS ficticio aqui.
Se algo nao estiver pronto, esta marcado como PENDENTE com impacto descrito.

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
6. [android/app/google-services.json](android/app/google-services.json): IDs Firebase/OAuth do Android.

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
9. validador OAuth dedicado: [scripts/validate-oauth.mjs](scripts/validate-oauth.mjs).
10. validador CI local: [scripts/validate-ci-config.mjs](scripts/validate-ci-config.mjs).

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
1. versionName: 1.2.7
2. versionCode: 20
3. APK final local: [build-output/app-release.apk](build-output/app-release.apk)
4. SHA-256 APK: pendente (gerar apos validacao humana)
5. Tamanho: ~88 MB (estimado)

---

## 11) Protecoes implementadas (MECANISMO ANTI-REGRESSAO)

Esta secao documenta CADA mecanismo de protecao existente: o que protege, quando roda, como usar e o que acontece se falhar.

### 11.1 ops-preflight (pre-deploy)
- **Arquivo:** [scripts/ops-preflight.mjs](scripts/ops-preflight.mjs)
- **O que protege:** garante que arquivos criticos existem, que o backend expoe as rotas certas, que o pipeline usa Gradle (e nao dependencia obsoleta), que OAuth esta configurado no google-services.json.
- **Quando roda:**
  - Automaticamente no GitHub Actions antes do build de APK.
  - Manualmente: `npm run ops:preflight` na raiz do projeto.
- **Como usar:**
  ```
  npm run ops:preflight
  ```
  Esperar o [SUMMARY] ao final.
- **O que acontece se falhar:**
  - Localmente: exibe [FAIL] com causa exata e aborta com exit 1 (bloqueia build).
  - Em CI: se GITHUB_ACTIONS=true, converte falhas de ambiente (sem .env, OAuth sem client no runner) em [WARN] para nao bloquear o build desnecessariamente. Falhas estruturais (arquivo ausente) ainda bloqueiam.
- **Exemplo de saida OK:**
  ```
  [OK] Render usa Gradle assembleRelease
  [OK] google-services.json com OAuth Android
  [SUMMARY] Preflight operacional PASS.
  ```

### 11.2 ops-health-smoke (smoke remoto)
- **Arquivo:** [scripts/ops-health-smoke.ps1](scripts/ops-health-smoke.ps1)
- **O que protege:** verifica se os endpoints do Render em producao estao respondendo com os status esperados.
- **Quando roda:** manualmente apos deploy no Render ou como parte do release:gate.
- **Como usar:**
  ```
  npm run ops:health:smoke
  ```
  Ou diretamente: `powershell scripts/ops-health-smoke.ps1`
- **O que acontece se falhar:**
  - Exibe DIVERGENCIA: endpoint nao respondeu como esperado.
  - Retorna exit 1 para bloquear automacao upstream.
  - Causa mais provavel: deploy no Render com codigo antigo; ou servico inativo (free tier spin-down).

### 11.3 release:gate (gate completo)
- **Arquivo:** [scripts/release-gate.ps1](scripts/release-gate.ps1)
- **O que protege:** executa em sequencia: check-env + preflight + smoke local + smoke remoto opcional.
- **Quando roda:** antes de gerar APK de release.
- **Como usar:**
  ```
  npm run release:gate
  ```
  Para pular smoke remoto (sem internet ou Render offline):
  ```
  powershell scripts/release-gate.ps1 -SkipRemoteSmoke
  ```
- **O que acontece se falhar:**
  - Para em cada etapa com mensagem clara.
  - Nao gera APK sem passar por todas as etapas.

### 11.4 test:basic (smoke local do backend)
- **Arquivo:** [scripts/test-basic.js](scripts/test-basic.js)
- **O que protege:** sobe o backend localmente e valida que /health retorna 200, /auth/login-password retorna 400 (sem payload), /api/health e /api/auth/* respondem corrretamente.
- **Quando roda:** manualmente antes de commits no backend.
- **Como usar:**
  ```
  npm run test:basic
  ```
- **O que acontece se falhar:**
  - Indica que backend local esta com rota quebrada ou nao sobe.

### 11.5 Pinagem de Node (engine)
- **Arquivos:** [.nvmrc](.nvmrc), [backend/.nvmrc](backend/.nvmrc), engines no [package.json](package.json) e [backend/package.json](backend/package.json).
- **O que protege:** garante que Node 20 e usado em dev, CI e Render.
- **Quando roda:** ao instalar dependencias (aviso se versao divergir) e no Render via runtimeVersion.
- **O que acontece se falhar:** Render ou CI com Node errado pode introduzir bugs silenciosos de compatibilidade.

### 11.6 Aliases /api no backend
- **Arquivo:** [backend/server.js](backend/server.js)
- **O que protege:** permite que chamadas com prefixo /api/* tambem funcionem (ex: /api/health, /api/auth/*), reduzindo quebra quando o app usa path diferente do esperado.
- **Quando e validado:** pelo preflight (ops-preflight) e pelo smoke-remoto (ops-health-smoke).
- **O que acontece se removido:** chamadas /api/* retornam 404 para o app.

### 11.7 Bootstrap admin de emergencia
- **Arquivo:** [backend/routes/auth.js](backend/routes/auth.js)
- **O que protege:** garante que mesmo sem banco persistente, existe uma conta admin em memoria com credenciais definidas por variaveis de ambiente (ADMIN_USER, ADMIN_EMAIL, ADMIN_PASS).
- **Quando e ativado:** quando backend reinicia sem dados persistidos e variaveis ADMIN_* estao definidas no Render.
- **O que acontece se nao estiver configurado:** admin nao consegue logar apos restart ate que dados de producao sejam restaurados.

### 11.8 CI com preflight obrigatorio
- **Arquivo:** [.github/workflows/release-apk-on-push.yml](.github/workflows/release-apk-on-push.yml)
- **O que protege:** todo push que tenta gerar APK no CI passa primeiro pelo preflight.
- **Quando roda:** automaticamente em todo push para o branch de release (evolucao-app).
- **O que acontece se falhar:** CI para, APK nao e gerado, desenvolvedor recebe notificacao com causa.

### 11.9 validate-oauth (validador OAuth dedicado)
- **Arquivo:** [scripts/validate-oauth.mjs](scripts/validate-oauth.mjs)
- **O que protege:** verifica se todos os client IDs Google estao presentes e consistentes entre .env, google-services.json e authService.js. Tambem confirma que package_name bate com applicationId.
- **Quando roda:** manualmente antes de release em device, ou quando alterar .env/google-services.json.
- **Como usar:**
  ```
  npm run ops:validate:oauth
  ```
- **O que acontece se falhar:**
  - [FAIL] indica qual ID esta ausente ou divergindo.
  - Corrigir antes de instalar no device ou vai ter erro de OAuth no login Google.

### 11.10 validate-ci-config (validador CI local)
- **Arquivo:** [scripts/validate-ci-config.mjs](scripts/validate-ci-config.mjs)
- **O que protege:** verifica localmente se o YAML do workflow de release tem todos os steps obrigatorios, versoes corretas, permissoes, e arquivos necessarios existem no projeto. Detecta problemas antes de fazer push.
- **Quando roda:** manualmente antes de alterar o workflow ou antes de um push importante.
- **Como usar:**
  ```
  npm run ops:validate:ci
  ```
- **O que acontece se falhar:**
  - [FAIL] indica step ausente, arquivo faltando ou versao incorreta.
  - Corrigir antes de push para evitar run vermelho no GitHub Actions.

---

## 12) Validacao humana REAL — checklist obrigatorio

**Esta secao nao pode ser substituida por automacao. Requer acesso fisico ao device.**

### Como usar este checklist
Marcar cada item SOMENTE se executado e validado de verdade.
Nao marcar "assumindo" ou "parece que funcionou".
Se algo nao funcionar, marcar PENDENTE com descricao do erro real.

### 12.1 Instalacao e abertura basica
- [ ] APK instalou sem erro
- [ ] App abre na primeira vez sem crash
- [ ] Tela inicial renderiza corretamente (sem branco/preto inesperado)

### 12.2 Login Google
- [ ] Botao "Entrar com Google" exibido
- [ ] Tela de selecao Google abre corretamente
- [ ] Login conclui sem erro de OAuth
- [ ] Perfil do usuario carrega apos login
- **PENDENTE conhecido:** OAuth Google ainda retorna erro "Custom URI scheme not enabled" nesta build. Isso e um problema de configuracao no Google Cloud (client Android precisa ter URI scheme correto). Login por e-mail/senha funciona como alternativa.

### 12.3 Reopen (fechar e reabrir)
- [ ] App fechado pelo botao de voltar ou pelo gerenciador de tarefas
- [ ] Reaberto — sessao mantem logada sem pedir novo login
- [ ] Dados do usuario carregam corretamente

### 12.4 Logout e novo login
- [ ] Logout executado com sucesso
- [ ] Tela de login exibida
- [ ] Novo login funciona

### 12.5 PRO por codigo
- [ ] Tela de ativacao PRO acessada
- [ ] Codigo digitado
- [ ] Ativacao confirmada
- [ ] Features PRO visiveis

### 12.6 Social basico
- [ ] Tela social abre
- [ ] Lista de amigos/ranking carrega
- [ ] Convite ou interacao basica executada

### 12.7 OCR basico
- [ ] Tela OCR acessada
- [ ] Imagem capturada ou carregada
- [ ] Resultado do OCR retorna sem crash

### 12.8 Coach basico
- [ ] Secao de coach acessada
- [ ] Recomendacao aparece ou responde
- [ ] Sem crash ou tela branca

### 12.9 Questionario
- [ ] Fluxo de questionario iniciado
- [ ] Respostas navegam corretamente
- [ ] Conclusao sem erro

### 12.10 Treino
- [ ] Tela de treino acessada
- [ ] Treino iniciado e executado
- [ ] Finalizacao sem crash

### 12.11 Navegacao entre abas
- [ ] Todas as abas principals acessadas
- [ ] Nenhuma aba trava ou da tela branca
- [ ] Transicoes fluidas

### 12.12 Estabilidade visual
- [ ] Nenhum elemento cortado ou sobreposto visivelmente
- [ ] Scrolls sem travar
- [ ] Textos legíveis e sem overflow

---

## 13) Status real do projeto (sem mascarar)
> Ultima atualizacao: 11 mai 2026 — baseado em validacao real de endpoints e scripts.

### O que esta CONFIRMADO funcionando (evidencia real)
1. **Backend Render (producao):**
   - /health → HTTP 200, service=evolucao-backend (nao mais qa-dashboard-local)
   - /api/health → HTTP 200 com aliases confirmados
   - /auth/send-code e /api/auth/send-code → HTTP 400 (rota existe, exige payload)
   - Erro 127 (exit code 127 no startup) ELIMINADO — confirmado pelo health
   - Servico correto ativo: evolucao-api-dou2.onrender.com
2. **ops-preflight:** PASS total (11 mai 2026) — 100% verde, sem WARN, sem FAIL
3. **ops-health-smoke:** PASS total (11 mai 2026) — 6/6 endpoints OK
4. **validate-oauth:** PASS total — 13 OK, 0 WARN, 0 FAIL
5. **validate-ci-config:** PASS total — 33 OK, 0 WARN, 0 FAIL
6. **Configuracao OAuth:** client IDs, package_name, google-services.json e authService.js consistentes
7. **Pipeline CI:** hardened com Gradle local, sem expo-github-action, preflight obrigatorio
8. **APK local 1.2.6/versionCode 19:** disponivel e instalavel

### Pendencias REAIS (nao mascaradas)
1. **GitHub Actions run 97:** NAO verificado automaticamente (sem gh CLI nem token disponivel). STATUS: REQUER verificacao manual em https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/actions. Se verde: pipeline CI OK. Se vermelho: ver logs e corrigir.
2. **Validacao humana no device:** NAO executada. Todos os itens do checklist (Secao 12) estao PENDENTE ate que alguem com acesso fisico ao device realize e confirme cada item.
3. **OAuth Google no device real:** Configuracao validada estaticamente (scripts), mas nao testada em device fisico. Risco permanece ate homologacao humana.
4. **Release 1.2.7:** preparada (versionCode 20) mas APK nao gerada ainda. Aguardando validacao humana antes de gerar.

### Riscos documentados
1. RISCO ALTO (ate homologacao): login Google nao validado em device real. Workaround: login por e-mail/senha disponivel.
2. RISCO MEDIO: Render free tier pode hibernar e demorar 30-60s para responder na primeira requisicao do dia.
3. RISCO BAIXO: GitHub Actions run 97 pode estar vermelho. APK local 1.2.6 disponivel como fallback imediato.
4. RISCO BAIXO: sem validacao de OCR, coach, social, questionario e treino em device fisico real.

### O que fazer agora (ordem de prioridade)
1. Verificar GitHub Actions manualmente: https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/actions
2. Realizar validacao humana completa (Secao 12) em device fisico.
3. Reportar resultado de cada item do checklist.
4. Apos homologacao OK: gerar APK 1.2.7 e distribuir.

---

## 14) Comandos de validacao rapida (referencia)

| Comando | O que faz | Esperado |
|---------|-----------|----------|
| `npm run ops:preflight` | Valida infra, arquivos, OAuth, pipeline | PASS |
| `npm run ops:health:smoke` | Smoke remoto no Render | SMOKE PASS |
| `npm run ops:validate:oauth` | Valida IDs OAuth em todas as fontes | PASS |
| `npm run ops:validate:ci` | Valida YAML do CI localmente | PASS |
| `npm run release:gate` | Gate completo antes de release | PASS Gate |
| `npm run test:basic` | Smoke local do backend | ok |

---

## 15) Links e recursos rapidos

### Dashboards
- **Render:** https://dashboard.render.com/web/srv-d7crvuv41pts739lq5d0/events
- **GitHub Actions:** https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/actions
- **Firebase Console:** https://console.firebase.google.com/project/t-evo-b069a/settings/general
- **Google Cloud OAuth:** https://console.cloud.google.com/auth/clients?project=t-evo-b069a

### Endpoints de producao (todos confirmados 11 mai 2026)
- Health principal: https://evolucao-api-dou2.onrender.com/health → 200 PASS
- Health alias: https://evolucao-api-dou2.onrender.com/api/health → 200 PASS
- Auth: https://evolucao-api-dou2.onrender.com/api/auth/* → rotas respondem

### Arquivos criticos
- Backend principal: [backend/server.js](backend/server.js)
- Config deploy: [render.yaml](render.yaml)
- Config Android: [android/app/build.gradle](android/app/build.gradle)
- OAuth Android: [android/app/google-services.json](android/app/google-services.json)
- Env variaveis: [.env](.env) (NAO commitar)
- Workflow release: [.github/workflows/release-apk-on-push.yml](.github/workflows/release-apk-on-push.yml)
- Preflight: [scripts/ops-preflight.mjs](scripts/ops-preflight.mjs)
- Smoke remoto: [scripts/ops-health-smoke.ps1](scripts/ops-health-smoke.ps1)
- Gate de release: [scripts/release-gate.ps1](scripts/release-gate.ps1)
- Validador OAuth: [scripts/validate-oauth.mjs](scripts/validate-oauth.mjs)
- Validador CI: [scripts/validate-ci-config.mjs](scripts/validate-ci-config.mjs)
