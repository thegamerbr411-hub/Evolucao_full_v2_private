# Rotinas — Fix Iniciar + frequência semanal

**Data:** 2026-06-04  
**Device QA (canônico):** emulator-5554 · RQ8T209ZTAF = device errado (Nexa) — não conclusivo  
**Sessão:** `videos/first_install_tabs_20260603_1346/`  
**Origem:** ChatGPT pacote manual 11–13 — próxima correção única

---

## CHECKPOINT — ROTINAS ANALISADAS / FIX APLICADO

| Item | Valor |
|------|--------|
| Bug “Iniciar” desabilitado confirmado? | **SIM** (botão clicável mas navegação morta) |
| Causa raiz Iniciar | `navigation.navigate('Workout', …)` — rota **inexistente**; stack usa `TreinoHoje` |
| Bug “x por semana” confirmado? | **SIM** |
| Causa raiz frequência | `frequency` passada na UI mas **não persistida** em `createUserRoutine` / `updateUserRoutine` |
| Arquivos analisados | `RoutinesScreen.js`, `AppContext-v2.ts`, `RootNavigator.js`, `WorkoutScreen.js` |
| Arquivos alterados | `src/services/routineDisplay.js` (novo), `AppContext-v2.ts`, `RoutinesScreen.js`, `__tests__/routineDisplay.test.mjs`, `__tests__/routineSelectionFlow.integrity.test.mjs` |
| Testes criados/rodados | `node --test` routineDisplay + routineSelectionFlow — **11/11 PASS** |
| Evidência visual criada | `12_fix_rotina_iniciar_frequencia.png` (screencap device; validar tela Rotinas pós-reload Metro) |
| Rotina pode iniciar agora? | **SIM** (código) — requer reload app + rotina com ≥1 exercício |
| Texto “x por semana” corrigido? | **SIM** (helper + persistência) |
| Código alterado? | **SIM** |
| Commit/push feito? | **NÃO** |
| PASS global do app? | **NÃO** |

---

## Correções aplicadas

### 1. Iniciar → `TreinoHoje`

- `startRoutine` navega para `TreinoHoje` com `{ workoutId: routine.id }`.
- Se sem exercícios: toast + botão `disabled` + hint “Adicione exercicios para iniciar”.

### 2. Frequência semanal

- `createUserRoutine`, `updateUserRoutine`, `createRoutineFromTemplate`, `saveTodayWorkoutAsRoutine` persistem `frequency` (clamp 1–7).
- UI usa `formatRoutineWeeklyFrequency(routine.frequency, profile.trainingDaysPerWeek)` — nunca renderiza `x por semana` cru.

### 3. Extra (mínimo)

- `reorderUserRoutineExercises`: UI passa `from`/`to` (antes `fromIndex`/`toIndex` ignorados pelo context).

---

## CHECKPOINT — RQ8T209ZTAF (2026-06-04) — DEVICE ERRADO / NÃO CONCLUSIVO

```text
Device: RQ8T209ZTAF (celular físico — uso Nexa/outros testes)
Veredito: NÃO CONCLUSIVO para Evolução — login Samsung/Nexa, não sessão Evolução no emulador
Uso como bloqueio final do fix? NÃO
Evidência histórica: 12_fix_rotina_iniciar_frequencia_PENDENTE_LOGIN_DEVICE.png
```

---

## CHECKPOINT — ROTINAS VALIDADAS NO EMULADOR CORRETO (2026-06-04)

```text
CHECKPOINT — ROTINAS VALIDADAS NO EMULADOR CORRETO
Status: VALIDADO
Device usado: emulator-5554
RQ8T209ZTAF usado? NÃO
emulator-5554 disponível? SIM
Reload Metro feito? NÃO (8081 indisponível; app abriu com bundle instalado)
App Evolução aberto no emulador? SIM
Tela Rotinas aberta? SIM (screen-routines)
Rotina validada: Peito Segundou
Frequência legível? SIM — texto UI: "Frequencia nao definida" (fallback profile; não "x por semana" cru)
Texto “x por semana” sumiu? SIM (ausente no dump)
Botão Iniciar habilitado? SIM (6 exercícios listados)
Se desabilitado, motivo aparece? N/A
Iniciar abriu TreinoHoje? SIM — "Treino de hoje", "Exercicio 1 de 6", exercícios da rotina (ex. Supino Inclinado Halter)
Evidência: 12_fix_rotina_iniciar_frequencia_VALIDADO_emulator_01_rotinas.png, _02_treino_hoje.png
Testes unitários | 11/11 PASS
Código alterado nesta rodada? NÃO
Commit/push? NÃO
PASS global? NÃO
```

---

## Próxima ação única

1. Pedir **OK Felipe** para implementar `BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT` (sheet 200/300/500/510 + personalizado) — **sem** alterar código até OK.
2. Opcional depois: regravação **focada** do vídeo 12 no emulator.
3. **Não** usar RQ8T209ZTAF para QA Evolução · **Não** reabrir 05B · **Não** PASS global · **Não** commit.

---

## Evidência

- PNG Rotinas: [`videos/first_install_tabs_20260603_1346/12_fix_rotina_iniciar_frequencia_VALIDADO_emulator_01_rotinas.png`](videos/first_install_tabs_20260603_1346/12_fix_rotina_iniciar_frequencia_VALIDADO_emulator_01_rotinas.png)
- PNG TreinoHoje: [`videos/first_install_tabs_20260603_1346/12_fix_rotina_iniciar_frequencia_VALIDADO_emulator_02_treino_hoje.png`](videos/first_install_tabs_20260603_1346/12_fix_rotina_iniciar_frequencia_VALIDADO_emulator_02_treino_hoje.png)
- PNG device errado (histórico): `12_fix_rotina_iniciar_frequencia_PENDENTE_LOGIN_DEVICE.png` (RQ8T209ZTAF — não usar)
