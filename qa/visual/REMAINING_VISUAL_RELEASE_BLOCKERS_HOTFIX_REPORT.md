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

## 18. Validação manual ExerciseDetail ×5 (scrcpy + ADB pós-tela)

| Item | Valor |
|------|-------|
| Método | **Manual/scrcpy** + navegação assistida passo-a-passo + **captura ADB somente após tela aberta** |
| Script bulk rejeitado | **Não** usado `exercise_details_5_run.cjs` / `exercise_details_after.cjs` como evidência |
| Helper local | `.qa_runtime/remaining_blockers/exercise_details_manual/manual_details_gate.cjs` |
| Manifest | `.qa_runtime/remaining_blockers/exercise_details_manual/results_manual.json` |
| Device | `RQ8T209ZTAF` · package **`com.tipolt.evolucaofullv2`** (1ª rodada capturou NEXA por engano — descartada) |
| scrcpy | Aberto (`scrcpy -s RQ8T209ZTAF`) |
| Data | 2026-06-14 |

### Resultado por exercício

| Exercício | Status | Abriu | Evidência local |
|-----------|--------|-------|-----------------|
| Cadeira Extensora | **FAIL** | — | Catálogo/Detalhes não completou após 3 tentativas (busca + filtro músculo) |
| Supino Inclinado | **FAIL** | — | Idem (Barra/Halter) |
| Puxada Alta | **PASS** | ExerciseDetail | `exercise_details_manual/screens/DETALHE_PUXADA_ALTA.png` + `dumps/DETALHE_PUXADA_ALTA.xml` (`screen_exercise_detail`, Puxada Frontal Polia) |
| Agachamento Hack | **PASS** | ExerciseDetail | `exercise_details_manual/screens/DETALHE_AGACHAMENTO_HACK.png` + `dumps/DETALHE_AGACHAMENTO_HACK.xml` (Hack Machine) |
| Tríceps na Polia | **FAIL** | — | Catálogo/Detalhes não completou após 3 tentativas |

**Resumo:** **2/5 PASS** · 0 PARTIAL · **3 FAIL** · veredito manifest: **`BLOCKED`** · merge: **NO-GO**

### Blocker 4 — veredito pós-manual

- **PASS real** em 2 exercícios com tela `ExerciseDetail` confirmada no XML (package Evolução, instruções/mídia placeholder).
- **FAIL real** em 3 exercícios — rotina/catálogo não abriu de forma confiável na sessão (não é crash RedBox; é fluxo produto/ADB instável).
- **PR #30 squash merge:** **NO-GO** (critério ≥4/5 PASS não atingido).
- **Próxima ação:** revalidar manualmente Cadeira / Supino / Tríceps com sessão limpa (sem NEXA em foreground) ou hotfix de rota catálogo.

### Gates pós-manual

| Gate | Resultado |
|------|-----------|
| Audit | drift **0** |
| Unit hotfix scope | **15/15 PASS** |
| Logcat | `exercise_details_manual/logs/manual_details_logcat.txt` |

---

## 19. Entrega Felipe — checklist 16 itens (manual gate)

| # | Item | Resposta |
|---|------|----------|
| 1 | PR #30 | OPEN @ `ed609ce` — https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/30 |
| 2 | Manual/scrcpy usado | Sim — scrcpy + captura ADB pós-tela |
| 3 | Cadeira Extensora | **FAIL** |
| 4 | Supino Inclinado | **FAIL** |
| 5 | Puxada Alta | **PASS** (ExerciseDetail) |
| 6 | Agachamento Hack | **PASS** (ExerciseDetail) |
| 7 | Tríceps na Polia | **FAIL** |
| 8 | Resultado Detalhes ×5 | **2/5 PASS** — BLOCKED |
| 9 | Audit | drift **0** |
| 10 | Unitários | **15/15 PASS** (scope hotfix) |
| 11 | Relatório | Este arquivo §18–19 |
| 12 | PR comentário | Final gate manual update (NO-GO merge) |
| 13 | Merge | **NO-GO** — não executado |
| 14 | Main pós-merge | N/A (sem merge) |
| 15 | Release Readiness | **NO-GO** |
| 16 | Próxima ação real | Revalidar 3 FAIL manualmente ou corrigir fluxo catálogo; só então merge PR #30 |

---

## 20. Reteste manual — 3 ExerciseDetails restantes (PR #30 gate)

| Item | Valor |
|------|-------|
| Sessão | Reteste focado nos 3 FAIL de §18 (Cadeira, Supino, Tríceps) |
| Método | **scrcpy + navegação manual**; ADB **somente** `screencap` + `uiautomator dump/pull` após tela aberta |
| Scripts bulk | **Não** usados `manual_details_gate.cjs`, `exercise_details_after.cjs`, `exercise_details_5_run.cjs` como evidência |
| Helpers locais (não commitados) | `capture_only.cjs`, `open_one_detail.cjs`, `run_last3.cjs` |
| Device | `RQ8T209ZTAF` · package verificado **`com.tipolt.evolucaofullv2`** (NEXA force-stop antes da sessão) |
| Branch | `fix/remaining-visual-release-blockers` @ `356fef3` |
| Manifest | `.qa_runtime/remaining_blockers/exercise_details_manual/results_manual.json` |
| Data | 2026-06-14 |

### Resultado dos 3 retestados

| Exercício | ID | Status | Observação |
|-----------|-----|--------|------------|
| Cadeira Extensora | `DETALHE_CADEIRA_EXTENSORA` | **FAIL** | Catálogo abriu (`SELECIONAR EXERCICIOS`); botão **Detalhes** visível; `screen_exercise_detail` **não** apareceu após tap |
| Supino Inclinado | `DETALHE_SUPINO_INCLINADO` | **FAIL** | Idem — linha `Supino Inclinado Barra/Halter` + `btn-routine-detail-*` no XML; permaneceu no modal de catálogo |
| Tríceps na Polia | `DETALHE_TRICEPS_POLIA` | **FAIL** | Idem — busca/filtro Tríceps; sem transição para ExerciseDetail |

Evidência FAIL local (não commitada): `screens/DETALHE_*_FAIL_catalog.png`, `dumps/wait_final.xml` (catálogo, não detail).

### Combinado ×5 (2 PASS anteriores + 3 reteste)

| Exercício | Status | Evidência PASS |
|-----------|--------|----------------|
| Puxada Alta | **PASS** | `screens/DETALHE_PUXADA_ALTA.png` + `dumps/DETALHE_PUXADA_ALTA.xml` (`screen_exercise_detail`, Puxada Frontal Polia) |
| Agachamento Hack | **PASS** | `screens/DETALHE_AGACHAMENTO_HACK.png` + `dumps/DETALHE_AGACHAMENTO_HACK.xml` |
| Cadeira Extensora | **FAIL** | — |
| Supino Inclinado | **FAIL** | — |
| Tríceps na Polia | **FAIL** | — |

**Resumo:** **2/5 PASS** · 0 PARTIAL · **3 FAIL** · manifest: **`BLOCKED`** · merge: **NO-GO**

### P1 blocker (produto)

- **Sintoma:** tap em **Detalhes** no catálogo de rotina (Etapa 2/4) não navega para `ExerciseDetail` de forma confiável para Cadeira / Supino / Tríceps, enquanto Puxada Alta e Agachamento Hack abrem normalmente na mesma sessão.
- **Não é** RedBox nem package NEXA; é **rota catálogo → detail** instável ou quebrada para subset do catálogo.
- **Ação:** hotfix em `RoutinesScreen` / fluxo `openExerciseDetail` ou reteste manual com sessão limpa antes de reabrir merge gate PR #30.

### Gates pós-reteste §20

| Gate | Resultado |
|------|-----------|
| Audit | drift **0** |
| Unit hotfix scope | **15/15 PASS** |
| Squash merge PR #30 | **NO-GO** — critério ≥4/5 PASS não atingido |

---

## 21. Correção ExerciseDetail ×5 (PR #30 — hotfix código)

| Item | Valor |
|------|-------|
| Branch | `fix/remaining-visual-release-blockers` |
| Causa raiz | `dbecfdf` fechou o modal **antes** de `navigate('ExerciseDetail')`; no Android (RN 0.83) a navegação durante teardown do Modal slide era descartada. Contribuinte: alvo de toque pequeno no botão Detalhes + busca sem aliases de auditoria. |
| Correção | Navegar **antes** de fechar modal; `resolveExerciseForDetail` + aliases; linha do catálogo (`row-routine-detail-*`) abre detalhe; `keyboardShouldPersistTaps` no ScrollView do modal; botão Detalhes com `minHeight: 48`. |
| Arquivos | `src/screens/RoutinesScreen.js`, `src/data/exercises.js`, `src/screens/ExerciseDetailScreen.js`, `__tests__/exerciseDetailCatalogAccess.test.mjs` |
| Teste novo | **4/4 PASS** (`exerciseDetailCatalogAccess.test.mjs`) |
| Audit | drift **0** (após `audit:release:sync`) |
| Unit hotfix scope | **19/19 PASS** (15 scope + 4 novo) |

### Resultado device pós-correção (`run_last3.cjs`)

| Exercício | Antes §20 | Depois (última rodada) |
|-----------|-----------|------------------------|
| Cadeira Extensora | FAIL | **FAIL** (automação) |
| Supino Inclinado | FAIL | **FAIL** (automação) |
| Tríceps na Polia | FAIL | **FAIL** (automação) |
| Puxada Alta | PASS | **PASS** |
| Agachamento Hack | PASS | **PASS** |

**Resumo device:** **2/5 PASS** · 0 PARTIAL · **3 FAIL** — critério merge ≥4/5 **não atingido**.

**Nota:** código corrigido e coberto por testes unitários; device pode exigir `installDebug` + reload Metro para carregar bundle com `navigate`-first. Reteste manual scrcpy recomendado para confirmar os 3 FAIL antes de merge.

### Veredito PR #30

**NO-GO merge** — ExerciseDetail ×5 ainda **2/5 PASS** no gate device automatizado.

---

_Relatório atualizado — correção ExerciseDetail ×5 — 2026-06-14. Sem merge PR #30. Sem commit de `.qa_runtime/**`._
