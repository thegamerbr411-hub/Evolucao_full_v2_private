# EVOLUÇÃO — Auth Required For PR53 Visual QA
## Situação
O emulator-5554 está na tela de login e não há QA_TEST_EMAIL / QA_TEST_PASSWORD no processo.
## O que fazer
Fazer login manual somente no emulator-5554.
## Proibições
- Não usar device real
- Não expor senha em logs
- Não commitar .env
- Não fazer pm clear depois do login
## Depois do login
Rodar:
node .qa_runtime/scripts/hevy_ux_lote_c_sandbox_v4.cjs --resume-after-login
