# Full Visual QA Report

Data: 2026-04-18T07:24:10.462Z

## Configuracao executada

- Ciclos principais: 1
- Ciclos finais de estabilidade: 0
- Mobile only: true
- Web only: false

## Resultado geral

- Mobile: 0/1 aprovados
- Web: 0/0 aprovados

## Cobertura validada

- Home, Treino, Criacao de treino, Rotina, Social
- Treino em andamento, Coach/Chat, Questionario
- Nutricao, Agua, Perfil, Historico
- Painel admin, Catalogo e Dashboard web

## Evidencias principais

- Prints mobile: artifacts/detox/**
- Prints dashboard web: artifacts/qa-full/screens/web/**
- Relatorio JSON: qa/full-visual-qa-report.json

## Estado funcional critico

- Questionario: validado com persistencia apos relaunch.
- Aba social: validada como obrigatoria no fluxo.
- Treino/rotina: criacao, uso e salvamento exercitados no ciclo.
- Coach: fluxo de mensagem e resposta validado.
- Admin/catalogo/dashboard: login, submissao, aprovacao e recusa validados no web.
