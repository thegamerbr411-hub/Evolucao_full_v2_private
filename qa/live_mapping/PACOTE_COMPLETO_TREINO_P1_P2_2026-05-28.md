# PACOTE COMPLETO — ChatGPT / Cursor — Projeto Evolução (Treino P1/P2)

**Data do pacote:** 2026-05-28  
**Workspace:** `F:\projetos\evolucao app`  
**Objetivo:** Análise de correções recentes, regressão, cobertura de testes e próximo bug único.

---

## 1. Estado atual real do projeto

| Item | Valor |
|------|--------|
| **Branch atual** | `hotfix/p0-auth-persistence-reopen-20260511` (tracking `origin/hotfix/p0-auth-persistence-reopen-20260511`) |
| **Último commit (HEAD)** | `7c28fa9` — `fix(auth): use ASCII-safe verification email template` |
| **Working tree** | Muitas alterações locais **não commitadas**; fixes de treino em arquivos modificados/`??` |
| **PASS global QA live** | **NÃO** (`LIVE_TEST_STATUS.md`) |
| **Gate técnico treino (7 suites)** | **76/76 PASS** |

### Último checkpoint (treino)

```
CHECKPOINT — PROGRESSO DUPLICADO CORRIGIDO (2026-05-31)
Cálculo alterado? NÃO
Persistência alterada? NÃO
Dados apagados? NÃO
workoutProgressCopy.test.mjs → 10/10 PASS
Gate 7 suites → 76/76 PASS
```

### Último bug corrigido

**`BUG_WORKOUT_PROGRESS_DUPLICATE`** — `workoutProgressCopy.js` + UI `WorkoutScreen.js`

### Bugs treino FIXED (código/testes)

| Bug | Data | Gate |
|-----|------|------|
| `BUG_WORKOUT_FINISH_NO_CONFIRM` | 2026-05-31 | 41/41 |
| `BUG_WORKOUT_EXERCISE_SWAP_NO_CONTEXT` | 2026-05-31 | 54/54 |
| `BUG_WORKOUT_HISTORY_NOT_PROVEN` | 2026-05-31 | 66/66 |
| `BUG_WORKOUT_PROGRESS_DUPLICATE` | 2026-05-31 | 76/76 |
| P1 estado / finish / rest / validação / parcial→concluído | 2026-05-28–30 | docs P1 |

### Bugs abertos (treino)

| Bug | Sev. |
|-----|------|
| **`BUG_WORKOUT_MODE_CARD_BLOATED`** | P2 — **próximo recomendado** |
| **`BUG_WORKOUT_SERIES_CHECKS_CONFUSING`** | P2 |
| `BUG_WORKOUT_HISTORY_CAPTURE_INCOMPLETE` | P2 |
| `BUG_WORKOUT_SUBSTITUIR_NO_CONTEXT` | P2 |
| `BUG_WORKOUT_FINISH_FIELDS_RESET` | P2 |
| `BUG_WORKOUT_HISTORY_PERMANENT_DELETE` | opcional — **NÃO autorizado** |

### Próximo bug recomendado

**`BUG_WORKOUT_MODE_CARD_BLOATED`** — aguarda OK Felipe.

---

## 2. Arquivos alterados recentemente

| Arquivo | O que mudou | Por quê | Risco |
|---------|-------------|---------|-------|
| `src/services/workoutProgressCopy.js` | NOVO | Duplicação UI progresso | Baixo |
| `src/screens/WorkoutScreen.js` | progressCopy, header/footer | BUG_WORKOUT_PROGRESS_DUPLICATE | Baixo UI |
| `src/services/workoutFinishFlow.js` | NOVO Alert saída parcial | BUG_WORKOUT_FINISH_NO_CONFIRM | Baixo |
| `src/services/workoutExerciseSwap.js` | NOVO swap contextual | BUG_WORKOUT_EXERCISE_SWAP_NO_CONTEXT | Médio |
| `src/services/workoutHistoryFlow.js` | NOVO summary strict | BUG_WORKOUT_HISTORY_NOT_PROVEN | Médio leitura |
| `src/services/workoutExerciseIdentity.js` | NOVO exerciseId | Testável sem MMKV | Baixo |
| `src/services/workoutInputValidation.js` | NOVO limites | Validação persist | Baixo |
| `src/services/dailyState.js` | canFinishWorkout, status | P1 estado global | Médio |
| `src/context/AppContext-v2.ts` | gates save/history | Fonte única | Médio |

---

## 3. Trechos de código (prova das correções)

### Cálculo inalterado (WorkoutScreen.js)

```javascript
const computedPlannedSets = useMemo(() => (
  allExercises.reduce((acc, exercise) => (
    acc + Math.max(1, Number(setCountByExercise?.[exercise?.name] || exercise?.sets || 1))
  ), 0)
), [allExercises, setCountByExercise]);
const computedGuidedSets = useMemo(() => {
  const todayLogs = workoutLogs.filter((item) => item.date === todayKey);
  const effectiveLogs = resolveEffectiveWorkoutLogs(todayLogs, workoutSessionId);
  return effectiveLogs.length;
}, [workoutLogs, todayKey, workoutSessionId]);
const canFinishWorkoutNow = useMemo(
  () => canFinishWorkout({ plannedSets: computedPlannedSets, completedSets: computedGuidedSets }),
  [computedPlannedSets, computedGuidedSets]
);
```

### progressCopy + UI unificada

```javascript
const progressCopy = useMemo(
  () => buildWorkoutProgressCopy({
    completedSets: computedGuidedSets,
    plannedSets: computedPlannedSets,
    currentExerciseIndex: activeExerciseIndex,
    totalExercises: allExercises.length,
    canFinish: canFinishWorkoutNow,
  }),
  [...]
);
// header: progressCopy.headerLabel
// label: progressCopy.workoutProgressLabel (testID workout-progress-label)
// footer: progressCopy.footerHint (sem N/M)
// topRow: só Nivel/XP — sem contador series
// badge 1/5 no card: só !simpleMode
```

### workoutProgressCopy.js (completo)

- `normalizeProgressCounts` — cap completed <= planned
- `computeWorkoutCompletionPercent` — planned=0 → 0% (não 100% fake)
- `buildWorkoutProgressCopy` — `Treino: N/M series concluidas · P%`; footer ação

### dailyState.js — canFinishWorkout

```javascript
export function canFinishWorkout({ plannedSets = 0, completedSets = 0 } = {}) {
  const planned = Math.max(0, Number(plannedSets) || 0);
  const completed = Math.max(0, Number(completedSets) || 0);
  return planned > 0 && completed >= planned;
}
```

### Validação + saveWorkoutSet (AppContext-v2.ts)

- `validateWorkoutSetInput` antes de `workoutStore.addWorkoutLog`
- limites: 0–300kg, 1–100 reps, RPE 1–10

### finishWorkout + confirmIncompleteWorkoutExit

- `INCOMPLETE_EXIT_CONFIRMATION` em workoutFinishFlow.js
- Alert se `!canFinishWorkoutNow` ao finalizar/sair

### swap — buildExerciseSwapPlan

- `transferLogsToNewExercise: false`
- Alert contextual se hasCompletedSets || hasDraftSets

### histórico — buildWorkoutHistorySummary

- `getSafeExerciseHistory` → sanitize → lastSet, bestWeight, volume
- `exerciseId` strict via workoutExerciseIdentity.js

---

## 4. Testes

| Comando | Resultado |
|---------|-----------|
| `node --test __tests__/dailyState.test.mjs` | 12/12 PASS |
| `node --test __tests__/workoutInputValidation.test.mjs` | 10/10 PASS |
| `node --test __tests__/workoutHistoryCleanup.test.mjs` | 8/8 PASS |
| `node --test __tests__/workoutFinishFlow.test.mjs` | 11/11 PASS |
| `node --test __tests__/workoutExerciseSwap.test.mjs` | 13/13 PASS |
| `node --test __tests__/workoutHistoryFlow.test.mjs` | 12/12 PASS |
| `node --test __tests__/workoutProgressCopy.test.mjs` | 10/10 PASS |

**Total:** 76/76 PASS · 0 falhas

---

## 5. Prints / evidências

**PENDÊNCIA:** PNGs `qa/live_mapping/screenshots/treino/*.png` e `fix_p1/fix_00X.png` **ausentes no disco** (só `.analysis.md`, XML, JSON). Prints TREINO são **pre-fix** (2026-05-30). **Sem print pós-fix** progresso duplicado / finish confirm / swap / histórico UI.

---

## 6. Docs QA (resumo)

- `LIVE_TEST_STATUS.md`: PASS global NÃO; gate 76/76; próximo MODE_CARD_BLOATED
- `LIVE_BUGS_FOUND.md`: FIXED finish, swap, history, progress duplicate
- `TREINO_CHATGPT_ANALYSIS_SUMMARY.md`: 2 bugs P2 abertos
- `ANTI_HANG_RULES.md`: watcher PAUSADO; MaxScriptSec obrigatório

---

## 7. O que NÃO foi validado

- UI progresso unificado pós-fix (só código + testes)
- Alert saída parcial (sem print)
- Histórico real na tela (UI não comprovada)
- Commits dedicados treino vs HEAD auth hotfix

**Não declarar PASS visual** para progresso duplicado, finish confirm, histórico UI, card modo, checks.

---

## 8. Pedido de análise

1. Correções fazem sentido?
2. Risco de regressão?
3. Bug mal fechado (FIXED sem evidência)?
4. Testes cobrem bem? O que falta?
5. Próxima correção única?
6. Print novo necessário?
7. Pode avançar?

---

## 9. Resposta esperada (formato obrigatório)

```
DIAGNÓSTICO GERAL:
BUGS REALMENTE FIXED:
BUGS AINDA ABERTOS:
RISCO DE REGRESSÃO:
ARQUIVOS QUE PRECISAM SER REVISADOS:
TESTES QUE FALTAM:
PRÓXIMA CORREÇÃO ÚNICA:
PODE AVANÇAR? SIM/NÃO:
```
