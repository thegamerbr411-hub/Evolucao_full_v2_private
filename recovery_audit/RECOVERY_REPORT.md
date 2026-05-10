# Recovery Audit - Evolucao App

## Objetivo
Recuperar e estabilizar o fluxo de autenticacao/navegacao com foco em:
- corrigir autenticacao
- destravar navegacao
- eliminar estados silenciosos
- melhorar observabilidade
- permitir auditoria completa

## Escopo implementado nesta rodada
1. Padronizacao de autenticacao em Firebase Auth no fluxo principal.
2. Sincronizacao de sessao Firebase com user store na hidratacao.
3. Recomputo seguro da rota inicial para evitar lock em estado antigo.
4. Validacao automatizada basica e coleta de logs de execucao disponiveis.

## Mudancas de codigo aplicadas
- `src/screens/RegisterScreen.js`
  - cadastro com `createUserWithEmailAndPassword`.
  - login com `signInWithEmailAndPassword`.
  - envio de verificacao por e-mail com `sendEmailVerification` (nao bloqueante para entrar).
  - erros mapeados por codigo Firebase com mensagens claras.
  - retry automatico para falhas transientes.
  - logs estruturados de auth (`[AUTH_FLOW]`).
  - navegacao de sucesso para `MainTabs`.

- `src/context/AppContext-v2.ts`
  - bootstrap de sessao pelo `auth.currentUser` durante hidratacao.
  - listener `onAuthStateChanged` para manter `useUserStore` sincronizado.
  - fallback para `logout` quando sessao Firebase encerra.

- `src/navigation/RootNavigator.js`
  - `key` dinamica no navigator para reavaliar `initialRouteName` quando estado de conta/onboarding muda.

## Evidencias coletadas
- teste basico backend/local:
  - `recovery_audit/logs/test_basic_output.txt`
- boot de Metro dev-client:
  - `recovery_audit/logs/metro_devclient_output.txt`
- tentativa de coleta logcat/device:
  - `recovery_audit/logs/adb_runtime_attempt.txt`

## Resultado de validacao
- Validacao de arquivo (errors tool): sem erros nos 3 arquivos alterados.
- `npm run test:basic`: OK.
- `npm run start:dev-client`: inicializado e confirmado fallback de porta para 8082.
- Coleta ADB/logcat: bloqueada por ausencia de `adb` no PATH desta sessao.

## Riscos residuais
1. Sem logcat do dispositivo nesta sessao, ainda falta evidencia runtime Android apos login/cadastro em hardware real.
2. Fluxos secundarios que usem auth por servicos legados JS/TS duplicados ainda merecem consolidacao futura.
3. Backend `/auth/send-code` segue fora do caminho principal, mas ainda pode existir codigo legado chamando essa rota em outros pontos.

## Status
- Auth principal: estabilizado em Firebase.
- Restauracao de sessao: implementada.
- Navegacao pos-auth: destravada no fluxo principal.
- Observabilidade auth: melhorada.
- Auditoria: parcialmente completa, pendente de evidencias ADB/device apos ajuste de ambiente.
