# P1 State Fix Report

**Data:** 2026-05-30  
**Device:** emulator-5554  
**App:** com.tipolt.evolucaofullv2  
**Modo:** Correcao P1 estado global (sem redesign)

---

## Problemas corrigidos

| P1 | Problema | Causa raiz | Correcao |
|---|---|---|---|
| Streak | Home "Dia 1" vs Treino "0 dias" | `Math.max(1, streak)` forçava dia 1 na Home | `formatStreakLabel` + `dailyState.streakDays` real |
| XP hoje | Home +120 fixo vs Treino XP total | Fallback hardcoded `sessionXp \|\| 120` | `computeXpTodayFromLogs` (10 XP/série guiada) |
| Proteina | Home 150g vs Nutricao 160g | Home calculava 30% kcal; Nutricao usa peso×fator via `getMacroTargetsUseCase` | Meta unica via `buildDailyState` → **160g** (80kg × 2) |
| Treino ativo | Home CONTINUAR vs Treino INICIAR vs Coach "nao treinou" | Cada tela usava heuristica diferente | `computeWorkoutSessionStatus` + recovery observability |
| Status Treino hub | "—" em vez de label humano | Badge binario ✓/— | Label: Nao iniciado / Em andamento / Concluido |
| Multi-exercicio | Sessao persistida com 1 exercicio | Draft/UI session stale vs `baseExercises` (5) | Resync quando `baseExercises.length >= 2` e sem series salvas |
| Texto invisivel | Label sem cor em tema escuro | `QuickExerciseRegister` sem `color` | `colors.textPrimary` + botao `textInverse` |
| Registrar 10kg | Botao debug no modo avancado | `QuickExerciseRegister` exposto em prod | Oculto fora de `__DEV__` |

---

## Arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/services/dailyState.js` | **NOVO** — fonte unica daily progress |
| `src/context/AppContext-v2.ts` | `getDailyState`, `getTodayWorkout` params, `getTodayWorkoutSummary.sessionXp` |
| `src/screens/HomeScreen.js` | Usa `getDailyState`; remove 150g/120 XP/streak fake |
| `src/screens/WorkoutsHubScreen.js` | Status humano + CTA dinamico |
| `src/screens/CoachChatScreen.js` | Proteina de `nutritionLogs`; treino em andamento |
| `src/context/modules/coachRules.js` | `workoutCompleted` somente em `status === completed` |
| `src/context/modules/coachMessages.js` | Mensagens para treino em andamento |
| `src/screens/WorkoutScreen.js` | Resync multi-exercicio; debug button __DEV__ only; contraste; dismiss recovery no finish |
| `src/components/QuickExerciseRegister.js` | Cores tema escuro |
| `__tests__/dailyState.test.mjs` | 12 testes (pos-finalizacao 2026-05-28) |
| `__tests__/workoutsHubScreen.integrity.test.mjs` | CTA dinamico |
| `qa/live_mapping/fix_p1_capture.ps1` | **NOVO** — script captura validacao |

---

## Fonte unica definida

**Modulo:** `src/services/dailyState.js` → exposto como `getDailyState()` no AppContext

| Dado | Fonte |
|---|---|
| Meta proteina | `getMacroTargetsUseCase(plan, profile)` — peso + goal |
| Proteina consumida | `sumNutritionTotals(nutritionLogs hoje)` |
| Streak | `useGamificationStore.streakDays` |
| XP total | `useGamificationStore.xp` |
| XP hoje | Soma logs guiados hoje (10/série, 3 se failed) |
| Treino status | `guidedSets` + `plannedSets` + `getDropRecoveryCandidate()` |
| Agua | `hydration` store + history fallback |

**Meta proteina escolhida:** **160g** (calculo por peso do perfil, ex. 80kg × 2.0). Home deixou de usar 30% das calorias (150g).

---

## Antes vs depois

| Metrica | Antes (deep audit) | Depois (codigo + reload necessario) |
|---|---|---|
| Home streak | Dia 1 forcado | Sem sequencia ativa (se streak=0) |
| Home XP hoje | +120 hardcoded | +0 ou real das series |
| Home proteina meta | 0/150g | 0/160g (alinhado Nutricao) |
| Treino hub status | — | Nao iniciado / Em andamento |
| Treino hub CTA | Sempre Iniciar | Continuar quando em andamento |
| Coach treino | ❌ "nao treinou" com sessao ativa | em andamento + Continuar treino |
| Exercicios | 1 de 1 (sessao stale) | Resync para 5 quando preset full body |

---

## Prints de validacao

| Arquivo | Tela |
|---|---|
| `screenshots/fix_p1/fix_001_home.png` | Home |
| `screenshots/fix_p1/fix_002_treino_tab.png` | Aba Treino |
| `screenshots/fix_p1/fix_003_coach.png` | Coach |
| `screenshots/fix_p1/fix_004_nutricao.png` | Nutricao |
| `screenshots/fix_p1/fix_005_continuar_treino.png` | WorkoutScreen pos CTA |

**Nota:** Recarregar Metro/app (`r` no bundler ou reinstalar) para ver correcoes JS no device.

---

## Testes executados

```bash
node --test __tests__/dailyState.test.mjs          # 12/12 PASS (2026-05-28 pos-finalizacao)
npm test                                            # suite completa — falhas pre-existentes (adminService, mmkv path, google-services.json)
__tests__/workoutsHubScreen.integrity.test.mjs     # PASS
```

---

## Bugs ainda abertos

| Codigo | Status pos-fix |
|---|---|
| `BUG_MULTI_EXERCISE_WORKOUT_NOT_LOADED` | **Parcial** — resync implementado; validar "Exercicio 1 de 5" apos reload |
| `BUG_FINISH_BUTTON_VISIBLE_TOO_EARLY` | **FIXED** |
| `BUG_REST_BUTTONS_STATE_CONFUSING` | **FIXED** |
| `BUG_MEAL_NOT_UPDATING_HOME` | **FIXED** 2026-06-02 — `getTodayKey` calendario local |
| `BUG_PROTEIN_GOAL_MISMATCH` | **Corrigido** meta (160g unificada) |
| Streak/XP/Insights sync | **Parcial** — Home/Coach/Treino hub alinhados; Insights nao alterado neste fix |

---

## Proxima acao recomendada

1. **Nao repetir** validadores PASS — ver [`ANTI_HANG_RULES.md`](ANTI_HANG_RULES.md)
2. Aguardar **autorizacao Felipe** para enviar TREINO 1/3–3/3 ao ChatGPT (Playwright, Dever de casa)
3. Bugs Home pos-fix (Concluido+Continuar, troca exercicio) — **Concluido+Continuar FIXED** 2026-05-28
4. BUG_MEAL / Insights — fora escopo imediato

**Veredito gate P1:** **PASS tecnico** — estado global + BUG_FINISH + BUG_REST OK; TREINO 1/3 aguarda OK Felipe.

---

## Hotfix runtime (2026-05-30)

**Bug:** `nutritionStore.getState is not a function`  
**Causa:** `getDailyState()` tratava hook snapshot como store Zustand estatica  
**Correcao:** `AppContext-v2.ts` — usar `nutritionStore.hydration` do hook  
**Teste:** `node --test __tests__/dailyState.test.mjs` — 6/6 PASS

---

## Metro anti-parada (2026-05-30)

**Scripts:** `qa/live_mapping/metro_debug/`  
- `start_metro_logged.ps1` — Metro detached via `cmd start /B`  
- `wait_metro_ready.ps1` — poll `/status` (fix byte[] response)  
- `stop_metro_evolucao.ps1` — kill somente PID porta 8081  
**Gate:** `fix_p1_validate.ps1` exit 3 se Metro offline (nao sobrescreve PNGs)  
**Logs:** `metro_debug/metro_start_attempt_*.log`, `metro_port_check_*.txt`

---

## Anti-travamento (2026-05-30)

**Documento:** [`ANTI_HANG_RULES.md`](ANTI_HANG_RULES.md)

**Regra:** Nao rerodar `fix_p1_validate`, `fix_finish_validate`, `fix_rest_validate`, audits pesados sem motivo + `MaxScriptSec` hard.

**Scripts proibidos sem timeout:** `live_watch_mapping.ps1`, `home_deep_batch_audit.ps1`, `treino_batch_audit.ps1`, uiautomator dump ilimitado.

---

## Validacao pos-hotfix + Metro (2026-05-30T17:52:58)

**Script:** `fix_p1_validate.ps1 -Phase quick`  
**Metro:** pid 18412, porta 8081 LISTENING, bundle cache limpo (-c)  
**Device:** emulator-5554

### Resultado por tela

| Tela | Status | Metricas |
|---|---|---|
| Home | **PASS** | 0/160g, +20 XP, Sem sequencia, CONTINUAR TREINO |
| Treino hub | **PASS** | Em andamento, Continuar treino |
| Coach | **PASS** | 160g proteina, treino em andamento |
| Nutricao | **PASS** | 0/160g |
| WorkoutScreen | **PASS** | Exercicio **1 de 5**, PROXIMO Supino, sem Registrar 10kg |

### Matriz PASS/FAIL

| Bug | Resultado |
|---|---|
| P1_REGRESSION getState | **PASS** (corrigido) |
| Proteina 160g unificada | **PASS** |
| Streak/XP coerentes | **PASS** (+20 XP real, streak 0) |
| Treino ativo alinhado | **PASS** |
| Multi-exercicio 1 de 5 | **PASS** |
| Texto invisivel | **PASS** |
| Registrar 10kg | **PASS** (ausente) |
| BUG_FINISH early | **FIXED** (2026-05-30T22:27) — Continuar + Sair parcial; sem Feche/Finalizar |
| BUG_REST | **FIXED** (2026-05-30T23:16) — presets + timer validados |
| BUG_MEAL | **FIXED** — dailyState.test.mjs 14/14 |
| BUG_INSIGHTS | **Pendente** |

**Veredito gate P1:** **PASS tecnico** — estado global + BUG_FINISH + BUG_REST OK; TREINO 1/3 aguarda OK Felipe.

### BUG_FINISH fix (2026-05-30)

- **Codigo:** `WorkoutScreen.js` + `canFinishWorkout()` em `dailyState.js`
- **Validacao:** `fix_finish_validate.ps1` (bounded, ~84s)
- **Evidencia:** `finish_002_after_fix_1_of_17.png`, `finish_button.analysis.md`, `fix_finish_metrics.json`

### BUG_REST fix (2026-05-30)

- **Codigo:** `WorkoutScreen.js` — `presetBtnActive`/`presetBtnIdle`; testIDs `rest-timer-countdown`, `btn-rest-skip`, `btn-rest-extend-30`
- **Validacao:** `fix_rest_validate.ps1` (bounded, ~116s, bugRestPass: true)
- **Evidencia:** `rest_001..006` PNG/XML, `rest_buttons.analysis.md`, `fix_rest_metrics.json`

### Fix pos-finalizacao treino (2026-05-28)

**Bugs:** `BUG_HOME_CONCLUIDO_CONTINUAR`, `BUG_WORKOUT_PARTIAL_BECOMES_CONCLUIDO`, `BUG_HOME_COPY_PAROU_APOS_CONCLUIDO`

**Codigo:**
- `src/services/dailyState.js` — `computeWorkoutSessionStatus` usa `canFinishWorkout`; recovery guard; `workoutCompletedToday`
- `src/context/modules/coachRules.js` — `workoutCompleted` somente quando `workoutStatus === 'completed'`
- `src/screens/HomeScreen.js` — suprime recovery quando concluido
- `src/screens/WorkoutsHubScreen.js` — remove fallback local por `guidedSets`
- `src/screens/WorkoutScreen.js` — `dismissDropRecoveryCandidate()` no finish; `markWorkoutSessionState` no partial exit

**Validacao:** `node --test __tests__/dailyState.test.mjs` — **12/12 PASS** (sem QA visual)

**Evidencia ChatGPT:** treino_013, treino_015 (prints pre-fix)

### Fix validacao carga/reps (2026-05-28)

**Bugs:** `BUG_WORKOUT_INPUT_NO_VALIDATION`, `BUG_WORKOUT_HISTORY_CONTAMINATED`

**Codigo:**
- `src/services/workoutInputValidation.js` — `validateWorkoutSetInput`, limites 0–300kg / 1–100 reps / RPE 1–10
- `src/context/AppContext-v2.ts` — gate save + filtro `getExerciseProgress` / `getExerciseHistorySnapshot`
- `src/screens/WorkoutScreen.js` — validacao UI + lastSet plausivel
- `src/utils/suggestNextWeight.js`, `src/context/modules/coach.js` — ignorar logs implausiveis

**Validacao:** `node --test __tests__/workoutInputValidation.test.mjs` — **10/10 PASS**

**Aberto:** delete permanente opcional (`BUG_WORKOUT_HISTORY_PERMANENT_DELETE`) — aguarda OK Felipe

### Fix historico contaminado — modo seguro (2026-05-28)

**Bug:** `BUG_WORKOUT_HISTORY_DATA_CLEANUP`

**Codigo:**
- `src/services/workoutLogIntegrity.js` — `classifyWorkoutLogIssue`, `analyzeWorkoutLogIntegrity`, `sanitizeWorkoutLogsForRead`
- `AppContext-v2.ts`, `workout.js`, `coach.js`, `InsightsScreen.js`, `WorkoutScreen.js` — leituras sanitizadas
- Relatorio DEV: `workout_log_integrity_report` via `logEvent`

**Validacao:**
```powershell
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
```
Persistencia **nao** alterada · dados **nao** apagados

### Fix confirmacao finalizacao treino (2026-05-31)

**Bug:** `BUG_WORKOUT_FINISH_NO_CONFIRM`

**Codigo:**
- `src/services/workoutFinishFlow.js` — **NOVO** — copy confirmacao + gates `shouldMarkPartialSessionOnExit` / `shouldDismissRecoveryOnFinish`
- `src/screens/WorkoutScreen.js` — Alert "Continuar treino" / "Sair e salvar progresso"; `finishWorkout` bloqueado usa confirmacao (nao toast); `markWorkoutSessionState` so quando incompleto

**Validacao:**
```powershell
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
```
**Gate total:** 41/41 PASS · persistencia **nao** alterada · dados **nao** apagados

### Fix troca de exercicio com contexto (2026-05-31)

**Bug:** `BUG_WORKOUT_EXERCISE_SWAP_NO_CONTEXT`

**Codigo:**
- `src/services/workoutExerciseSwap.js` — **NOVO** — `buildExerciseSwapPlan`, `applyExerciseSwapToWorkout`, `migrateSetCountForSwap`, `buildDraftCleanupForSwap`
- `src/screens/WorkoutScreen.js` — Alert old→new; confirmacao com series/draft; `executeExerciseSwap`; logs **nao** transferidos

**Validacao:**
```powershell
node --test __tests__/workoutExerciseSwap.test.mjs      # 13/13 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
```
**Gate total:** 54/54 PASS · series antigas **nao** apagadas · logs **nao** transferidos · persistencia **nao** alterada

### Fix historico real comprovado (2026-05-31)

**Bug:** `BUG_WORKOUT_HISTORY_NOT_PROVEN`

**Codigo:**
- `src/services/workoutExerciseIdentity.js` — **NOVO** — matching strict por exerciseId
- `src/services/workoutHistoryFlow.js` — **NOVO** — `getSafeExerciseHistory`, `buildWorkoutHistorySummary`
- `src/context/AppContext-v2.ts` — progress/snapshot/history; fix progressao com logs filtrados

**Validacao:**
```powershell
node --test __tests__/workoutHistoryFlow.test.mjs       # 12/12 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/workoutExerciseSwap.test.mjs      # 13/13 PASS
```
**Gate total:** 66/66 PASS · persistencia **nao** alterada · dados **nao** apagados

### Fix progresso duplicado (2026-05-31)

**Bug:** `BUG_WORKOUT_PROGRESS_DUPLICATE`

**Codigo:**
- `src/services/workoutProgressCopy.js` — **NOVO** — copy unificada de progresso
- `src/screens/WorkoutScreen.js` — header/footer reorganizados; badge card oculto em modo simples

**Validacao:**
```powershell
node --test __tests__/workoutProgressCopy.test.mjs      # 10/10 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/workoutExerciseSwap.test.mjs      # 13/13 PASS
node --test __tests__/workoutHistoryFlow.test.mjs       # 12/12 PASS
```
**Gate total:** 76/76 PASS · calculo **nao** alterado · persistencia **nao** alterada

### Fix mode card compactado (2026-06-02)

**Bug:** `BUG_WORKOUT_MODE_CARD_BLOATED`

**Codigo:**
- `src/services/workoutModeCopy.js` — **NOVO** — copy compacta modo simples/avancado
- `src/screens/WorkoutScreen.js` — linha `workout-mode-bar` + chip Alternar (substitui SecondaryButton full-width)

**Validacao:**
```powershell
node --test __tests__/workoutModeCard.test.mjs          # 10/10 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/workoutExerciseSwap.test.mjs      # 13/13 PASS
node --test __tests__/workoutHistoryFlow.test.mjs       # 12/12 PASS
node --test __tests__/workoutProgressCopy.test.mjs      # 10/10 PASS
```
**Gate total:** 86/86 PASS · calculo **nao** alterado · persistencia **nao** alterada · print pos-fix **nao**

### Fix series checks clarificados (2026-06-02)

**Bug:** `BUG_WORKOUT_SERIES_CHECKS_CONFUSING`

**Codigo:**
- `src/services/workoutSetRowState.js` — **NOVO** — maquina de estados visuais por linha
- `src/components/workout/SetRow.js` — badge + botao condicional
- `src/components/workout/ExerciseCard.js` — calcula `rowState` por serie
- `src/screens/WorkoutScreen.js` — modo avancado inline com chip status e botao `Salvar serie`

**Validacao:**
```powershell
node --test __tests__/workoutSetRowState.test.mjs       # 10/10 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/workoutExerciseSwap.test.mjs      # 13/13 PASS
node --test __tests__/workoutHistoryFlow.test.mjs       # 12/12 PASS
node --test __tests__/workoutProgressCopy.test.mjs      # 10/10 PASS
node --test __tests__/workoutModeCard.test.mjs          # 10/10 PASS
```
**Gate total:** 96/96 PASS · calculo **nao** alterado · persistencia **nao** alterada · print pos-fix **nao**

### Fix Substituir com contexto (2026-06-02)

**Bug:** `BUG_WORKOUT_SUBSTITUIR_NO_CONTEXT`

**Codigo:**
- `src/services/workoutExerciseSwap.js` — `buildExerciseSwapActionCopy`; plan com copy de UI
- `src/screens/WorkoutScreen.js` — Trocar exercicio + helper; Alert/toast via plan

**Validacao:**
```powershell
node --test __tests__/workoutExerciseSwap.test.mjs      # 23/23 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/workoutHistoryFlow.test.mjs       # 12/12 PASS
node --test __tests__/workoutProgressCopy.test.mjs      # 10/10 PASS
node --test __tests__/workoutModeCard.test.mjs          # 10/10 PASS
node --test __tests__/workoutSetRowState.test.mjs       # 10/10 PASS
```
**Gate total:** 106/106 PASS · calculo **nao** · persistencia **nao** · logs transferidos **nao** · series antigas apagadas **nao** · print **nao**

### Fix campos Kg/Reps no save/finish (2026-06-02)

**Bug:** `BUG_WORKOUT_FINISH_FIELDS_RESET`

**Codigo:**
- `src/services/workoutSetDisplayValue.js` — **NOVO**
- `src/components/workout/WorkoutSetField.js`, `SetRow.js`, `ExerciseCard.js`
- `src/screens/WorkoutScreen.js` — unified rows + defer `clearWorkoutDraftStorage`

**Validacao:**
```powershell
node --test __tests__/workoutSetDisplayValue.test.mjs   # 10/10 PASS
node --test __tests__/dailyState.test.mjs               # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs    # 8/8 PASS
node --test __tests__/workoutFinishFlow.test.mjs        # 11/11 PASS
node --test __tests__/workoutExerciseSwap.test.mjs      # 23/23 PASS
node --test __tests__/workoutHistoryFlow.test.mjs       # 12/12 PASS
node --test __tests__/workoutProgressCopy.test.mjs      # 10/10 PASS
node --test __tests__/workoutModeCard.test.mjs          # 10/10 PASS
node --test __tests__/workoutSetRowState.test.mjs       # 10/10 PASS
node --test __tests__/workoutSetDisplayValue.test.mjs   # 10/10 PASS
node --test __tests__/workoutHistoryCapture.test.mjs    # 10/10 PASS
```
**Gate total:** 126/126 PASS · calculo **nao** · persistencia **nao** · historico captura UI **sim** (leitura only) · print **nao**

**Fix captura historico (2026-05-28):** `BUG_WORKOUT_HISTORY_CAPTURE_INCOMPLETE` — painel treino + bloco Historico local; logs invalidos nao exibidos nem apagados.

**Validacao visual pos-fix Treino (2026-06-02):** `treino_postfix_visual_check.ps1` + `treino_postfix_gap_check.ps1` — **PASS VISUAL PARCIAL COM RESSALVAS**; 003 modo avancado OK / Trocar condicionado; 005 vazio documentado + 006 leitura OK.

**Fechamento modulo Treino (2026-06-02 — OK Felipe):** P1 estado global + fixes Treino/Home listados em [`TREINO_FINAL_STATUS.md`](TREINO_FINAL_STATUS.md) — veredito **PASS VISUAL PARCIAL COM RESSALVAS**; gate 126/126 aceito; prints `screenshots/treino_postfix/treino_postfix_001` … `006` + recaptura 003/005; **PASS global app: NAO**; Nutricao profunda e historico permanente/delete fora de escopo.

**Home pendências finais (2026-06-02):** [`HOME_FINAL_PENDING_REPORT.md`](HOME_FINAL_PENDING_REPORT.md) — **PASS PARCIAL**; meal sync (`getTodayKey` local + focus refresh Home); CTA/concluído revalidado com Treino; Insights/P2 abertos.

### Analises

`screenshots/fix_p1/fix_00X_*.analysis.md` (5 arquivos) · `fix_p1_metrics.json` · `finish_button.analysis.md` · `rest_buttons.analysis.md`
