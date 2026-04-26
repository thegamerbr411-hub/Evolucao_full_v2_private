# Relatorio de Refatoracao Senior - 2026-04-26

## 1) Mapeamento da Estrutura (pastas principais)

### Mobile
- android
- assets
- e2e
- src
- __tests__
- mobile (novo modulo de entrada para separacao estrutural)

### Backend
- backend
- functions

### Dashboard
- dashboard

### QA/Automation
- qa
- scripts
- artifacts
- screenshots
- analysis
- _audit_release

### Suporte/infra
- docs
- .github
- dist
- dist_clean_project
- _export_zip

## 2) Limpeza Inicial de Scripts

### Scripts redundantes/duplicados identificados
- qa:smoke e test:auto executavam o mesmo fluxo base de teste-flow.
- Varias entradas detox/visual/stress coexistiam com sobreposicao funcional para uso diario de produto.

### Simplificacao aplicada no package.json raiz
- start: mantido para fluxo principal do app.
- android: mantido para fluxo principal Android.
- backend: adicionado para iniciar API essencial com npm --prefix backend run start.
- dashboard: adicionado para iniciar dashboard isoladamente.
- test:basic: adicionado para baseline minimo de qualidade.

### QA avancado marcado como opcional
- qa:optional:detox
- qa:optional:visual
- qa:optional:stress
- qa:optional:night

## 3) Separacao Logica

### Estrutura criada
- /mobile (novo modulo leve com scripts de entrada)
- /backend (ja existente e mantido)
- /dashboard (ja existente e mantido)

### Ajustes de caminhos
- Scripts raiz agora expõem fronteiras explicitas de execucao (backend/dashboard/test basico).
- /mobile recebeu package.json proprio para separar o entrypoint do app na organizacao do workspace.

## 4) Foco no App (onboarding -> home -> treino -> resultado)

### Fluxo validado por leitura de navegacao
- Onboarding: Questionario em RootNavigator.
- Home: MainTabs -> Home.
- Treino: MainTabs -> Treino (WorkoutsHubScreen) -> TreinoHoje (WorkoutScreen).
- Resultado: rota WorkoutCompleteScreen registrada.

### Pontos de risco encontrados
- Acoplamento funcional ainda presente entre AppContext-v2 e stores (coexistencia de camadas legadas e novas).
- Servicos do app ainda apontam para endpoints /api/* de infraestrutura QA/dashboard (workout/hydration/social/analytics/error).
- Testes com Node 24 exibem incompatibilidades preexistentes em caminhos que importam React Native e em firebase/auth.

## 5) Backend Essencial

### Rotas essenciais
- auth: validada e mantida.
- workouts: validada e corrigida (bug no delete usava variavel incorreta).
- nutrition: adicionada com endpoints essenciais:
  - POST /nutrition/logs
  - GET /nutrition/logs
  - GET /nutrition/summary

### Isolamento de endpoints QA
- Novo modulo backend/routes/qa.js.
- Exposicao controlada por flag ENABLE_QA_ENDPOINTS=1.
- Sem flag, QA fica fora da superficie principal da API.

## 6) Desacoplamento (app sem detox/QA server/AI scripts)

### Mudancas aplicadas
- src/utils/qaTransport.js agora e opt-in por EXPO_PUBLIC_ENABLE_QA_TRANSPORT.
- Com QA desabilitado (padrao), chamadas QA retornam skipped sem bloquear app.
- shouldInjectQaAppError tambem ficou condicionado ao QA habilitado.

### Resultado esperado
- App principal pode rodar sem servidor QA ativo.
- Falhas de observabilidade/QA nao interrompem o fluxo de produto.

## 7) Problemas Encontrados

1. Dependencia estrutural de servicos mobile em endpoints /api/* do dashboard QA.
2. Convivencia de arquitetura mista (Context legado + Zustand) aumenta risco de estado inconsistente.
3. Test baseline falha no ambiente atual por incompatibilidades preexistentes (Node 24 x React Native/Firebase), fora do escopo desta rodada de separacao.

## 8) Nova Arquitetura Sugerida (proxima etapa)

- /mobile: app React Native + camadas de dominio sem dependencia de QA runtime por padrao.
- /backend: API de produto (auth, workouts, nutrition, social, subscription) com contrato versionado.
- /dashboard: observabilidade e automacao QA isoladas, consumindo dados por integracao explicita.
- /qa: pipelines, relatórios e scripts de stress/soak sem acoplar runtime do app.

## 9) Melhorias Prioritarias

1. Introduzir ApiGatewayService no mobile com fallback por modulo (produto vs observabilidade), removendo dependencia direta de /api/* QA nos servicos de dominio.
2. Finalizar migracao para uma unica fonte de estado (Zustand), removendo superficie residual do contexto legado.
3. Fixar baseline de testes para Node 24 (compatibilidade Firebase/Auth e suites que importam React Native em runtime Node puro).
4. Separar CI em trilhas independentes: product-quality (mobile/backend) e qa-quality (dashboard/automation).
5. Evoluir backend nutrition para persistencia real (DB) e contratos de validacao (schema).
