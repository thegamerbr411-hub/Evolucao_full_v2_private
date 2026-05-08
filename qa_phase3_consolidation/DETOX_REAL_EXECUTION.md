# Detox Real Execution Report — Phase 3 Semantic Tests
**Data:** 2026-05-08  
**Device:** RQ8T209ZTAF (Samsung / Android — físico)  
**Configuração Detox:** `android.attached`  
**Status:** ⚙️ INFRA PRONTA / AGUARDANDO EXECUÇÃO REAL

---

## Configuração de Execução

### Variáveis de Ambiente
```powershell
$env:DETOX_ADB_NAME     = 'RQ8T209ZTAF'
$env:DETOX_REUSE_APP    = '1'
$env:DETOX_CLEAR_APP_DATA = '0'
$env:DETOX_FORCE_ATTACHED = '1'
```

### Comandos de Execução

#### Smoke (2-5 min)
```powershell
.\run_smoke.ps1 -AdbName RQ8T209ZTAF -Reuse
```

#### Cycle Completo (10-20 min)
```powershell
.\run_qa_cycle.ps1 -AdbName RQ8T209ZTAF -Reuse
```

#### Regression Full (30-60 min)
```powershell
.\run_regression.ps1 -AdbName RQ8T209ZTAF -Reuse
```

#### Execução Manual Detox
```powershell
$env:DETOX_ADB_NAME = 'RQ8T209ZTAF'
$env:DETOX_REUSE_APP = '1'
npx detox test --configuration android.attached --testPathPattern "semantic" --forceExit
```

---

## Testes Semânticos Disponíveis

### Suite Phase 3 — Semântica

| ID | Arquivo | Cenários |
|---|---|---|
| SEM-00 | `00-semantic-smoke.e2e.js` | Boot detection, landing signal |
| SEM-01 | `01-semantic-auth.e2e.js` | Auth screens, campos, botões modo |
| SEM-02 | `02-semantic-navigation.e2e.js` | Tabs, rotação sem crash |
| SEM-03 | `03-semantic-logout.e2e.js` | Logout, pós-logout auth |
| SEM-04 | `04-semantic-qa-health.e2e.js` | Infra QA, debug screens |

### Suite Legada — Regressão

| ID | Arquivo | Cenários |
|---|---|---|
| LEG-01 | `01-onboarding.e2e.js` | Onboarding completo |
| LEG-08 | `08-navigation.e2e.js` | Navigation stress |
| LEG-16 | `16-treino-tab-smoke.e2e.js` | Treinos tab smoke |
| LEG-21 | `21-profile-save.e2e.js` | Profile save |

---

## Pré-Requisitos para Execução Real

### ✅ Concluídos
- [x] App instalado no device (build debug via `android/gradlew installDebug`)
- [x] Seletores semânticos wirted em 10 telas/componentes críticos
- [x] Sistema de alias bidirecional configurado em `e2e/helpers/utils.js`
- [x] Testes semânticos criados em `e2e/semantic/`
- [x] Runners PS1 criados (`run_smoke.ps1`, `run_qa_cycle.ps1`, `run_regression.ps1`)
- [x] Detox configurado para device físico `android.attached`

### ⚙️ Para Executar
1. Device RQ8T209ZTAF conectado via USB
2. Metro Bundler rodando (`npx expo start --dev-client` ou metro direto)
3. App debug instalado com as últimas alterações Phase 3
4. Executar `.\run_smoke.ps1` para validação inicial

---

## Artefatos de Execução (Local)

Os artefatos de cada run são salvos automaticamente em:
```
qa_runs/
  smoke/run_YYYYMMDD_HHMMSS/
    logs/smoke.log
    logs/jest-output.txt
    logs/logcat.txt
    screenshots/
    report.md
  cycle/run_YYYYMMDD_HHMMSS/
    logs/cycle.log
    logs/<test-name>.log (por teste)
    logs/logcat.txt
    screenshots/
    report.md
  regression/run_YYYYMMDD_HHMMSS/
    logs/regression.log
    logs/<test-name>.log (por teste)
    logs/logcat.txt
    screenshots/
    video/regression.mp4
    report.md
```

---

## Validação de Seletores Semânticos (Offline)

Os IDs semânticos foram validados por inspeção de código — todos os componentes instrumentados usam `qaProps()` ou `qaAliasProps()` que setam `testID`, `accessibilityLabel` e `nativeID` simultaneamente.

**Convenção validada:** todos os IDs seguem `snake_case` sem hífens, prefixados por tipo:
- Telas: `screen_*`
- Tabs: `tab_*`  
- Botões: `btn_*`
- Inputs: `input_*`
- Players: `player_*`
- Debug: `qa_*`

---

## Próxima Execução Real

Para atualizar este documento com resultados reais, executar:
```powershell
.\run_qa_cycle.ps1 -AdbName RQ8T209ZTAF -Reuse
# Copiar o report.md gerado em qa_runs/cycle/run_*/report.md para qa_phase3_consolidation/QA_RUNS/
```

---

*Gerado pela consolidação Phase 3 QA — Evolução App*
