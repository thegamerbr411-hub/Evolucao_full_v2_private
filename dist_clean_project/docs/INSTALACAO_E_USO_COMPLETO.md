INSTALACAO E USO COMPLETO - EVOLUCAO FULL V2

1. VISAO GERAL

Para funcionar 100%:
- APK instalado no celular
- Backend QA (dashboard/API) rodando
- Variaveis de ambiente corretas
- Login com token quando acessar endpoints protegidos
- Rede local funcionando (celular e PC na mesma rede)

2. INSTALAR O APK NO CELULAR

- Android > Configuracoes > Seguranca/Privacidade
- Habilitar instalacao de apps desconhecidos
- Instalar preferencialmente `build-output/app-release.apk`

3. ABRIR O APP

- Abrir "Evolucao Full V2"
- Aguardar carregamento
- Completar onboarding no primeiro uso
- Fazer login quando o fluxo exigir autenticacao

4. BACKEND (OBRIGATORIO PARA FLUXO COMPLETO)

No root do projeto:

```powershell
npm --prefix dashboard install
npm --prefix dashboard start
```

Verificar saude:

```text
http://localhost:3000/health
```

Resposta esperada inclui `status: ok`.

5. CONFIGURACAO DE REDE (CELULAR FISICO)

- Celular e PC na mesma rede Wi-Fi
- Descobrir IP do PC:

```powershell
ipconfig
```

- Usar backend com IP local, por exemplo:

```text
http://192.168.1.5:3000
```

6. LOGIN ADMIN (PAINEL/API)

Endpoint:

```text
POST /login
```

Body aceito:

```json
{
  "user": "admin",
  "pass": "SUA_SENHA"
}
```

Ou:

```json
{
  "user": "admin",
  "password": "SUA_SENHA"
}
```

Retorno: token JWT de admin.

7. ACESSO AO PAINEL/ROTAS PROTEGIDAS

Header obrigatorio quando nao estiver em bypass QA local:

```text
Authorization: Bearer SEU_TOKEN
```

Sem token valido: acesso negado (401).

8. GERAR TOKEN DE CLIENTE

Com token admin:

```text
POST /token/client
```

Body:

```json
{
  "clientId": "admin"
}
```

9. ROTAS IMPORTANTES

- GET /health
- POST /login
- POST /token/client
- GET /api/bugs
- POST /api/log
- POST /api/analyze
- POST /api/apply-fix
- POST /api/retest
- GET /api/maintenance/artifacts
- POST /api/maintenance/cleanup

10. TESTE DO SISTEMA COMPLETO

No app:
- Criar treino
- Registrar exercicio
- Usar coach
- Finalizar treino

No painel/API:
- Ver bugs
- Aplicar fix
- Rodar retest
- Ver status final (closed/resolved/autoClosed)

11. RODAR TESTES

Projeto completo:

```powershell
npm run test:all
```

Dashboard:

```powershell
npm --prefix dashboard test
```

E2E attached:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/detox-bootstrap.ps1 -Mode attached -Run test
```

12. PRODUCAO (RENDER)

Backend:
- Root: `dashboard`
- Start: `npm start`

Variaveis obrigatorias:
- ADMIN_USER
- ADMIN_PASS
- JWT_SECRET
- DEFAULT_CLIENT_ID
- CLIENT_API_KEYS
- ENABLE_QA_LOCAL_BYPASS=0

Observacao:
- Neste repositorio nao existe frontend separado em `dashboard/client`.
- A UI do dashboard e servida pelo proprio `dashboard/server.js` (arquivos em `dashboard/public`).

13. COMANDOS ADB IMPORTANTES

```powershell
adb devices
adb install -r build-output\app-release.apk
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
```

14. PROBLEMAS COMUNS

ACESSO NEGADO:
- token ausente/invalido
- Authorization ausente

LOGIN FALHA:
- ADMIN_USER/ADMIN_PASS invalidos

APP NAO CARREGA:
- backend desligado
- IP/porta incorretos

API NAO RESPONDE:
- servidor nao iniciado
- firewall/rede bloqueando

CRASH:
- reinstalar app
- limpar dados do app

15. CHECKLIST DE 100%

- App abre sem Metro (APK standalone)
- Login/token funcionando
- Dashboard sem 401 indevido
- Bugs aparecendo
- apply-fix e retest funcionando
- cleanup de artifacts funcionando
- Sem falha critica nos testes principais
