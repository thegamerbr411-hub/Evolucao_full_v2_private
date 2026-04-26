# Auto-debug executado em E2E 14 (17-04-2026)

## Erro inicial observado
- Timeout em `replaceInput` para `input-peso-atual` no onboarding (`not null`).

## Correcoes aplicadas
1. `e2e/helpers/flows.js`
- Adicionado `detectStage()` para identificar `questionnaire-screen` vs `screen-home`.
- Introduzido `fillFieldIfVisible()` para preencher campos somente quando visiveis.
- Aplicado fallback pos-submit para tentar reenvio do formulario quando a tela nao sai do onboarding.

2. `e2e/helpers/flows.js`
- Corrigida chamada de `scrollToElement` com assinatura correta (`direction`, `amount`, `attempts`).

## Revalidacoes executadas
- Miplas execucoes: `npx detox test --configuration android.emulator.debug --cleanup -- --runTestsByPath e2e/14-full-visual-functional.e2e.js`
- Resultado: fluxo progrediu alem de falhas anteriores, mas permaneceu falha residual na transicao para home/launch detection.

## Estado final
- Sem erro sintatico nos patches (`node --check e2e/helpers/flows.js`).
- Falha residual bloqueia conclusao do bloco global e do loop controlado.
