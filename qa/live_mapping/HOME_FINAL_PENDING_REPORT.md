# HOME — Final Pending Report

**Data:** 2026-06-02  
**Autorização:** OK Felipe — Home pendências finais pós-fechamento Treino  
**Device:** emulator-5554  
**App:** com.tipolt.evolucaofullv2  
**Treino:** fechado — [`TREINO_FINAL_STATUS.md`](TREINO_FINAL_STATUS.md) (não reaberto)

---

## Status

**PASS PARCIAL** (navegação + estado/dados pós-fixes)

| Área | Veredito |
|------|----------|
| Navegação Home | PASS PARCIAL |
| Coerência Home ↔ Treino (CTA, concluído, parcial) | **FIXED** — revalidado por código + `treino_postfix_001` |
| Proteína / meal sync na Home | **FIXED** (chave de dia local + refresh no focus) |
| PASS global do app | **NÃO** |
| Nutrição profunda (3/3B) | Fora de escopo |
| Insights paywall / ranking mock / acentos | Abertos (P2) |

---

## Bugs investigados

| Código / tema | Resultado auditoria |
|---------------|----------------------|
| Concluído + Continuar treino | **FIXED** (P1 + Treino) — `dailyState` + `HomeScreen` recovery guard |
| Treino parcial → 100% indevido | **FIXED** — `canFinishWorkout` |
| Proteína divergente Home vs meta | **FIXED** (160g unificado) |
| Streak/XP Home vs Treino hub | **FIXED** (P1) — Insights mock ainda pode divergir |
| `BUG_MEAL_NOT_UPDATING_HOME` | **Causa:** `getTodayKey` em `utils.ts` usava UTC (`toISOString`); logs salvos com data UTC não batiam com filtro local da Home → `proteinToday` 0 |
| `BUG_INSIGHTS_XP_STREAK_MISMATCH` | **Aberto** — ranking mock em Insights; sem mudança de regra XP/streak neste ciclo |
| Exercício troca aleatório (3/3A) | **Revalidado** — escopo Treino/P1; sem regressão documentada |
| Paywall / acentos / MAIS OPÇÕES | **Aberto** — P2 / 3/3C |

---

## Bugs corrigidos (neste ciclo)

| Bug | Fix | Arquivo |
|-----|-----|---------|
| Meal não reflete na Home (data key) | `getTodayKey` alinhado ao calendário **local** (igual `getDailyTodayKey` / nutrition store) | `src/context/modules/utils.ts` |
| Proteína 0 com logs válidos no dia | `todayProtein` usa `Math.max(dailyState, logs locais)` | `src/screens/HomeScreen.js` |
| Recovery/CTA stale ao voltar para Home | `homeStateTick` incrementa no `navigation` focus → re-lê `getDailyState()` | `src/screens/HomeScreen.js` |

---

## Bugs mantidos abertos

| Código | Motivo | Bloqueia PASS global? |
|--------|--------|----------------------|
| `BUG_INSIGHTS_XP_STREAK_MISMATCH` | Mock social em Insights; precisa decisão de produto | Sim (Insights) |
| `BUG_PAYWALL_TOO_AGGRESSIVE` | P2 — 3/3C | Não para Home core |
| `BUG_MOCK_RANKING_EXPOSED` | P2 | Não |
| `BUG_MICROCOPY_ACCENTS_BROKEN` | P2 | Não |
| Salvar refeição deep audit INCONCLUSIVO | Fluxo `btn-salvar-alimento` sem mudança visível na captura antiga | Revalidar só se regressão reportada |

---

## Arquivos alterados

- `src/context/modules/utils.ts`
- `src/screens/HomeScreen.js`
- `__tests__/dailyState.test.mjs`

---

## Testes

```text
node --test __tests__/dailyState.test.mjs
# 14/14 PASS (incl. getTodayKey local + proteinToday)
```

Gate 126/126 **não** rerodado. Captura visual bounded **não** executada (P1 coberto por `treino_postfix_001` + testes).

---

## Evidências

| Tipo | Referência |
|------|------------|
| Treino Home CTA | `screenshots/treino_postfix/treino_postfix_001_home_treino_state.png` — PASS |
| P1 validate | `screenshots/fix_p1/`, `fix_p1_metrics.json` |
| Deep audit histórico | `screenshots/home_deep/` (27 PNG) — meal bug `home_deep_022` |
| Análise Treino | `TREINO_FINAL_STATUS.md` |

---

## O que NÃO declarar

- App pronto
- PASS global do app
- Nutrição validada (3/3B)
- Treino reaberto

---

## Próxima ação única

**A)** Commit/organização dos fixes Home + Treino **ou** **B)** Revisão visual leve Home (script bounded opcional, ≤4 PNG) se Felipe quiser evidência nova de meal sync **ou** **C)** Insights/P2 (3/3C) com OK explícito — **sem** Nutrição profunda.
