# Checklist de Lancamento - Evolucao Full V2

## Build e Versao

- [x] Versao do app visivel na UI (Perfil mostra v1.0.3).
- [x] Versionamento atualizado em app.json.
- [x] Build Android release validado localmente.
- [x] Gerar AAB para Play Console (bundleRelease).

## Backend e Producao

- [x] Sem localhost como fallback em producao para API principal.
- [x] Endpoints de treino por usuario ativos:
  - POST /api/workouts
  - GET /api/workouts
  - GET /api/workouts/:id
  - GET /api/stats
  - GET /api/streak
  - GET /api/ranking
  - GET /api/leaderboard
  - GET /api/me/stats
  - GET /api/coach/insight
- [x] UserId obrigatorio nos dados de treino.
- [x] Seguranca basica por x-api-key (APP_API_KEY) para endpoints de app.
- [x] Validacao automatizada de producao (`npm run qa:prod:check`) com relatorio em `artifacts/production-check.json`.
- [ ] Rotacionar segredos fracos em producao (`ADMIN_PASS`, `JWT_SECRET`, `CLIENT_API_KEYS`, `APP_API_KEY`).

## Admin Dashboard

- [x] Login admin emite token admin e token client corretamente.
- [x] Dashboard usa /token/client apos /login (corrige acesso negado em producao).
- [x] Endpoint de diagnostico de env admin:
  - GET /api/admin/env-check
- [x] Render config ajustado para CLIENT_API_KEYS em formato JSON valido.

## App e UX

- [x] UserId persistente por usuario/sessao com fallback local.
- [x] Login com Google implementado (fallback local seguro quando OAuth nao estiver configurado).
- [x] Salvamento de treino com fallback offline.
- [x] Sincronizacao automatica de pendencias quando online.
- [x] Estados de loading/sincronizacao ao finalizar treino.
- [x] Historico real carregado do backend com detalhe por treino.
- [x] Insights com evolucao real, streak e ranking.
- [x] Logs de erro com screen, action, message, userId e version.

## Config de Auth Social

- [ ] Definir EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID no ambiente de build.
- [ ] Definir EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID no ambiente de build.
- [ ] Definir EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID no ambiente de build.

## Notificacoes

- [x] Inicializacao de notificacoes ativada com fallback seguro.
- [x] Agendamento de notificacoes inteligentes habilitado quando permissao existir.

## Publicacao Play Store

- [ ] Revisar nome final de exibicao do app.
- [ ] Revisar icone final e splash final para identidade de marca.
- [ ] Revisar textos legais (privacidade/termos) na pagina da loja.
- [ ] Rodar checklist de conteudo da Play Console.

## Validacoes executadas

- [x] npm run test:all
- [x] npm --prefix dashboard test
- [x] build release APK (assembleRelease)
- [x] build release AAB (bundleRelease)
- [x] npm run qa:prod:check
