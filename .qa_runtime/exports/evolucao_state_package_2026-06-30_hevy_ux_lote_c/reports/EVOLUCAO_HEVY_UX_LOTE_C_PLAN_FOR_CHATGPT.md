# EVOLUÇÃO — Hevy UX Lote C — Plano para ChatGPT

## 1. Source of truth confirmado

- Previous: `EVOLUCAO_PAYWALL_ADDITIONAL_CLOSURE_POST_ARCHIVE_ARCHIVE_COMPLETE`
- Main: `19cc195fb49add888370174bfe7cba4e02c86010`
- PR #52: MERGED
- Archive SHA256: `0AA902AB31D9A28933C718E967A3728D5263B0AE124EDC4E2D6C2DB76A7E5735`
- WORKTREE_EXTERNAL_SWITCH_NOTE: branch local `feat/hevy-ux-lote-a-guided-logging` tinha `qa/audit-release-sync-report.json` modificado; stash reversível `lote-c-worktree-note` antes de `git switch -c feat/hevy-ux-lote-c-session-summary origin/main`

## 2. Branch proposta

`feat/hevy-ux-lote-c-session-summary` (from `origin/main`)

## 3. Ferramentas CLI disponíveis

| Tool | Version |
|------|---------|
| git | 2.51.2 |
| gh | 2.94.0 |
| node | v26.1.0 |
| npm | 11.13.0 |
| rg | 15.1.0 |
| adb | 1.0.41 |
| PowerShell | 5.1.26100.8655 |

## 4–6. Recursos Cursor / MCPs / extras

- Cursor global search, diff, terminal PowerShell, Git, GitHub CLI
- ADB via scrcpy bundle path
- Gradle build via `npm run detox:build:attached`
- Node test runner: `scripts/run-node-tests.js`
- Scripts QA: `.qa_runtime/scripts/paywall_additional_closure_*.cjs` como modelo
- Nenhuma ferramenta adicional instalada; nenhum lockfile alterado

## 7. Mapa de arquivos treino guiado

- `src/screens/WorkoutScreen.js` — treino ativo, finishWorkout
- `src/screens/WorkoutCompleteScreen.js` — resumo pós-treino
- `src/services/workoutFinishFlow.js` — gating
- `src/services/workoutSessionStatsCopy.js` — duração
- `src/services/workoutSessionSummary.js` — **novo** resumo puro
- `src/services/workoutApiService.js` — saveCompletedWorkoutToApi
- `src/navigation/RootNavigator.js` — rota WorkoutCompleteScreen

## 8. Fluxo atual

WorkoutScreen → finishWorkout → saveCompletedWorkoutToApi (1x) → navigate WorkoutCompleteScreen → Ver histórico / Voltar ao início

## 9. Riscos dados reais

- Device real: read-only; sem finish/save
- Sandbox: destrutivo permitido documentado

## 10–11. Estratégia sandbox / real

- Sandbox emulator-5554: script `hevy_ux_lote_c_sandbox.cjs`
- Real RQ8T209ZTAF: smoke read-only apenas

## 12. Design alvo

Resumo premium: duração, exercícios, séries, volume, finalizado em, lista exercícios, CTAs claros

## 13. Componentes alterados

- `workoutSessionSummary.js` (novo)
- `WorkoutCompleteScreen.js` (refino)
- `WorkoutScreen.js` (params navegação)

## 14. Testes

- `__tests__/hevyUxLoteCSessionSummary.test.mjs` (novo)
- Regressão: workoutSessionStatsCopy, workoutHistoryFlow, guidedMultiExerciseNavigation, workoutSetRowState, workoutProgressCopy

## 15. Build/QA

- `npm run detox:build:attached` em `C:\b\evo`
- Visual: `.qa_runtime/visual_audit/hevy_ux_lote_c/`

## 16–18. Critérios veredito

- PR_READY: testes + build + sandbox visual OK
- DRAFT_PR_VISUAL_PENDING: testes + build OK, emulator offline
- BLOCKED: git/tests/build failures

## 19. Próximo passo humano

Revisar PR; rodar sandbox complementar se offline; merge gate se aprovado; sem release/Play/Internal
