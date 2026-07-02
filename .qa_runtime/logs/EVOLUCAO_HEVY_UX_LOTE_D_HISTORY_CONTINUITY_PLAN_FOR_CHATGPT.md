# EVOLUÇÃO — Hevy UX Lote D History Continuity Plan

## 1–4. Source of truth
- Atual: EVOLUCAO_PR53_REAL_XML_P2_STILL_LIMITED_NON_BLOCKING
- Consolidado: EVOLUCAO_PR53_MERGED_MAIN_VALIDATED_ARCHIVE_COMPLETE
- Main: d46ea45e9cdf19e4c7e2af604f0f186a67477876
- PR #53: MERGED
- P2 XML real: non-blocking

## 5. Branch
- feat/hevy-ux-lote-d-history-continuity (from origin/main)

## 6–9. Ferramentas
- git 2.51.2, gh 2.94.0, node v26.1.0, adb 1.0.41, PowerShell 5.1
- Cursor: search, diff, preview, terminal, GitHub CLI
- Sem instalações novas

## 10. Escopo Felipe = Opção A
- Bloco treinos salvos/backend + detalhe inline
- Micro-polish copy/testIDs/empty states
- Não premiumizar tela inteira

## 11–12. Descoberta / Navegação PR53
- WorkoutComplete → navigate('Historico')
- WorkoutsHub → btn_open_history → Historico (sandbox QA)
- HistoryScreen backend via listUserWorkoutsFromApi

## 13–14. Escopo produto / testes
- HistoryScreen backend block, workoutHistoryPresentation helpers
- hevyUxLoteDHistoryContinuity.test.mjs

## 15–19. Estratégias
- Audit: npm run audit:release:check, mirror pontual se drift
- Build: C:\b\evo detox:build:attached
- Visual sandbox: emulator-5554, treino hub → btn_open_history
- Real device: PNG-only read-only, PIN mascarado se necessário
- PASS: tests + audit + build + sandbox screen-history

## 20–24. Critérios / próximo passo
- DRAFT_PR_READY se gates OK
- DRAFT_PR_VISUAL_PENDING se sandbox auth/dados limitados
- Próximo: revisar PR, sem merge/release
