# Render and Tools Triage — pós PR #31 / PR #34

> **Tipo:** READ-ONLY triage — **não** alterou produção  
> **Estado:** `RENDER_TOOLS_TRIAGE_PARTIAL_PR_OPEN`  
> **Data:** 2026-06-15 (UTC)  
> **Projeto:** EVOLUÇÃO — `com.tipolt.evolucaofullv2`  
> **Repo:** [thegamerbr411-hub/Evolucao_full_v2_private](https://github.com/thegamerbr411-hub/Evolucao_full_v2_private)  
> **Base:** `origin/main` @ `eac722b`  
> **Evidência local (não commitada):** `.qa_runtime/infra_render_triage/`

---

## 1. Projeto

EVOLUÇÃO fitness app — backend Node/Express hospedado no Render (free tier). Mobile usa Firebase + API Render para auth/sync/features online.

---

## 2. Base main

| Campo | Valor |
|-------|--------|
| SHA | `eac722b` |
| PRs merged | #31 Lote 1 · #32 baseline · #33 dry-run · #34 AI routing |
| Lote 2 | **NÃO iniciado** |
| Release / tag / Play Store | **NÃO** |

---

## 3. Guard

| Gate | Resultado |
|------|-----------|
| `verify_evolucao_context.cjs` | **PASS** — `CONTEXT_GUARD_OK` |
| Package | `com.tipolt.evolucaofullv2` |
| NEXA | Fora do escopo (aviso foreground ADB apenas) |

---

## 4. Render investigado?

| Canal | Status |
|-------|--------|
| Repo / blueprint | **SIM** — `render.yaml`, `docs/INFRA_RENDER.md` |
| Health probe público | **SIM** — GET `/health` HTTP 200 (~22s cold start) |
| Render Dashboard | **MANUAL_REQUIRED** — MCP Render indisponível; sem CDP dashboard nesta sessão |
| Deploy / restart / env | **NÃO** — proibido neste ciclo |

---

## 5. E-mails investigados?

**MANUAL_REQUIRED**

Sem acesso à caixa de e-mail nesta sessão. Felipe deve fornecer (sem secrets):

- Print ou texto do **assunto**
- **Data/hora**
- **Nome do serviço** Render
- Trecho do erro (failed deploy, health check, exited, suspended, etc.)

Pesquisar termos: `Render`, `evolucao-api`, `onrender`, `deploy failed`, `health check`, `exited`, `crash`.

---

## 6. Serviços Render encontrados

| Campo | Valor |
|-------|--------|
| Blueprint name | `evolucao-api` |
| Dashboard name (doc) | `evolucao-api-dou2` |
| URL pública | `https://evolucao-api-dou2.onrender.com` |
| Tipo | web service |
| Runtime | Node **20.x** |
| Plan | **free** |
| rootDir | `backend/` |
| healthCheckPath | `/health` |
| buildCommand | `npm ci` |
| startCommand | `npm start` |

**NEXA:** nenhum serviço Render NEXA referenciado neste repositório Evolução.

---

## 7. Alertas Render encontrados

| ID | Fonte | Alerta | Ativo? |
|----|-------|--------|--------|
| ALT-01 | Health probe | Resposta `/health` OK mas **~22s** (cold start) | Provável spin-down free tier |
| ALT-02 | Felipe report | E-mails frequentes de erro Render | **UNKNOWN** — aguarda e-mail |
| ALT-03 | Repo | Secrets plaintext em `render.yaml` | **SIM** — risco segurança contínuo |
| ALT-04 | Dashboard | Deploy fail / OOM / crash loop | **UNKNOWN** — aguarda dashboard |

---

## 8. Classificação por alerta

| ID | Classificação | Serviço | Projeto | Sev | Impacto Lote 2 | Impacto release | Lote 2? | Ciclo sep? |
|----|---------------|---------|---------|-----|----------------|-----------------|---------|------------|
| ALT-01 | `EVOLUÇÃO_RISCO_BAIXO` | evolucao-api-dou2 | Evolução | P2 | Não bloqueia polish visual local | Login/sync lentos após idle; explica e-mails health/spin-down | **NÃO** | **SIM** (infra pós-L2) |
| ALT-02 | `UNKNOWN_NEEDS_FELIPE` | ? | ? | ? | — | — | **NÃO** | — |
| ALT-03 | `EVOLUÇÃO_SECURITY_P0` | render.yaml git | Evolução | **P0** sec | Não bloqueia L2 visual offline | Rotação credenciais; remover secrets do yaml | **NÃO** | **SIM** urgente |
| ALT-04 | `UNKNOWN_NEEDS_FELIPE` | evolucao-api-dou2 | Evolução? | ? | — | — | **NÃO** | Talvez |

**Se e-mails forem só cold start / health check timeout:** reclassificar ALT-02 como `EVOLUÇÃO_RISCO_BAIXO`.

**Se e-mails forem crash loop 5xx persistente:** reclassificar como `EVOLUÇÃO_RELEASE_BLOCKER` (P1).

---

## 9. Impacto no Evolução

| Área | Com Render down / cold |
|------|------------------------|
| Treino local / Coach básico | Funciona (local rules) |
| Login / auth / sync | **Degradado** — depende API |
| Social / ranking / nutrition online | **Degradado** |
| Release APK manual (dry-run) | **OK** — smoke passou offline parcial |
| Beta interno APK | **GO COM RISCO** se testers offline-first |

---

## 10. Impacto no Lote 2

| Item | Impacto |
|------|---------|
| L2-A testes | **Nenhum** — local |
| L2-B release config | **Nenhum** direto |
| L2-C visual polish | **Nenhum** — não requer Render |
| L2-D dry-run | Documentar latência API se online smoke incluir auth |

**Conclusão:** alertas Render prováveis **não bloqueiam** abertura do Lote 2 visual/testes, desde que Felipe confirme que não há P1 crash ativo.

---

## 11. Impacto no release

| Destino | Com estado atual API |
|---------|----------------------|
| Play Store | **NO-GO** (já documentado dry-run PR #33) |
| Beta APK manual | **GO COM RISCO** |
| Backend prod estável | **INCERTO** até dashboard + e-mails |

Free tier spin-down pode gerar **falsos positivos** de health check nos e-mails Render.

---

## 12. P0

| ID | Item |
|----|------|
| SEC-P0-1 | Plaintext secrets em [`render.yaml`](../render.yaml) (JWT, API keys, admin — **[REDACTED]**) — **ciclo segurança separado** |

---

## 13. P1

| ID | Item | Condicionado |
|----|------|--------------|
| INF-P1-1 | Crash loop / 5xx persistente | Se confirmado no dashboard |
| INF-P1-1 | Auth/sync indisponível prolongado | Se health fail além de cold start |

---

## 14. P2

| ID | Item |
|----|------|
| INF-P2-1 | Cold start ~22s em `/health` (free tier) |
| INF-P2-2 | E-mails Render ruído por spin-down 15 min |
| INF-P2-3 | `RESEND_API_KEY` / SMTP sync:false — e-mail auth pode falhar se unset no Dashboard |

---

## 15. Segurança / secrets — REDACTED

- [`render.yaml`](../render.yaml) contém credenciais em plaintext no repositório.
- **Não** corrigir neste ciclo.
- **Não** expor valores no doc ou commit.
- Ação futura (Felipe): rotacionar JWT/API keys/admin; mover para env vars Render Dashboard only; remover do git history (ciclo dedicado).

Chaves **nome-only** documentadas em [`docs/INFRA_RENDER.md`](../docs/INFRA_RENDER.md).

---

## 16. Ferramentas úteis para Lote 2

| Ferramenta | Usar? | Motivo |
|------------|-------|--------|
| Cursor/Devin | SIM | L2 PRs, guard |
| Terminal / PowerShell | SIM | git, node, npm, health curl |
| GitHub CLI | SIM | PRs L2 + este doc |
| ADB / Detox / Metro | SIM | smoke visual L2-C/D |
| Render Dashboard (read-only) | Pendente Felipe | confirmar alertas |
| ChatGPT Project oficial | SIM | priorização L2 |
| NotebookLM oficial | SIM consulta | sources NÃO |
| Render MCP | **NÃO** agora | errored; requer setup Felipe |

---

## 17. APIs úteis

| API | Usar Lote 2? | Nota |
|-----|--------------|------|
| Evolução Render API (public health) | Read-only probe | OK |
| OpenAI / Gemini API | **NÃO** | Lote 3 TIA |
| Firebase prod | **NÃO** | proibido |
| Firebase Emulator | Opcional testes | local only |

---

## 18. MCP / extensões — recomendadas ou proibidas

| Item | Veredito |
|------|----------|
| MCP GitHub (gh CLI) | OK |
| MCP Render | Pendente auth — read-only futuro |
| MCP browser/Playwright | ChatGPT bridge only |
| Gemini Web genérico | **PROIBIDO** Lote 2+ |
| Extensões novas | **PROIBIDO** instalar |
| NEXA MCP/tools | **PROIBIDO** |

---

## 19. O que precisa autorização Felipe

1. Assuntos/datas e-mails Render (ALT-02)
2. Prints dashboard: status, último deploy, logs, alerts (ALT-04)
3. Autorizar ciclo **segurança** render.yaml (SEC-P0-1)
4. Autorizar Render MCP read-only (opcional)
5. Confirmar se e-mails são **Evolução** vs outro projeto
6. **"pode implementar Lote 2"** após triagem completa

---

## 20. O que fica fora do escopo

- Deploy / restart / env vars Render
- Alterar `render.yaml` ou `src/**`
- Lote 2 código
- Release / tag / Play Store / Firebase prod
- NEXA
- Rotação secrets (ciclo separado)
- Commit `.qa_runtime/**`

---

## 21. Passos manuais Felipe (dashboard)

1. Abrir [Render Dashboard](https://dashboard.render.com) → serviço **evolucao-api-dou2**
2. Anotar: **status** (live/suspended), **último deploy** (success/fail), **últimos eventos**
3. Logs: filtrar erros 24–72h — crash, OOM, health check fail, build fail
4. Verificar se serviço está em **free tier** spin-down pattern
5. Enviar resumo (sem env var values) para completar ALT-02/ALT-04

---

## 22. Matriz ferramentas (Fase R5)

| Ferramenta | Usar agora? | Motivo | Risco | OK Felipe? |
|------------|-------------|--------|-------|------------|
| Cursor/Devin | SIM | triage + L2 plan | Baixo | Implícito |
| Terminal/PowerShell | SIM | guard, probe | Baixo | SIM |
| GitHub CLI | SIM | PR docs | Baixo | SIM |
| ADB | SIM | L2 smoke | Baixo | SIM |
| Detox | SIM | L2 smoke | Médio | SIM |
| Metro/Expo | SIM | recapture | Baixo | SIM |
| Render Dashboard | Pendente | ALT-04 | Baixo RO | **Pedir** |
| Render logs | Pendente | classificar | Baixo RO | **Pedir** |
| Gmail/e-mail | MANUAL | ALT-02 | — | **Pedir** |
| ChatGPT Project | SIM | L2 priority | Médio | SIM |
| NotebookLM | SIM | consulta | Baixo | SIM |
| Gemini Web genérico | NÃO | routing | Alto | NÃO |
| OpenAI API | NÃO | Lote 3 | Médio | Pendente |
| Gemini API | NÃO | — | Médio | Pendente |
| Firebase Emulator | Opcional | testes | Baixo | Pendente |
| Firebase prod | NÃO | proibido | Alto | NÃO |
| Play Store | NÃO | NO-GO | — | NÃO |
| Sentry/Crashlytics | N/A | não no repo | — | — |
| MCP GitHub | Opcional | gh suficiente | Baixo | Pendente |
| MCP filesystem | NÃO | desnecessário | Médio | NÃO |
| MCP browser | Opcional | bridge | Médio | Pendente |
| Extensões Cursor | NÃO instalar | regra | — | NÃO |
| NEXA | NÃO | separado | — | NÃO |

---

## 23. Próxima ação única

Felipe enviar **assuntos e-mails Render** + **prints dashboard read-only** (ou autorizar Render MCP) → reclassificar ALT-02/ALT-04 → autorizar ciclo segurança SEC-P0-1 → então **"pode implementar Lote 2"**.

---

## Referências

- [`render.yaml`](../render.yaml) — blueprint (secrets [REDACTED] in doc)
- [`docs/INFRA_RENDER.md`](../docs/INFRA_RENDER.md)
- [`src/services/api.ts`](../src/services/api.ts)
- [`backend/server.js`](../backend/server.js)
- [`qa/release/RELEASE_READINESS_DRY_RUN_POST_PR31.md`](../release/RELEASE_READINESS_DRY_RUN_POST_PR31.md)
