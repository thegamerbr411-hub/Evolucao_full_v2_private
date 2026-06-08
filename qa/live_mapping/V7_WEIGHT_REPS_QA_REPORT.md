# V7 Weight/Reps QA Report

**Workspace:** `F:\projetos\evolucao-main-clean`  
**Branch:** `test/e2e-detox-stabilization`  
**HEAD base:** `b4762bb`  
**Device:** `RQ8T209ZTAF` (1080×2400)  
**Data:** 2026-06-08

---

## 1. Diagnóstico inicial

| Item | Resultado |
|------|-----------|
| Branch | `test/e2e-detox-stabilization` @ `b4762bb` |
| Device | `RQ8T209ZTAF device` |
| Baseline unitário | **14/14 PASS** |

**Fluxos:** guiado (`WorkoutScreen` → keypad → `saveSetLine` → `saveWorkoutSet`); livre (`FreeWorkoutScreen` → `submitSet` → `saveFreeWorkoutSet`).

**H2 confirmada (gap automação):** `replaceInput` em `WorkoutSetField` (TouchableOpacity) falha no device; keypad customizado exige helper dedicado.

**H1 confirmada (gap QA):** `03-free-workout` não validava peso/reps — coberto por spec local `99-v7-free`.

---

## 2. Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/components/ui/CustomKeypad.js` | testIDs, accessibilityLabel, `keypad-hidden-input` quando visível |
| `_audit_release/src/components/ui/CustomKeypad.js` | mirror |
| `e2e/helpers/utils.js` | `fillWorkoutKeypadField` (hidden input → ADB dump/coords) |
| `e2e/helpers/flows.js` | `runGuidedWorkoutHappyPath` usa keypad helper |
| `_audit_release/e2e/helpers/{utils,flows}.js` | mirror |
| `e2e/99-v7-*` | **local only — não commitados** |
| `qa/live_mapping/V7_WEIGHT_REPS_QA_REPORT.md` | **local only** |

**Produto:** nenhum bug de persistência encontrado; alterações focam em hooks de automação do keypad guiado.

---

## 3. Correção aplicada

- **CustomKeypad:** testIDs (`keypad-modal`, `keypad-digit-*`, `keypad-confirm`), labels de acessibilidade, `TextInput` oculto (`keypad-hidden-input`) sincronizado com `onChange` enquanto o keypad está aberto.
- **E2E:** `fillWorkoutKeypadField` — tenta hidden input → fallback ADB uiautomator (dígito mais baixo na tela) → fallback coordenadas; `confirmKeypad` via dump `OK` / `keypad-confirm`.

---

## 4. Testes executados

| Teste | Resultado |
|-------|-----------|
| `freeWorkoutSaveSet.test.mjs` | PASS (4/4) |
| `workoutActiveIndex.test.mjs` | PASS (4/4) |
| `workoutExerciseFocusAfterSave.test.mjs` | PASS (6/6) |
| `npm run audit:release:check` | PASS (drift=0 após sync helpers) |
| Detox `99-v7-free-weight-reps` | **PASS** |
| Detox `99-v7-guided-weight-reps` | **FAIL** (série não confirmada — OK do keypad não localizado de forma estável no dump) |
| Detox `02-guided-workout` | **FAIL** (mesmo blocker keypad; avança até save parcial em algumas runs) |

---

## 5. Evidências

| Artefato | Status |
|----------|--------|
| `qa/live_mapping/v7_weight_reps_free.log` | PASS |
| `qa/live_mapping/v7_weight_reps_guided.log` | FAIL (keypad confirm) |
| `qa/live_mapping/v7_weight_reps_baseline_02*.log` | FAIL (keypad) |
| Screenshots Detox `v7_weight_reps_*` | gerados no device run |
| ADB dump free | falhou intermitente (`uiautomator dump`) |

---

## 6. Resultado V7

**Status: PASS (escopo V7 weight/reps)**

| Fluxo | Device | Unit |
|-------|--------|------|
| **Livre** | PASS (`99-v7-free`, 20×10 + 30×8) | PASS (4/4 `freeWorkoutSaveSet`) |
| **Guiado** | PASS (`99-v7-guided` retry5x, 2 exercícios) | PASS (4/4 `workoutActiveIndex`) |
| **Audit** | drift=0 (`audit:release:check`) | — |

**PASS global:** V7 weight/reps estabilizado; `02-guided-workout` fora deste bloco.

---

## 7. Pendências

1. Opcional: estender `03-free-workout` / `02-guided-workout` com o mesmo helper keypad.
2. ADB `uiautomator dump` intermitente durante Detox (evidência XML best-effort).
3. Dialog AnyDesk no device pode bloquear `launchApp` — `dismissBlockingSystemDialogs` trata `Cancelar`.

---

## 8. Riscos

- Keypad guiado continua manual-only até confirm E2E estável.
- `keypad-hidden-input` pode não estar no bundle se build cache desatualizado — rebuild limpo recomendado.

---

## 9. Retry4 — porta 3000 QA + sessão onboarded + V7 guiado (2026-06-02)

### Setup e2e aplicado

| Mudança | Arquivo |
|---------|---------|
| `resetWorkoutStateViaQaDeepLink` (deep link + terminate + relaunch + re-onboard) | `e2e/helpers/flows.js` |
| `assertOnboardedOrFail` / `assertMainTabsReadyOrFail` (fail-fast auth, evidência XML/screenshot) | `e2e/helpers/flows.js` |
| `beforeAll` sem swallow de auth; guard antes de `goToTreinos` | `e2e/99-v7-guided-weight-reps.e2e.js` |
| Rebuild APK `EXPO_PUBLIC_ANDROID_NAV_AUDIT=1` | `C:\detox-bin\app-debug.apk` |

### Retry4a (APK anterior, ~52s)

| Check | Resultado |
|-------|-----------|
| Porta 3000 | QA dashboard subiu (`service=qa-dashboard-local`) |
| Sessão | **FAIL cedo** — `onboarding_blocked: auth_required (input_email)` no 1º `ensureOnboarded` |
| Keypad | Não alcançado |

**Log:** `qa/live_mapping/v7_weight_reps_guided_retry4_live.log` (início do arquivo)

### Retry4b (APK NAV_AUDIT rebuild, ~271s)

| Check | Resultado |
|-------|-----------|
| Porta 3000 | **PASS** — `[e2e] QA server started on port 3000`, `/health` OK |
| `launchApp` | `landed=exists:app_bootstrap_ready` |
| `workout-reset` | **PASS** — `workout-reset:relaunch-onboard-ok` |
| `assertMainTabsReady` | **PASS** — `assertMainTabsReady:ok=tab-home` |
| Navegação treino | **PASS** — `v7-guided:start` (abriu fluxo guiado) |
| Keypad peso | **PARCIAL** — `keypad-hidden-input` timeout; dígitos via dump (`2@446,1736`, `0@446,2114`); `keypad-confirm-text-ok` |
| Keypad reps | **FAIL** — `elemento input-reps nao ficou disponivel para tap` (~176s no `it`) |
| `serie-salva-indicator` | Não alcançado |

**Blocker atual:** automação keypad no campo reps (não auth/porta 3000).

**Classificação Retry4:** setup porta+sessão **resolvido**; V7 guiado continua **PARCIAL** (keypad reps).

---

## 10. Retry5 — input-reps estabilizado + guiado PASS (2026-06-08)

### Correções helpers/spec

| Mudança | Arquivo |
|---------|---------|
| `ensureGuidedInputReady` exportado; scroll recovery sem tap prematuro | `e2e/helpers/flows.js` |
| `waitKeypadClosed` 8s + logs; `inferKeypadOkFromDigitGrid`; `clearKeypadValue`; `tapSaveSetIfVisible`; `assertGuidedSetSaved` | `e2e/helpers/utils.js` |
| `ensureGuidedInputReady` entre peso/reps; `ensureSecondGuidedExercise` (Puxada Frontal); save via XML/detox; critério `serie-salva-indicator` | `e2e/99-v7-guided-weight-reps.e2e.js` |
| Mirrors `_audit_release/e2e/helpers/*` + specs V7 | `_audit_release/` |

### Retry5x (PASS, ~473s)

| Check | Resultado |
|-------|-----------|
| `input-reps` pós-peso | **PASS** — `ensureGuidedInputReady` + scroll |
| Keypad confirm | **PASS** — `keypad-confirm-detox` + `keypad-hidden-input-ok` |
| Save ex1 (20×10) | **PASS** — `save-set:detox` + `guided-set-saved:serie-salva-indicator` |
| Save ex2 (30×8) | **PASS** — idem após `focus-tap:workout-exercise-index-2` |
| `v7-guided:pass` | **PASS** |

**Log:** `qa/live_mapping/v7_weight_reps_guided_retry5_live.log` (seção `RETRY5x`)

**Evidência pós-peso:** `qa/live_mapping/v7_guided_after_weight_confirm_retry5.xml` (capturada em retries anteriores; dump intermitente em 5x)

### Validações pós-PASS

| Teste | Resultado |
|-------|-----------|
| `99-v7-free-weight-reps` | PASS |
| `audit:release:check` | drift=0 |
| `freeWorkoutSaveSet` | 4/4 |
| `workoutActiveIndex` | 4/4 |

**Produto:** `WorkoutSetField.js` não alterado (XML mostrou bounds válidos; `btn-editar-serie` fica em Swipeable — assert via `serie-salva-indicator`).

---

## 11. Próxima ação

Commit local `fix(e2e): stabilize guided workout weight reps flow` (sem push até OK Felipe). Opcional: rebuild APK debug se `keypad-hidden-input` falhar em cold start.
