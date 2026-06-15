# AI Review Registry — Evolução (OFICIAL)

> **Última atualização:** 2026-06-15 (setup routing IA)  
> **Base main:** `origin/main` @ `f4f806e`  
> **Routing doc:** [`AI_BRIDGE_ROUTING_EVOLUCAO.md`](AI_BRIDGE_ROUTING_EVOLUCAO.md)  
> **Estado routing:** `AI_ROUTING_PARTIAL`  
> **Lote 2:** **NÃO iniciado**

---

## Registry — campos obrigatórios

| # | Campo | Valor |
|---|--------|--------|
| 1 | **Fonte de verdade atual** | GitHub PRs #31/#32/#33 · `qa/visual/*` · `qa/release/*` |
| 2 | **PRs base** | #31 merged · #32 baseline · #33 dry-run |
| 3 | **Main atual** | `f4f806e` |
| 4 | **ChatGPT Project existe?** | **MANUAL_REQUIRED** (modal criar pendente Felipe) |
| 5 | **ChatGPT Project nome** | EVOLUÇÃO — App Fitness QA *(alvo)* |
| 6 | **ChatGPT Project link** | *(pendente — sem `/g/` capturado)* |
| 7 | **ChatGPT chat oficial existe?** | **MANUAL_REQUIRED** |
| 8 | **ChatGPT chat oficial link** | *(pendente — sem `/c/` oficial)* |
| 9 | **ChatGPT fallback permitido?** | **NÃO** (Lote 2+) — fallback Lote 1 `ARCHIVE_ONLY` |
| 10 | **ChatGPT último arquivo resposta** | `.qa_runtime/chatgpt_bridge/evolucao_premium_release_cleanup_v1_response.txt` |
| 11 | **ChatGPT último marcador** | `EVOLUCAO_RELEASE_CLEANUP_V1_REVIEW_DONE` |
| 12 | **Gemini Notebook existe?** | **SIM** |
| 13 | **Gemini Notebook nome** | EVOLUÇÃO — QA Visual e Release Readiness |
| 14 | **Gemini Notebook link** | `https://notebooklm.google.com/notebook/2b75bdbe-ee31-4145-97b1-b0b5f606cbc8` |
| 15 | **Gemini deep link disponível?** | **SIM** |
| 16 | **Gemini notebook oficial confirmado?** | **SIM** (`GEMINI_NOTEBOOK_CREATED`, sources **NÃO**) |
| 17 | **Gemini último arquivo resposta** | `.qa_runtime/gemini_review/gemini_premium_visual_response.txt` |
| 18 | **Gemini último marcador/status** | `GEMINI_WEB_REAL_USED: YES` / Notebook `AUTOMATION_CREATED` |
| 19 | **NEXA separado?** | **SIM** (guard + regra routing) |
| 20 | **Risco de chat errado** | ChatGPT Project/chat pendente; notebook antigo `7a60bf00` inválido; não usar `Dever de casa` |
| 21 | **Próximo ciclo autorizado** | Felipe completar ChatGPT Project/chat → merge PR docs → Lote 2 |
| 22 | **Lote 2 iniciado?** | **NÃO** |
| 23 | **Release Readiness real iniciado?** | **NÃO** |

---

## ChatGPT — resumo

| Campo | Valor |
|-------|--------|
| CDP profile | Edge **Default** (contas logadas) |
| Project status | `CHATGPT_PROJECT_MANUAL_REQUIRED` |
| Chat status | `CHATGPT_OFFICIAL_CHAT_NOT_CONFIRMED` |
| Fallback Lote 1 | `https://chatgpt.com/c/6a2f065d-0094-83e9-b07b-80af901f40dc` — **ARCHIVE_ONLY** |
| Evidência | `.qa_runtime/ai_routing_setup/chatgpt_project_evidence.png` |

---

## NotebookLM — resumo

| Campo | Valor |
|-------|--------|
| Status | `GEMINI_NOTEBOOK_CREATED` |
| URL | `https://notebooklm.google.com/notebook/2b75bdbe-ee31-4145-97b1-b0b5f606cbc8` |
| Sources uploaded | **NÃO** |
| Evidência | `.qa_runtime/ai_routing_setup/notebooklm_evidence.png` |

---

## O que não afirmar

| Afirmação | Permitido? |
|-----------|------------|
| ChatGPT Project criado | **NÃO** (até URL `/g/` + Felipe confirmar) |
| Chat oficial confirmado | **NÃO** (até URL `/c/` no Project) |
| NotebookLM criado | **SIM** (deep link `2b75bdbe-...`) |
| Ponte Lote 1 fechada | **SIM** (marcador histórico) |
| Lote 2 iniciado | **NÃO** |

---

## Regras (obrigatórias)

1. Evidência real: link **ou** arquivo **ou** marcador — nunca inventar.
2. `NOT_CREATED` / `MANUAL_REQUIRED` / `ARCHIVE_ONLY` quando aplicável.
3. Não commitar `.qa_runtime/**`, PNG, XML, logs.
4. Guard antes de jobs de pipeline.
5. Upload NotebookLM sources = ciclo separado com OK Felipe.

---

## Histórico

| Data | Evento |
|------|--------|
| 2026-06-15 | Setup routing: NotebookLM **CREATED**; ChatGPT **MANUAL_REQUIRED**; Edge Default |
| 2026-06-15 | Tentativa inválida `chrome-profile` → descartada |
| 2026-06-15 | PR #33 dry-run merged; Lote 2 não iniciado |
| 2026-06-15 | Ponte Lote 1 PR #31 `BRIDGE_CLOSED` + marcador |
