# Render Secrets Rotation Plan — SEC-P0-1

> **Ciclo:** SEC-P0-1 — separado de Lote 2 e PR #35  
> **Estado:** `SEC_P0_AWAITING_DASHBOARD_ROTATION`  
> **Decisão Felipe (2026-06-15):** Opção **C** — rotacionar vars no Dashboard **antes** de commit/PR  
> **Data:** 2026-06-15 (UTC)  
> **Projeto:** EVOLUÇÃO — `evolucao-api` / `evolucao-api-dou2`  
> **Repo:** [thegamerbr411-hub/Evolucao_full_v2_private](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private)

---

## Objetivo

Remover credenciais plaintext de [`render.yaml`](../../render.yaml) do Git. Valores passam a existir **somente** no Render Dashboard (`sync: false`). Credenciais que estiveram no histórico Git devem ser **rotacionadas** manualmente.

**Este documento não contém valores reais de secrets.**

### Princípios (obrigatórios)

| Regra | Detalhe |
|-------|---------|
| Valores antigos | **Comprometidos** — estiveram em `render.yaml` versionado no Git |
| Rotação | **Obrigatória** antes de commit/PR/deploy |
| Onde ficam os valores reais | **Somente** Render Dashboard (env vars) |
| `render.yaml` | **Somente** nomes + `sync: false` — **nunca** `value:` em secrets |
| PR / chat / docs | **Proibido** colar valores reais |
| Diff Git | Linhas `-` ainda mostram secrets antigos — tratar como exposição a colaboradores do repo |

---

## Checklist manual — Felipe (Dashboard Render)

**Serviço:** [evolucao-api-dou2](https://dashboard.render.com)  
**Quando terminar:** responder no chat apenas **`Render vars rotacionadas`** — **sem** enviar valores.

### Ordem segura (Opção C)

1. Abrir Dashboard Render → serviço **evolucao-api-dou2**
2. **Environment → Environment Variables**
3. Criar/atualizar vars abaixo com **valores novos** (gerados localmente, fora do repo)
4. **Salvar** no Dashboard
5. **Não** fazer Manual Deploy ainda (salvo se Render exigir para persistir)
6. Confirmar: cada nome existe; valores aparecem **ocultos/mascarados**
7. Responder: **`Render vars rotacionadas`**
8. **Só então** Cursor faz commit + push + PR security
9. Após merge aprovado → deploy controlado → validar `/health` → auth/API se aplicável

### Obrigatório rotacionar (novos valores)

- [ ] `JWT_SECRET`
- [ ] `ADMIN_PASS`
- [ ] `APP_API_KEY`
- [ ] `CLIENT_API_KEYS` (JSON válido — formato map client→key)

### Configurar / verificar (Dashboard)

- [ ] `ADMIN_USER`
- [ ] `DEFAULT_CLIENT_ID`
- [ ] `RESEND_API_KEY`
- [ ] `SMTP_HOST`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `PASSWORD_RESET_URL`

### Já declarados `sync: false` no yaml (não-secret com value permitido)

| Chave | No yaml |
|-------|---------|
| `NODE_ENV` | `value: production` |
| `ENABLE_QA_LOCAL_BYPASS` | `value: "0"` |
| `RESEND_FROM` | `value: noreply@evolucao.app` |
| `SMTP_PORT` | `value: "587"` |
| `SMTP_FROM` | `value: noreply@evolucao.app` |

---

## O que mudou no render.yaml

| Categoria | Chaves | Config no yaml |
|-----------|--------|----------------|
| Non-secret config | `NODE_ENV`, `ENABLE_QA_LOCAL_BYPASS`, `RESEND_FROM`, `SMTP_PORT`, `SMTP_FROM` | `value:` permitido |
| Secrets (Dashboard only) | Ver tabela abaixo | `sync: false` — **sem** `value:` |

### Chaves que devem estar no Render Dashboard

| # | Env var | Uso | Rotacionar? |
|---|---------|-----|-------------|
| 1 | `ADMIN_USER` | Admin básico backend | **SIM** se exposto no git |
| 2 | `ADMIN_PASS` | Admin básico backend | **SIM** — obrigatório |
| 3 | `JWT_SECRET` | Tokens JWT auth | **SIM** — obrigatório |
| 4 | `DEFAULT_CLIENT_ID` | Client id default API | **SIM** se exposto |
| 5 | `CLIENT_API_KEYS` | JSON map client → key | **SIM** — obrigatório |
| 6 | `APP_API_KEY` | API key app mobile | **SIM** — obrigatório |
| 7 | `RESEND_API_KEY` | E-mail transacional | Verificar se já no Dashboard |
| 8 | `SMTP_HOST` | SMTP fallback | Verificar Dashboard |
| 9 | `SMTP_USER` | SMTP auth | **SIM** se exposto |
| 10 | `SMTP_PASS` | SMTP auth | **SIM** se exposto |
| 11 | `PASSWORD_RESET_URL` | Link reset senha | Configurar URL prod |

---

## Passos manuais — Render Dashboard

**Pré-requisitos:** Felipe logado no [Render Dashboard](https://dashboard.render.com) → serviço **evolucao-api-dou2**. **Não** redeploy até vars configuradas.

1. **Gerar novos valores** (local seguro, fora do repo):
   - Novo `JWT_SECRET` (string longa aleatória)
   - Novo `ADMIN_PASS` forte
   - Novo `APP_API_KEY` e entradas em `CLIENT_API_KEYS` (JSON válido)
   - Rotacionar SMTP/Resend se keys estiveram no git

2. **Environment → Environment Variables:**
   - Para cada chave da tabela acima: **Add** com valor novo
   - **Não** colar valores em chat, PR, ou docs

3. **Salvar** — aguardar confirmação Dashboard (sem trigger deploy automático até Felipe decidir)

4. **Deploy manual** (somente após OK Felipe):
   - Manual Deploy ou push em `main` que dispare blueprint
   - Monitorar logs — sem crash loop

5. **Validação read-only:**
   ```text
   GET https://evolucao-api-dou2.onrender.com/health
   → HTTP 200, ok: true
   ```
   - Testar auth mínimo (send-code / login) em ambiente controlado — **sem** expor tokens no log

6. **Mobile app:** se `APP_API_KEY` rotacionou, atualizar build/env de release **fora deste ciclo** (não commitar key no repo)

---

## Histórico Git

Credenciais estiveram em commits anteriores de `render.yaml`. **Remover do yaml não apaga histórico.** Tratar **todo valor antigo como vazado**.

| Ação | Quando |
|------|--------|
| Rotação no Dashboard | **ANTES** de commit/PR (Opção C — Felipe) |
| Commit + PR security | **DEPOIS** de Felipe confirmar `Render vars rotacionadas` |
| Deploy controlado | **DEPOIS** de merge PR — com OK Felipe |
| `git filter-repo` / BFG | Opcional — ciclo separado se compliance exigir |
| Revogar keys antigas | Implícito ao rotacionar — antigas invalidadas |

---

## O que NÃO fazer neste ciclo

- Redeploy Render sem confirmação Felipe
- Colar secrets em PR, issue, chat, ou terminal log
- Merge automático PR #35 (docs triage)
- Lote 2 / release / tag / Play Store
- NEXA
- Alterar `src/**` ou Firebase prod

---

## Gates deste PR (sec branch)

| Gate | Esperado |
|------|----------|
| `render.yaml` diff | Sem `value:` em secrets; apenas `sync: false` |
| grep secrets no diff | Nenhum valor sensível literal |
| `npm run audit:release:check` | PASS drift 0 (ou explicar se drift) |
| PR separado de #35 | Branch `sec/remove-render-yaml-secrets` |

---

## Próxima ação única

**Felipe:** abra o Dashboard Render e configure/rotacione as env vars (checklist acima). Quando terminar, responda **apenas:**

```text
Render vars rotacionadas
```

**Sem** mandar valores.

**Depois (Cursor, com OK implícito na mensagem acima):**

1. Rechecar diff — nenhum secret em linhas `+`
2. Commit: `security(infra): remove plaintext Render secrets from config`
3. Push branch `sec/remove-render-yaml-secrets`
4. Abrir PR security (separado de PR #35)
5. Merge + deploy **somente** com nova confirmação Felipe

---

## Referências

- [`render.yaml`](../../render.yaml) — pós-sanitização
- [`qa/infra/RENDER_AND_TOOLS_TRIAGE_POST_PR31.md`](RENDER_AND_TOOLS_TRIAGE_POST_PR31.md) — PR #35 (aberto)
- [`docs/INFRA_RENDER.md`](../../docs/INFRA_RENDER.md)
