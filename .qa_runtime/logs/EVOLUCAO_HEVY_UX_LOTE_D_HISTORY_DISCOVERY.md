# EVOLUÇÃO — Hevy UX Lote D History Discovery

## Escopo confirmado: Opção A (backend + detalhe inline)

## 1. Telas
- `src/screens/HistoryScreen.js` — tela principal
- `WorkoutHistoryScreen.js` — não existe

## 2. Navegação
- `WorkoutCompleteScreen.js` → `navigation.navigate('Historico')`
- `WorkoutsHubScreen.js` → `btn_open_history` → Historico
- `RootNavigator.js` — Stack.Screen Historico

## 3. PR #53 → Histórico
- CTA `btn-workout-summary-history` navega para Historico (read-only)

## 4. Dados no Histórico backend
- `listUserWorkoutsFromApi({ userId, limit })` — read-only GET
- Campos: id, name, dateKey, createdAt, durationMinutes, totalSets, totalVolume, exercises[]

## 5. Storage
- Sem nova persistência; API existente somente leitura

## 6. Empty states
- Backend sem treinos → history-empty-state

## 7. Cards atuais (antes do patch)
- remoteRow básico sem testIDs premium

## 8. TestIDs existentes
- screen-history, history-local-logs-panel

## 9. TestIDs faltantes (Lote D)
- history-empty-state, history-session-*, history-session-detail-*, btn-history-session-*

## 10–12. Riscos
- Save duplicado: baixo (somente presentation)
- Auth/Sync: não tocado
- Navegação PR53: preservada

## 13. Fora de escopo (lote futuro)
- Resumo semanal 7 dias redesign
- Logs locais redesign
- Tela inteira premium
