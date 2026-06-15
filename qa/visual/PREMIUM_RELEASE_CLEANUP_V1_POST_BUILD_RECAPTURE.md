# Post-Build Recapture — Premium Release Cleanup v1 (PR #31)

> **Data/hora:** 2026-06-15 (UTC)  
> **Device:** `RQ8T209ZTAF` (Samsung r8q, API 33)  
> **Branch:** `fix/premium-release-cleanup-v1`  
> **HEAD (pré-push fix):** `e0e8042` → novo SHA após commit fix 07/08  
> **PR:** [#31](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/31)  
> **Package validado:** `com.tipolt.evolucaofullv2` — NEXA ausente em foreground  
> **Modo visual limpo:** `EXPO_PUBLIC_SHOW_QA_DIAGNOSTICS` **não** usado  
> **Estado final:** **`POST_BUILD_RECAPTURE_PASS_MERGE_READY`** (sujeito a CI verde no HEAD pós-push)

---

## Build / install / Metro

| Etapa | Resultado |
|-------|-----------|
| Gradle `assembleDebug` | **OK** (sessão anterior) |
| APK install `RQ8T209ZTAF` | **OK** |
| Metro | `npx expo start --dev-client --clear --port 8081` (sem `CI=true`) |
| `curl :8081/status` | `packager-status:running` |
| `adb reverse tcp:8081` | **OK** |
| Foreground | `com.tipolt.evolucaofullv2` |

---

## Slots 07/08 FIX (evidência local — não commitada)

Pasta: `.qa_runtime/premium_release_cleanup_v1/post_build_recapture_fix_07_08/`

| Slot | Arquivo | Status | Notas |
|------|---------|--------|-------|
| **07** | `07_CATALOG_MODAL_AFTER_FIX.png/.xml` | **PASS** | Modal catálogo real; Detox `replaceInput` + ADB PNG/XML |
| **08** | `08_EXERCISE_DETAIL_AFTER_FIX.png/.xml` | **PASS** | `screen_exercise_detail` confirmado; sem `%20`; copy premium |

**Slots 01–06, 09–16:** mantidos **PASS** da recaptura anterior (`.qa_runtime/.../post_build_recapture/`).

**Contagem global:** PASS **16/16** · FAIL_P1 **0** · P0 **0**

---

## Correções aplicadas nesta execução

1. **testIDs** em `RoutinesScreen.js` (sem mudança visual): `card-routine-manual-builder`, `btn-routine-builder-next`, `modal-routine-catalog`, `btn-catalog-exercise-detail-*`, `input-routine-name` + a11y.
2. **ExerciseDetailScreen.js:** import `setQaPlayerState` (RedBox ao abrir detalhe); remoção copy técnica duplicada; `Metadata` → `Informacoes adicionais`; `Sem metadata cadastrada` → `Informacoes complementares em breve`.
3. **CI audit:** `_audit_release/e2e/10-smoke-minimo-treino-persistencia.e2e.js` via `npm run audit:release:sync` (não criado manualmente).
4. **Helper Detox recapture:** `.qa_runtime/.../25-post-build-recapture-07-08.e2e.js` — **local only, não commitado**.

---

## Automação

| Caminho | Resultado |
|---------|-----------|
| Detox navegação | **SIM** — `replaceInput` + fluxo catálogo/detalhe |
| Detox como evidência | **NÃO** — apenas ADB PNG+XML |
| Detox falhas | 2+ antes de fix produto (`setQaPlayerState`, copy técnica) |
| `MANUAL_CAPTURE_USED` | **PARCIAL** — re-capture ADB slot 07 após timing; slot 08 após fix copy |

---

## Gates locais

| Gate | Resultado |
|------|-----------|
| `verify_evolucao_context.cjs` | **PASS** |
| `audit:release:check` | **PASS** drift 0 |
| Testes Lote 1 (`__tests__/`) | **PASS** 30/30 |
| Bridge | **BRIDGE_CLOSED** |

---

## CI (consultar HEAD pós-push)

```powershell
git rev-parse HEAD
gh pr checks 31 --repo thegamerbr411-hub/Evolucao_full_v2_private
```

**Não usar** run histórico `27518642786` como verdade final.

---

## MERGE_READY

**MERGE_READY_SIM** se `root-quality` + `dashboard-tests` **PASS** no HEAD atual.

**Merge não executado** (conforme escopo).

---

## Ferramentas

| Ferramenta | Usado |
|------------|-------|
| Cursor Agent | SIM |
| Terminal / PowerShell | SIM |
| ADB | SIM |
| Metro (Expo dev-client) | SIM |
| Detox | SIM (navegação local) |
| scrcpy | NÃO |
| ChatGPT bridge | NÃO (fechado) |
| GitHub CLI | SIM |
| NEXA / Firebase prod / Play Store | NÃO |
