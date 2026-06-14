# Remaining Visual Release Blockers — Hotfix Report

> **Caminho oficial:** `qa/visual/REMAINING_VISUAL_RELEASE_BLOCKERS_HOTFIX_REPORT.md`  
> **Evidências (não commitadas):** `.qa_runtime/remaining_blockers/`  
> **Resposta ChatGPT:** `.qa_runtime/chatgpt_bridge/evolucao_remaining_blockers_response.txt`

---

## 1. Base / branch / device

| Campo | Valor |
|-------|-------|
| Workspace | `F:\projetos\evolucao-main-clean` |
| Branch hotfix | `fix/remaining-visual-release-blockers` |
| Base | `origin/main` @ **`c016a16`** (PR #29 squash) |
| PR docs merged | [#29](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/29) |
| Device | `RQ8T209ZTAF` (Samsung SM-G990E, Android 14) |
| Metro | `8081` — **reiniciado sem `CI=1`** após RedBox (reloads estavam desabilitados em CI mode) |
| Data | 2026-06-13 |
| Gates | `audit:release:check` **drift 0** pós-sync · unitários **35/35 PASS** |

---

## 2. Escopo

Tratar os **5 blockers visuais/release** documentados no fechamento do Bloco 3 (PR #29 / relatório final):

1. Config Beta/Diagnóstico exposto no Perfil  
2. Chip `[F-Nutrition]` na Nutrição  
3. Copy técnica no Histórico (`local` / `backend`)  
4. ExerciseDetail real (modal catálogo não fechava antes de navegar)  
5. Social RedBox (`useBottomTabBarHeight` fora do Tab Navigator)

**Fora de escopo:** Release Readiness run, Firebase prod, alterações em `saveSet` / `activeExerciseIndex`, Bloco 4.

---

## 3. Método

- Correções mínimas em `src/` alinhadas ao plano de hotfix  
- `npm run audit:release:sync` após drift 8 em `src/`  
- Unitários core + `qaDiagnosticsVisibility.test.mjs`  
- Capturas ADB: `.qa_runtime/remaining_blockers/capture_after_blockers.cjs`, `exercise_details_after.cjs`, `spot_check.cjs`  
- Verificação Metro bundle: `TAB_BAR_ESTIMATE` servido em `SocialChallengesScreen` (sem `useBottomTabBarHeight`)  
- ChatGPT ponte: PNGs pós-fix via `send_images_bridge.cjs`

---

## 4. Resumo executivo

| Blocker | Código | Device pós-reload Metro |
|---------|--------|-------------------------|
| 1 Perfil Beta/Diagnóstico | **FIX** — `shouldShowQaDiagnostics()` | **PASS** spot-check (sem copy Beta na viewport capturada) |
| 2 `[F-Nutrition]` | **FIX** — chip removido | **PASS** — `F-Nutrition false` em `spot_check.cjs` |
| 3 Histórico copy | **FIX** — títulos humanizados PT-BR | **PARCIAL** — PNG capturado; dump ADB intermitente |
| 4 ExerciseDetail | **FIX** — fecha modal + `testID` Detalhes | **PENDENTE** — script ×5 abortou (`uiautomator` status 137) |
| 5 Social RedBox | **FIX** — padding fixo + safe area | **PASS** — `Social RedBox false` em `spot_check.cjs` |

**Veredito:** hotfix **pronto para review/merge**. Beta fechado **GO COM RISCO → tendência GO** após validação manual de Detalhes ×5. **Release Readiness NO-GO**. **Produção NO-GO**.

---

## 5. Blocker 1 — Config Beta/Diagnóstico

| Item | Detalhe |
|------|---------|
| Arquivo | `src/screens/ProfileScreen.js`, `src/utils/qaDiagnosticsVisibility.js` (novo) |
| Problema | Seções Beta/Diagnóstico e Exportar Beta sempre visíveis |
| Correção | `shouldShowQaDiagnostics()` (= `__DEV__`) envolve ambos os blocos; heading dev `Ferramentas QA` |
| Device | `.qa_runtime/remaining_blockers/screens_after/PERFIL_SEM_BETA.png` — export beta buttons ausentes na área principal após scroll |
| Nota | Em `__DEV__` true, Ferramentas QA ainda aparecem (padrão alinhado a Nutrição pré-fix); builds release ocultam |

---

## 6. Blocker 2 — Nutrição `[F-Nutrition]`

| Item | Detalhe |
|------|---------|
| Arquivo | `src/screens/NutritionScanner.js` |
| Correção | Removido bloco `devFeatureTag` com `[F-Nutrition]` |
| Device | `spot_check.cjs` → **F-Nutrition false** (pós Metro restart sem CI) |
| Evidência | `.qa_runtime/remaining_blockers/screens_after/NUTRICAO_SEM_F_TAG.png` |

---

## 7. Blocker 3 — Histórico copy técnica

| Item | Detalhe |
|------|---------|
| Arquivo | `src/screens/HistoryScreen.js` |
| Antes → Depois | `Historico dos Ultimos 7 Dias` → `Histórico dos últimos 7 dias`; `Historico de series (local)` → `Séries registradas`; `Historico real (backend)` → `Treinos sincronizados`; `Media de calorias` → `Média de calorias` |
| Persistência | **Não alterada** (`workoutHistoryFlow.js` intacto) |
| Testes | `workoutHistorySetValues.test.mjs` **5/5 PASS** |
| Device | PNG `HISTORICO_COPY.png`; navegação via `btn_open_history` no hub Treino |

---

## 8. Blocker 4 — ExerciseDetail real

| Item | Detalhe |
|------|---------|
| Arquivo | `src/screens/RoutinesScreen.js` |
| Causa | `openExerciseDetail` navegava com modal catálogo aberto |
| Correção | `setShowCatalogModal(false)` antes de `navigation.navigate('ExerciseDetail', …)`; `testID` `btn-routine-detail-${toTestId(name)}`; `accessibilityLabel="Detalhes"` |
| Device | `exercise_details_after.cjs` não completou (falha intermitente `uiautomator dump`) — **revalidar manualmente** |
| Script | `.qa_runtime/remaining_blockers/exercise_details_after.cjs` |

---

## 9. Blocker 5 — Social RedBox

| Item | Detalhe |
|------|---------|
| Arquivo | `src/screens/SocialChallengesScreen.js` |
| Causa | `useBottomTabBarHeight()` quando hub abre stack fora do Bottom Tab Navigator |
| Correção | `TAB_BAR_ESTIMATE = 56` + `useSafeAreaInsets()` |
| Device | **PASS** — `spot_check.cjs`: RedBox `false` após reload; capturas anteriores (bundle stale + CI mode) mostravam RedBox esperado |
| Extra | `RankingEvolutionScreen.js` — labels PT-BR nos chips (`XP`, `Consistência`, …) |

---

## 10. Capturas after (local)

```
.qa_runtime/remaining_blockers/
  screens_after/          PERFIL_SEM_BETA, NUTRICAO_SEM_F_TAG, HISTORICO_COPY (+ social retries)
  dumps/                  XML parcial (uiautomator instável pós-restart)
  exercise_details/       (script ×5 não concluído)
  capture_results.json
  social_retest_log.txt
  spot_check.cjs
```

**Nota operacional:** Metro estava com `CI=1` → reloads desabilitados; bundle stale invalidou primeira rodada de capturas. Restart Metro **sem CI** confirmou fixes (nutrition + social).

---

## 11. Testes

| Suite | Resultado |
|-------|-----------|
| `freeWorkoutSaveSet.test.mjs` | 4/4 PASS |
| `workoutActiveIndex.test.mjs` | 4/4 PASS |
| `workoutHistorySetValues.test.mjs` | 5/5 PASS |
| `workoutModeCard.test.mjs` | 10/10 PASS |
| `workoutSetRowState.test.mjs` | 10/10 PASS |
| `qaDiagnosticsVisibility.test.mjs` | 2/2 PASS |
| **Total** | **35/35 PASS** |

---

## 12. Audit release

| Gate | Resultado |
|------|-----------|
| Pré-sync drift | **8** (alterações em `src/screens/*` + novo util) |
| `npm run audit:release:sync` | **drift 0** |
| `_audit_release/**` | Atualizado no commit |

---

## 13. Risco residual

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Detalhes ×5 não revalidados no device nesta sessão | Média | Rodar `exercise_details_after.cjs` após estabilizar ADB |
| Ferramentas QA visíveis em dev client (`__DEV__`) | Baixa | Esperado; release build oculta |
| `uiautomator dump` status 137 intermitente | Baixa | Retry / captura manual scrcpy |
| Ranking hub ADB (`btn_open_ranking`) não abriu em script social | Baixa | Spot-check social OK; ranking tab alternativa |

---

## 14. Vereditos

| Item | Veredito |
|------|----------|
| Hotfix código | **GO** — 5 blockers tratados |
| Beta fechado | **GO COM RISCO → possível GO** se Detalhes ×5 confirmados |
| Release Readiness | **NO-GO** |
| Produção / Play Store | **NO-GO** |

---

## 16. Final gate PR #30 (device `RQ8T209ZTAF`, 2026-06-14)

| Item | Valor |
|------|-------|
| Branch | `fix/remaining-visual-release-blockers` @ **`8a69a6e`** (+ `InteractionManager` em `openExerciseDetail`) |
| Metro | `8081` — **não reiniciado** (`packager-status:running`); reload HTTP 200 apenas |
| Device | `RQ8T209ZTAF` · package `com.tipolt.evolucaofullv2` |
| Histórico Evolução | **PASS** — `capture_historico_evolucao.cjs`: copy humana, `history-local-logs-panel`, sem NEXA |
| Blockers 1–3–5 (final) | **PASS** — `capture_after_blockers.cjs` @ `2026-06-14T00:00:57Z` |
| Detalhes ×5 | **FAIL automação** (0/5 última rodada) · **1/5 PASS device** mid-session (Tríceps Corda Polia → `screen_exercise_detail`) após `8a69a6e` |
| Audit | `npm run audit:release:check` → **drift 0** |
| Unit (hotfix scope) | `freeWorkoutSaveSet` + `workoutActiveIndex` + `workoutHistorySetValues` + `qaDiagnosticsVisibility` → **15/15 PASS** |
| Logcat | `.qa_runtime/remaining_blockers/logs/pr30_final_gate_logcat.txt` — sem `FATAL`/`bottom tab bar height` no retest Social |
| Squash merge PR #30 | **NO-GO** — blocker 4 não atingiu 4/5 device (automação ADB/catalogo instável após sessão longa) |

### Blocker status (final gate)

| # | Blocker | Device | Evidência |
|---|---------|--------|-----------|
| 1 | Config Beta | **PASS** | `screens_after/PERFIL_SEM_BETA.png` · sem copy Beta na viewport |
| 2 | Nutrição | **PASS** | `NUTRICAO_SEM_F_TAG.png` · `hasFNutrition: false` |
| 3 | Histórico | **PASS** | `HISTORICO_EVOLUCAO.png` + `dumps/HISTORICO_EVOLUCAO.xml` (Evolução, copy PT-BR) |
| 4 | ExerciseDetail | **PARCIAL** | Código `InteractionManager` · 1 navegação confirmada (Tríceps); automação ×5 falhou (`uiautomator` 137 / catálogo) |
| 5 | Social RedBox | **PASS** | 3× `SOCIAL_RETEST_*` + `RANKING_RETEST_*` · `social_retest_log.txt` · `redbox: false` |

### Vereditos finais (gate)

| Gate | Veredito |
|------|----------|
| Beta fechado | **GO COM RISCO** — blockers 1–3–5 OK; revalidar Detalhes ×5 manual pós-merge |
| Release Readiness | **NO-GO** (gate dedicado não iniciado) |
| Produção / Play Store | **NO-GO** |
| Merge PR #30 | **NO-GO** (critério Detalhes ≥4/5 não atingido) |

---

## 17. Entrega Felipe — checklist 22 itens (final gate)

| # | Item | Status / path |
|---|------|----------------|
| 1 | PR #30 URL | https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/30 |
| 2 | Branch | `fix/remaining-visual-release-blockers` @ `8a69a6e` |
| 3 | Base main | `c016a16` |
| 4 | Metro final | 8081 running, sem restart |
| 5 | Device | `RQ8T209ZTAF` |
| 6 | APP_HOME | `.qa_runtime/remaining_blockers/screens_after/APP_HOME_PR30.png` |
| 7 | Histórico Evolução | **PASS** — `HISTORICO_EVOLUCAO.png` + `dumps/HISTORICO_EVOLUCAO.xml` |
| 8 | Blocker 1 Perfil | **PASS** — `PERFIL_SEM_BETA.png` |
| 9 | Blocker 2 Nutrição | **PASS** — `NUTRICAO_SEM_F_TAG.png` |
| 10 | Blocker 5 Social ×3 | **PASS** — `SOCIAL_RETEST_1..3.png`, `social_retest_log.txt` |
| 11 | Blocker 4 Detalhes ×5 | **PARCIAL** — `exercise_details/screens/` · automação 0/5 final; 1 PASS mid-session |
| 12 | `capture_results.json` | `.qa_runtime/remaining_blockers/capture_results.json` |
| 13 | Logcat gate | `.qa_runtime/remaining_blockers/logs/pr30_final_gate_logcat.txt` |
| 14 | Audit drift | **0** — `qa/audit-release-sync-report.json` |
| 15 | Unit hotfix | **15/15 PASS** (4 arquivos scope PR #30) |
| 16 | Commit extra gate | `8a69a6e` InteractionManager catalog→detail |
| 17 | ChatGPT ponte final | **Não acionado** (Detalhes inconclusivo por infra ADB, não ambiguidade visual) |
| 18 | Squash merge | **NO-GO** (Detalhes <4/5) |
| 19 | Beta fechado | **GO COM RISCO** |
| 20 | Release Readiness | **NO-GO** |
| 21 | Produção | **NO-GO** |
| 22 | Relatório commitável | **Este arquivo** §16–17 |

---

_Relatório atualizado no final gate PR #30 — 2026-06-14. Sem Release Readiness. Sem commit de `.qa_runtime/**`._
