# Smoke Mínimo Treino Persistência — Evolução

## Baseline
- Workspace: `F:\projetos\evolucao-main-clean`
- Branch: `polish/full-app-visual-icon-cards`
- Commit HEAD: `15be59f` (+ validação local pós-smoke)
- PR: https://github.com/thegamerbr411-hub/Evolucao_full_v2_private/pull/24
- Device: `RQ8T209ZTAF` (físico, único após kill `emulator-5554`)
- Metro: RUNNING com `EXPO_PUBLIC_ANDROID_NAV_AUDIT=1`, `EXPO_PUBLIC_ENABLE_QA_TRANSPORT=1`, `EXPO_PUBLIC_QA_WORKOUT_FIXTURE=1`

## Commits relevantes
- `5b7a976` fix(feedback): prevent beta prompt from blocking workout flow
- `fb892e3` … `15be59f` smoke mínimo Detox (deleteApp, onboarding, keypad waits)
- Validação local: estabilização attached em `e2e/helpers/utils.js` (ADB/XML fallback, sem alterar saveSet)

## Audit release
- Comando: `npm run audit:release:check`
- Resultado: **PASS** (drift 0 após `npm run audit:release:sync` local)

## Testes unitários core
| Teste | Resultado |
|-------|-----------|
| `freeWorkoutSaveSet.test.mjs` | **PASS 4/4** |
| `workoutActiveIndex.test.mjs` | **PASS 4/4** |

## Smoke Detox save-set
- Comando: `npx detox test e2e/10-smoke-minimo-treino-persistencia.e2e.js --configuration android.attached.debug`
- Device: `ANDROID_SERIAL=RQ8T209ZTAF`, `DETOX_ADB_NAME=RQ8T209ZTAF`
- Resultado: **PASS** em **213.517s**
- Fluxo: onboarding → main tabs → screen-workout → peso 40 → reps 12 → save-set (XML `btn-save-set`)
- Observação: `set-saved-indicator` não visível no timeout (`smoke:set-saved=false`); save-set executado via bounds

## Modal beta (feedback)
- Fix `5b7a976`: telas críticas `screen-workout` / `WorkoutScreen` / `screen-treino` / `TreinoScreen` excluídas do prompt
- Durante smoke treino: **modal não interceptou** abertura de `screen-workout` nem save-set
- Ao sair do treino e tocar `btn_open_history`: modal **Feedback rapido** apareceu (tela `screen_treinos`); dispensado via tap 👍; histórico abriu em seguida

## Histórico / persistência (ADB pós-smoke, sem repetir keypad)
- Pós-smoke: BACK → `screen_treinos` (hub Treino)
- Scroll + tap `btn_open_history` @ (540, 1219)
- Histórico abriu: **SIM** (`Historico dos Ultimos 7 Dias`)
- Conteúdo local observado: `06/12 Agachamento Livre · 0kg x 1`
- Série esperada do smoke (40kg x 12): **não confirmada visualmente** no bloco "Historico de series (local)"
- Bloqueio específico: persistência visual divergente — save-set passou no fluxo de treino, mas histórico local exibe `0kg x 1` (possível log anterior/fixture ou mapping de apresentação; não revalidado via keypad)

## Logcat crash
- Detox transport disconnect nesta sessão: **não**
- Logcat crash P0/P1: **não coletado** (smoke PASS sem disconnect)

## XMLs locais (não versionados)
- `.qa_runtime/after_smoke_save_set.xml`
- `.qa_runtime/after_back_from_workout.xml`
- `.qa_runtime/treinos_hub_scrolled.xml`
- `.qa_runtime/history_screen_after_feedback.xml`

## Riscos restantes
- Histórico local não reflete 40×12 após smoke save-set
- Build release assinado depende de keystore local
- Import IA depende de backend
- Metro deve subir com flags QA locais; Metro sem flags causa `auth_required` no onboarding
- Modal beta ainda dispara ao sair de telas não-críticas (ex.: hub Treino → Histórico)

## Veredito
**PR criado. Smoke save-set PASS mantido. Histórico abre sem crash, mas persistência visual 40×12 não confirmada (dado local `0kg x 1`).** Regra saveSet/activeExerciseIndex não alterada.
