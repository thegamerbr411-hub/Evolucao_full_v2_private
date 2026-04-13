# INTEGRATION_REPORT

## Resultado Geral
- Google login: ERRO (configuracao externa incompleta)
- Backend conexao: OK
- Firebase: ERRO (arquivo/config nativa ausente)
- Fluxo completo (simulado): OK

## Validacoes Executadas
- Backend validado em runtime com JWT_SECRET definido na sessao:
  - GET /health => ok=true
  - POST /auth/google => accessToken + user
  - POST /sync com Bearer token => ok=true
  - POST /workouts => success=true, xp calculado
  - POST /ranking/add-xp => success=true
  - POST /social/feed => success=true
  - GET /ranking => ranking atualizado
  - GET /social/feed => feed com item novo
- Testes do projeto executados com npm test: todos os testes passaram.
- Cenarios de erro autenticacao validados:
  - /sync sem token => 401
  - /sync com token invalido => 401

## Problemas Encontrados
1. API mobile com fallback para localhost
- Encontrado fallback local em src/services/api.ts.
- Impacto: app em producao podia tentar localhost e falhar rede.

2. Fluxo Google sem backend-first no caminho principal da UI
- login em src/services/authService.js priorizava Firebase/fallback local.
- Impacto: token JWT do backend nao era garantido para /sync, /workouts, social e ranking.

3. Captura de idToken incompleta
- Fluxo considerava so response.authentication.idToken.
- Impacto: alguns retornos do Expo trazem id_token em response.params.id_token.

4. Segredo JWT com fallback hardcoded no backend
- backend/middleware/auth.js tinha fallback literal.
- Impacto: risco de seguranca e inconsistencias entre ambientes.

5. Firebase Android nativo ausente
- google-services.json nao existe no workspace.
- android/app/build.gradle nao aplica plugin Google Services.
- Impacto: integracao nativa Firebase/Google Sign-In nao fecha sem esses itens.

## Correcoes Aplicadas
1. Base URL da API corrigida para producao
- Arquivo: src/services/api.ts
- Ajustes:
  - Removido fallback localhost.
  - Prioridade de variaveis: EXPO_PUBLIC_API_URL -> EXPO_PUBLIC_API_BASE_URL -> API_URL -> https://evolucao-api-dou2.onrender.com
  - Sanitizacao de barra final.
  - Logs temporarios adicionados:
    - [INTEGRATION][API][REQUEST]
    - [INTEGRATION][API][RESPONSE]
    - [INTEGRATION][API][ERROR]

2. Google login backend-first implementado
- Arquivo: src/services/authService.js
- Ajustes:
  - Fluxo agora: promptAsync -> idToken -> POST /auth/google.
  - Persistencia de accessToken/refreshToken no useAuthStore.
  - setUser no useAuthStore ao concluir login backend.
  - Fallback para Firebase mantido apenas como resiliencia.
  - Logs temporarios adicionados no login.

3. Suporte oficial a EXPO_PUBLIC_GOOGLE_CLIENT_ID
- Arquivos:
  - src/services/authService.js
  - src/services/authService.ts
  - src/screens/ProfileScreen.js
  - .env.example
- Ajustes:
  - EXPO_PUBLIC_GOOGLE_CLIENT_ID aceito como shared client id.
  - Mantida compatibilidade com variaveis separadas Android/Expo/iOS.
  - Mensagem de tela atualizada para refletir ambas as opcoes.

4. Captura robusta de idToken
- Arquivos:
  - src/screens/ProfileScreen.js
  - src/hooks/useAuth.ts
- Ajustes:
  - idToken agora vem de authentication.idToken OU params.id_token.

5. JWT_SECRET sem hardcode
- Arquivo: backend/middleware/auth.js
- Ajustes:
  - Removido fallback literal.
  - Se JWT_SECRET nao estiver definido: erro 500 explicito em rotas protegidas e erro claro na geracao de token.

6. Fluxo social alinhado aos endpoints reais do backend
- Arquivo: src/features/social/socialApiClient.ts
- Ajustes:
  - Trocado uso de endpoints inexistentes por endpoints reais:
    - POST /ranking/add-xp
    - POST /social/feed
    - GET /ranking
    - GET /social/feed
  - Normalizacao de payload para ranking/feed do store.

## Variaveis de Ambiente Conferidas
- EXPO_PUBLIC_GOOGLE_CLIENT_ID: agora suportada e utilizada no auth session.
- API_URL: agora suportada como fallback no app (alem de EXPO_PUBLIC_API_URL e EXPO_PUBLIC_API_BASE_URL).
- JWT_SECRET (backend): obrigatoria para rotas protegidas e geracao de JWT.
- Hardcode removido do segredo JWT no backend.

## Pendencias Externas (acao manual necessaria)
1. Configurar credenciais Google OAuth validas
- O valor informado "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" nao tem formato de OAuth Client ID para Expo (esperado: *.apps.googleusercontent.com).
- Necessario definir EXPO_PUBLIC_GOOGLE_CLIENT_ID valido (ou os 3 client IDs por plataforma).

2. Firebase Android nativo (se for requisito do produto)
- Adicionar arquivo android/app/google-services.json.
- Aplicar plugin Google Services no Gradle Android.
- Garantir Google Auth habilitado no Firebase Console.

## Status Final
- Backend conectado e respondendo: OK
- API respondendo e fluxo ponta a ponta simulado: OK
- Sync, XP, ranking e feed: OK
- Login Google real em producao depende de credencial OAuth valida (pendencia externa)
