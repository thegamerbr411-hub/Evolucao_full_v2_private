# EVOLUÇÃO — Hevy UX Lote D History Scope Lock

## Permitido
- `src/screens/HistoryScreen.js` — bloco backend + detalhe inline
- `src/services/workoutHistoryPresentation.js` — helpers puros + testIDs
- `__tests__/hevyUxLoteDHistoryContinuity.test.mjs`
- `_audit_release/**` se audit drift
- `.qa_runtime/**`

## Proibido
- WorkoutCompleteScreen (navegação OK)
- Auth/Firebase/Sync, Paywall, AppId, lockfiles
- Blocos semanal/local (exceto micro-copy se colidir)
- Nova API/persistência

## TestIDs obrigatórios
- history-empty-state, history-session-card, history-session-title, history-session-date
- history-session-duration, history-session-exercises, history-session-sets
- history-session-detail, history-session-detail-card, history-session-detail-exercise-list
- btn-history-session-open-detail (accessibilityLabel), btn-history-session-back

## Copy
- Duração, Exercícios, Séries, Finalizado em, Treinos salvos, Resumo do treino

## Critérios visuais
- Cards premium alinhados a workoutSessionSummary
- Empty state claro
- Detalhe inline read-only

## Rollback
- Reverter HistoryScreen backend block + workoutHistoryPresentation additions

## Não expansão
- Se precisar tela inteira → DEVER DE CASA, lote futuro
