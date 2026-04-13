# DEV_GUIDE

Data: 2026-04-12

## COMO RODAR O PROJETO

### Pre requisitos
- Node.js 18+
- npm 9+
- Expo CLI via `npx expo`
- Android SDK + ADB (para device/emulador)

### Frontend (Expo)
1. Instalar dependencias:
   - `npm install`
2. Subir bundler:
   - `npx expo start`
3. Modo CI/sem interacao (validacao):
   - `CI=1 npx expo start --offline`

### Backend simples (`backend/`)
1. Entrar em backend:
   - `cd backend`
2. Instalar deps:
   - `npm install`
3. Rodar:
   - `npm start`
4. Health check:
   - `GET http://localhost:3000/health`

### Dashboard QA (`dashboard/`)
1. Entrar em dashboard:
   - `cd dashboard`
2. Instalar deps:
   - `npm install`
3. Rodar server:
   - `npm start`

## COMANDOS IMPORTANTES

### Start
- App Expo: `npm start`
- Android Expo run: `npm run android`
- Backend simples: `cd backend && npm start`
- Dashboard QA: `npm run dashboard:start`

### Build
- Detox build (emulador): `npm run detox:build`
- Detox build attached: `npm run detox:build:attached`

### Test
- Suite node principal: `npm test`
- Suite completa: `npm run test:all`
- Dashboard tests: `npm run dashboard:test`
- Smoke QA: `npm run qa:smoke`
- Production check: `npm run qa:prod:check`

### Detox
- Test emulador: `npm run detox:test`
- Test device conectado: `npm run detox:test:attached`
- Auto bootstrap: `npm run detox:auto`

Observacoes atuais de ambiente:
- O build Detox emulador esta passando.
- A suite completa (`npm run test:all`) esta passando com `api-test:ok` e `test-flow:ok`.
- O `qa:prod:check` retorna `errors=0` e warnings de higiene de ambiente/segredos para tratar antes de release publico.
- `detox:test` nesta maquina falha em runtime com: `CPU Acceleration status: Android Emulator hypervisor driver is not installed on this machine`.
- Diagnostico de hardware/firmware nesta maquina esta OK (`HyperVRequirement* = True`), entao o bloqueio e instalacao/configuracao do driver do emulador.
- Script default do driver nao foi encontrado em `extras/google/Android_Emulator_Hypervisor_Driver/silent_install.bat` (SDK local sem esse pacote).
- Pacote do driver foi instalado via SDK Manager (`extras;google;Android_Emulator_Hypervisor_Driver`) e os arquivos existem no SDK local.
- Instalacao efetiva do driver no host exigiu elevacao administrativa e nao concluiu nesta sessao automatizada.
- `adb` nao esta no PATH da sessao atual; para fallback em device fisico, exportar `platform-tools` no PATH antes de `detox:test:attached`.

Passos recomendados para destravar `detox:test` no Windows:
1. Abrir Android SDK Manager e instalar/atualizar:
   - Android Emulator
   - Android SDK Platform-Tools
   - Android Emulator Hypervisor Driver (installer)
   - alternativa CLI: `sdkmanager --install "extras;google;Android_Emulator_Hypervisor_Driver"`
2. Reiniciar o Windows apos instalacao do driver.
   - executar instalador do driver em terminal/admin: `...\extras\google\Android_Emulator_Hypervisor_Driver\silent_install.bat`
3. Validar em terminal novo:
   - `emulator -accel-check`
   - `adb devices`
4. Reexecutar:
   - `npm run detox:test`
5. Se ainda falhar no emulador, usar fallback com device fisico:
   - garantir `adb devices` listando o device
   - rodar `npm run detox:test:attached`

### Reset / cleanup
- QA cleanup: `npm run qa:cleanup`
- Limpar release package local:
  - remover pasta `_audit_release`
  - recriar zip via script/manual conforme processo de release

## ESTRUTURA DE PASTAS EXPLICADA

- `src/`
  - `screens/`: telas principais do app
  - `navigation/`: stacks/tabs
  - `context/`: estado legado (Context API)
  - `stores/`: estado novo (Zustand TS)
  - `services/`: integracoes e regras de negocio
  - `storage/`: persistencia local e sync queue
  - `features/`: modulos novos (coach/onboarding)
  - `components/`: UI reutilizavel

- `backend/`
  - `server.js`: bootstrap Express
  - `routes/*`: auth/workouts/sync/social/ranking
  - `middleware/auth.js`: JWT middleware

- `dashboard/`
  - backend de QA/observabilidade
  - scripts de analise, retest e automacao noturna

- `__tests__/`
  - testes unitarios, integracao e fullstack

- `e2e/`
  - cenarios Detox

## COMO DEBUGAR

### 1. Quebra no boot Expo
- Rodar: `CI=1 npx expo start --offline`
- Se reclamar de TS deps:
  - `npx expo install typescript @types/react`

### 2. Backend nao sobe
- Verificar `backend/package.json` valido JSON
- Rodar em `backend/`: `npm start`
- Validar endpoint: `GET /health`
- Se faltar dependencia local: rodar `npm install` dentro de `backend/` antes do start

### 3. Erro 401 em rotas
- Esperado sem token para rotas protegidas (`/workouts`, `/sync`, `/social/feed`)
- Validar fluxo JWT + refresh no cliente

### 4. Sync offline nao dispara
- Verificar fila em `src/storage/syncQueue.ts`
- Verificar envio em `src/storage/syncEngine.ts`
- Confirmar backend no ar e token valido

### 5. Falha em teste
- Rodar suite isolada:
  - `node --test __tests__/arquivo.test.mjs`
- Corrigir export/import e repetir `npm test`

### 6. Detox falha antes dos testes
- Se aparecer colisao de haste map por pastas de release, manter `modulePathIgnorePatterns` no `e2e/jest.config.js` para ignorar `_audit_release/` e `dist_clean_project/`.
- Se aparecer erro de AVD, ajustar `DETOX_AVD_NAME` ou usar default `Detox_API_34`.
- Se aparecer erro de modulo ausente no bundle, validar deps de runtime (`zustand`, `expo-secure-store`) com `npm install`.
- Se aparecer `x86_64 emulation currently requires hardware acceleration`, instalar o Android Emulator Hypervisor Driver pelo SDK Manager e validar com `emulator -accel-check`.
- Se `adb` nao for reconhecido, adicionar `C:\Users\USER\AppData\Local\Android\Sdk\platform-tools` ao PATH da sessao e repetir.
- Se `adb devices` mostrar device `unauthorized`, desbloquear o celular, aceitar o prompt de USB debugging (RSA), e repetir `adb devices` ate status `device`.

## COMO ADICIONAR FEATURE NOVA

### Padrao recomendado (evitar regressao)
1. Definir fonte de estado (Context OU Zustand; nao os dois para mesma feature).
2. Criar servico em `src/services` para logica de IO/API.
3. Expor estado e acoes em store/context.
4. Conectar tela em `src/screens` ou `src/features/*`.
5. Cobrir com teste em `__tests__/`.
6. Rodar `npm test` antes de merge.

### Convenioes praticas
- Evitar alias `@/` sem resolver dedicado no bundler.
- Preferir imports relativos estaveis.
- Evitar duplicar modulo JS e TS com mesma responsabilidade.

## COMO EVITAR QUEBRAR O APP

1. Nao introduzir novo caminho de auth sem descontinuar o anterior.
2. Nao manter duas fontes de verdade para o mesmo estado de tela.
3. Nao alterar contratos de API sem ajustar testes de integracao.
4. Sempre validar:
   - `npm test`
   - boot Expo (`CI=1 npx expo start --offline`)
   - backend local (`cd backend && npm start` + `/health`)
5. Antes de release externo, gerar pacote limpo sem caches/builds.

## CHECKLIST RAPIDO DE RELEASE TECNICO

- [x] `npm test` verde
- [x] backend sobe e `/health` responde
- [x] Expo bundler inicia sem erro de dependencia
- [ ] auth refresh sem regressao
- [ ] sync offline validado
- [x] detox:build verde
- [ ] detox:test validado em ambiente com aceleracao/device
- [x] zip de auditoria gerado e conferido

