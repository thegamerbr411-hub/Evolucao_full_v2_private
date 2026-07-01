# PR #53 Visual QA V5 — Gate D Auth Resume

| Field | Value |
|-------|-------|
| Device | emulator-5554 only |
| Package | com.tipolt.evolucaofullv2 |
| Date | 2026-07-01 |
| Verdict | **AUTH_ALREADY_LOGGED_IN** |

## Classification

- First dump: `AUTH_UNKNOWN_SCREEN` (transient empty/splash)
- Retry 1: `AUTH_ALREADY_LOGGED_IN`
- Signals: `tab-home`, `btn_home_main_cta`, `home_ready`, `Boa tarde`, `INICIAR TREINO` / `CONTINUAR TREINO`
- No login screen (`Entrar`, `Cadastrar`, `input_email`)

## Artifacts

- PNG/XML: `.qa_runtime/visual_audit/hevy_ux_lote_c_v5/00_auth_check.png`
- Manifest entry: `validForPass: true`, `authState: AUTH_ALREADY_LOGGED_IN`

## Notes

- `QA_TEST_EMAIL` / `QA_TEST_PASSWORD` not required (session preserved on emulator)
- APK install skipped on resume (`APK_INSTALL_SKIPPED_TO_PRESERVE_SESSION`)
- Partial workout in progress: home shows `CONTINUAR TREINO` / treino `Parcial`
