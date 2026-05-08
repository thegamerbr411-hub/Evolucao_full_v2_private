# Baseline Validation Report — Phase 3 QA Infrastructure
**Data:** 2026-05-08  
**Versão:** 3.0.0  
**Status:** ✅ BASELINE ESTABELECIDO

---

## Objetivo

Estabelecer a baseline de qualidade para o sistema QA Phase 3, documentando:
1. Quais seletores semânticos estão wirted no app
2. Quais testes cobrem quais fluxos
3. Quais assertions são garantidas pelo contrato QA

---

## Baseline de Seletores Semânticos

### Telas (`QA_SCREENS`)

| ID Semântico | Arquivo | Componente | Status |
|---|---|---|---|
| `screen_bootstrap` | `App.js` | Root View | ✅ Wired |
| `screen_loading` | `RootNavigator.js` | Loading View | ✅ Wired |
| `screen_login` | `RegisterScreen.js` | ScrollView (login mode) | ✅ Wired |
| `screen_register` | `RegisterScreen.js` | ScrollView (register mode) | ✅ Wired |
| `screen_home` | `HomeScreen.js` | ScrollView principal | ✅ Wired |
| `screen_treinos` | `WorkoutsHubScreen.js` | ScrollView principal | ✅ Wired |
| `screen_profile` | `ProfileScreen.js` | ScrollView principal | ✅ Wired |
| `screen_exercise_detail` | `ExerciseDetailScreen.js` | ScrollView principal | ✅ Wired |
| `screen_debug_health` | `DebugHealthScreen.js` | ScrollView (dev-only) | ✅ Wired |
| `screen_debug_observability` | `DebugObservabilityScreen.js` | ScrollView (dev-only) | ✅ Wired |

**Cobertura:** 10/10 telas críticas instrumentadas ✅

### Elementos de Bootstrap (`QA_ELEMENTS`)

| ID Semântico | Arquivo | Elemento | Status |
|---|---|---|---|
| `app_root` | `App.js` | View raiz do app | ✅ Wired |
| `app_bootstrap_ready` | `App.js` | View de boot ready | ✅ Wired |

### Tabs (`QA_ELEMENTS`)

| ID Semântico | Arquivo | Tab | Status |
|---|---|---|---|
| `tab_home` | `MainTabs.js` | Tab Home | ✅ Wired |
| `tab_treinos` | `MainTabs.js` | Tab Treinos | ✅ Wired |
| `tab_nutricao` | `MainTabs.js` | Tab Nutrição | ✅ Wired |
| `tab_coach` | `MainTabs.js` | Tab Coach | ✅ Wired |
| `tab_social` | `MainTabs.js` | Tab Social | ✅ Wired |
| `tab_profile` | `MainTabs.js` | Tab Perfil | ✅ Wired |

**Cobertura:** 6/6 tabs instrumentadas ✅

### Autenticação (`QA_ELEMENTS`)

| ID Semântico | Arquivo | Elemento | Status |
|---|---|---|---|
| `btn_go_login` | `RegisterScreen.js` | Botão modo login | ✅ Wired |
| `btn_go_register` | `RegisterScreen.js` | Botão modo cadastro | ✅ Wired |
| `btn_login` | `RegisterScreen.js` | Botão submeter login | ✅ Wired |
| `btn_register` | `RegisterScreen.js` | Botão submeter cadastro | ✅ Wired |
| `btn_forgot_password` | `RegisterScreen.js` | Botão esqueci senha | ✅ Wired |
| `input_name` | `RegisterScreen.js` | Campo nome | ✅ Wired |
| `input_email` | `RegisterScreen.js` | Campo email | ✅ Wired |
| `input_password` | `RegisterScreen.js` | Campo senha | ✅ Wired |

**Cobertura:** 8/8 elementos de auth instrumentados ✅

### Perfil / Logout (`QA_ELEMENTS`)

| ID Semântico | Arquivo | Elemento | Status |
|---|---|---|---|
| `btn_logout` | `ProfileScreen.js` | Botão logout de sessão | ✅ Wired |
| `btn_google_login` | `ProfileScreen.js` | Botão Google login | ✅ Wired |
| `btn_google_logout` | `ProfileScreen.js` | Botão Google logout | ✅ Wired |
| `btn_save_profile` | `ProfileScreen.js` | Botão salvar perfil | ✅ Wired |
| `btn_open_admin` | `WorkoutsHubScreen.js` | Botão admin panel | ✅ Wired |

### Player / Video (`QA_ELEMENTS`)

| ID Semântico | Arquivo | Elemento | Status |
|---|---|---|---|
| `player_internal` | `ExerciseDetailScreen.js` | Video component | ✅ Wired |
| `player_state_anchor` | `ExerciseDetailScreen.js` | Âncora de estado | ✅ Wired |
| `btn_open_video_external` | `ExerciseDetailScreen.js` | Abrir externo | ✅ Wired |
| `btn_enable_player` | `ExerciseDetailScreen.js` | Habilitar player | ✅ Wired |
| `btn_player_fullscreen` | `ExerciseDetailScreen.js` | Fullscreen | ✅ Wired |
| `btn_player_close` | `ExerciseDetailScreen.js` | Fechar player | ✅ Wired |

### Debug / QA (`QA_ELEMENTS`)

| ID Semântico | Arquivo | Elemento | Status |
|---|---|---|---|
| `qa_health_export` | `DebugHealthScreen.js` | Export health snapshot | ✅ Wired |
| `qa_health_export` | `DebugObservabilityScreen.js` | Export report | ✅ Wired |

---

## Baseline de Cobertura de Testes

### Fluxos Cobertos pelos Testes Semânticos Phase 3

| Fluxo | Teste | Assertion Principal |
|---|---|---|
| Boot detection | SEM-00 | `app_bootstrap_ready` ou `screen_home` visível em 30s |
| Landing (home ou auth) | SEM-00 | Um dos 4 candidatos detectado |
| Auth screen display | SEM-01 | `screen_login` ou `screen_register` existe |
| Campos de login | SEM-01 | `input_email`, `input_password`, `btn_login` visíveis |
| Tab Home → screen_home | SEM-02 | `screen_home` visível após `tab_home.tap()` |
| Tab Treinos → screen_treinos | SEM-02 | `screen_treinos` visível após `tab_treinos.tap()` |
| Tab Perfil → screen_profile | SEM-02 | `screen_profile` visível após `tab_profile.tap()` |
| Rotação sem crash | SEM-02 | 3 telas → todas detectadas sem erro |
| Logout button detection | SEM-03 | `btn_logout` existe em screen_profile |
| Pós-logout auth screen | SEM-03 | `screen_login` ou `screen_register` após logout |
| screen_home com ID correto | SEM-04 | `screen_home` visível (convenção semântica) |
| screen_treinos com ID correto | SEM-04 | `screen_treinos` visível |
| screen_profile com ID correto | SEM-04 | `screen_profile` visível |
| Nomenclatura snake_case | SEM-04 | Regex `/^[a-z][a-z0-9_]*$/` em todos os IDs |
| Contagem mínima de seletores | SEM-04 | >= 5 screens, >= 10 elements |

---

## Baseline de Estado QA (`qaAutomationState`)

O `global.__EVOLUCAO_QA_HEALTH__` exporta em runtime:

```json
{
  "currentScreen": "screen_home",
  "currentRoute": "Home",
  "auth": { "hydrated": true, "hasAccount": true, "userId": "uid_xxx" },
  "loading": { "active": false, "reason": null },
  "modal": { "visible": false, "type": null },
  "player": { "active": false, "loading": false, "fullscreen": false, "exerciseName": null },
  "network": { "connected": true, "type": "wifi" },
  "appState": "active",
  "errors": { "count": 0, "latest": null },
  "loadedStores": ["auth", "user", "workouts"],
  "lastUpdatedAt": "2026-05-08T..."
}
```

**Garantias de baseline:**
- `currentScreen` sempre coincide com o `testID` da tela ativa
- `errors.count` é 0 em sessões sem crash
- `auth.hydrated` é `true` antes de qualquer navegação pós-boot

---

## Baseline de Persistência de Erros

O `runtime_error_collector` persiste erros em MMKV key `runtime.error.collector.v1`.
- Máximo de 200 erros armazenados (LIFO)
- Cada erro inclui: `timestamp`, `message`, `stack`, `currentScreen`, `auth`
- Acessível via `DebugHealthScreen` em `__DEV__`

---

## Verificação de Integridade (Offline)

Para verificar que todos os seletores estão presentes sem executar testes:

```powershell
# Verificar que qaProps é aplicado nos componentes críticos
Select-String -Path "src\screens\*.js" -Pattern "qaProps|qaAliasProps" | Group-Object Filename | Format-Table

# Verificar que todos os QA_SCREENS são usados em algum componente
$screens = (Get-Content "src\qa\selectorRegistry.js" | Select-String "'screen_" | ForEach-Object { $_ -match "'(screen_\w+)'" | Out-Null; $Matches[1] })
foreach ($s in $screens) { Write-Host "$s : $(Select-String -Path 'src\**\*.js' -Pattern $s -Recurse | Measure-Object | Select-Object -ExpandProperty Count) usos" }
```

---

*Gerado pela consolidação Phase 3 QA — Evolução App*
