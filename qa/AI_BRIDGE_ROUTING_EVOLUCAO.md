# EVOLUÇÃO — AI Bridge Routing

> **Última atualização:** 2026-06-15  
> **Estado routing:** `AI_ROUTING_READY_PR_OPEN`  
> **CDP profile usado:** Edge **Default** (`enable_cdp_on_open_edge.ps1`) — **não** `chrome-profile` isolado  
> **Lote 2:** **NÃO iniciado**

---

## Fonte de verdade

| Fonte | Uso |
|-------|-----|
| GitHub PRs #31, #32, #33 | merged @ `f4f806e` |
| [`qa/visual/*`](visual/) | Lote 1, baseline PR31, recapture |
| [`qa/release/*`](release/) | Release Readiness dry-run |
| Evidência local IA | `.qa_runtime/ai_routing_setup/` (**não commitada**) |

---

## ChatGPT oficial

| Campo | Valor |
|-------|--------|
| **Project** | EVOLUÇÃO — App Fitness QA |
| **Project URL** | `https://chatgpt.com/g/g-p-6a304cf980908191b5415b0c6be75339-evolucao-app-fitness-qa/project` |
| **Project status** | `CHATGPT_PROJECT_CREATED` |
| **Created by** | `MANUAL_CREATED_BY_FELIPE` |
| **Chat oficial** | EVOLUÇÃO — Oficial QA Pós PR31 / Lote 2 |
| **Chat URL** | `https://chatgpt.com/g/g-p-6a304cf980908191b5415b0c6be75339-evolucao-app-fitness-qa/c/6a304d0e-7c2c-83e9-bb63-f046f7f792f7` |
| **Chat status** | `CHATGPT_OFFICIAL_CHAT_CONFIRMED` |
| **Fallback antigo** | `ARCHIVE_ONLY` — `https://chatgpt.com/c/6a2f065d-0094-83e9-b07b-80af901f40dc` ("Análise app Evolução") |
| **"Dever de casa"** | **NÃO** é Project oficial |
| **Evidência local** | `.qa_runtime/ai_routing_setup/chatgpt_project_evidence.png` |
| **Status JSON** | `.qa_runtime/ai_routing_setup/chatgpt_routing_status.json` |

### Confirmação manual (2026-06-15)

Felipe criou Project e chat oficial no Edge Default. URLs acima são a fonte de verdade para Lote 2+. **Não** usar chat fallback `6a2f065d`.

### Lote 1 (histórico — evidência válida)

| Campo | Valor |
|-------|--------|
| Resposta | `.qa_runtime/chatgpt_bridge/evolucao_premium_release_cleanup_v1_response.txt` |
| Marcador | `EVOLUCAO_RELEASE_CLEANUP_V1_REVIEW_DONE` |
| Bridge | `BRIDGE_CLOSED` (fallback chat Lote 1) |

---

## Gemini / NotebookLM oficial

| Campo | Valor |
|-------|--------|
| **Notebook** | EVOLUÇÃO — QA Visual e Release Readiness |
| **Notebook URL** | `https://notebooklm.google.com/notebook/2b75bdbe-ee31-4145-97b1-b0b5f606cbc8` |
| **Deep link disponível** | **SIM** |
| **Status** | `GEMINI_NOTEBOOK_CREATED` |
| **Sources uploaded** | **NÃO** (proibido neste ciclo) |
| **Created by** | `AUTOMATION_CREATED` (Edge Default) |
| **Evidência local** | `.qa_runtime/ai_routing_setup/notebooklm_evidence.png` |
| **Status JSON** | `.qa_runtime/ai_routing_setup/gemini_routing_status.json` |

**Nota:** notebook `7a60bf00-...` (perfil isolado anterior) → `accessrequest` — **não usar**. Notebook oficial = `2b75bdbe-...`.

**Nota:** `gemini.google.com/app` **não** é link oficial pós-setup.

### Lote 1 Gemini Web (histórico)

| Campo | Valor |
|-------|--------|
| Resposta | `.qa_runtime/gemini_review/gemini_premium_visual_response.txt` |
| Status | `GEMINI_WEB_REAL_USED: YES` |

---

## Regras anti-chat errado

1. **Proibido** enviar Evolução em chats/conversas **NEXA**.
2. **Proibido** enviar NEXA em chats Evolução.
3. **URL genérica** (`gemini.google.com/app`, `chatgpt.com/` sem `/c/` ou `/g/`) **não** prova contexto oficial.
4. **Fallback** só com status explícito + confirmação Felipe antes de enviar pacote.
5. Toda resposta IA válida exige: arquivo `.txt` + status JSON + marcador + timestamp + link conversa.
6. **Sem marcador** → bridge **não** é `BRIDGE_CLOSED`.
7. Guard obrigatório: `node .qa_runtime/tools/verify_evolucao_context.cjs` antes de enviar pacote.
8. Notebooks NEXA na sidebar (**Auditoria NEXA**, **# NEXA PR #7**) → **não clicar**.

---

## Estados de routing

| Estado | Evolução (2026-06-15) |
|--------|------------------------|
| `CHATGPT_PROJECT_CREATED` | **SIM** |
| `CHATGPT_PROJECT_MANUAL_REQUIRED` | **NÃO** |
| `CHATGPT_OFFICIAL_CHAT_CONFIRMED` | **SIM** |
| `GEMINI_NOTEBOOK_CREATED` | **SIM** |
| `GEMINI_OFFICIAL_CONTEXT_CONFIRMED` | **SIM** (NotebookLM deep link) |
| `AI_ROUTING_READY` | **SIM** |
| `AI_ROUTING_READY_PR_OPEN` | **SIM** (PR #34 docs-only aberto) |
| `AI_ROUTING_PARTIAL` | **NÃO** |
| `AI_ROUTING_BLOCKED` | **NÃO** |

---

## Próximo ciclo

- Felipe autorizar **merge PR #34** (docs-only).
- **Lote 2** só após merge PR #34 + autorização explícita Felipe.

---

## Incidente corrigido

Setup anterior usou `--user-data-dir=chrome-profile` → ChatGPT deslogado (`Entrar`). **Invalidado.** Este routing usa **Edge Default** logado.
