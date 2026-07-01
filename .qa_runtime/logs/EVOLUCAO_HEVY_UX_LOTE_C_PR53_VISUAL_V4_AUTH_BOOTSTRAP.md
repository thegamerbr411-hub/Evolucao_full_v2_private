# EVOLUÇÃO — PR53 Visual V4 Auth Bootstrap

## Device
- Sandbox: emulator-5554 ONLY
- Real device RQ8T209ZTAF: não usado destrutivamente

## Auth state detectado
- **AUTH_LOGIN_SCREEN_DETECTED** (textos: Entrar, Cadastrar, E-mail, Senha, Entre com e-mail...)
- Após APK install, dumps UiAutomator parcialmente vazios em alguns retries; classificação final via credenciais ausentes + textos visíveis

## Env credentials
- QA_TEST_EMAIL: MISSING (shell e dotenv .env/.env.local/.env.qa)
- QA_TEST_PASSWORD: MISSING

## Manual login
- Necessário no emulator-5554 antes de continuar visual QA

## Secret handling
- Logs mascarados no script V4
- AUTH_REQUIRED doc criado sem segredos

## Resultado
- **EVOLUCAO_HEVY_UX_LOTE_C_PR53_AUTH_REQUIRED_FOR_VISUAL_QA**
- Script exit code 20
- Capturas: `.qa_runtime/visual_audit/hevy_ux_lote_c_v4/00_auth_check.*`

## Próximo comando após login manual
```
Remove-Item Env:ANDROID_SERIAL -ErrorAction SilentlyContinue
node .qa_runtime/scripts/hevy_ux_lote_c_sandbox_v4.cjs --resume-after-login
```
