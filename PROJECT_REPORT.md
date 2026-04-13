# PROJECT_REPORT

Data da auditoria: 2026-04-12
Escopo: frontend Expo/React Native, backend Express, testes Node e pacote para auditoria externa.

## VISAO GERAL

O app Evolucao e um produto fitness com foco em:

- treino (registro de exercicios, series, carga, RPE)
- nutricao e hidratacao
- coach contextual
- social (ranking, desafios)
- observabilidade QA (dashboard + artifacts)
- operacao offline com sincronizacao

## ARQUITETURA


### Camadas principais
- App mobile: `App.js` + navegacao em `src/navigation`
- Estado global legado: `src/context/AppContext.js` via `RootProvider`
- Estado novo (modular): stores Zustand em `src/stores/*.ts`
- Servicos mobile: `src/services/*`
- Storage local/offline: `src/storage/*`
- Backend simples de dominio: `backend/*`
- Backend QA/dashboard separado: `dashboard/*`


### Topologia de backend
- API backend (porta 3000): `/auth`, `/workouts`, `/sync`, `/social`, `/ranking`, `/health`
- API dashboard QA (porta 3000 no contexto de testes de integracao): `/api/*` para bugs/eventos/retest


### Diagnostico de acoplamento
- Coexistem duas arquiteturas de estado: Context API legado e Zustand (nova).
- Coexistem implementacoes duplicadas em JS/TS para alguns modulos (`authService`, `workoutService`, `coachEngine`, `useCoach`, `CoachCard`, `PrimaryButton`).
- Parte TS esta implementada, mas ainda nao e a fonte unica de verdade da UI principal.

## FLUXO DE DADOS


### Fluxo principal user -> treino -> backend -> sync
1. Usuario interage em telas (`src/screens/*`).
2. Dados de treino sao salvos localmente (MMKV/servicos locais).
3. Operacoes de escrita entram na fila (`src/storage/syncQueue.ts`) quando necessario.
4. `syncEngine.ts` tenta enviar para `/sync`.
5. Backend valida JWT e responde; app atualiza estado local.
6. Dashboard QA coleta eventos e erros em paralelo (fluxo de observabilidade).

## FUNCIONALIDADES


### Implementadas
- Navegacao base e tabs
- Registro de treino e historico
- Nutricao/hidratacao
- Coach chat/contextual
- Ranking e desafios (backend QA e backend simples)
- Notificacoes
- Auth Google/Firebase (fluxo JS) e auth JWT backend
- Modo offline + fila + sync
- Testes unitarios/integracao em `__tests__`


### Implementadas mas nao integradas 100% na UI principal
- Componentes TS de onboarding/challenges/upgrade modal
- Parte das stores Zustand TS
- Fluxo TS de auth/hook ainda nao e caminho principal da UI

## O QUE ESTA FUNCIONANDO (VALIDADO)


### Testes automatizados
Comando executado: `npm test`
Resultado: OK apos correcoes (todas as suites passando)

Revalidacao final desta rodada:
- `npm run test:all` => OK (`[test-runner] ok`, `api-test:ok`, `test-flow:ok`).


### Backend runtime
Backend iniciado localmente com sucesso apos fix em `backend/package.json`.

Checks executados:
- `GET /health` => 200 OK
- `POST /auth/refresh` => responde (fluxo ativo)
- `GET /workouts` => 401 sem token (esperado)
- `POST /sync` => 401 sem token (esperado)
- `GET /social/feed` => 401 sem token (esperado)
- `GET /ranking` => 200 OK

Revalidacao final desta rodada:
- `npm install` em `backend/` executado com sucesso.
- `npm start` em `backend/` executado com sucesso (`Servidor rodando em http://localhost:3000`).
- `GET http://localhost:3000/health` => 200 OK (confirmado em runtime real).


### Frontend boot
Comando executado: `CI=1 npx expo start --offline`
- Primeiro falhou por dependencia TS faltando.
- Corrigido com `npx expo install typescript @types/react`.
- Depois inicializou Metro e ficou aguardando em `http://localhost:8081`.


### Smoke QA
Comando executado: `npm run qa:smoke`

Resultado validado:
- `health`, `api/log`, `api/events`, `api/heatmap`, `api/apply-fix` e `api/insights` responderam com sucesso.
- Execucao concluiu com `test-flow:ok`.


### Production check
Comando executado: `npm run qa:prod:check`

Resultado validado:
- `ok=true`, `errors=0`, `warnings=7`.
- Warnings principais: variaveis de ambiente locais nao definidas (`JWT_SECRET`, `CLIENT_API_KEYS`), segredo fraco em valores padrao de deploy e `redis_not_configured` (opcional dependendo da estrategia de cache).


### Detox build/test (rodada final)
Comandos executados:
- `npm run detox:build`
- `npm run detox:test`

Resultado validado:
- `detox:build` = OK (BUILD SUCCESSFUL) apos instalar dependencias ausentes `zustand` e `expo-secure-store`.
- `detox:test` = NAO EXECUTOU CENARIOS por bloqueio de ambiente local: emulador Android x86_64 sem aceleracao de hardware habilitada no Windows (hypervisor driver ausente).

Correcao aplicada na configuracao para reduzir falsos negativos:
- `.detoxrc.js`: default de AVD ajustado para `Detox_API_34`.
- `e2e/jest.config.js`: ignorado `_audit_release/` e `dist_clean_project/` para evitar colisao de haste map.

## O QUE NAO ESTA 100%

1. Arquitetura hibrida (Context + Zustand) gera risco de divergencia de estado.
2. Modulos duplicados JS/TS sem consolidacao definitiva.
3. Features TS novas (onboarding/challenges/paywall) ainda nao sao fluxo principal em todas as telas JS.
4. Auth possui dois caminhos (JS Firebase e TS JWT helper), exigindo padronizacao final.
5. Ainda existem muitos arquivos/documentos de entrega no root; para auditoria externa foi criado pacote limpo.

## PROBLEMAS ENCONTRADOS E CORRIGIDOS NESTA AUDITORIA


### Correcoes aplicadas
1. `src/services/rankingService.js`
- Problema: teste importava exports inexistentes.
- Correcao: exportados `calculateUserScore` e `sortRanking`.

2. `backend/package.json`
- Problema: JSON invalido (comentario no topo) impedia `npm start`.
- Correcao: removido comentario, backend voltou a iniciar.

3. Imports com alias nao resolvido em TS
- Problema: uso de `@/` sem resolver configurado no Babel/Metro.
- Correcao: convertido para imports relativos em modulos TS alterados.
- Arquivos ajustados:
  - `src/hooks/useAuth.ts`
  - `src/services/api.ts`
  - `src/services/authService.ts`
  - `src/services/notificationService.ts`
  - `src/storage/syncEngine.ts`
  - `src/components/ExerciseSetCard.tsx`
  - `src/components/ChallengeCard.tsx`
  - `src/features/onboarding/OnboardingScreen.tsx`
  - `src/features/coach/useCoach.ts`
  - `src/services/workoutService.ts`

4. `src/services/authService.ts`
- Problema: bug de fluxo (`promptAsync` fora de escopo) e declaracao duplicada durante ajuste.
- Correcao: fluxo corrigido para receber `googleIdToken`; duplicacao removida; `useGoogleAuth` alinhado.

5. Dependencias de boot TS
- Problema: Expo recusava iniciar sem `typescript` e `@types/react`.
- Correcao: dependencias instaladas no projeto.

6. Dependencias faltantes para bundling Android/Detox
- Problema: bundling falhou por modulos ausentes (`zustand` e `expo-secure-store`).
- Correcao: dependencias instaladas e build Detox revalidado com sucesso.

## RISCOS

1. Divergencia de estado entre Context e Zustand.
2. Codigo duplicado JS/TS pode criar regressao por manutencao em lugar errado.
3. Fluxo de autenticacao ainda disperso (necessita consolidacao de fonte unica).
4. Grande volume de artefatos e docs no root pode confundir auditor externo (mitigado com zip limpo).
5. Sem pipeline CI unico consolidado para Expo build + backend + dashboard em uma so execucao.
6. `backend/npm install` reportou 3 vulnerabilidades altas em dependencias transientes (recomendada tratativa dedicada com `npm audit` e validacao de impacto antes de `npm audit fix --force`).

## PRONTO PARA PRODUCAO?

NAO (ainda).

Justificativa objetiva:
- O core funcional esta operacional e testado.
- Porem a base ainda esta em transicao arquitetural (Context + Zustand + duplicidades JS/TS).
- O build Android para E2E esta validado, mas a execucao Detox em emulador local depende de aceleracao de hardware habilitada na maquina.
- Para lancamento real com risco controlado, recomenda-se 1 sprint curto de consolidacao:
  - definir fonte unica de estado
  - eliminar duplicatas nao utilizadas
  - unificar auth path
  - fechar smoke e2e mobile/device em pipeline CI (ou usar device fisico/runner com aceleracao)

## PACOTE EXTERNO PARA AUDITORIA

Arquivo gerado:
- `Evolucao_audit_ready_2026-04-12.zip`

Tamanho final:
- ~61.6 MB (dentro da faixa alvo 50-300 MB)

Conteudo incluído:
- `src/`
- `backend/`
- `assets/`
- `e2e/`
- `__tests__/`
- `android/` (sem builds/caches)
- `dashboard/` (sem node_modules/test-results)
- configs essenciais (`package.json`, `app.json`, `.env.example`, etc)

Conteudo removido do pacote:
- `node_modules`
- builds/caches Android
- logs e artefatos pesados desnecessarios




