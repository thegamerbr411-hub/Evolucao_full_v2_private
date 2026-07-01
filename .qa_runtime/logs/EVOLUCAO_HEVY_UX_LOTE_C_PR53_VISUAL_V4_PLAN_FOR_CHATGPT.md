# EVOLUÇÃO — PR53 Hevy UX Lote C Visual QA V4 Plan

## 1. Estado do PR #53
- PR #53 Draft — feat(workout): Hevy UX Lote C session summary
- Veredito alvo deste ciclo: auth bootstrap + resume capture + ready gate

## 2. Source of truth confirmado
- EVOLUCAO_PAYWALL_ADDITIONAL_CLOSURE_POST_ARCHIVE_ARCHIVE_COMPLETE
- Archive SHA256: 0AA902AB31D9A28933C718E967A3728D5263B0AE124EDC4E2D6C2DB76A7E5735

## 3. Branch/commit atual
- Branch: feat/hevy-ux-lote-c-session-summary
- Commit before V4: 1beafd3
- Main base: 19cc195fb49add888370174bfe7cba4e02c86010

## 4. WIP local preservado
- Patches em `.qa_runtime/patches/PR53_READY_GATE_V3_WIP_*`

## 5. Commit 1beafd3 preservado
- Sim — não resetado

## 6. Ferramentas CLI
- git 2.51.2, gh 2.94.0, node v26.1.0, npm 11.13.0, adb 1.0.41, PowerShell 5.1

## 7–9. Recursos Cursor / MCPs / extensões
- Global search, diff viewer, Markdown/PNG preview, PowerShell terminal, Git integration, GitHub CLI, ADB, uiautomator, Node .cjs, Compress-Archive, Get-FileHash
- MCPs disponíveis: Notion, Stripe, Linear, Sentry, Figma, Slack, Render, Firebase, Playwright
- Nenhuma instalação adicional necessária

## 10. Causa provável falha V3
- `--fresh-sandbox` executou pm clear → sessão perdida
- QA_TEST_EMAIL/PASSWORD ausentes no processo Node
- Script continuou para completeAllSets em tela de login

## 11. Estratégia auth bootstrap
- Step 00_auth_check → classifyAuthState → env/.env.local/.env.qa → manual login

## 12. Segredos
- Logs mascarados; nunca imprimir senha/email completo; não commitar .env

## 13. Sem pm clear por padrão
- `--fresh-sandbox` bloqueado com FRESH_SANDBOX_BLOCKED_TO_PRESERVE_AUTH_SESSION

## 14. Estabilizar emulator-5554
- wake/unlock, force-stop, reverse 8081, install APK, monkey launch — sem pm clear

## 15–17. Visual QA V4
- Script: `.qa_runtime/scripts/hevy_ux_lote_c_sandbox_v4.cjs`
- Flags: `--resume-after-login`, `--resume-capture-only`, `--manual-assist-wait`
- Manual assist + resume-capture-only como fallback

## 18. Audit drift
- npm run audit:release:check → drift=0 PASS

## 19. Testes
- Lote C + regressões afetadas (workoutFinishFlow pré-existente falha RN import)

## 20. Build
- APK anterior válido: C:\detox-bin\app-debug.apk SHA256 0BC8AF9533EDBF35165610DD806144C226C123265AF3F824AFB959B4C78A7067
- Rebuild não necessário (sem patch de produto)

## 21. PR ready gate
- gh pr ready 53 somente se visual PASS + todos gates

## 22. Critérios PASS
- screen-workout-complete + summary card/stats/CTAs/Histórico no emulator-5554

## 23. Manter Draft
- Auth pendente ou visual parcial

## 24. AUTH_REQUIRED
- Login screen + credenciais ausentes

## 25. Bloqueio
- git/audit/tests/build/product bug

## 26. Próximo passo humano
- Login manual no emulator-5554 OU set QA_TEST_EMAIL/PASSWORD localmente, depois `--resume-after-login`
