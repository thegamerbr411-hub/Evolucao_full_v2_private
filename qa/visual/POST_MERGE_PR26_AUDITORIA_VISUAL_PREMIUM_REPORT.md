# Relatório Pós-Merge — PR #26 — Auditoria Visual Premium Navigation Fixes

## Metadados

| Campo | Valor |
|-------|-------|
| PR | [#26](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/26) |
| Título | `fix(ui): address premium visual audit navigation findings` |
| Merge commit | `f962057` |
| Branch merged | `qa/auditoria-visual-premium-a44b828` |
| Base | `main` |
| Data do merge | 2026-06-13 |

## Arquivos mergeados

| Arquivo | Descrição |
|---------|-----------|
| `App.js` | Desabilita restauração automática de estado do NavigationContainer (`linking.getInitialState: () => undefined`) |
| `src/navigation/MainTabs.js` | Adiciona `initialRouteName="Home"` ao Tab.Navigator; melhora UX dos tabs (`activeOpacity`, `hitSlop`) |
| `src/components/ui/ScreenHeader.js` | Aumenta `hitSlop` do botão voltar (8→12px) e adiciona `activeOpacity={0.7}` |
| `qa/visual/AUDITORIA_VISUAL_PREMIUM_A44B828_REPORT.md` | Relatório de auditoria com seção de validação pós-rebuild |

## Bugs corrigidos

| BUG | Causa raiz | Status pós-merge |
|-----|-----------|----------------|
| BUG #2 — App abre na Treino/Workout após relaunch | React Navigation restaurava estado anterior salvo pelo Android | ✅ Corrigido |
| BUG #3 — Bottom nav "intermitente" | O app reabria em WorkoutScreen (sem bottom nav) devido à restauração de estado | ✅ Corrigido |
| BUG #1 — Hit area do voltar no Workout | `hitSlop` insuficiente e ausência de `activeOpacity` | ✅ Melhorado defensivamente |

## Regressão pós-merge

| Teste | Resultado |
|-------|-----------|
| `npm run audit:release:check` | ✅ PASS (drift 0) |
| `freeWorkoutSaveSet.test.mjs` | ✅ PASS 4/4 |
| `workoutActiveIndex.test.mjs` | ✅ PASS 4/4 |
| `workoutHistorySetValues.test.mjs` | ✅ PASS 5/5 |

## Validação visual pós-rebuild

- **Device:** `RQ8T209ZTAF` (Samsung SM-G990E, Android 14)
- **Rebuild:** `npm run android` (Expo run:android debug build)
- **BUG #2:** 5/5 relaunches abriram na Home (`screen_home`)
- **BUG #3:** Bottom nav funcional em todas as 6 abas após relaunch
- **BUG #1:** 3/3 taps no ícone voltar do Workout responderam corretamente

## Release

- **Release feito?** NÃO
- **Tag criada?** NÃO
- **Play Store?** NÃO
- **Próxima fase:** Release Readiness dedicado
