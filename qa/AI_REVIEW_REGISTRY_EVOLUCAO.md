# AI Review Registry — Evolução (OFICIAL)

> **Última atualização:** 2026-06-14  
> **Branch:** `fix/premium-release-cleanup-v1`  
> **Status pipeline:** **LIMPO** — Lote 1 implementado em PR

---

## Projeto

| Campo | Valor |
|-------|-------|
| Nome | Evolução |
| Repo | `thegamerbr411-hub/Evolucao_full_v2_private` |
| Pasta local | `F:\projetos\evolucao-main-clean` |
| Package Android | `com.tipolt.evolucaofullv2` |
| Device QA | `RQ8T209ZTAF` |

---

## ChatGPT — Diretor Técnico Premium (OFICIAL)

| Campo | Valor |
|-------|-------|
| **Nome do chat** | **EVOLUÇÃO — Diretor Técnico Premium — OFICIAL** |
| Projeto ChatGPT | Dever de casa |
| Uso | Master final pós-Gemini; consolida tops, lotes, decisões Felipe |
| Último pacote | `.qa_runtime/chatgpt_bridge/evolucao_premium_gemini_master_packet.txt` |
| Última resposta | `.qa_runtime/chatgpt_bridge/evolucao_premium_gemini_master_response.txt` |
| Bridge | `.devin/chatgpt_bridge/chatgpt_bridge.cjs` (CDP Edge 9222) |
| **Status** | **APPROVO master com slot 07 corrigido** — PR sugerido: `premium-release-cleanup-v1` |

---

## Gemini Web — Auditoria Premium UX/UI (OFICIAL)

| Campo | Valor |
|-------|-------|
| **Nome do chat** | **EVOLUÇÃO — Auditoria Premium UX/UI — OFICIAL** |
| Gemini API | **NÃO** usada |
| Gemini Web | **SIM** — CDP + Playwright |
| `GEMINI_WEB_REAL_USED` | **YES** (28 PNGs, blocos A–D) |
| Resposta original | `.qa_runtime/gemini_review/gemini_premium_visual_response.txt` |
| Correção PNG 07 | `.qa_runtime/gemini_review/gemini_premium_visual_response_07_fix.txt` |
| Status envio | `.qa_runtime/gemini_review/gemini_send_status.json` |
| Bridge | `.qa_runtime/gemini_review/gemini_web_bridge.cjs` |
| PNG 07 válido | `07_CATALOGO_MODAL_EVOLUCAO_RECAPTURE.png` |
| **Status análise** | Pacote **LIMPO**; veredito release **BLOCKED** até Lote 1 |

---

## Plano de implementação

| Campo | Valor |
|-------|-------|
| Documento | [`qa/visual/PREMIUM_IMPLEMENTATION_FINAL_PLAN.md`](visual/PREMIUM_IMPLEMENTATION_FINAL_PLAN.md) |
| Implementação | **AINDA NÃO INICIADA** |
| Gate Felipe | Responder **“pode implementar lote 1”** |

---

## Regras (obrigatórias)

1. **Nunca** usar chats NEXA, PR #24 antigo, ou chat sem título oficial.
2. Chat errado → resposta = `INVALID_REVIEW_CHAT` (descartar).
3. **Sempre** salvar resposta em arquivo `.txt` antes de considerar entrega válida.
4. **Nunca** colar caminhos `F:\` no chat — anexar PNGs reais (upload).
5. Rodar `node .qa_runtime/tools/verify_evolucao_context.cjs` **antes** de qualquer job de pipeline.
6. Lote 1 implementado em `fix/premium-release-cleanup-v1` — aguardar merge antes de Lote 2.
7. **Não** commitar `.qa_runtime/**`, PNGs, XMLs, logs ou secrets.
8. **Sempre** incluir seção “Ferramentas, APIs, extensões e automações usadas” em relatórios ao Felipe.

---

## Histórico de incidentes

| Data | Incidente | Ação |
|------|-----------|------|
| 2026-06-14 | Lote 1 premium-release-cleanup-v1 | PR `fix/premium-release-cleanup-v1`; relatório `PREMIUM_RELEASE_CLEANUP_V1_REPORT.md` |
| 2026-06-14 | PNG 07 capturado com app NEXA (`com.nexa.finance`) | Recapture Evolução; original `INVALID_NEXA_CONTAMINATED` |
| 2026-06-14 | CONTEXT MIX — agente rodou QA NEXA com workspace Evolução | Separado; NEXA parado; lock + guard criados |
| 2026-06-12 | Plano final premium consolidado | `PREMIUM_IMPLEMENTATION_FINAL_PLAN.md` + tools inventory |
