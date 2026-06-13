# P1 Functional Blockers Before Visual Bloco 3

**Branch:** `fix/p1-functional-blockers-before-visual-b3`  
**Base:** `origin/main` @ `12a24c5` (PR #26 mergeado, inclui PR #25)  
**Device:** `RQ8T209ZTAF`  
**Data:** 2026-06-13  
**Contexto ChatGPT Bloco 2:** `.qa_runtime/chatgpt_bridge/evolucao_visual_review_bloco2_16_25_response.txt` — NO-GO Bloco 3 / NO-GO Release Readiness por P1 funcionais e automação ADB.

---

## Resumo executivo

Correção **confirmada** do P1 crítico **RedBox PanGestureHandler** no modo avançado (Visão completa). Tabs **Nutrição** e **Coach** navegam corretamente via ADB após fix + Metro reload. Demais fluxos (detalhe exercício catálogo, keypad reps em sequência longa) permanecem **parcialmente cobertos por ADB** — não bug de produto comprovado nos tabs; retest manual/Detox recomendado antes de Bloco 3 visual.

**Veredito:** GO controlado para **retomar auditoria visual Bloco 3** após merge deste hotfix. **Release Readiness continua NO-GO** (histórico vazio, cobertura visual incompleta, Detox smoke infra fail).

---

## P1 #1 — RedBox PanGestureHandler (modo avançado)

| Campo | Detalhe |
|-------|---------|
| Reprodução | Treino → Continuar → Trocar (`btn-toggle-workout-mode`) |
| Evidência antes | `TELA_17_STUCK.xml` — Render Error PanGestureHandler |
| Causa raiz | `Swipeable` (RNGH) em `WorkoutScreen.js` L3154 sem `GestureHandlerRootView` no app |
| Correção | `index.js`: import side-effect RNGH; `App.js`: `GestureHandlerRootView` outermost; `WorkoutScreen.js`: wrapper local |
| Evidência depois | `redbox_retest.cjs` → **PASS advanced mode OK** (sem RedBox, `Visao completa` / advanced list) |
| Testes | Unitários workout mode PASS; retest device PASS |

---

## P1 #2 — Tabs Nutrição / Coach

| Campo | Detalhe |
|-------|---------|
| Reprodução Bloco 2 | TELA_24 ficou na Home (treino ativo + app_runtime_busy) |
| Diagnóstico pós-fix | `p1_diagnosis_run.cjs`: **PASS** tab-nutricao (`screen-nutricao`); **PASS** tab-coach (`screen-coach`, `chat-input`) |
| Conclusão | **Bug real não reproduzido** após fix RedBox + coldStart; falha Bloco 2 = cascata RedBox + ADB |
| Correção código | Nenhuma em MainTabs |

---

## P1 #3 — Detalhes de exercício (5)

| Campo | Detalhe |
|-------|---------|
| Rota | `RoutinesScreen` → catálogo → `navigation.navigate('ExerciseDetail')` |
| ADB run | **FAIL** — botão Detalhes não encontrado (modal/step ADB impreciso) |
| Conclusão | Pendente recaptura manual/Detox; rota registrada no stack |
| Correção código | Nenhuma neste PR |

---

## P1 #4 — Keypad reps

| Campo | Detalhe |
|-------|---------|
| ADB run | **FAIL** — WorkoutScreen não abriu na sequência (após rotinas) |
| Retest isolado | Não executado neste ciclo (prioridade RedBox) |
| Unitários | `workoutHistorySetValues.test.mjs` PASS (lógica save/reps) |
| Correção código | Nenhuma |

---

## P1 #5 — Treino Livre add exercise

| Campo | Detalhe |
|-------|---------|
| ADB run | **PARTIAL** — tap add ok, seleção não confirmada no XML |
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
| **P1 funcional crítico restante?** | RedBox **resolvido**; tabs **OK**; demais = automação/recaptura, não blocker de merge |

---

## Evidências locais (não commitadas)

- `.qa_runtime/p1_functional_blockers/p1_diagnosis_results.json`
- `.qa_runtime/p1_functional_blockers/screens/`
- `.qa_runtime/p1_functional_blockers/dumps/advanced_retest.xml`
- `.qa_runtime/p1_functional_blockers/PLANO_DIAGNOSTICO_P1.md`
