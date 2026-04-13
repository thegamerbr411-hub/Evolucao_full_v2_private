# Evolucao Full v2

App React Native/Expo com automacao Detox, telemetria QA local e dashboard de observabilidade para rodar testes de uso real por horas.

## Stack QA entregue

- Detox para Android (`.detoxrc.js`, `e2e/`, runner nativo Android).
- Backend local de QA com:
  - `POST /api/log`
  - `POST /api/events`
  - `GET /api/events`
  - `GET /api/heatmap`
  - `GET /api/insights`
  - `POST /api/apply-fix`
  - `GET /api/retests`
  - `POST /api/retest`
- Persistencia local em `artifacts/`:
  - `learning.json`
  - `events.json`
  - `apply-fix.json`
  - `insights.json`
- Scripts de ciclo e loop:
  - `scripts/run-detox-cycle.js`
  - `scripts/run-detox-loop.js`
  - `dashboard/scripts/night-run.js`

## Rodar ambiente local

### 1. Subir app + backend QA

```powershell
npm run dev:start
```

Esse comando:

- corrige `adb` e Java
- sobe `dashboard/server.js`
- sobe o Metro
- aplica `adb reverse` para `3000`, `8081` e `8082`
- builda e abre o app Android

### 2. Smoke test da API local

```powershell
npm run qa:smoke
```

Esse comando agora sobe um servidor efemero automaticamente quando `BASE_URL` nao for informado.

### 3. Testes do backend

```powershell
npm test
npm run dashboard:test
cd dashboard
npm run test:smoke
```

## Detox

### Build Android para Detox

```powershell
npm run detox:build
```

### Rodar suite completa no emulador

```powershell
npm run detox:test
```

### Rodar em device Android conectado

```powershell
$env:DETOX_CONFIGURATION='android.attached.debug'
npm run detox:test:attached
```

### Rodar um ciclo com seed/persona

```powershell
$env:QA_PERSONA='maromba'
$env:QA_SEED='night-001'
npm run detox:cycle
```

### Bootstrap automatico Detox (recomendado)

Detecta AVD/device automaticamente, configura variaveis e executa o ciclo:

```powershell
npm run detox:auto
```

Para tentar executar suite Detox direta com autodeteccao:

```powershell
npm run detox:auto:test
```

Se nao houver AVD/device, o ciclo usa skip controlado e registra no artifact `artifacts/detox-cycle-last.json`.

Variaveis uteis:

- `DETOX_CONFIGURATION=android.emulator.debug|android.attached.debug`
- `DETOX_AVD_NAME=nome-do-avd`
- `DETOX_ADB_NAME=serial-ou-regex-do-device`
- `DETOX_TEST_PATTERN=texto do teste`
- `QA_PERSONA=iniciante|maromba|dieta`
- `QA_SEED=qualquer-string`
- `QA_PERSONA_SEQUENCE=iniciante,maromba,dieta`
- `QA_SOAK_ROUNDS=2`

## Rodar por horas

### Loop Detox

```powershell
$env:QA_LOOP_HOURS='8'
$env:QA_LOOP_COOLDOWN_MS='10000'
npm run detox:loop
```

Para o soak operacional de 2 horas em device conectado:

```powershell
npm run qa:soak:2h
```

Ou com wrapper PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run-detox-loop.ps1 -Hours 8 -CooldownMs 10000 -Configuration android.emulator.debug
```

### Night run completo

Esse fluxo roda:

1. smoke da API
2. analise local de bugs
3. growth review (T1/T5/T8/T14) pre-ciclo
4. ciclo Detox
5. growth review (T1/T5/T8/T14) pos-ciclo
6. repete

```powershell
npm run qa:night
```

Para rodar um ciclo unico:

```powershell
npm run qa:night:once
```

## Artefatos gerados

- `artifacts/learning.json`: bugs agregados por cliente
- `artifacts/events.json`: eventos de uso real e heatmap
- `artifacts/apply-fix.json`: sugestoes recebidas em `/api/apply-fix`
- `artifacts/insights.json`: classificacao local dos bugs
- `artifacts/retests.json`: historico dos retestes disparados pelo dashboard/API
- `artifacts/detox/`: logs/screenshots do Detox
- `artifacts/detox-loop-report.json`: historico do loop

## Fluxos e2e cobertos

- onboarding/questionario real do app
- treino guiado
- treino livre
- nutricao
- tracking de agua
- coach/chat
- erros de validacao + spam click
- soak curto com rotacao de personas

## Deploy do backend no Render

Este repositorio ja tem `render.yaml` pronto para deploy com:

- `buildCommand: npm install`
- `startCommand: node dashboard/server.js`

Variaveis minimas:

- `JWT_SECRET`
- `ADMIN_EMAIL` ou `ADMIN_USER`
- `ADMIN_PASSWORD` ou `ADMIN_PASS`
- `DEFAULT_CLIENT_ID=admin`
- `CLIENT_API_KEYS={"admin":"SUA_API_KEY"}`

Fluxo do dashboard:

1. fazer login com admin
2. gerar token do `clientId`
3. opcionalmente informar a `API key` do cliente
4. operar backlog, analise, correcoes e retestes via `/api/insights`, `/api/apply-fix` e `/api/retest`

Em producao, o bypass local de QA deve ficar desativado:

- `ENABLE_QA_LOCAL_BYPASS=0`

## Login Google no App

Para habilitar login Google real no app (Expo Auth Session), configure estas variaveis no ambiente:

- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`

Sem essas variaveis o app continua funcional com fallback de identidade local, mas o login social nao conclui autenticacao OAuth real.

## Observacoes

- O fluxo de "login" automatizado usa o onboarding/questionario real do app, nao uma tela nova.
- O app envia telemetria QA local sem bloquear UI.
- O erro artificial no boot ficou protegido por flag QA (`EXPO_PUBLIC_QA_INJECT_APP_CRASH`).
- Para attached device, prefira rodar com `adb devices` validado antes.

## Troubleshooting Detox (Windows)

- Se o Detox no emulador falhar com `x86_64 emulation currently requires hardware acceleration`, habilite virtualizacao na BIOS/UEFI e instale o Android Emulator Hypervisor Driver (ou WHPX), depois reinicie a maquina.
- Se `adb devices` mostrar `unauthorized`, aceite o prompt de depuracao USB no aparelho e rode `adb kill-server` + `adb start-server`.
- Para fluxo automatico com fallback controlado sem hardware disponivel, use `npm run detox:auto`.
