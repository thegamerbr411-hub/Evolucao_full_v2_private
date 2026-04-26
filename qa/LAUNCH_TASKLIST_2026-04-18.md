# Launch Tasklist - 2026-04-18

## Status atual (atualizado 2026-04-23)

- Unit/integration suite local: PASS (14 testes subscriptionContract + suite geral com fail 0).
- P0 bloqueadores: todos resolvidos.
- P1 high-impact: endurecido com gate attached-strict, baseline SLO e budget para rollback.
- P2 operacao: consolidacao de _audit_release, runbook operacional e smoke de backend para attached implementados.
- Veredito: pronto para beta fechado e pre-release tecnico; release publica ainda requer execucao fisica do attached-strict 5x em device USB.

## P0 (bloqueia release)

1. [DONE 2026-04-23] Remover fallback de autenticacao Google para IDs pseudo.

- Evidencia: src/services/authService.js:35
- Evidencia: src/services/authService.js:115
- Risco: usuario entra em estado "logado" sem identidade confiavel (integridade e seguranca).
- Criterio de pronto:
- sem idToken: login deve falhar explicitamente.
- sem backend/Firebase valido: sem criacao de usuario pseudo.
- teste cobrindo fluxo invalido + mensagem de erro.

1. [DONE 2026-04-23] Eliminar no-op/stub no dominio principal do AppContext.

- Evidencia: src/context/AppContext-v2.ts:576
- Evidencia: src/context/AppContext-v2.ts:629
- Evidencia: src/context/AppContext-v2.ts:630
- Risco: metricas e recomendacoes podem parecer "ok" sem logica real.
- Criterio de pronto:
- getRecommendedWorkoutV4 implementado ou removido da API publica.
- prepareTodayWorkoutTargets implementado com efeito observavel.
- computeProductMetrics ligado ao pipeline de eventos/dados reais.

1. [DONE 2026-04-23] Endurecer smokes attached sem linguagem best effort.

- Evidencia: e2e/16-treino-tab-smoke.e2e.js:78
- Evidencia: e2e/17-social-tab-smoke.e2e.js:78
- Risco: cobertura verde com navegacao parcial.
- Criterio de pronto:
- sem comentarios/ramificacoes best effort para caminho principal.
- falha dura em ausencia de tab alvo.
- anexar screenshots obrigatorias por etapa.

1. [DONE 2026-04-23] Remover modo safe minimal do auditor visual 18 ou tirar do gate oficial.

- Evidencia: e2e/18-visual-map-audit.e2e.js:107
- Evidencia: e2e/18-visual-map-audit.e2e.js:68
- Risco: execucao "passa" com interacoes puladas.
- Criterio de pronto:
- modo oficial de release nao aceita skip-interactions.
- report com coverage de telas/acoes 100%.

1. [DONE 2026-04-23] Migrar paywall para estado de assinatura verificavel por backend/store.

- Evidencia: src/screens/PaywallScreen.js:149
- Evidencia: src/screens/PaywallScreen.js:176
- Evidencia: src/context/subscription/subscriptionService.js:84
- Risco: cliente ativa PRO local sem validacao de compra.
- Criterio de pronto:
- activateProPlan condicionado a recibo/token valido.
- sincronizacao de entitlement no backend.
- expiracao e revogacao refletidas no app.

## P1 (alto impacto)

1. [DONE CODIGO 2026-04-23 | VALIDACAO FISICA PENDENTE] Fechar estabilidade do crawler estrito 14 em attached.

- Evidencia: e2e/14-full-visual-functional.e2e.js
- Evidencia: scripts/qa-global-audit-loop.ps1:174
- Criterio de pronto:
- 5 ciclos seguidos no attached sem timeout.
- coverage.overallPercent=100 e missingActions=0.

1. [DONE 2026-04-23] Reduzir superficie de best effort em helpers de fluxo.

- Evidencia: e2e/helpers/flows.js:303
- Evidencia: e2e/helpers/flows.js:380
- Evidencia: e2e/helpers/flows.js:1061
- Criterio de pronto:
- helper principal com comportamento deterministico para release profile.

1. [DONE 2026-04-23] Adicionar suite de contrato para paywall/subscription.

- Alvos:
- src/screens/PaywallScreen.js
- src/context/subscription/subscriptionService.js
- Criterio de pronto:
- testes cobrindo trial, expiracao, pro ativo e feature gating por entitlement real.

1. [DONE 2026-04-23] Definir baseline de observabilidade de erro para mobile.

- Evidencia: uso de log de erro existe, mas sem SLO definido para go-live.
- Criterio de pronto:
- dashboard com taxa de erro por sessao.
- budget de erro para rollback automatizado.

## P2 (qualidade e operacao)

1. [DONE 2026-04-23] Consolidar duplicidade de codigo em _audit_release para evitar drift.

- Evidencia: arvore duplicada de src/e2e/backend em _audit_release.
- Criterio de pronto:
- fonte unica de verdade ou processo de sync validado por CI.

1. [DONE 2026-04-23] Publicar runbook unico de operacao continua.

- Criterio de pronto:
- comando unico para ciclo continuo.
- comando unico para auditoria global.
- saida padronizada em qa/*.json + qa/*.md.

1. [DONE 2026-04-23] Adicionar smoke de boot de backend antes de E2E attached.

- Evidencia: backend/server.js:13
- Evidencia: backend/server.js:43
- Criterio de pronto:
- healthcheck obrigatorio antes do run Detox.

## Comandos recomendados de operacao continua

- ciclo continuo geral:
- npm run continuous:runner

- auditoria global hard gate (rapida):
- npm run qa:global:audit:quick

- auditoria global hard gate (padrao):
- npm run qa:global:audit

- auditoria attached estrita (crawler 14, 5x):
- npm run qa:global:audit:attached:strict

- baseline de observabilidade mobile:
- npm run qa:mobile:observability

- budget de erro com rollback automatico:
- npm run rollback:auto:slo

- sincronizacao e validacao _audit_release:
- npm run audit:release:sync
- npm run audit:release:check

- loop detox attached:
- npm run detox:loop
