# P1 Functional Blockers Before Visual Bloco 3

**Branch:** `fix/p1-functional-blockers-before-visual-b3`  
**Base:** `origin/main` @ `12a24c5` (PR #26 mergeado, inclui PR #25)  
**Device:** `RQ8T209ZTAF`  
**Data:** 2026-06-13 (v2 retest pós-reload, Metro 8081 sem restart)  
**Contexto ChatGPT Bloco 2:** `.qa_runtime/chatgpt_bridge/evolucao_visual_review_bloco2_16_25_response.txt` — NO-GO Bloco 3 / NO-GO Release Readiness por P1 funcionais e automação ADB.

---

## Resumo executivo

Correção **confirmada** do P1 crítico **RedBox PanGestureHandler** no modo avançado (Visão completa) — retest **A** pós-reload **PASS** sem reiniciar Metro. Tabs **Coach** OK; **Nutrição** bloqueada por dialog *Feedback rápido* no script v2 (v1 PASS — automação). **Treino Livre add** **PASS** v2. **Keypad reps** **PASS** em retest isolado (toggle modo guiado + scroll). **Detalhes exercício (5)** ainda **não cobertos** — fluxo Rotinas→builder step 2→catálogo falhou no ADB (automacao).

**Veredito:** GO controlado para **retomar auditoria visual Bloco 3** após merge deste hotfix. **Release Readiness continua NO-GO** (histórico vazio, cobertura visual incompleta, Detox smoke infra fail).

---

## Diagnóstico v2 (2026-06-13, Metro PID ativo, sem `--clear`)

| Teste | Script | Resultado | Notas |
|-------|--------|-----------|-------|
| **A** RedBox / modo avançado | `redbox_retest.cjs` | **PASS** | Sem RedBox; `Visao completa` / `workout-exercise-list-advanced` |
| **B** Tab Nutrição | `p1_diagnosis_continue.cjs` | **FAIL automação** | Dialog *Feedback rápido* cobriu tela (`v2_tab_nutricao.xml`); v1 = PASS |
| **B** Tab Coach | `p1_diagnosis_continue.cjs` | **PASS** | `screen-coach`, `chat-input` |
| **C** Detalhes ×5 | `p1_diagnosis_continue.cjs` | **FAIL automação** | Catálogo rotinas não abriu (scroll/hub Treino→Rotinas) |
| **D** Keypad reps | `p1_diagnosis_continue.cjs` | **FAIL automação** | Workout abriu em modo avançado; `input-reps` fora do viewport |
| **D** Keypad reps (retest) | `keypad_retest_quick.cjs` | **PASS** | Toggle modo guiado + scroll → keypad (`Limpar`/`OK`) |
| **E** Treino Livre add | `p1_diagnosis_continue.cjs` | **PASS** | `Supino Reto` confirmado no XML pós `btn-free-add-exercise` |

Artefatos: `.qa_runtime/p1_functional_blockers/p1_diagnosis_results_v2.json`, `screens/v2_*`, `dumps/v2_keypad_retest.xml`

---

## P1 #1 — RedBox PanGestureHandler (modo avançado)

| Campo | Detalhe |
|-------|---------|
| Reprodução | Treino → Continuar → Trocar (`btn-toggle-workout-mode`) |
| Evidência antes | `TELA_17_STUCK.xml` — Render Error PanGestureHandler |
| Causa raiz | `Swipeable` (RNGH) em `WorkoutScreen.js` L3154 sem `GestureHandlerRootView` no app |
| Correção | `index.js`: import side-effect RNGH; `App.js`: `GestureHandlerRootView` outermost; `WorkoutScreen.js`: wrapper local |
| Evidência depois | `redbox_retest.cjs` v1 + **v2 pós-reload** → **PASS advanced mode OK** (Metro 8081 não reiniciado) |
| Testes | Unitários workout mode PASS; retest device PASS (v1 e v2) |

---

## P1 #2 — Tabs Nutrição / Coach

| Campo | Detalhe |
|-------|---------|
| Reprodução Bloco 2 | TELA_24 ficou na Home (treino ativo + app_runtime_busy) |
| Diagnóstico pós-fix | v1 `p1_diagnosis_run.cjs`: **PASS** ambos; v2 `p1_diagnosis_continue.cjs`: Coach **PASS**, Nutrição **FAIL automação** (dialog feedback) |
| Conclusão | **Bug real não reproduzido**; falhas = cascata RedBox (Bloco 2) ou dialog feedback / timing ADB (v2 Nutrição) |
| Correção código | Nenhuma em MainTabs |

---

## P1 #3 — Detalhes de exercício (5)

| Campo | Detalhe |
|-------|---------|
| Rota | `RoutinesScreen` → catálogo → `navigation.navigate('ExerciseDetail')` |
| ADB v1 | **FAIL** — botão Detalhes não encontrado (step builder não alcançado) |
| ADB v2 | **FAIL automação** — `openRoutineCatalogModal` não abriu (5 exercícios não testados) |
| Conclusão | Pendente recaptura manual/Detox; rota `ExerciseDetail` registrada no stack — **sem bug de produto comprovado** |
| Correção código | Nenhuma neste PR |

---

## P1 #4 — Keypad reps

| Campo | Detalhe |
|-------|---------|
| ADB v2 (sequência longa) | **FAIL automação** — `screen-workout` OK em modo avançado; `input-reps` abaixo do fold |
| Retest isolado | `keypad_retest_quick.cjs` → **PASS** (toggle modo guiado + scroll + tap `input-reps`) |
| Unitários | `workoutHistorySetValues.test.mjs` PASS (lógica save/reps) |
| Correção código | Nenhuma |

---

## P1 #5 — Treino Livre add exercise

| Campo | Detalhe |
|-------|---------|
| ADB v1 | **PARTIAL** — tap add ok, seleção não confirmada no XML |
| ADB v2 | **PASS** — `Supino Reto` + card confirmados após `input-free-exercise-name` + add |
| Bloco 2 | Tela 18 OK pos-polish |
| Unitários | `freeWorkoutSaveSet.test.mjs` PASS |
| Correção código | Nenhuma |

---

## P1 #6 — Histórico vazio

| Campo | Detalhe |
|-------|---------|
| Limitação | `EXPO_PUBLIC_QA_WORKOUT_FIXTURE=1` seeda dados — empty state indisponível |
| Ação | Documentado; captura empty state exige sessão sem fixture (pré-release público) |
| Correção código | Nenhuma (não apagar dados reais) |

---

## P1 #7 — Botão Salvar cortado (visual mínimo)

| Campo | Detalhe |
|-------|---------|
| Correção | `SetRow.js`: `flexWrap`, `flexShrink` status badge, `minWidth`/`maxWidth` botão Salvar |
| Escopo | Apenas estilos; sem alterar saveSet/activeExerciseIndex |
| Validação device | Pendente screenshot pós-fix |

---

## Arquivos alterados

- `index.js` — import `react-native-gesture-handler`
- `App.js` — `GestureHandlerRootView` outermost
- `src/screens/WorkoutScreen.js` — `GestureHandlerRootView` local
- `src/components/workout/SetRow.js` — layout row Salvar
- `qa/visual/P1_FUNCTIONAL_BLOCKERS_BEFORE_VISUAL_B3_REPORT.md` — este relatório

---

## Gates

| Gate | Resultado |
|------|-----------|
| `npm run audit:release:check` | **DRIFT 4** (esperado: `_audit_release` não sincronizado; fora do escopo hotfix) |
| Unitários (5 suites) | **PASS** (33 tests) |
| Detox `10-smoke-minimo` | **FAIL infra** — `onboarding_blocked: main_tabs_not_visible` / Detox não conectou ao app de teste (dev client ativo) |

---

## Pendências antes Release Readiness

1. Recaptura visual Bloco 1 gaps (detalhes 12a–d, keypad 14b, pós-save 15)
2. Recaptura Bloco 2 pós-fix (17 avançado, 19–25)
3. Histórico vazio sem fixture
4. Detox smoke com build detox (não dev client concorrente)
5. `audit:release:sync` quando fechar release (não neste hotfix)

---

## Vereditos

| Pergunta | Resposta |
|----------|----------|
| **Bloco 3 liberado?** | **GO controlado** após merge — retomar captura visual 26–34 com Metro reload obrigatório após hotfix |
| **Release Readiness liberado?** | **NO-GO** — cobertura visual e smoke formal incompletos |
| **P1 funcional crítico restante?** | RedBox **resolvido**; tabs **OK** (v1 + Coach v2); Treino Livre add **OK** v2; keypad **OK** retest isolado; detalhes ×5 = automação/recaptura |

---

## Evidências locais (não commitadas)

- `.qa_runtime/p1_functional_blockers/p1_diagnosis_results.json` (v1)
- `.qa_runtime/p1_functional_blockers/p1_diagnosis_results_v2.json` (v2)
- `.qa_runtime/p1_functional_blockers/p1_diagnosis_continue.cjs`
- `.qa_runtime/p1_functional_blockers/keypad_retest_quick.cjs`
- `.qa_runtime/p1_functional_blockers/screens/` (`v2_*`, `advanced_*`)
- `.qa_runtime/p1_functional_blockers/dumps/` (`advanced_retest.xml`, `v2_keypad_retest.xml`)
- `.qa_runtime/p1_functional_blockers/PLANO_DIAGNOSTICO_P1.md`
