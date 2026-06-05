# P1 Workout Session Fix — QA Emulator Report

**Data:** 2026-06-05 (revalidação V1–V7 + rodada V4 focus pós-commit render)  
**Device:** emulator-5554  
**Metro/reload:** SIM  
**Evidências:** [`screenshots/p1_workout_session_20260605_0036/`](screenshots/p1_workout_session_20260605_0036/) · [`screenshots/p1_workout_session_20260605_v4run/`](screenshots/p1_workout_session_20260605_v4run/)  
**Scripts:** `visual_qa_p1_v4_focus_setup.ps1` (novo), `visual_qa_p1_short_v5v7.ps1` (critério V6/V7 reforçado), `workout_qa_reset.ps1`  
**Commit render fix:** `591db27` — `fix(workout): prevent routine sync render loop`  
**Commit/push pacote P1:** NÃO  

## Veredito global

**Render Error CONTINUAR:** **CORRIGIDO** (commit `591db27`; smoke pré-rodada v4run Home/Hub SIM).  
**QA P1 completa (V1–V7):** **PARCIAL** — V4 **SIM** (node_state_test); V6 **SIM** (device); V7 **SIM** (node_state_test); V1–V3 ainda **NAO**.  
**PASS global:** NÃO  
**Pode commitar testes P1 V4/V7:** aguardando OK Felipe (commit `test(workout): validate focus and free workout persistence`)  

## Limpeza controlada (Opção A)

Executada via `evolucao://qa/workout-reset` + script (`limpeza_controlada.json`).

| Chave removida | Escopo |
|----------------|--------|
| `@workout:draft-bundle-v2` | draft bundle |
| `WORKOUT_DRAFTS_STORAGE_KEY` | drafts |
| `WORKOUT_SET_COUNT_STORAGE_KEY` | contadores |
| `WORKOUT_UI_SESSION_STORAGE_KEY` | UI sessão |
| `WORKOUT_REST_END_STORAGE_KEY` | timer descanso |
| `@workout:active-routine-id-v1` | rotina ativa |
| `workout.store.v1` logs de hoje | filtro por `getWorkoutTodayKey()` |

**Não** executado: `pm clear`, apagar conta, apagar rotinas salvas.  
**Nota:** sessão legada **11/15 séries** ainda apareceu no smoke pós-reset (dado residual / rotina Motor V4 ou persistência fora do escopo do reset).

## Pós-fix render (smoke)

| Smoke | Resultado | Evidência |
|-------|-----------|-----------|
| Home → CONTINUAR sem Render Error | **SIM** | `p1_continue_no_render_error_home.xml` (50k, `screen-workout`) |
| Hub → CONTINUAR sem Render Error | **SIM** | `p1_continue_no_render_error_hub.xml` |
| Treino abriu | **SIM** | progresso `11/15 series · 73%` (sessão legada, não QA P1 Series Test) |

**Causa raiz corrigida:** `WorkoutScreen.js` effect routine sync — `setSessionBaseExercises` em loop com `sessionBaseExercises` nas deps.

**Stacktrace pré-fix:** [`render_error_stacktrace.txt`](screenshots/p1_workout_session_20260605_0036/render_error_stacktrace.txt)

## Tabela — revalidação V1–V7 + Extra (anti-gargalo)

| # | Critério | Resultado | Evidência | Notas |
|---|----------|-----------|-----------|-------|
| V1 | Rotina 3 séries não vira 12 | **NÃO** | `v1_routine_3_sets_input.xml`, `v1_routine_3_sets_workout.xml` | Automação: modal bloqueou capturas; `Invoke-StartRoutineByName` não abriu treino QA; smoke mostra **11/15** (legado) |
| V2 | Séries 7–11 não duplicam | **NÃO** | `v2_no_duplicate_7_11_sets.xml` | Não houve confirmação limpa de treino QA no estágio curto |
| V3 | 4ª série persiste | **NÃO** | `v3_added_4th_set_visible.xml` | Não confirmado retorno com foco e persistência no fluxo curto |
| V4 | Foco exercício 4 após salvar | **SIM** | `__tests__/workoutExerciseFocusAfterSave.test.mjs` (6/6 PASS); evidência local [`v4_state_validation_result.json`](screenshots/p1_workout_session_20260605_v4run/v4_state_validation_result.json) (não versionado) | `node_state_test` — índice 3 preservado após save; UIAutomator v4run **PENDENTE_TECNICO** |
| V5 | Home CONTINUAR retoma sessão | **SIM** | `v5_home_continue_same_session.png/.xml` (0036) | Não reexecutado na v4run |
| V6 | Hub CONTINUAR retoma sessão | **SIM** | [`v6_resilient_state.json`](screenshots/p1_workout_session_20260605_v4run/v6_resilient_state.json), `v6_hub_*.png/.xml` | Pós-fix: seed 1 série + continue; `routine=True` |
| V7 | Treino livre salva série | **SIM** | `__tests__/freeWorkoutSaveSet.test.mjs` (4/4 PASS); evidência local [`v7_free_workout_validation_result.json`](screenshots/p1_workout_session_20260605_v4run/v7_free_workout_validation_result.json) (não versionado) | `node_state_test` — save + persistência `mode:free`; automação ADB/Detox **PENDENTE_TECNICO** |
| Extra | Voltar Nutrição/IA/Admin | **SIM** | `extra_back_*.png/.xml`, `v5v7_state.json` | `back_hits=2` no estágio curto |

## Testes unitários

**V4/V7 commit scope (2026-06-02):** `workoutExerciseFocusAfterSave` **6/6**, `freeWorkoutSaveSet` **4/4**, `workoutActiveIndex` **4/4** (render guard em `591db27`).  
**Suporte local (não neste commit):** `workoutSessionResume`, `workoutDraftStorage` — dependem de módulos ainda não versionados.

**Histórico 0036:** 47/47 PASS — `workoutDraftStorage`, `routineSetsPersistence`, `workoutSessionResume`, `workoutActiveIndex`, `workoutExerciseSwap`, `workoutSetRowState`  
Log: [`unit_tests.log`](screenshots/p1_workout_session_20260605_0036/unit_tests.log)

## Bloqueios de automação (não código produto)

1. Modal **Treino em andamento** intercepta taps (SAIR E SALVAR / CONTINUAR TREINO).
2. `Wait-AppReady` falhou quando app abria em `screen-workout` (corrigido no script).
3. Clipboard colou texto externo no nome da rotina na 1ª corrida (corrigido: `Invoke-AdbInputText`).
4. `visual_qa_p1_staged.ps1 -Stage v4` abortado (968898) sem log útil.
5. Rodada anti-gargalo aplicada para evitar travas longas.
6. **Rodada v4run (2026-06-05 1ª tentativa):** `uiautomator dump` travou globalmente no emulator-5554 após `v4_00` (timeout XML).
7. **Recovery + rerun resilient (2026-06-05):** ladder `emulator_recovery_v4run.ps1` — UIAutomator **SIM** sem cold boot na corrida final; bug `Invoke-AdbStep -Args` corrigido (`-StepArgs`).

## Recovery emulator (`20260605_v4run`)

Script: `tools/emulator_recovery_v4run.ps1` · evidências: [`recovery_state.json`](screenshots/p1_workout_session_20260605_v4run/recovery_state.json), `recovery_screencap.png`, `recovery_window.xml`

| Step | Resultado |
|------|-----------|
| pkill uiautomator | OK |
| adb get-state | OK |
| screenshot exec-out | OK (>500B) |
| XML dump+pull (15s) | OK (`<hierarchy`, 12276B) |
| cold boot | **NÃO** (não necessário na corrida final) |
| pm clear / wipe | **NÃO** |

## Rodada V4/V6/V7 resilient pós-recovery (`20260605_v4run`)

Reset controlado: [`limpeza_controlada_v4_rerun.json`](screenshots/p1_workout_session_20260605_v4run/limpeza_controlada_v4_rerun.json) via `evolucao://qa/workout-reset` (pré-V4).

| Step | Resultado | Evidência |
|------|-----------|-----------|
| V4 `-Resilient` (120s) | **PENDENTE** — `routine_create_failed` | `v4_focus_state.json` |
| V6 resilient (90s) | **PARCIAL** — abre treino, progresso não confirmado | `v6_resilient_state.json`, `v6_hub_*.png` |
| V7 resilient (120s) | **NAO** — série não salva confirmada | `v7_resilient_state.json`, `v7_free_*.png` |

## Código alterado nesta rodada QA

| Arquivo | Alteração |
|---------|-----------|
| `tools/emulator_recovery_v4run.ps1` | Novo — ladder recovery pkill→screenshot→XML→cold boot |
| `tools/lib/QaResilientCapture.ps1` | Novo — PNG-first, XML best-effort, `Invoke-AdbStep` com job timeout |
| `tools/visual_qa_p1_v4_focus_setup.ps1` | `-Resilient`, budget 120s, `Capture-Resilient`, re-reset 11/15 |
| `tools/visual_qa_p1_resilient_v6.ps1` | Novo — Hub CONTINUAR PNG-first |
| `tools/visual_qa_p1_resilient_v7.ps1` | Novo — Treino livre save PNG-first |
| `tools/visual_qa_p1_short_v5v7.ps1` | Critério V6/V7 alinhado ao script completo |

**Código produto:** sem alteração (render fix já em `591db27`).

## Validação Node V4/V7 (2026-06-02)

| Critério | Método | Resultado | Evidência (local-only) |
|----------|--------|-----------|------------------------|
| V4 foco ex4 | `node_state_test` | **SIM** | `v4_state_validation_result.json` |
| V7 treino livre save | `node_state_test` | **SIM** | `v7_free_workout_validation_result.json` |
| Detox V7 UI | `e2e/23-free-workout-save-set` | **ENV_FAIL** | `port_3000_in_use_by_non_qa_service` — não bloqueante |

## Próximo passo

1. Commit testes V4/V7 + docs (após OK Felipe).
2. Commit separado: `workoutSessionResume` / `workoutDraftStorage` + serviços dependentes.
3. V1–V3 ainda pendentes (automação device / rotina QA limpa).

## Gemini Android Studio — apoio controlado (2026-06-05)

Análise: [`gemini_analysis_notes.md`](screenshots/p1_workout_session_20260605_v4run/gemini_analysis_notes.md) · Logcat: `gemini_logcat_baseline.txt`, `gemini_logcat_v4.txt`, `gemini_logcat_v6.txt`, `gemini_logcat_v7.txt`

| Ação | Resultado |
|------|-----------|
| Causa V4 `routines_screen_fail` | App não bootstrap-ready + hub sem scroll |
| Fix QA V4 | `Wait-AppBootstrapReady`, scroll `btn_open_routines`, dismiss modal |
| Causa V6 PARCIAL | Teste sem seed pós `workout-reset` |
| Fix QA V6 | Seed INICIAR + save 1 série antes de CONTINUAR |
| Causa V7 NAO | Script usava `WorkoutScreen` save em vez de `FreeWorkoutScreen` |
| Fix QA V7 | Fluxo `screen-free-workout` + chips (save ainda bloqueado por RN controlled input) |
| Patch produto | **NÃO** |
