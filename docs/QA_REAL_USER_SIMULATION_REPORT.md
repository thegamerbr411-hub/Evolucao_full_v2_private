# QA Real User Simulation Report

Data: 2026-04-11
Projeto: Evolucao_full_v2

## Objetivo
Validar comportamento de usuario real em fluxos de treino, nutricao, hidratacao, coach, ranking, social, paywall, historico, falhas e sincronizacao.

## Suite adicionada
- __tests__/humanRealUsage.fullstack.test.mjs
- __tests__/fixtures/humanSimulationProfiles.mjs

## Cenarios simulados
- onboarding + login admin/token cliente
- treino pesado
- treino leve
- treino com descanso curto
- treino incompleto
- treino abandonado
- treino com exercicio novo (nao mapeado)
- treino com variacao de volume/intensidade
- hidratacao com virada de dia/timezone
- alimentacao com itens conhecidos e desconhecidos
- coach reagindo a consistencia e hidracao
- ranking + social + desafio
- validacao de paywall (free x premium)
- falha simulada de backend + replay manual de sync
- analise/growth via analyze-batch + insights + learning summary

## Resultado de execucao
Comando executado:
- npm run test:all
- npm run qa:stress:ux:10m
- npm run qa:prod:check

Status geral:
- PASSOU: suite node (__tests__), dashboard API tests, smoke flow
- PASSOU: stress UX de 10 minutos (295 ciclos, 0 falhas)
- PASSOU: validacao de producao (ok=true, sem erros bloqueantes)
- FALHOU: nenhum teste no ciclo executado

Observacoes:
- A suite adicionada passou integralmente.
- Simulacao Detox continua (sim:loop) ficou bloqueada por alvo Android instavel/ausente (estado "waiting for device").
- O script scripts/user-simulation-loop.js foi endurecido para detectar ausencia de alvo e evitar travamento em loops futuros.

## Arquivos alterados
- package.json
- auto-run.ps1
- __tests__/fixtures/humanSimulationProfiles.mjs
- __tests__/humanRealUsage.fullstack.test.mjs
- scripts/user-simulation-loop.js
- docs/QA_REAL_USER_SIMULATION_REPORT.md

## O que ainda falta para cobertura 100% operacional de dispositivo
- Rodar suites Detox no Android alvo (emulador/device estavel)
- Coletar relatorio de falhas visuais e flakiness por dispositivo

## Artefatos gerados
- artifacts/production-check.json

## Comandos operacionais
- Metro: npx react-native start --reset-cache
- App: npx react-native run-android
- Automacao loop: powershell -ExecutionPolicy Bypass -File auto-run.ps1
