# RBAC Desafios — "Criar desafio" só admin (RF-01)

**Data:** 2026-06-02  
**Bug:** `RF-01_CHALLENGE_CREATE_VISIBLE_TO_NON_ADMIN` (P1)  
**PASS global app:** NÃO  

---

## Resumo

Implementada proteção em camadas para que apenas usuários com `role: admin` ou `isAdmin: true` (validados no login/backend) vejam e executem criação de desafios sociais.

---

## Causa raiz

1. **UI:** [`SocialChallengesScreen.js`](../../src/screens/SocialChallengesScreen.js) renderizava o card "Criar desafio" para qualquer usuário autenticado.
2. **Serviço:** [`socialApiService.js`](../../src/services/socialApiService.js) `createChallengeFromApi` não validava role antes do POST.
3. **API (dashboard):** `POST /api/social/challenges` aceitava apenas `x-api-key` + `userId` no body, sem JWT admin.
4. **API (backend):** `POST /social/challenges` em [`backend/routes/social.js`](../../backend/routes/social.js) sem checagem admin.
5. **Store:** [`AppContext-v2.ts`](../../src/context/AppContext-v2.ts) podia sobrescrever `role: admin` com `user` no listener Firebase.

---

## Correção aplicada

| Camada | Arquivo | Comportamento |
|--------|---------|---------------|
| Helper | `src/utils/challengePermissions.js` | `isChallengeAdmin`, `getChallengeCreateGuardError`, mensagem padrão |
| UI | `SocialChallengesScreen.js` | Card oculto se `!isChallengeAdmin(user)`; `testID` `card-social-create-challenge` só admin; guard em `onCreateChallenge` |
| Serviço | `socialApiService.js` | Retorna `{ ok: false, error: 'admin_required' }` sem HTTP se não admin |
| API dashboard | `dashboard/server.js` | `validateJWT` + `requireChallengeAdmin` + `req.auth.id` em `resolveRequestUserId` |
| API backend | `backend/routes/social.js` | 403 `admin_required` se `!isAdmin` |
| Store | `AppContext-v2.ts` | Preserva `role: admin` no mesmo `uid` após login |

---

## Testes

| Suite | Comando | Resultado |
|-------|---------|-----------|
| Unit RBAC | `node --test __tests__/challengeAdminRbac.test.mjs` | **9/9 PASS** |
| Dashboard API | `node dashboard/tests/api.test.js` | **PASS** (401 sem Bearer; 403 JWT user; 200 JWT admin) |

---

## QA visual

| Cenário | Device | Status |
|---------|--------|--------|
| Conta comum — sem card criar | `emulator-5554` | **PENDENTE** (2026-06-02: só `RQ8T209ZTAF` online) |
| Conta admin — card visível | `emulator-5554` | **PENDENTE** (login admin não revalidado nesta sessão) |

Script: [`tools/visual_qa_challenge_admin_rbac.ps1`](../../tools/visual_qa_challenge_admin_rbac.ps1)  
Saída esperada: `qa/live_mapping/videos/challenge_admin_rbac/challenge_common_no_create_VALIDADO.png`

---

## Risco / pendência deploy

- **Render/produção:** até redeploy do serviço que expõe `POST /api/social/challenges` com o middleware novo, chamadas diretas com API key antiga podem ainda criar desafios. UI + serviço do app já bloqueiam UX e cliente honesto.
- **JWT obrigatório na rota:** app deve enviar `Authorization: Bearer` após login (`setQaRuntimeAuth({ jwt })`); sem token, API retorna 401.

---

## CHECKPOINT — RBAC DESAFIOS ANALISADO / FIX PRONTO

| Item | Valor |
|------|-------|
| Bug confirmado? | **SIM** |
| Causa raiz | UI + serviço + API sem RBAC; role admin podia ser perdida no Firebase sync |
| Arquivos alterados | `challengePermissions.js`, `SocialChallengesScreen.js`, `socialApiService.js`, `AppContext-v2.ts`, `dashboard/server.js`, `backend/routes/social.js`, `api.test.js`, `challengeAdminRbac.test.mjs`, docs QA |
| Proteção UI? | **SIM** |
| Proteção navegação? | **SIM** (mesma tela; card oculto + guard ação) |
| Proteção serviço/API? | **SIM** |
| Testes criados/rodados | **SIM** — 9/9 + api.test PASS |
| QA visual comum | **PENDENTE** (5554 offline) |
| QA visual admin | **PENDENTE** |
| Arquivos sensíveis? | **NÃO** |
| Commit/push feito? | **NÃO** |
| PASS global? | **NÃO** |
| Pode commitar? | **AGUARDANDO OK FELIPE** |

---

## Próxima ação recomendada (pós OK Felipe)

1. QA visual no `emulator-5554` com conta comum e admin.
2. Deploy API dashboard/Render com middleware RBAC.
3. Fase 2 QA: mídia exercícios (RF-02) — **após** RF-01 validado em device.
