# Bugs Encontrados — Mapeamento ao Vivo

---

## BUG_001 — Treino com apenas 1 exercicio

**Codigo:** `MULTI_EXERCISE_WORKOUT_NOT_LOADED`  
**Categoria:** Logica / Estado  
**Tela:** Treino de hoje  

**Descricao:**  
Ao clicar "Continuar treino" na Home, a WorkoutScreen abre com **Exercicio 1 de 1** e **0/4 series**, indicando treino de sessao unica em vez de multi-exercicio.

**Evidencia:**
- before: `screenshots/home/home_001_inicio.png`
- after: `screenshots/home/home_002_continuar_treino.png`

**Como reproduzir:**
1. Abrir app no emulador-5554
2. Home → Continuar treino
3. Observar header "Exercicio 1 de 1"

**Impacto:** **Alto** — invalida fluxo real de treino e testes de progresso multi-exercicio

**Correcao sugerida:** (nao aplicar ate analise auditoria externa) Revisar carga de `sessionBaseExercises` / preset / persistencia de rascunho

**Status:** Aberto — **P1 fix 2026-05-30:** resync multi-exercicio em `WorkoutScreen`; validar apos reload Metro

---

## BUG_002 — Preset de treino com 1 exercicio

**Codigo:** `WORKOUT_PRESET_ONLY_ONE_EXERCISE`  
**Categoria:** Logica / Dados  
**Tela:** Treino de hoje  

**Descricao:**  
Treino recomendado/continuado carrega apenas um exercicio (Agachamento ou similar), nao o split esperado (3-5 exercicios).

**Evidencia:** `screenshots/home/home_002_continuar_treino.png`  

**Impacto:** **Alto**  

**Status:** Parcial — P1 fix: resync sessao multi em WorkoutScreen

---

## BUG_STATE_P1 — Desync Home/Treino/Coach (P1 batch 2026-05-30)

**Codigos:** streak/XP/proteina/treino ativo inconsistentes entre telas  
**Correcao:** `src/services/dailyState.js` + `getDailyState()` + hotfix hydration  
**Status pos-validacao 2026-05-30T17:52:** **PASS estado global** — 160g unificado, CONTINUAR coerente, 1 de 5  
**Evidencia:** `screenshots/fix_p1/fix_001..005` + `fix_p1_metrics.json` + `*.analysis.md`  
**Hotfix:** `AppContext-v2.ts` — `nutritionStore.hydration` (nao `.getState()`)

---

## BUG_003 — Botao Finalizar visivel cedo demais

**Codigo:** `FINISH_BUTTON_VISIBLE_TOO_EARLY`  
**Categoria:** Logica / UX  
**Tela:** Treino de hoje (modo simples)

**Descricao:**  
Com apenas **1/4 series** e **25% concluido**, botao verde **"Finalizar treino (1/4)"** visivel antes do treino estar completo.

**Evidencia:**
- `screenshots/treino/treino_010_rest_presets.png`
- `screenshots/treino/treino_011_pre_finish.png`
- `screenshots/fix_p1/fix_005_continuar_treino.png` (2026-05-30: Finalizar 1/17 @ 6%)

**Impacto:** **Medio** — usuario pode encerrar treino incompleto

**Status:** **FIXED** (2026-05-30) — fix_finish_validate PASS; sem Feche/Finalizar com series incompletas

**Evidencia pos-fix:**
- `screenshots/fix_p1/finish_002_after_fix_1_of_17.png`
- `screenshots/fix_p1/finish_button.analysis.md`
- `screenshots/fix_p1/fix_finish_metrics.json`

**Referencia antes:** fix_005 / finish_001 (Feche em 1 toque + Finalizar 1/17)

---

## BUG_REST — Presets descanso confusos + timer

**Codigo:** `REST_BUTTONS_STATE_CONFUSING`  
**Categoria:** UX / Estado  
**Tela:** Treino de hoje  

**Descricao:**  
Presets 30s/60s/120s com multiplos estados visuais ativos; timer de descanso nao validado na deep audit.

**Correcao:**  
- Estilo unico ativo (`presetBtnActive` vs `presetBtnIdle`)  
- testIDs timer: `rest-timer-countdown`, `btn-rest-skip`, `btn-rest-extend-30`  
- Validador aceita PNG quando uiautomator timeout no overlay

**Evidencia pos-fix:**
- `screenshots/fix_p1/rest_001..006` PNG + XML
- `screenshots/fix_p1/rest_buttons.analysis.md`
- `screenshots/fix_p1/fix_rest_metrics.json` (bugRestPass: true)

**Status:** **FIXED** (2026-05-30T23:16)

---

## BUG_004 — Progresso 25% com 1 serie (treino 1 exercicio)

**Codigo:** `WORKOUT_PROGRESS_PREMATURE_25`  
**Categoria:** Logica / Progresso  
**Tela:** Treino de hoje  

**Descricao:**  
Apos salvar **1 serie** de **4**, barra mostra **25% concluido** (correto para 1 exercicio unico, incorreto se esperado 5 exercicios x 4 series).

**Evidencia:** `screenshots/treino/treino_002_ex1_parcial.png`, `treino_005_progresso_parcial.png`

**Impacto:** **Alto** (indireto — confirma modelo 1-exercicio)

**Status:** Aberto — observacional

---

## BUG_005 — Streak inconsistente entre telas (auditoria externa HOME 1/2)

**Codigo:** `STREAK_STATE_INCONSISTENT`  
**Categoria:** Logica / Estado global  
**Telas:** Home, Treino, Insights  

**Descricao:** Home mostra "Dia 1 de sequencia"; Treino e Insights mostram "0 dias".

**Evidencia:** home_001_inicio.png, home_002_continuar_treino.png, home_004_ver_insights.png  
**Fonte:** auditoria externa HOME 1/2  
**Impacto:** Alto  
**Status:** Corrigido em codigo (P1 fix 2026-05-30) — validar pos-reload

---

## BUG_006 — Meta de proteina inconsistente (auditoria externa)

**Codigo:** `PROTEIN_GOAL_INCONSISTENT`  
**Categoria:** Logica / Dados  
**Telas:** Home (150g), Nutricao/Coach (160g)  

**Evidencia:** home_001, home_003, home_006, home_007  
**Fonte:** auditoria externa HOME 1/2 + 2/2  
**Impacto:** Alto  
**Status:** Corrigido — meta unificada via `dailyState` (160g peso-based)

---

## BUG_007 — Texto invisivel na tela treino (auditoria externa)

**Codigo:** `WORKOUT_TEXT_INVISIBLE_CONTRAST`  
**Categoria:** Visual / Contraste  
**Tela:** Treino de hoje  

**Descricao:** "Supino Reto Barra" quase preto em fundo preto acima do botao "Registrar 10kg".

**Evidencia:** home_002_continuar_treino.png  
**Fonte:** auditoria externa HOME 1/2  
**Impacto:** Alto  
**Status:** Corrigido — QuickExerciseRegister com contraste + oculto fora __DEV__

---

## BUG_008 — Botao "Registrar 10kg" parece debug (auditoria externa)

**Codigo:** `WORKOUT_DEBUG_REGISTER_BUTTON`  
**Categoria:** UX / Debug exposto  
**Tela:** Treino de hoje  

**Evidencia:** home_002_continuar_treino.png  
**Fonte:** auditoria externa HOME 1/2  
**Impacto:** Medio  
**Status:** Corrigido — oculto fora de __DEV__ (modo avancado)

---

## BUG_009 — Estado treino inconsistente entre abas (auditoria externa HOME 2/2)

**Codigo:** `WORKOUT_ACTIVE_STATE_DESYNC`  
**Categoria:** Logica / Navegacao  
**Telas:** Home (Continuar treino), Treino (Iniciar), Coach (nao treinou)  

**Evidencia:** home_001, home_005, home_007  
**Fonte:** auditoria externa HOME 2/2  
**Impacto:** Alto  
**Status:** Aberto

---

## BUG_010 — Labels tecnicas expostas (auditoria externa)

**Codigo:** `DEBUG_FEATURE_LABELS_EXPOSED`  
**Categoria:** UX / Debug  
**Telas:** Nutricao `[F-Nutrition]`, Coach `[F-Coach]`  

**Evidencia:** home_006, home_007  
**Fonte:** auditoria externa HOME 2/2  
**Impacto:** Medio  
**Status:** Aberto

---

## BUG_011 — Card Treino "Hoje" status vazio (auditoria externa)

**Codigo:** `WORKOUT_HUB_STATUS_DASH`  
**Categoria:** UX / Dados  
**Tela:** Hub Treino  

**Descricao:** Card mostra "1 exercicio, 0 series, status = —"

**Evidencia:** home_005_tab_treino.png  
**Fonte:** auditoria externa HOME 2/2  
**Impacto:** Medio  
**Status:** Aberto

---

## HOME 3/3 Deep — Bugs confirmados com evidencia ADB (2026-05-30)

| Codigo | Prioridade | Evidencia |
|---|---|---|
| BUG_WORKOUT_PRESET_ONLY_ONE_EXERCISE | P1 | home_deep_004, 010 |
| BUG_MULTI_EXERCISE_WORKOUT_NOT_LOADED | P1 | home_deep_004, 010 |
| BUG_FINISH_BUTTON_VISIBLE_TOO_EARLY | P1 | home_deep_004 — **FIXED** fix_finish |
| BUG_REST_BUTTONS_STATE_CONFUSING | P2 | home_deep_004 — **FIXED** fix_rest |
| BUG_PROTEIN_GOAL_MISMATCH | P1 | Home 150g vs Nutricao 160g — **FIXED** 160g |
| BUG_MEAL_NOT_UPDATING_HOME | P1 | home_deep_022 — **FIXED** 2026-06-02 (`getTodayKey` local) |
| BUG_INSIGHTS_XP_STREAK_MISMATCH | P1 | Home Dia 1 vs Insights Streak 0 |
| BUG_PAYWALL_TOO_AGGRESSIVE | P2 | home_deep_024 |
| BUG_MOCK_RANKING_EXPOSED | P2 | home_deep_024, 025 |
| BUG_MICROCOPY_ACCENTS_BROKEN | P2 | home_deep_024, 025, 027 |

**BUG_001/002:** reconfirmados na deep audit.  
**Salvar refeicao:** INCONCLUSIVO — `btn-salvar-alimento` sem mudanca visivel.

---

## Codigos NAO confirmados (Treino batch)

- `REST_BUTTONS_MISSING` — presets visiveis na deep audit
- `WORKOUT_PROGRESS_PREMATURE_100` — max 25% observado
- `WORKOUT_COMPLETE_WITH_INCOMPLETE_SETS` — nao observado 100%

---

## BUG_HOME_CONCLUIDO_CONTINUAR — Home Concluido + Continuar treino (TREINO 3/3)

**Codigo:** `BUG_HOME_CONCLUIDO_CONTINUAR`  
**Categoria:** Logica / Estado  
**Telas:** Home, Treino hub, Coach  

**Descricao:**  
Apos finalizar ou com treino parcial, Home mostrava **Concluido** e **CONTINUAR TREINO** simultaneamente, com copy "Voce parou no treino".

**Evidencia:** treino_013, treino_015 (prints pre-fix 2026-05-30)  
**Fonte:** auditoria externa TREINO 3/3  

**Correcao (2026-05-28):**
- `src/services/dailyState.js` — `completed` via `canFinishWorkout`; recovery guard em `buildDailyState`
- `src/screens/HomeScreen.js` — suprime `adaptiveConfig.recovery` quando `status === completed`
- `src/screens/WorkoutScreen.js` — `dismissDropRecoveryCandidate()` no finish
- `src/screens/WorkoutsHubScreen.js` — remove fallback local por `guidedSets > 0`

**Testes:** `node --test __tests__/dailyState.test.mjs` — 12/12 PASS  

**Status:** **FIXED** (codigo; revalidacao visual aguarda OK Felipe)

---

## BUG_WORKOUT_PARTIAL_BECOMES_CONCLUIDO — Parcial vira 100% Concluido

**Codigo:** `BUG_WORKOUT_PARTIAL_BECOMES_CONCLUIDO`  
**Categoria:** Logica / Estado  
**Telas:** Home, Coach  

**Descricao:**  
Com 1 serie de 17, Home/Coach tratavam treino como **Concluido 100%** em vez de **Em andamento**.

**Evidencia:** treino_013, treino_015  
**Fonte:** auditoria externa TREINO 3/3  

**Correcao (2026-05-28):**
- `src/context/modules/coachRules.js` — `workoutCompleted` somente quando `workoutStatus === 'completed'`
- `dailyState.js` — `completionRate` recalculado; flags `isPartial` / `workoutCompletedToday`

**Status:** **FIXED** (codigo; revalidacao visual aguarda OK Felipe)

---

## BUG_WORKOUT_INPUT_NO_VALIDATION — Valores absurdos aceitos (TREINO 1/3)

**Codigo:** `BUG_WORKOUT_INPUT_NO_VALIDATION`  
**Categoria:** Logica / Validacao  
**Telas:** WorkoutScreen, AppContext  

**Descricao:**  
App aceitava 2060kg x 1010 reps e botao DEV "Registrar 2163kg".

**Evidencia:** treino_002..005  
**Correcao (2026-05-28):** `workoutInputValidation.js`, gate AppContext, WorkoutScreen, suggestNextWeight  
**Testes:** `node --test __tests__/workoutInputValidation.test.mjs` — 10/10 PASS  
**Status:** **FIXED** (codigo)

---

## BUG_WORKOUT_HISTORY_CONTAMINATED — PR/ultimo com valores absurdos

**Codigo:** `BUG_WORKOUT_HISTORY_CONTAMINATED`  
**Categoria:** Dados / Exibicao  

**Correcao (2026-05-28):** filtro read-only em PR, ultimo, coach, lastSetByExercise  
**Status:** **FIXED** (mitigacao; dados antigos permanecem)

---

## BUG_WORKOUT_HISTORY_DATA_CLEANUP — Migracao de logs contaminados

**Codigo:** `BUG_WORKOUT_HISTORY_DATA_CLEANUP`  
**Status:** **FIXED** 2026-05-28 (modo seguro)

**Correcao:**
- `src/services/workoutLogIntegrity.js` — `analyzeWorkoutLogIntegrity`, `sanitizeWorkoutLogsForRead`, helpers PR/ultimo
- Leituras sanitizadas: `getTodayWorkoutSummary` (stats, XP intacto), `InsightsScreen`, `WorkoutScreen` finish volume, `getRecommendedWorkout`, progression
- Relatorio DEV: `logEvent('workout_log_integrity_report')` quando `invalidLogs > 0`
- **Persistencia:** nao alterada · **Dados apagados:** nao

**Testes:** `node --test __tests__/workoutHistoryCleanup.test.mjs` — 8/8 PASS

**Opcional futuro:** `BUG_WORKOUT_HISTORY_PERMANENT_DELETE` — delete/migracao com backup (aguarda OK Felipe)

---

## BUG_WORKOUT_FINISH_NO_CONFIRM — Finalizar/sair sem confirmacao clara

**Codigo:** `BUG_WORKOUT_FINISH_NO_CONFIRM`  
**Categoria:** UX / Logica  
**Tela:** WorkoutScreen  

**Descricao:**  
Treino incompleto podia ser encerrado ou finalizado sem modal claro; copy/botoes da confirmacao nao seguiam spec; saida com treino completo marcava `partial_exit` indevidamente.

**Evidencia:** treino_012 ("Salvando treino..." sem modal)  
**Fonte:** auditoria externa TREINO 3/3  

**Causa real:** Alert com copy antiga (`Cancelar` / `Sair e salvar`); `finishWorkout` bloqueado usava toast apenas; `flushPartialWorkoutState` sempre chamava `markWorkoutSessionState({ partial_exit })` mesmo quando `canFinishWorkout`.

**Correcao (2026-05-31):**
- `src/services/workoutFinishFlow.js` — **NOVO** — `INCOMPLETE_EXIT_CONFIRMATION`, `shouldMarkPartialSessionOnExit`, `shouldDismissRecoveryOnFinish`
- `src/screens/WorkoutScreen.js` — Alert spec; gate `markWorkoutSessionState` so quando incompleto; `finishWorkout` bloqueado abre confirmacao (nunca "Salvando treino...")

**Regra:** `canFinishWorkout({ plannedSets, completedSets })` — incompleto → confirmacao + partial/in_progress + recovery; completo → `finishWorkout` + dismiss recovery

**Persistencia alterada?** NAO · **Dados apagados?** NAO

**Testes:**
```powershell
node --test __tests__/workoutFinishFlow.test.mjs   # 11/11 PASS
node --test __tests__/dailyState.test.mjs          # 12/12 PASS
node --test __tests__/workoutInputValidation.test.mjs  # 10/10 PASS
node --test __tests__/workoutHistoryCleanup.test.mjs   # 8/8 PASS
```
**Gate total:** 41/41 PASS

**Status:** **FIXED** (codigo + testes; sem QA visual pesada)

---

## BUG_WORKOUT_EXERCISE_SWAP_NO_CONTEXT — Troca sem contexto

**Codigo:** `BUG_WORKOUT_EXERCISE_SWAP_NO_CONTEXT`  
**Categoria:** UX / Logica  
**Tela:** WorkoutScreen  

**Descricao:**  
Substituir exercicio (ex. Supino → Puxada) ocorria sem copy contextual, sem confirmacao quando havia progresso, e sem deixar claro que series registradas permanecem no exercicio anterior.

**Evidencia:** treino_006..010  
**Fonte:** auditoria externa TREINO 2/3  

**Causa real:** `replaceActiveExercise` trocava nome silenciosamente; toast generico; nenhum `buildExerciseSwapPlan`; draft orfao sob nome antigo.

**Correcao (2026-05-31):**
- `src/services/workoutExerciseSwap.js` — **NOVO** — `buildExerciseSwapPlan`, `applyExerciseSwapToWorkout`, `migrateSetCountForSwap`, `buildDraftCleanupForSwap`
- `src/screens/WorkoutScreen.js` — Alert contextual old→new; confirmacao quando series concluidas ou draft; `executeExerciseSwap`; `quickReplaceActiveExercise` com nome direto

**Regra de swap:**
- Sem series/draft → troca direta + toast `"Old substituido por New"`
- Com series concluidas → confirmacao; logs preservados no exercicio anterior; **nao transferidos**
- Com draft nao salvo → confirmacao; draft orfao removido do state local (nao logs)
- Contador X/Y e planned sets mantidos; `workoutLogs` intactos

**Series antigas apagadas?** NAO · **Logs transferidos?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO

**Testes:**
```powershell
node --test __tests__/workoutExerciseSwap.test.mjs   # 13/13 PASS
```
**Gate total (5 suites):** 54/54 PASS

**Status:** **FIXED** (codigo + testes; sem QA visual pesada)

---

## BUG_WORKOUT_HISTORY_NOT_PROVEN — Historico real nao comprovado

**Codigo:** `BUG_WORKOUT_HISTORY_NOT_PROVEN`  
**Categoria:** Dados / Logica  
**Telas:** WorkoutScreen, AppContext (progress/PR/snapshot)  

**Descricao:**  
Pipeline de historico por exercicio nao estava centralizado nem coberto por testes; matching por `exerciseId` fraco; progressao podia usar logs de outros exercicios.

**Evidencia:** treino_014 (print aba Treinos — evidencia visual insuficiente)  
**Fonte:** auditoria externa TREINO 3/3  

**Causa real:**
- `getExerciseProgressionSuggestion` filtrava logs mas passava `workoutLogs` global ao use case
- `matchesExerciseLog` fazia match por nome mesmo com `exerciseId` diferente
- Sem modulo unico `buildWorkoutHistorySummary` / `getSafeExerciseHistory`

**Correcao (2026-05-31):**
- `src/services/workoutExerciseIdentity.js` — **NOVO** — `matchesExerciseLog` strict (exerciseId prioridade)
- `src/services/workoutHistoryFlow.js` — **NOVO** — `getSafeExerciseHistory`, `buildWorkoutHistorySummary`
- `src/context/AppContext-v2.ts` — `getExerciseProgress`, `getExerciseHistorySnapshot`, fix progressao
- `src/context/modules/workout.js` — re-export identity helpers

**Regra:** filter → sanitize → sort → last/best/volume; `exerciseId` prioridade; `ignoredCount` diagnostico

**Persistencia alterada?** NAO · **Dados apagados?** NAO

**Testes:** `node --test __tests__/workoutHistoryFlow.test.mjs` — 12/12 PASS  
**Gate total (6 suites):** 66/66 PASS

**Status:** **FIXED** (comprovado por testes; QA visual nao obrigatoria)

---

## BUG_WORKOUT_PROGRESS_DUPLICATE — Progresso duplicado na tela

**Codigo:** `BUG_WORKOUT_PROGRESS_DUPLICATE`  
**Categoria:** UX  
**Tela:** WorkoutScreen  

**Descricao:**  
Contadores de progresso repetidos (topRow 1/17, Treino X%, footer com X/Y, badge 1/5 no card).

**Evidencia:** treino_001, treino_002  
**Fonte:** auditoria externa TREINO 1/3  

**Causa real:** copy espalhada sem helper unico; footer repetia metricas em vez de orientar acao.

**Correcao (2026-05-31):**
- `src/services/workoutProgressCopy.js` — **NOVO** — `buildWorkoutProgressCopy`, `computeWorkoutCompletionPercent`
- `src/screens/WorkoutScreen.js` — header unificado; footer acao; badge 1/5 oculto em modo simples

**Regra:** progresso principal unico (`Exercicio X de Y` + `Treino: N/M series · P%`); footer so orienta acao

**Cálculo alterado?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO

**Testes:** `node --test __tests__/workoutProgressCopy.test.mjs` — 10/10 PASS  
**Gate total (7 suites):** 76/76 PASS

**Status:** **FIXED** (codigo + testes; sem QA visual pesada)

---

## BUG_WORKOUT_MODE_CARD_BLOATED — Card modo simples/avançado grande

**Codigo:** `BUG_WORKOUT_MODE_CARD_BLOATED`  
**Categoria:** UX  
**Tela:** WorkoutScreen  

**Descricao:**  
SecondaryButton full-width ("Modo simples ativo") ocupava faixa grande da tela.

**Evidencia:** treino_008, treino_009  
**Fonte:** auditoria externa TREINO 2/3 + PACOTE_COMPLETO 2026-06-02  

**Causa real:** `SecondaryButton` padrao (minHeight 48) usado como toggle de modo; copy redundante com "ativo".

**Correcao (2026-06-02):**
- `src/services/workoutModeCopy.js` — **NOVO** — `buildWorkoutModePresentation`
- `src/screens/WorkoutScreen.js` — linha compacta `workout-mode-bar` + chip "Alternar"; helper discreto so no avancado

**Regra anterior:** botao secundario full-width "Modo X ativo"  
**Regra nova:** `Modo simples` / `Modo avancado` + chip `Alternar` (`btn-toggle-workout-mode` preservado)

**Calculo alterado?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO

**Testes:** `node --test __tests__/workoutModeCard.test.mjs` — 10/10 PASS  
**Gate total (8 suites):** 86/86 PASS

**Print pos-fix?** NAO — FIXED tecnico/UI por codigo + testes

**Status:** **FIXED** (codigo + testes; sem PASS visual)

---

## BUG_WORKOUT_SERIES_CHECKS_CONFUSING — Checks confusos em séries não salvas

**Codigo:** `BUG_WORKOUT_SERIES_CHECKS_CONFUSING`  
**Categoria:** UX  
**Tela:** WorkoutScreen (modo simples + avancado)  

**Descricao:**  
Botao check/concluir aparecia em todas as linhas; series futuras pareciam concluidas (verde ou ✔ desabilitado).

**Evidencia:** treino_008  
**Fonte:** auditoria externa TREINO 2/3 + PACOTE_COMPLETO 2026-06-02  

**Causa real:** UI usava check como affordance generica; nao distinguia pendente/pronta/salva/invalida/futura.

**Correcao (2026-06-02):**
- `src/services/workoutSetRowState.js` — **NOVO** — `buildWorkoutSetRowState`
- `src/components/workout/SetRow.js` — badge status + botao `Salvar serie` so em `ready`; check verde so em `saved`
- `src/components/workout/ExerciseCard.js` — calcula `rowState` por linha
- `src/screens/WorkoutScreen.js` — modo avancado inline: chip status + botao condicional (sem ✔ Concluir serie em futuras)

**Regra anterior:** ✔ / "Concluir serie" em linhas nao salvas  
**Regra nova:** `Pendente` / `Pronta` / `Salva` / `Invalida`; acao `Salvar serie` apenas quando valida e ativa

**Calculo alterado?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO

**Testes:** `node --test __tests__/workoutSetRowState.test.mjs` — 10/10 PASS  
**Gate total (9 suites):** 96/96 PASS

**Print pos-fix?** NAO — FIXED tecnico/UI por codigo + testes

**Status:** **FIXED** (codigo + testes; sem PASS visual)

---

## BUG_WORKOUT_SUBSTITUIR_NO_CONTEXT — Botão Substituir sem contexto

**Codigo:** `BUG_WORKOUT_SUBSTITUIR_NO_CONTEXT`  
**Categoria:** UX  
**Tela:** WorkoutScreen (modo avancado)  

**Descricao:**  
Chip/botao "Substituir" nao deixava claro que troca apenas o exercicio atual no treino de hoje.

**Evidencia:** treino_002  
**Fonte:** auditoria externa TREINO 2/3 + PACOTE_COMPLETO 2026-06-02  

**Causa real:** copy generica "Substituir" sem helper nem titulo de confirmacao contextual.

**Correcao (2026-06-02):**
- `src/services/workoutExerciseSwap.js` — `buildExerciseSwapActionCopy`; plan expoe copy de UI
- `src/screens/WorkoutScreen.js` — "Trocar exercicio" + helper; Alert/toast/painel via plan

**Regra anterior:** "Substituir" isolado; confirmacao com titulo "Substituir exercicio?"  
**Regra nova:** `Trocar exercicio` + `Substitui so o exercicio atual`; Alert "Trocar exercicio?" com mensagem de historico preservado

**Calculo alterado?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO · **Logs transferidos?** NAO · **Series antigas apagadas?** NAO

**Status:** **FIXED** (codigo + testes; sem PASS visual)

---

## BUG_WORKOUT_FINISH_FIELDS_RESET — Kg/Reps viram placeholder no save/finish

**Codigo:** `BUG_WORKOUT_FINISH_FIELDS_RESET`  
**Categoria:** UX  
**Tela:** WorkoutScreen (modo simples + avancado)  

**Descricao:**  
Durante salvar serie ou finalizar treino, campos Kg/Reps podiam mostrar placeholder em vez do valor digitado/salvo.

**Evidencia:** treino_012  
**Fonte:** auditoria externa TREINO 3/3 + PACOTE_COMPLETO 2026-06-02  

**Causa real:** coercao falsy (`value || placeholder`) tratava peso `0` como vazio; `clearWorkoutDraftStorage` antes de `navigate` esvaziava UI durante "Salvando treino...".

**Correcao (2026-06-02):**
- `src/services/workoutSetDisplayValue.js` — **NOVO** — `normalizeSetFieldValue`, `buildWorkoutSetInputDisplay`
- `src/components/workout/WorkoutSetField.js` — display via helper (preserva 0 e estado saving)
- `src/components/workout/SetRow.js` — idem modo simples
- `src/screens/WorkoutScreen.js` — `buildUnifiedSetRows` sem apagar 0; `SetField` com flags; `clearWorkoutDraftStorage` apos navigate

**Regra anterior:** `String(weight || '')` e placeholder quando falsy  
**Regra nova:** valor digitado/salvo visivel; placeholder so quando vazio; saving mantem ultimo valor; peso 0 mostra `0`

**Calculo alterado?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO · **Historico alterado?** NAO

**Testes:** `node --test __tests__/workoutSetDisplayValue.test.mjs` — 10/10 PASS  
**Gate total (10 suites):** 116/116 PASS

**Print pos-fix?** NAO — FIXED tecnico/UI por codigo + testes

**Status:** **FIXED** (codigo + testes; sem PASS visual)

**Validacao visual pos-fix (2026-06-02):** `screenshots/treino_postfix/` — **PASS VISUAL PARCIAL COM RESSALVAS**; 006 bloco local PASS; 004 alert PASS; ver `treino_postfix_visual_analysis.md`

**Recaptura gap 003/005 (2026-06-02):** `treino_postfix_gap_check.ps1` — 003 **PARTIAL** (modo avancado OK; Trocar ausente sem `hasHistory`); 005 **PASS** (vazio documentado; leitura em 006); gate 126/126 nao rerodado; persistencia/auditoria pesada **NAO**

---

## BUG_WORKOUT_HISTORY_CAPTURE_INCOMPLETE — Historico de series nao comprovado na UI

**Codigo:** `BUG_WORKOUT_HISTORY_CAPTURE_INCOMPLETE`  
**Categoria:** UX / Dados  
**Telas:** WorkoutScreen, HistoryScreen  

**Descricao:**  
Leitura de historico ja estava correta em `workoutHistoryFlow`, mas a UI nao mostrava lista auditavel de series nem aviso de registros ignorados na leitura.

**Evidencia:** treino_014  
**Fonte:** auditoria externa TREINO 3/3 + plano fix_history_capture_ui  

**Causa real:** gap de apresentacao — sparkline/ultimo/PR sem painel explicito; HistoryScreen sem `workoutLogs` locais; `getExerciseProgress` sem `exerciseId` em um ponto do treino.

**Correcao (2026-05-28):**
- `src/services/workoutHistoryPresentation.js` — **NOVO** — `buildWorkoutHistoryPresentation`, `buildLocalWorkoutLogsPresentation`
- `src/screens/WorkoutScreen.js` — painel "Historico do exercicio" (ultimo/melhor/volume, lista, `ignoredHint`); testIDs; fonte unificada via presentation; `exerciseId` no progress
- `src/screens/HistoryScreen.js` — bloco "Historico de series (local)" (ate 10 logs sanitizados)

**UI de historico ja existia?** SIM (parcial no treino) / complementado em Historico  
**Calculo alterado?** NAO · **Persistencia alterada?** NAO · **Dados apagados?** NAO  
**Logs invalidos exibidos?** NAO · **Logs invalidos apagados?** NAO  

**Testes:** `node --test __tests__/workoutHistoryCapture.test.mjs` — 10/10 PASS  
**Gate total (11 suites):** 126/126 PASS

**Print pos-fix?** SIM (2026-06-02) — `screenshots/treino_postfix/` 6/8; bloco local PASS (006); painel exercicio PARTIAL (005)

**Status:** **FIXED** (codigo + testes + validacao visual PARTIAL)

**Fechamento modulo Treino:** ver [`TREINO_FINAL_STATUS.md`](TREINO_FINAL_STATUS.md) — **PASS VISUAL PARCIAL COM RESSALVAS** (2026-06-02 OK Felipe). Nao reabrir sem evidencia nova.

---

## TREINO — Fechamento modulo (2026-06-02 — OK Felipe)

**Veredito:** **PASS VISUAL PARCIAL COM RESSALVAS** · gate 126/126 PASS (aceito) · persistencia **NAO** · auditoria pesada **NAO** · **PASS global app: NAO**

**Canônico:** [`TREINO_FINAL_STATUS.md`](TREINO_FINAL_STATUS.md)

| Codigo | Status fechamento | Nota visual |
|--------|-------------------|-------------|
| `BUG_STATE_P1` | FIXED | P1 + fix_p1 |
| P1 proteina/streak/XP/treino ativo | FIXED | P1_STATE_FIX_REPORT |
| `BUG_003` | FIXED | finish validate + 004 |
| `BUG_REST` | FIXED | rest validate |
| `BUG_HOME_CONCLUIDO_CONTINUAR` | FIXED | 001 |
| `BUG_WORKOUT_PARTIAL_BECOMES_CONCLUIDO` | FIXED | gate + 004 |
| `BUG_HOME_COPY_PAROU_APOS_CONCLUIDO` | FIXED | testes |
| `BUG_WORKOUT_INPUT_NO_VALIDATION` | FIXED | testes; rascunho Invalida em 005 |
| `BUG_WORKOUT_HISTORY_CONTAMINATED` | FIXED | 006 |
| `BUG_WORKOUT_FINISH_NO_CONFIRM` | FIXED | 004 |
| `BUG_WORKOUT_EXERCISE_SWAP_NO_CONTEXT` | FIXED | codigo; 003 Trocar PARTIAL visual |
| `BUG_WORKOUT_HISTORY_NOT_PROVEN` | FIXED | 006 |
| `BUG_WORKOUT_PROGRESS_DUPLICATE` | FIXED | 002/003 |
| `BUG_WORKOUT_MODE_CARD_BLOATED` | FIXED | 003 recaptura |
| `BUG_WORKOUT_SERIES_CHECKS_CONFUSING` | FIXED | 002 |
| `BUG_WORKOUT_SUBSTITUIR_NO_CONTEXT` | FIXED | Trocar condicionado hasHistory |
| `BUG_WORKOUT_FINISH_FIELDS_RESET` | FIXED | testes (008 N/C print) |
| `BUG_WORKOUT_HISTORY_CAPTURE_INCOMPLETE` | FIXED | 006 + 005 vazio documentado |

**Nao reabrir** bugs acima sem evidencia nova. **Nao** rerodar scripts postfix/gap/batch sem motivo explicito.

---

## HOME — Pendências finais (2026-06-02 — OK Felipe)

**Veredito Home:** **PASS PARCIAL** · **PASS global app: NÃO**  
**Relatório:** [`HOME_FINAL_PENDING_REPORT.md`](HOME_FINAL_PENDING_REPORT.md)

| Codigo | Status |
|--------|--------|
| `BUG_HOME_CONCLUIDO_CONTINUAR` | FIXED (revalidado treino_postfix_001) |
| `BUG_WORKOUT_PARTIAL_BECOMES_CONCLUIDO` | FIXED |
| `BUG_PROTEIN_GOAL_MISMATCH` | FIXED |
| `BUG_MEAL_NOT_UPDATING_HOME` | **FIXED** 2026-06-02 — chave de dia UTC vs local em `utils.getTodayKey` |
| `BUG_INSIGHTS_XP_STREAK_MISMATCH` | **Aberto** — mock Insights |
| Paywall / ranking / acentos | **Aberto** P2 |

**Treino:** nao reabrir — `TREINO_FINAL_STATUS.md`

---

## BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT — Home registra água sem quantidade (2026-06-04)

**Codigo:** `BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT`  
**Categoria:** UX / Funcionalidade  
**Tela:** Home — quick action `+ Beber água` (`btn_add_water`)  
**Severidade:** **P2**

**Descricao:**  
Ao tocar em registrar/beber água na Home, o app chama `addWaterIntake(300)` **sem** perguntar quantidade. Sempre soma **300 ml** fixos e mostra feedback `+300ml adicionados`.

**Evidencia (codigo):**
- `src/screens/HomeScreen.js` — `onPress` → `addWaterIntake?.(300)`
- `src/context/AppContext-v2.ts` — `addWaterIntake` → `hydration.consumedMl` + `history.waterMl`

**Comportamento esperado:**  
Modal/sheet com opções 200/300/500/510 ml + personalizado; Cancelar não altera total; Registrar atualiza Home com toast `Água registrada: N ml`.

**Impacto:** Medio — hidratacao imprecisa; usuario pode nao perceber registro errado.

**Correcao aplicada:** [`HOME_WATER_QUICK_ADD_FIX_REPORT.md`](HOME_WATER_QUICK_ADD_FIX_REPORT.md) — `waterQuickAdd.js` + Modal sheet na Home.

**Status:** **CORRIGIDO** (codigo 2026-06-04) — revalidacao visual na Home com Metro ativo (emulator-5554).

**Relacionado:** Rotinas validado emulator — ver `ROUTINE_START_FREQUENCY_FIX_REPORT.md`.

---

## RF-01 — "Criar desafio" visível para não-admin (2026-06-02)

**Codigo:** `RF-01_CHALLENGE_CREATE_VISIBLE_TO_NON_ADMIN`  
**Categoria:** Permissões / Desafios / Admin  
**Tela:** Mais → Social e Desafios (`SocialChallengesScreen`)  
**Severidade:** **P1**

**Descricao:**  
Usuário comum via card "Criar desafio" e formulário sem restrição de role; API aceitava criação com `userId` + API key.

**Correcao aplicada:** [`CHALLENGE_ADMIN_RBAC_FIX_REPORT.md`](CHALLENGE_ADMIN_RBAC_FIX_REPORT.md) — `isChallengeAdmin`, UI condicional, `admin_required` no serviço, JWT+admin no dashboard, backend social.

**Status:** **CORRIGIDO (codigo)** — QA visual emulator-5554 **pendente**; deploy Render API **pendente** para enforcement servidor em produção.

**PASS global:** NÃO

---

## RF-02 — Mídia exercício placeholder / preview quebrado (2026-06-02)

**Codigo:** `EXERCISE_MEDIA_PLACEHOLDER_BROKEN_PREVIEW`  
**Categoria:** UX / Mídia / Exercícios  
**Severidade:** **P2**

**Descricao:** Catálogo usa URLs `cdn.app.com` sem asset real; treino mostrava “Preview indisponivel” e detalhe empurrava busca YouTube genérica.

**Correcao aplicada:** [`EXERCISE_MEDIA_FALLBACK_CTA_FIX_REPORT.md`](EXERCISE_MEDIA_FALLBACK_CTA_FIX_REPORT.md) — fallback local + CTA “Ver execução”.

**Status:** **CORRIGIDO (codigo + QA visual)** — detalhe **4/4 REVALIDADO** (manual) · CTA treino **REVALIDADO** (auto `visual_qa_exercise_workout_cta_auto.ps1`, 43s, nome detalhe PARCIAL).

---

## Full Human Walkthrough — Observações Felipe (2026-06-04)

**Sessão:** [`videos/full_human_walkthrough_20260604_2215/`](videos/full_human_walkthrough_20260604_2215/)  
**Registro:** [`FELIPE_OBSERVED_BUGS.md`](videos/full_human_walkthrough_20260604_2215/FELIPE_OBSERVED_BUGS.md)  
**Lote 3:** [`LOTE_3_ANALYSIS_RESPONSE.md`](videos/full_human_walkthrough_20260604_2215/LOTE_3_ANALYSIS_RESPONSE.md)  
**Status:** 3 lotes analisados — render fix **commitado** `591db27` — **QA v4run 2026-06-05 UIAutomator BLOQUEIO** ([`P1_WORKOUT_SESSION_FIX_REPORT.md`](P1_WORKOUT_SESSION_FIX_REPORT.md))  
**PASS global:** NÃO  

### Confirmados P1 treino (corrigir)

| ID | Sev. | Status pós-QA emulator |
|----|------|------------------------|
| FW-P1-NO_BACK_BUTTON_ON_FLOW_SCREENS | P1 | **SIM (anti-gargalo)** — `extra_back_*` curtos com `back_hits=2` |
| FW-P1-ROUTINE_SERIES_INPUT_TURNS_INTO_12 | P1 | **ABERTO** — sessão legada **11/15** no smoke; V1 limpo com rotina QA **NÃO** confirmado |
| FW-P1-WORKOUT_EXCESS_DUPLICATE_SETS | P1 | **ABERTO** — V2 ainda não confirmou fluxo QA limpo |
| FW-P1-RENDER_INFINITE_UPDATE | P0 | **CORRIGIDO** — commit `591db27`; smoke Home/Hub sem RedBox |

### Suspeitos P1 — status pós-QA (2026-06-05 revalidação)

| ID | Status pós-QA |
|----|----------------|
| FW-P1-ADDED_SET_DISAPPEARS | NÃO validado (V3 sem confirmação pós-retorno) |
| FW-P1-WORKOUT_SCROLL_JUMPS | **CORRIGIDO (estado)** — V4 validado por `workoutExerciseFocusAfterSave.test.mjs` (node_state_test) |
| FW-P1-HOME_START_CONTINUE | **SIM** (v5 em 0036) |
| FW-P1-HOME_START_CONTINUE hub | **SIM** — V6 resilient pós-seed (`v6_resilient_state.json`) |
| FW-P1-FREE_WORKOUT_SET_NOT_SAVED | **CORRIGIDO (estado)** — V7 validado por `freeWorkoutSaveSet.test.mjs`; automação ADB/Detox **PENDENTE_TECNICO** |

### Confirmados fora P1 (registrar)

FW-P1-COACH_BUGGY_GENERIC_NOT_SYNCED · FW-P2-MOTOR_V4_LEGS · FW-P2-LOCAL_EXERCISE_WRONG_MUSCLE · FW-P2-INSIGHTS_NUTRITION_EMPTY · FW-P2-IA_DAY_META_INCOMPLETE · FW-P2-NUTRITION_KEYBOARD · FW-P2-EXERCISE_MEDIA_REAL_ASSETS_MISSING

### Suspeitos (pacote treino)

FW-P1-SIMPLE_MODE · FW-P1-WORKOUT_SCROLL_JUMPS · FW-P1-ADDED_SET_DISAPPEARS · FW-P1-HOME_START_CONTINUE · FW-P1-EXERCISE_SUBSTITUTION · FW-P1-FREE_WORKOUT_SET_NOT_SAVED

**Conclusão:** PACOTE **TREINO / SÉRIES / RETOMADA / NAVEGAÇÃO**

**Relacionados:** BUG_001, BUG_002, BUG_003, RF-02 (UX parcial).
