# Commit Prep — Home + Treino

**Data:** 2026-06-02  
**Autorização:** OK Felipe — organizar fixes; **commit NÃO realizado**  
**Escopo commits:** **Apenas** Home + Treino + QA docs + testes + scripts QA bounded (excluir auth/e2e/android/audit/assets)

---

## Status

| Item | Valor |
|------|--------|
| Treino (módulo) | PASS VISUAL PARCIAL COM RESSALVAS — [`TREINO_FINAL_STATUS.md`](TREINO_FINAL_STATUS.md) |
| Home (pendências finais) | PASS PARCIAL — [`HOME_FINAL_PENDING_REPORT.md`](HOME_FINAL_PENDING_REPORT.md) |
| PASS global app | **NÃO** |
| Commit realizado | **NÃO** |
| Push realizado | **NÃO** |

---

## Branch atual

`hotfix/p0-auth-persistence-reopen-20260511`

## Último commit

`7c28fa9` — fix(auth): use ASCII-safe verification email template

---

## Working tree summary

| Métrica | Valor |
|---------|--------|
| Arquivos modificados (total repo) | ~196 tracked + centenas untracked |
| **In scope Home+Treino** | ~45 paths (ver abaixo) |
| **Fora de escopo** | auth, e2e, `_audit_release`, android, package-lock, qa_metrics, docs infra, vídeos, `.gradle-user-home`, `.playwright-mcp`, etc. |

**Recomendação:** usar `git add` **cirúrgico** apenas nos paths *In scope*. Deixar o resto unstaged.

---

## Arquivos por grupo (IN SCOPE)

### Treino — code (`src/`)

| Arquivo | Tipo |
|---------|------|
| `src/services/dailyState.js` | novo |
| `src/services/workoutInputValidation.js` | novo |
| `src/services/workoutLogIntegrity.js` | novo |
| `src/services/workoutHistoryFlow.js` | novo |
| `src/services/workoutHistoryPresentation.js` | novo |
| `src/services/workoutFinishFlow.js` | novo |
| `src/services/workoutExerciseSwap.js` | novo |
| `src/services/workoutExerciseIdentity.js` | novo |
| `src/services/workoutProgressCopy.js` | novo |
| `src/services/workoutModeCopy.js` | novo |
| `src/services/workoutSetRowState.js` | novo |
| `src/services/workoutSetDisplayValue.js` | novo |
| `src/screens/WorkoutScreen.js` | modificado |
| `src/screens/WorkoutsHubScreen.js` | modificado |
| `src/screens/HistoryScreen.js` | modificado |
| `src/components/workout/ExerciseCard.js` | modificado |
| `src/components/workout/SetRow.js` | modificado |
| `src/components/workout/WorkoutSetField.js` | novo |
| `src/context/AppContext-v2.ts` | modificado (`getDailyState`, history, nutrition hooks) |
| `src/context/modules/coach.js` | modificado (`getFoodCatalog` import) |

### Home — code

| Arquivo | Tipo |
|---------|------|
| `src/screens/HomeScreen.js` | modificado (focus tick, protein sync) |
| `src/context/modules/utils.ts` | modificado (`getTodayKey` local) |

### Tests (`__tests__/`)

| Arquivo |
|---------|
| `__tests__/dailyState.test.mjs` |
| `__tests__/workoutInputValidation.test.mjs` |
| `__tests__/workoutHistoryCleanup.test.mjs` |
| `__tests__/workoutFinishFlow.test.mjs` |
| `__tests__/workoutExerciseSwap.test.mjs` |
| `__tests__/workoutHistoryFlow.test.mjs` |
| `__tests__/workoutProgressCopy.test.mjs` |
| `__tests__/workoutModeCard.test.mjs` |
| `__tests__/workoutSetRowState.test.mjs` |
| `__tests__/workoutSetDisplayValue.test.mjs` |
| `__tests__/workoutHistoryCapture.test.mjs` |

### QA docs (`qa/live_mapping/`)

| Arquivo |
|---------|
| `TREINO_FINAL_STATUS.md` |
| `HOME_FINAL_PENDING_REPORT.md` |
| `LIVE_TEST_STATUS.md` |
| `LIVE_BUGS_FOUND.md` |
| `P1_STATE_FIX_REPORT.md` |
| `TREINO_CHATGPT_ANALYSIS_SUMMARY.md` |
| `CHATGPT_ANALYSIS_RESPONSES.md` |
| `HOME_3_3A_CHATGPT_ANALYSIS_SUMMARY.md` |
| `HOME_DEEP_AUDIT_REPORT.md` |
| `ANTI_HANG_RULES.md` |
| `CHATGPT_BATCHES.md` (se rastreio Treino/Home) |
| `PACOTE_COMPLETO_TREINO_P1_P2_2026-05-28.md` |
| `LIVE_APP_MAP.md`, `LIVE_COORDINATE_MAP.md`, `LIVE_CLICK_LOG.md` (opcional rastreio) |
| `screenshots/treino_postfix/*.md`, `*.json`, `*.xml` (PNG gitignored) |
| `screenshots/fix_p1/*.md`, `*.json`, `*.xml` |

### Scripts / infra QA (bounded)

| Arquivo |
|---------|
| `qa/live_mapping/treino_postfix_visual_check.ps1` |
| `qa/live_mapping/treino_postfix_gap_check.ps1` |
| `qa/live_mapping/fix_p1_validate.ps1` |
| `qa/live_mapping/fix_finish_validate.ps1` |
| `qa/live_mapping/fix_rest_validate.ps1` |
| `qa/live_mapping/fix_p1_capture.ps1` |
| `tools/lib/AndroidQaTarget.ps1` |

**NÃO incluir em commit:** `qa/live_mapping/metro_debug/*.log`, `*.err.log`, `metro.pid`, `metro_last_start.json` (runtime local).

---

## Fora de escopo (deixar unstaged)

| Categoria | Exemplos |
|-----------|----------|
| Auth / backend | `src/services/authService.js`, `RegisterScreen.js`, `_audit_release/backend/` |
| E2E / Detox | `e2e/`, `.detoxrc.js` |
| Android build | `android/`, `android/sentry.properties` |
| Env / secrets | `.env` (gitignored); `.env.example` modificado — **revisar diff antes de qualquer commit amplo** |
| Pacotes / lock | `package.json`, `package-lock.json` |
| QA pesada / métricas | `qa_metrics/`, `qa/full-visual-qa-report.json`, `qa_phase4_*` |
| Cache / tooling local | `.gradle-user-home/`, `.playwright-mcp/`, `device-video-*.mp4` |
| Nutrição profunda | fluxos fora Home meal sync |
| `_audit_release/` mirror | inteiro |

---

## Arquivos suspeitos / sensíveis

| Arquivo | Risco | Recomendação |
|---------|--------|--------------|
| `.env` | secrets | **Não** no status — OK |
| `.env.example` | template | Fora escopo A — não adicionar |
| `android/sentry.properties` | token DSN? | **Não** commitar sem revisão |
| `metro_debug/*.log` | ruído | **Não** commitar |
| PNG screenshots | volume | Já em `.gitignore` (`qa/**/*.png`) |

**Nenhum arquivo sensível bloqueante** no pacote Home+Treino in scope.

---

## Testes executados

```powershell
Set-Location "F:\projetos\evolucao app"
node --test __tests__/dailyState.test.mjs `
  __tests__/workoutInputValidation.test.mjs `
  __tests__/workoutHistoryCleanup.test.mjs `
  __tests__/workoutFinishFlow.test.mjs `
  __tests__/workoutExerciseSwap.test.mjs `
  __tests__/workoutHistoryFlow.test.mjs `
  __tests__/workoutProgressCopy.test.mjs `
  __tests__/workoutModeCard.test.mjs `
  __tests__/workoutSetRowState.test.mjs `
  __tests__/workoutSetDisplayValue.test.mjs `
  __tests__/workoutHistoryCapture.test.mjs
```

**Nota:** Felipe citou `tests/` — no repo os suites estão em **`__tests__/`**.

## Resultado dos testes

**128/128 PASS** (11 arquivos, 0 fail)

Gate documentado Treino: 126/126 — diferença +2 por testes novos em `dailyState.test.mjs` (getTodayKey local + proteinToday).

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Commit acidental de 196 arquivos | `git add` apenas paths *In scope* |
| `AppContext-v2.ts` mistura outras mudanças | Revisar `git diff src/context/AppContext-v2.ts` antes do commit 1 |
| Branch hotfix auth | Commits Home/Treino podem ser cherry-pick ou branch dedicada — decisão Felipe |
| PNGs não versionados | OK — análise `.md`/`.xml`/`.json` versionados |

---

## Sugestão de commits (após OK Felipe)

### Commit 1 — `feat(workout): state machine, finish flow and hub alignment`

- `src/services/dailyState.js`
- `src/services/workoutFinishFlow.js`
- `src/screens/WorkoutsHubScreen.js`
- `src/context/AppContext-v2.ts` (parte dailyState/workout summary — revisar diff)
- `__tests__/dailyState.test.mjs`
- `__tests__/workoutFinishFlow.test.mjs`

### Commit 2 — `feat(workout): history, input validation and UI presentation`

- `src/services/workoutInputValidation.js`
- `src/services/workoutLogIntegrity.js`
- `src/services/workoutHistoryFlow.js`
- `src/services/workoutHistoryPresentation.js`
- `src/services/workoutHistoryCleanup` (via workoutHistoryCleanup test + flow files)
- `src/screens/WorkoutScreen.js`, `HistoryScreen.js`
- `src/components/workout/*`
- `src/services/workoutProgressCopy.js`, `workoutModeCopy.js`, `workoutSetRowState.js`, `workoutSetDisplayValue.js`, `workoutExerciseSwap.js`, `workoutExerciseIdentity.js`
- `src/context/modules/coach.js`
- `__tests__/workout*.test.mjs` (restantes)

### Commit 3 — `fix(home): daily state sync and local today key`

- `src/context/modules/utils.ts`
- `src/screens/HomeScreen.js`

### Commit 4 — `docs(qa): treino and home closure status`

- `qa/live_mapping/TREINO_FINAL_STATUS.md`
- `qa/live_mapping/HOME_FINAL_PENDING_REPORT.md`
- `qa/live_mapping/COMMIT_PREP_HOME_TREINO_REPORT.md`
- `qa/live_mapping/LIVE_TEST_STATUS.md`, `LIVE_BUGS_FOUND.md`, `P1_STATE_FIX_REPORT.md`
- `qa/live_mapping/TREINO_CHATGPT_ANALYSIS_SUMMARY.md`, `CHATGPT_ANALYSIS_RESPONSES.md`, `HOME_3_3A_*`
- `qa/live_mapping/screenshots/**` (md/json/xml; sem png)
- `qa/live_mapping/*.ps1` (bounded), `tools/lib/AndroidQaTarget.ps1`

**Alternativa:** 2 commits (code+tests | docs+qa scripts) se Felipe preferir menos granularidade.

---

## O que NÃO commitar

- Auth, e2e, android, sentry, gradle, package-lock, `_audit_release`
- `metro_debug` logs, `.gradle-user-home`, `.playwright-mcp`, vídeos
- Nutrição profunda / escopos não relacionados
- Prints PNG (gitignored)

---

## Próxima ação recomendada

1. Felipe revisa este relatório e `git diff` dos paths in scope.  
2. Autoriza commits separados (1–4 ou 2 blocos).  
3. Agente ou Felipe executa `git add` cirúrgico + `git commit` (sem push até OK).

**Não declarar app pronto. PASS global: NÃO.**
