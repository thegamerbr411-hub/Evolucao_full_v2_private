# Post-Build Recapture — Premium Release Cleanup v1 (PR #31)

> **Data/hora:** 2026-06-15 (UTC)  
> **Device:** `RQ8T209ZTAF` (Samsung r8q, API 33)  
> **Branch:** `fix/premium-release-cleanup-v1`  
> **HEAD:** `d523629b40bcbe86abfae295e1f8b810c3ca412a`  
> **PR:** [#31](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/31)  
> **Package validado:** `com.tipolt.evolucaofullv2` — NEXA ausente em foreground  
> **Modo visual limpo:** `EXPO_PUBLIC_SHOW_QA_DIAGNOSTICS` **não** usado  
> **Estado final:** **`POST_BUILD_RECAPTURE_BLOCKED`**

---

## Build / install

| Etapa | Comando / artefato | Resultado |
|-------|-------------------|-----------|
| Gradle | `android/gradlew.bat assembleDebug` | **OK** |
| Install | `adb -s RQ8T209ZTAF install -r -d -g app-debug.apk` | **OK** |
| Metro | Porta 8081 (dev client, bundle PR #31 recarregado) | **OK** após restart |
| Reverse | `adb reverse tcp:8081 tcp:8081` | **OK** |
| Foreground | `dumpsys window` → `com.tipolt.evolucaofullv2/.MainActivity` | **OK** |
| `pm clear` | **Não executado** (sem autorização Felipe) | — |

**Flags permitidas:** `EXPO_PUBLIC_ANDROID_NAV_AUDIT=1`, `EXPO_PUBLIC_ENABLE_QA_TRANSPORT=1`  
**Flags proibidas:** `EXPO_PUBLIC_SHOW_QA_DIAGNOSTICS=1` — ausente  
**QA_WORKOUT_FIXTURE:** **não** usado (slots 09–11 passaram com treino em andamento existente)

---

## Slots 01–16 (status individual)

Evidência local (não commitada): `.qa_runtime/premium_release_cleanup_v1/post_build_recapture/{screens,dumps,logs}/`

| Slot | Arquivo | Status | Notas |
|------|---------|--------|-------|
| 01 | `01_ICON_ANDROID_AFTER` | **PASS** | Launcher capturado; label a11y ausente (comum no launcher Samsung) |
| 02 | `02_SPLASH_AFTER` | **PASS** | Cold start Evolução |
| 03 | `03_HOME_TOP_AFTER` | **PASS** | Home topo |
| 04 | `04_HOME_SCROLL_AFTER` | **PASS** | Scroll home |
| 05 | `05_WORKOUT_HUB_TOP_AFTER` | **PASS** | Hub treino |
| 06 | `06_WORKOUT_HUB_SCROLL_AFTER` | **PASS** | Scroll hub |
| 07 | `07_CATALOG_MODAL_AFTER` | **FAIL_P1** | XML **não** confirma modal catálogo (`Etapa 1/4` apenas). Automação ADB não preenche `routineName` (input controlado React); retry falhou ao abrir modal |
| 08 | `08_EXERCISE_DETAIL_AFTER` | **FAIL_P1** | `screen_exercise_detail` ausente no XML; depende do slot 07 |
| 09 | `09_WORKOUT_SCREEN_AFTER` | **PASS** | WorkoutScreen |
| 10 | `10_KEYPAD_AFTER` | **PASS** | Keypad |
| 11 | `11_POST_SAVE_AFTER` | **PASS** | Feedback “Série salva” detectado |
| 12 | `12_HISTORY_AFTER` | **PASS** | Sem “Fórmula indisponível” |
| 13 | `13_NUTRITION_AFTER` | **PASS** | Sem `[F-Nutrition]` |
| 14 | `14_COACH_AFTER` | **PASS** | Coach |
| 15 | `15_SOCIAL_AFTER` | **PASS** | Após reload Metro: sem `[F-Social]`; placeholder `@usuario` |
| 16 | `16_PROFILE_CONFIG_AFTER` | **PASS** | Após reload Metro: sem Beta/Diagnóstico/Exportar na UI comum |

**Contagem:** PASS **14** · FAIL_P1 **2** · P0 produto **0**

---

## P0 / P1 / P2

| Severidade | Itens |
|------------|-------|
| **P0** | Nenhum (RedBox, NEXA foreground, package errado) |
| **P1** | **07** catálogo não validado no device · **08** detalhe exercício não capturado/validado |
| **P2** | Automação frágil em rotina manual (input React); CI `root-quality` drift histórico no SHA atual |

---

## Gates

| Gate | Resultado |
|------|-----------|
| PR diff sem arquivos proibidos | **PASS** |
| `verify_evolucao_context.cjs` | **PASS** (`CONTEXT_GUARD_OK`) |
| ChatGPT bridge | **BRIDGE_CLOSED** + marcador OK |
| `audit:release:check` (local) | **PASS** drift 0 |
| Testes Lote 1 (`__tests__/`) | **PASS** (30/30 nos 6 arquivos obrigatórios) |
| GitHub `root-quality` | **FAILURE** — `audit:release:check` drift=1 no CI @ `d523629` |
| GitHub `dashboard-tests` | **SUCCESS** |
| `mergeStateStatus` | **UNSTABLE** |

---

## MERGE_READY

**MERGE_READY_NÃO**

Motivos:
1. Slots **07** e **08** = **FAIL_P1** (evidência Lote 1 catálogo/detalhe incompleta no device)
2. GitHub check **`root-quality` FAILURE** (bloqueio CI)
3. Recaptura catálogo exige input React (ADB `input text` não atualiza state) — necessário Detox/Maestro ou recaptura manual Felipe nos slots 07–08

**Merge não executado** (conforme escopo).

---

## Correções / observações pós-captura

1. **Metro stale:** primeira passagem slot 15/16 falhou com bundle antigo (`[F-Social]`, `user id do amigo`). Após restart Metro + reload app → **PASS**.
2. **Slot 07 falso positivo inicial:** validação original não exigia presença do modal; reanálise do XML corrigiu para **FAIL_P1**.
3. **CI drift:** local drift 0; CI no SHA `d523629` reportou drift 1 — investigar sync `_audit_release` no remoto antes de merge.

---

## Ferramentas usadas (esta sessão)

| Ferramenta | Usado | Detalhe |
|------------|-------|---------|
| Cursor Agent | **SIM** | Execução plano recaptura pós-build |
| Terminal / PowerShell | **SIM** | git, gh, npm, gradlew, adb |
| ADB | **SIM** | install, screencap, uiautomator, monkey, reverse |
| Metro (Expo dev client) | **SIM** | `:8081`, reload após restart |
| Gradle assembleDebug | **SIM** | APK debug PR #31 |
| Script recaptura | **SIM** | `.qa_runtime/.../run_post_build_recapture.cjs` |
| scrcpy | **NÃO** | — |
| Detox | **NÃO** | — |
| ChatGPT bridge | **NÃO** (já fechado) | — |
| Gemini | **NÃO** | — |
| GitHub CLI | **SIM** | `gh pr view`, comentário PR |
| MCP / APIs pagas | **NÃO** | — |
| Firebase prod / Play Store / NEXA | **NÃO** | force-stop NEXA apenas |

---

## Próxima ação única

**Felipe:** recaptura manual ou Detox dos slots **07–08** (catálogo + detalhe exercício) no device com build PR #31; em paralelo corrigir **CI root-quality** (audit drift) no branch antes de autorizar merge.
