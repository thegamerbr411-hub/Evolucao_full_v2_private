# HOME 3/3 — Auditoria Funcional Profunda

**Device:** emulator-5554  
**App:** com.tipolt.evolucaofullv2  
**Script:** `qa/live_mapping/home_deep_batch_audit.ps1`  
**Timestamp:** 2026-05-30 14:28  
**Screenshots:** `qa/live_mapping/screenshots/home_deep/` (27 PNG + batch_results.json)

---

## Estado inicial da Home

| Metrica | Valor |
|---|---|
| Streak | Dia 1 de sequencia |
| XP | +120 XP hoje |
| Proteina | 0 / 150 g |
| Agua | 0.0 / 3.5 L |
| Treino | Pendente / CONTINUAR TREINO visivel |

---

## Scroll da Home

| Item | Resultado |
|---|---|
| Conteudo oculto | Sim — scroll revela area inferior (SEMANA ATUAL, MAIS OPCOES) |
| Botoes nao mapeados | `Expandir` / MAIS OPCOES revela **+ Beber agua** apos tap |
| Problemas visuais | Acoes rapidas parcialmente visiveis no topo; conteudo inferior requer scroll |

**Evidencia:** `home_deep_001_top.png`, `home_deep_002_bottom.png`

---

## Continuar treino

| Item | Resultado |
|---|---|
| Tela aberta | Treino de hoje (WorkoutScreen) |
| Exercicios carregados | **Exercicio 1 de 1** (Supino Reto Barra / Puxada Frontal Polia) |
| Progresso inicial | 25% apos abrir (1/4 series ja salvas de sessao anterior) |
| Descanso | Presets 30s/60s/120 visiveis; botao Descanso responde (timer ativo em 008) |
| Salvamento de serie | Keypad + btn-save-set OK; permanece 1/4 series, 25%, Ex 1/1 |
| Estado apos voltar Home | Proteina 0/150g inalterada; streak Dia 1 inalterado; treino ainda pendente |

**Bugs confirmados:**
- BUG_WORKOUT_PRESET_ONLY_ONE_EXERCISE
- BUG_MULTI_EXERCISE_WORKOUT_NOT_LOADED
- BUG_FINISH_BUTTON_VISIBLE_TOO_EARLY (Finalizar com 25%)
- BUG_REST_BUTTONS_STATE_CONFUSING
- Streak treino "0 dias" vs Home "Dia 1" (desync)

**Evidencia:** `home_deep_003` … `home_deep_011`

---

## Registrar refeicao

| Item | Resultado |
|---|---|
| Chips testados | +2 ovos, +150g frango, +1 pao, +1 whey — taps OK |
| Refeicao manual | Texto `frango 150g arroz 100g` + Montar refeicao |
| Atualizacao Nutricao | Meta **160g** (0/160g); chips alteraram input |
| Atualizacao Home | Proteina permanece **0/150g** apos voltar |
| Atualizacao Coach | Nao sincronizado (proteina Home vs Nutricao divergem) |
| Salvar refeicao | Tap btn-salvar **INCONCLUSIVO** — tela nao mudou visivelmente |

**Bugs confirmados:**
- BUG_PROTEIN_GOAL_MISMATCH (Home 150g vs Nutricao 160g)
- BUG_MEAL_NOT_UPDATING_HOME
- BUG_NUTRITION_STATE_NOT_SYNCED (provavel — save inconclusivo)

**Evidencia:** `home_deep_012` … `home_deep_022`

---

## Ver insights

| Item | Resultado |
|---|---|
| Topo | Banner PRO "Destrave seu proximo salto" antes dos dados |
| Final da tela | Ranking social (#1 Leo, #2 Voce…), dashboard zerado |
| Botao PRO | Tap "Desbloquear meu plano" — OK (paywall/tela respondeu) |
| Ranking/social | Visivel — contexto mock nao explicado |
| Streak/XP vs Home | Insights Streak 0 / XP 208344 vs Home Dia 1 / +120 XP |

**Bugs confirmados:**
- BUG_PAYWALL_TOO_AGGRESSIVE
- BUG_MOCK_RANKING_EXPOSED
- BUG_MICROCOPY_ACCENTS_BROKEN
- BUG_INSIGHTS_XP_STREAK_MISMATCH

**Evidencia:** `home_deep_023` … `home_deep_026`

---

## Coerencia final Home / Treino / Nutricao / Coach

| Metrica | Home (028) | Treino (004) | Nutricao (013) | Insights (024) | Coach (027) |
|---|---|---|---|---|---|
| Streak | Dia 1 | 0 dias | — | Streak 0 | — |
| XP | +120 hoje | 208334 | — | 208344 | — |
| Proteina | 0/150g | — | 0/160g | — | — |
| Agua | 0.0/3.5L | — | — | — | — |
| Treino | Pendente | 1 de 1, 25% | — | — | Nao refletiu acao |

**Status final:** **HOME PASS PARCIAL (navegacao) / HOME FAIL (funcao/estado/dados)**

---

## Bugs encontrados

### P0
- Nenhum (sem crash ou bloqueio total)

### P1
- BUG_WORKOUT_PRESET_ONLY_ONE_EXERCISE — treino 1 de 1
- BUG_MULTI_EXERCISE_WORKOUT_NOT_LOADED — esperado 5 exercicios
- BUG_PROTEIN_GOAL_MISMATCH — 150g Home vs 160g Nutricao
- BUG_MEAL_NOT_UPDATING_HOME — refeicao nao atualizou resumo Home
- BUG_NUTRITION_STATE_NOT_SYNCED — estados divergentes entre abas
- BUG_INSIGHTS_XP_STREAK_MISMATCH — streak/XP diferentes por tela
- BUG_FINISH_BUTTON_VISIBLE_TOO_EARLY — Finalizar com 25%

### P2
- BUG_REST_BUTTONS_STATE_CONFUSING — selecao visual confusa 30/60/120
- BUG_PAYWALL_TOO_AGGRESSIVE — PRO no topo Insights
- BUG_MOCK_RANKING_EXPOSED — ranking sem contexto
- BUG_MICROCOPY_ACCENTS_BROKEN — Voce, Sugestao, etc.

### P3
- Scroll Home revela conteudo nao mapeado em HOME 1/2
- Salvar refeicao inconclusivo (UI nao confirmou save)

---

## O que faltou testar ainda

- + Beber agua (revelado apos Expandir) — tap e verificar Home
- SEMANA ATUAL / calendario
- Linhas do RESUMO DE HOJE (tap treino/proteina/agua individual)
- Confirmar save refeicao com fluxo alternativo (btn-save-meal)
- Scroll completo Coach pos-acoes
- Alternancia rapida entre abas (stress nav)

---

## Proxima acao recomendada

1. Enviar **HOME 3/3A** ao ChatGPT no navegador PC (6 prints)
2. Apos analise ChatGPT 3/3A–C, aguardar autorizacao Felipe para corrigir **fonte de verdade global** (streak, XP, proteina, treino ativo)
3. **Nao declarar PASS** na Home ate re-auditoria pos-correcao

**Cliques registrados:** 022–044 (23 acoes)  
**Verdict script:** HOME PASS PARCIAL / FAIL funcional
