# EVOLUÇÃO — Hevy UX Lote C — Discovery

## 1. Tela treino ativo?

`src/screens/WorkoutScreen.js` — controla treino guiado, séries, timer, rest, finish.

## 2. WorkoutCompleteScreen existe?

Sim — registrada em `RootNavigator.js` como `WorkoutCompleteScreen`.

## 3. Tela resumo pós-treino?

Sim — `WorkoutCompleteScreen.js` (refinada no Lote C). Também existe modal inline `showWorkoutSummary` em WorkoutScreen (preservado).

## 4. Como finalizar treino?

`btn-finalizar-treino` → `finishWorkout()` quando `canFinishWorkoutNow`. Bloqueio incompleto via `confirmIncompleteWorkoutExit`.

## 5. Histórico recebe treino?

`finishWorkout` chama `saveCompletedWorkoutToApi` **uma vez** antes de navegar. Histórico lê logs/API existente.

## 6. Cálculos duração/séries/exercícios?

Em `finishWorkout`: `todaySessionLogs`, `exerciseCount`, `totalVolume`, `sessionDurationMinutes`, `computedPlannedSets`. Formatação reutiliza `workoutSessionStatsCopy.js` e novo `workoutSessionSummary.js`.

## 7. Testes fluxo treino?

`workoutFinishFlow.test.mjs`, `workoutSessionStatsCopy.test.mjs`, `workoutProgressCopy.test.mjs`, `guidedMultiExerciseNavigation.test.mjs`, `workoutSetRowState.test.mjs`, `workoutHistoryFlow.test.mjs`, novo `hevyUxLoteCSessionSummary.test.mjs`.

## 8. testIDs existentes / novos

Preservados: `btn-finalizar-treino`, conquest blocks.  
Novos Lote C: `screen-workout-complete`, `workout-summary-*`, `btn-workout-summary-history`, `btn-workout-summary-home`.  
Legados removidos da UI principal: `btn-complete-continuar-amanha`, `btn-complete-ver-evolucao` (substituídos pelos novos testIDs).

## 9. Risco duplicar histórico?

Alto se `saveCompletedWorkoutToApi` for chamado na tela de conclusão. Mitigação: save só em `finishWorkout`; CTAs da complete screen apenas navegam.

## 10. Menor patch seguro

1. `workoutSessionSummary.js` puro  
2. Refinar `WorkoutCompleteScreen` com testIDs/copy  
3. Passar params extras em `navigation.navigate`  
Sem alterar finish gating, rest, set row, save logic.

## 11. Onde está saveCompletedWorkoutToApi?

`src/services/workoutApiService.js` — chamado em `WorkoutScreen.finishWorkout` (~L2264).

## 12. Garantir que complete screen não salva?

`WorkoutCompleteScreen` não importa `workoutApiService` nem storage; apenas `navigation.navigate` nos CTAs.
