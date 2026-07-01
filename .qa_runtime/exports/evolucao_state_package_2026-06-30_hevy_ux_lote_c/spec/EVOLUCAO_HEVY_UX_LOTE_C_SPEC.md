# EVOLUÇÃO — Hevy UX Lote C — Spec

## 1. Tela/estado alvo

`WorkoutCompleteScreen` após `finishWorkout()` bem-sucedido.

## 2. Dados do resumo

| Campo | Fonte |
|-------|-------|
| Duração | `sessionDurationMinutes` |
| Exercícios | `exerciseCount` / fallback `plannedExercises` |
| Séries | `completedSets` / `plannedSets` |
| Volume | `totalVolume` |
| Finalizado em | `finishedAt` ISO |
| Lista exercícios | `exerciseNames[]` |
| Streak/XP | preservados (conquista) |

## 3. Fallbacks

- Duração: `0 min`
- Séries: `N` se plannedSets=0
- Volume: ocultar bloco se 0
- Lista: `—` se vazia
- Data: now se inválida

## 4. TestIDs

`screen-workout-complete`, `workout-summary-card`, `workout-summary-duration`, `workout-summary-exercises`, `workout-summary-sets`, `workout-summary-volume`, `workout-summary-finished-at`, `workout-summary-exercise-list`, `btn-workout-summary-history`, `btn-workout-summary-home`

## 5. Copy PT-BR

Treino concluído · Resumo do treino · Duração · Exercícios · Séries concluídas · Volume estimado · Finalizado em · Ver histórico · Voltar ao início

## 6. Ações

- Ver histórico → `Historico`
- Voltar ao início → `MainTabs { screen: 'Home' }`
- Sem "Treinar novamente" (sem padrão seguro)

## 7. Estados vazios/parciais

Volume oculto; lista `—`; séries só concluídas se sem planned

## 8. Evitar duplicar histórico

Save único em `finishWorkout`; complete screen read-only para persistência

## 9. Compatibilidade PR49–52

Sem alteração em workoutFinishFlow, rest timer, set row, progress copy, btn-finalizar-treino

## 10. Validação teste

`hevyUxLoteCSessionSummary.test.mjs` — 10 casos cobrindo summary, fallbacks, copy, testIDs, pureza
