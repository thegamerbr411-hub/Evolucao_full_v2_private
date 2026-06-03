# HOME 3/3A — Resumo análise ChatGPT

**Pacote:** HOME 3/3A — Scroll + Continuar treino  
**Enviado:** 2026-05-30 via Playwright  
**Chat:** Dever de casa → Chat do Cursor  
**Status:** **ANALISE_RECEBIDA_E_REGISTRADA**  
**Fonte resposta:** `.playwright-mcp/page-2026-05-30T18-02-33-866Z.yml` + `CHATGPT_ANALYSIS_RESPONSES.md`

---

## Diagnóstico visual (ChatGPT)

Pacote **melhor que HOME 1/2 e 2/2** — testou função real: scroll Home, Continuar treino, descanso, salvar série, voltar Home.

**Veredito ChatGPT:** Home **NÃO PASS** — bugs fortes de estado/lógica entre Home e Treino. Base visual OK; problema é **estado quebrado entre telas**.

---

## Bugs confirmados (ChatGPT)

| Prioridade | Bug | Evidência |
|---|---|---|
| **P1** | Home "Concluído" + barra 100% mas CTA "Continuar treino" | home_deep_011 |
| **P1** | Home troca exercício (Puxada → Agachamento) após ação | home_deep_004 vs 011 |
| **P1** | Exercício 1 de 1 (esperado multi) | home_deep_004, 010 |
| **P1** | Finalizar treino com 25% (1/4 séries) | home_deep_010 |
| **P1** | Streak Home Dia 1 vs Treino 0 dias | home_deep_004, 011 |
| **P1** | XP confuso (208334 total vs +120 hoje) | home_deep_004, 010 |
| **P1** | Descanso — presets/timer inconsistentes | home_deep_008, 010 |
| **P2** | Checks de série confundem salva vs não salva | home_deep_010 |
| **P2** | Card "Modo simples ativo" grande demais | home_deep_004 |
| **P2** | Expandir MAIS OPÇÕES não testado pós-tap | home_deep_002 |

**P0:** Nenhum (sem crash, tela branca ou travamento total).

---

## Bugs novos (vs HOME 1/2)

- Home mostra treino **concluído** mas pede **continuar** (incoerência CTA vs barra 100%)
- Home **troca exercício** sozinha após salvar série e voltar
- Confirmação funcional profunda de descanso + save série (não só navegação)

---

## Bugs rejeitados / não aplicáveis

| Item | Motivo |
|---|---|
| P0 crash/navegação | ChatGPT confirmou ausência — OK |
| REST_BUTTONS_MISSING | Presets sempre visíveis na deep audit |

---

## Prioridade de correção (ChatGPT)

1. **P1:** Fonte de verdade treino Home ↔ Treino (CTA, exercício atual, multi 1 de N)
2. **P1:** Esconder/rebaixar Finalizar com treino incompleto
3. **P1:** Unificar streak/XP entre telas
4. **P1:** Descanso — um preset ativo, timer alinhado
5. **P2:** UX séries, modo simples, Expandir

**Próxima ação ChatGPT (original):** corrigir estado treino Home/Treino antes de avançar abas.

---

## O que já foi corrigido depois da análise (2026-05-30)

| Bug ChatGPT 3/3A | Status pos-P1 fix |
|---|---|
| Proteína 150g vs 160g | **FIXED** — 160g unificado (`dailyState`) |
| Streak/XP Home vs Coach/Treino hub | **FIXED** — validação P1 PASS |
| Exercício 1 de 1 | **FIXED** — Exercício **1 de 5** pos-resync |
| Finalizar cedo demais | **FIXED** — `canFinishWorkout` + UI condicional |
| Descanso presets confusos | **FIXED** — seleção única + timer validado |
| Crash hydration / Render Error | **FIXED** — hotfix AppContext-v2 |
| Registrar 10kg debug | **FIXED** — oculto fora `__DEV__` |

---

## Revalidação pós-Treino + pendências finais (2026-06-02)

| Bug | Status |
|---|---|
| Home Concluído + Continuar treino | **FIXED** — `treino_postfix_001` + P1 |
| Home troca exercício aleatório | **Revalidado** — sem regressão documentada |
| BUG_MEAL_NOT_UPDATING_HOME | **FIXED** — `getTodayKey` local ([`HOME_FINAL_PENDING_REPORT.md`](HOME_FINAL_PENDING_REPORT.md)) |
| BUG_INSIGHTS_XP_STREAK_MISMATCH | **Aberto** |
| Expandir MAIS OPÇÕES | **Não mapeado** |
| Checks série confusos | **FIXED** (Treino) |
| Paywall / ranking / acentos | **P2** — 3/3C |

**Veredito Home atual:** **PASS PARCIAL** — ver `HOME_FINAL_PENDING_REPORT.md`

---

## Próxima ação única

Commit/organização fixes **ou** revisão visual leve Home (opcional) — Treino fechado em `TREINO_FINAL_STATUS.md`.

---

## Screenshots do pacote

1. `home_deep_001_top.png`
2. `home_deep_002_bottom.png`
3. `home_deep_004_treino_aberto.png`
4. `home_deep_008_descanso_action.png`
5. `home_deep_010_after_save_set.png`
6. `home_deep_011_home_after_workout_action.png`
