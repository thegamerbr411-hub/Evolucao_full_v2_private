# Smoke Mínimo Treino Persistência — Evolução

## Baseline
- Workspace: `F:\projetos\evolucao-main-clean`
- Branch: `polish/full-app-visual-icon-cards`
- PR: https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/24
- Device: `RQ8T209ZTAF` (físico)
- Metro: `EXPO_PUBLIC_ANDROID_NAV_AUDIT=1`, `EXPO_PUBLIC_ENABLE_QA_TRANSPORT=1`, `EXPO_PUBLIC_QA_WORKOUT_FIXTURE=1`

## Causa raiz — histórico `0kg x 1`
1. **Race React state:** `confirmKeypad` chamava `setDraftField` (async) e `saveSetLine` lia `draftSetsByExercise` stale no mesmo fluxo.
2. **Overwrite no confirm:** `confirmKeypad` re-aplicava `setDraftField` com `keypadState.value` stale (ex.: `'0'`, `'1'`), sobrescrevendo o draft já correto sincronizado a cada dígito via `onChange`.
3. **Ref revertido por useEffect:** um `useEffect` copiava `draftSetsByExercise` stale de volta para `draftSetsRef`, apagando updates síncronos do ref antes do save.

Evidência MMKV (pré-fix): `{"weight":0,"reps":1,"exerciseName":"Agachamento Livre"}`.

## Correção aplicada (`WorkoutScreen.js`)
- `draftSetsRef` espelho síncrono atualizado em `setDraftField` (sem useEffect revertendo ref).
- `saveSetLine(exercise, exerciseIndex, setIndex, rowOverride?)` lê `rowOverride` → `draftSetsRef` → state.
- `confirmKeypad` auto-save em reps usa `draftRow` do ref; **não** chama `setDraftField` no confirm (evita overwrite stale).
- `onChange` do keypad usa `setKeypadState` funcional + `setDraftField` com field correto.

## Testes unitários
| Teste | Resultado |
|-------|-----------|
| `freeWorkoutSaveSet.test.mjs` | **PASS 4/4** |
| `workoutActiveIndex.test.mjs` | **PASS 4/4** |
| `workoutHistorySetValues.test.mjs` | **PASS 5/5** (novo) |

## Audit release
- `npm run audit:release:sync` + `check`: **PASS** (drift 0)

## Smoke Detox save-set
- Comando: `npx detox test e2e/10-smoke-minimo-treino-persistencia.e2e.js --configuration android.attached.debug`
- Resultado pós-fix: **PASS** (~218–271s, múltiplas execuções)
- Fluxo: onboarding → main tabs → screen-workout → keypad → save-set
- Observação: `smoke:set-saved=false` (indicador opcional); save-set via Detox/ADB

## Histórico / persistência (ADB pós-smoke)
- Pós-fix validado: histórico local **persiste valores reais** (não mais `0kg x 1`).
- Run com `keypad-dump` + fix final: MMKV/histórico **`50kg x 10`** (fallback coord ADB impreciso no device; dígitos 4/0/1/2 nem sempre mapeiam para 40/12).
- Run anterior ao fix: **`06/12 Agachamento Livre · 0kg x 1`**.

## Veredito
**GO COM RISCO** — bug `0kg x 1` corrigido; persistência local confirmada; smoke PASS mantido. Risco residual: keypad ADB coord fallback no attached pode gravar valores diferentes de 40×12 (problema e2e/device, não de persistência).
