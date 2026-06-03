# Pacotes ChatGPT — Auditoria Visual Evolução

**Projeto ChatGPT:** Dever de casa / chat para o cursor  
**Device:** emulator-5554  
**Regra:** max 4-6 screenshots por pacote

---

## Historico

| Pacote | Aba | Screenshots | Status |
|---|---|---|---|
| HOME 1/2 | Home | 4 | Enviado ChatGPT |
| HOME 2/2 | Home | 5 | Enviado ChatGPT |
| **HOME 3/3A** | Home deep | 6 | **ANALISE_RECEBIDA_E_REGISTRADA** (2026-05-30) |
| **HOME 3/3B** | Home deep | 6 | **Pronto para envio** |
| **HOME 3/3C** | Home deep | 5 | **Pronto para envio** |
| **TREINO 1/3** | Treino | 5 | **ANALISE_RECEBIDA_E_REGISTRADA** (2026-05-31) |
| **TREINO 2/3** | Treino | 5 | **ANALISE_RECEBIDA_E_REGISTRADA** (2026-05-31) |
| **TREINO 3/3** | Treino | 5 | **ANALISE_RECEBIDA_E_REGISTRADA** (2026-05-31) |
| **PACOTE_COMPLETO_TREINO_P1_P2** | Treino (codigo + testes) | 0 PNG + 1 MD | **ANALISE_RECEBIDA_E_REGISTRADA** (2026-06-02) |

**Envio via Playwright:** MCP `user-playwright` → Dever de casa / chat para o cursor (HOME 3/3A, TREINO 1/3–3/3 e PACOTE_COMPLETO enviados com sucesso)

### PACOTE_COMPLETO_TREINO_P1_P2 (2026-06-02)

| Campo | Valor |
|---|---|
| **Codigo** | `PACOTE_COMPLETO_TREINO_P1_P2` |
| **Canal** | Dever de casa → Chat do Cursor |
| **Chat URL** | https://chatgpt.com/g/g-p-69ca44b08b848191926fe19ddcb48d3d/c/6a19e72a-0cc0-83e9-a620-a3e496ea1953 |
| **Enviado em** | 2026-06-02T17:05:58-03:00 (Playwright MCP) |
| **Arquivo** | `qa/live_mapping/PACOTE_COMPLETO_TREINO_P1_P2_2026-05-28.md` |
| **Conteudo** | Estado projeto, arquivos alterados, trechos codigo, gate 76/76, pendencias PNG, pedido analise |
| **Resposta** | **Recebida** 2026-06-02 — formato secoes 1–9 |
| **Veredito ChatGPT** | PASS tecnico parcial; NAO PASS visual/global; proximo `BUG_WORKOUT_MODE_CARD_BLOATED` |

---

## PACOTE HOME 1/2

### Arquivos (enviar estes 4 PNG)

1. `qa/live_mapping/screenshots/home/home_001_inicio.png` — Home / estado inicial
2. `qa/live_mapping/screenshots/home/home_002_continuar_treino.png` — Apos Continuar treino
3. `qa/live_mapping/screenshots/home/home_003_registrar_refeicao.png` — Registrar refeicao
4. `qa/live_mapping/screenshots/home/home_004_ver_insights.png` — Ver insights do dia

### Prompt para colar no ChatGPT

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada:
Home

Pacote:
HOME 1/2

Objetivo:
Analisar visualmente as screenshots, identificar bugs, inconsistências, telas feias, textos ruins, problemas de UX, fluxos quebrados e o que faltou mapear.

Screenshots enviadas:

1. home_001_inicio.png — Home / estado inicial
2. home_002_continuar_treino.png — Treino de hoje apos Continuar treino
3. home_003_registrar_refeicao.png — Tela aberta por Registrar refeicao
4. home_004_ver_insights.png — Tela Insights

O que eu testei:

- Clique em Continuar treino (Home → Treino)
- Voltei e cliquei Registrar refeicao
- Voltei e cliquei Ver insights do dia

O que preciso que você analise:

1. O que está feio visualmente.
2. O que está confuso.
3. O que parece bug de lógica.
4. O que parece bug de navegação.
5. O que parece bug de estado/progresso.
6. O que faltou eu testar nessa aba.
7. O que NÃO devo mexer.
8. O que devo corrigir primeiro.
9. Prioridade dos problemas: P0, P1, P2, P3.

Problemas já percebidos por mim:

- Treino abriu com "Exercicio 1 de 1" e series 0/4 (esperado multi-exercicio)
- BUG: MULTI_EXERCISE_WORKOUT_NOT_LOADED
- BUG: WORKOUT_PRESET_ONLY_ONE_EXERCISE

Responda em formato objetivo:

Diagnóstico visual
Bugs encontrados
Melhorias recomendadas
O que faltou mapear
Prioridade de correção
Próxima ação única
```

---

## PACOTE HOME 2/2

### Arquivos (enviar estes 5 PNG)

1. `qa/live_mapping/screenshots/home/home_005_tab_treino.png` — Aba Treino (Hub)
2. `qa/live_mapping/screenshots/home/home_006_tab_nutricao.png` — Aba Nutricao
3. `qa/live_mapping/screenshots/home/home_007_tab_coach.png` — Aba Coach
4. `qa/live_mapping/screenshots/home/home_008_tab_mais.png` — Aba Mais
5. `qa/live_mapping/screenshots/home/home_010_tab_home.png` — Retorno Home

### Prompt para colar no ChatGPT

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada:
Home (navegacao inferior)

Pacote:
HOME 2/2

Objetivo:
Analisar visualmente as screenshots das abas inferiores, identificar bugs de navegacao, UX, layout e textos.

Screenshots enviadas:

1. home_005_tab_treino.png — Hub Treino
2. home_006_tab_nutricao.png — Aba Nutricao
3. home_007_tab_coach.png — Aba Coach
4. home_008_tab_mais.png — Aba Mais
5. home_010_tab_home.png — Retorno Home

O que eu testei:

- Toque em cada aba inferior (Treino, Nutricao, Coach, Mais) sem aprofundar fluxos
- Retorno a Home

O que preciso que você analise:

1. O que está feio visualmente.
2. O que está confuso.
3. O que parece bug de navegação.
4. Abas abrem a tela certa?
5. O que faltou mapear.
6. Prioridade P0-P3.

Responda em formato objetivo:

Diagnóstico visual
Bugs encontrados
Melhorias recomendadas
O que faltou mapear
Prioridade de correção
Próxima ação única
```

---

## Instrucao de envio

**Nao consegui anexar as imagens automaticamente ao ChatGPT.**

Felipe, envie manualmente no chat **Dever de casa / chat para o cursor**:

**HOME 1/2:** home_001_inicio.png, home_002_continuar_treino.png, home_003_registrar_refeicao.png, home_004_ver_insights.png

**HOME 2/2:** home_005_tab_treino.png, home_006_tab_nutricao.png, home_007_tab_coach.png, home_008_tab_mais.png, home_010_tab_home.png

Cole o prompt correspondente acima junto com as imagens.

---

## Analise local Cursor (HOME 1/2 — rascunho)

**Data:** 2026-05-28 | **Device:** emulator-5554 | **Nao substitui ChatGPT**

### Diagnostico visual

| Print | Observacao |
|---|---|
| home_001_inicio | Home coerente: CTA verde "Continuar treino", resumo "Supino Reto Barra", barras proteina/agua zeradas, streak dia 1. Copy "Voce parou no treino" sem acento em "Voce". |
| home_002_continuar_treino | Navegacao OK. **Exercicio 1 de 1** (Supino Reto Barra), 0/4 series, 0% concluido. Modo avancado ativo. Descanso 30/60/120 visivel. Redundancia "0/4 series" e "Nivel 2" duplicados no header. |
| home_003_registrar_refeicao | Abriu aba Nutricao (nao modal inline). Registro rapido, meta 160g proteina, coach nutricional com sugestao. Fluxo funcional. |
| home_004_ver_insights | Insights com banner PRO, dashboard semanal zerado, loop coach "Prioridade: Treinar", ranking #2 Voce 264 XP. Fluxo funcional. |

### Bugs encontrados (local)

| Prioridade | Codigo | Evidencia |
|---|---|---|
| **P0** | MULTI_EXERCISE_WORKOUT_NOT_LOADED | home_002 — "Exercicio 1 de 1" |
| **P0** | WORKOUT_PRESET_ONLY_ONE_EXERCISE | home_002 — treino continua com 1 exercicio |
| **P2** | COPY_MISSING_ACCENT | home_001 — "Voce" sem acento |
| **P2** | WORKOUT_HEADER_REDUNDANT_TEXT | home_002 — series/nivel repetidos |

### Melhorias recomendadas (local)

- Corrigir preset/sessao para 5 exercicios antes de validar progresso %.
- Unificar linha de progresso no Treino (series + nivel uma vez).
- Revisar se "Registrar refeicao" na Home deveria abrir modal vs aba Nutricao.

### Proxima acao unica (local)

Enviar HOME 1/2 ao ChatGPT; iniciar captura TREINO 1/3 registrando estado real (mesmo com 1 exercicio).

---

## PACOTE TREINO 1/3

**Status:** **ANALISE_RECEBIDA_E_REGISTRADA**  
**Enviado em:** 2026-05-31  
**Resposta capturada:** 2026-05-31  
**Canal:** Dever de casa → Chat do Cursor (Playwright/navegador PC)  
**Resumo:** [`TREINO_CHATGPT_ANALYSIS_SUMMARY.md`](TREINO_CHATGPT_ANALYSIS_SUMMARY.md)  
**Arquivos enviados:** treino_001_inicio_ex1, 002_ex1_parcial, 003_ex1_concluido, 004_ex2_inicio, 005_progresso_parcial

### Arquivos (enviar estes 5 PNG)

1. `qa/live_mapping/screenshots/treino/treino_001_inicio_ex1.png` — Treino aberto, Exercicio 1 de Y
2. `qa/live_mapping/screenshots/treino/treino_002_ex1_parcial.png` — Apos 1 serie salva
3. `qa/live_mapping/screenshots/treino/treino_003_ex1_concluido.png` — Series ex1 (estado real)
4. `qa/live_mapping/screenshots/treino/treino_004_ex2_inicio.png` — Tentativa transicao ex2
5. `qa/live_mapping/screenshots/treino/treino_005_progresso_parcial.png` — Barra % visivel

### Prompt para colar no ChatGPT

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada:
Treino de hoje

Pacote:
TREINO 1/3

Objetivo:
Analisar abertura do treino, progresso de series, transicao entre exercicios e barra de %.

Screenshots enviadas:

1. treino_001_inicio_ex1.png — Inicio ex1 (pos QA reset)
2. treino_002_ex1_parcial.png — 1 serie salva
3. treino_003_ex1_concluido.png — Estado pos completar series
4. treino_004_ex2_inicio.png — Tentativa ir para ex2
5. treino_005_progresso_parcial.png — Progresso parcial

O que eu testei:

- Reset QA evolucao://qa/workout-reset
- Abrir treino (Continuar/Iniciar)
- Salvar series via keypad + btn-save-set
- Observar progresso % e contador Exercicio X de Y

Problemas ja percebidos:

- Exercicio 1 de 1 (esperado 5)
- MULTI_EXERCISE_WORKOUT_NOT_LOADED / WORKOUT_PRESET_ONLY_ONE_EXERCISE
- Transicao ex2 falhou (permaneceu 1 de 1)
- Progresso 25% com 1/4 series apos salvar
- NAO declarar PASS

Responda: Diagnostico visual | Bugs | Melhorias | Prioridade P0-P3 | Proxima acao unica
```

### Analise local Cursor (TREINO 1/3 — rascunho)

- **treino_001:** Supino Reto Barra, Ex 1 de 1, 0/4, modo avancado, rest 30/60/120 OK.
- **treino_002-005:** Apos salvar, 25% concluido com 1/4 series; nunca avancou para ex2.
- **P0:** preset 1 exercicio bloqueia fluxo multi.
- **P1:** progresso 25% com apenas 1 serie salva (esperado ~5% se 5 exercicios x 4 series).

---

## PACOTE TREINO 2/3

**Status:** **ANALISE_RECEBIDA_E_REGISTRADA**  
**Enviado em:** 2026-05-31  
**Resposta capturada:** 2026-05-31  
**Canal:** Dever de casa → Chat do Cursor (Playwright/navegador PC)  
**Arquivos enviados:** treino_006_ex3_inicio, 007_ex5_inicio, 008_modo_simples, 009_modo_avancado, 010_rest_presets

### Arquivos (enviar estes 5 PNG)

1. `qa/live_mapping/screenshots/treino/treino_006_ex3_inicio.png`
2. `qa/live_mapping/screenshots/treino/treino_007_ex5_inicio.png`
3. `qa/live_mapping/screenshots/treino/treino_008_modo_simples.png`
4. `qa/live_mapping/screenshots/treino/treino_009_modo_avancado.png`
5. `qa/live_mapping/screenshots/treino/treino_010_rest_presets.png`

### Prompt para colar no ChatGPT

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada:
Treino de hoje (multi-exercicio + modos)

Pacote:
TREINO 2/3

Screenshots: treino_006 a treino_010 (ex3, ex5 via avancado, modo simples, modo avancado, rest presets)

O que testei:
- Avancar series / modo avancado / lista exercicios
- Toggle btn-toggle-workout-mode (simples vs avancado)
- Botoes descanso 30s/60s/120s

Problemas ja percebidos:
- Permanece Exercicio 1 de 1 (nao chegou ex3/ex5)
- Finalizar treino visivel com 1/4 series (FINISH_BUTTON_VISIBLE_TOO_EARLY)
- REST_BUTTONS_MISSING: NAO confirmado — presets visiveis
- Exercicio mudou para Puxada Frontal Polia no modo simples

Responda: Diagnostico visual | Bugs | Melhorias | Prioridade P0-P3 | Proxima acao unica
```

---

## PACOTE TREINO 3/3

**Status:** **ANALISE_RECEBIDA_E_REGISTRADA**  
**Enviado em:** 2026-05-31  
**Resposta capturada:** 2026-05-31  
**Canal:** Dever de casa → Chat do Cursor (Playwright/navegador PC)  
**Arquivos enviados:** treino_011_pre_finish, 012_finish_confirm, 013_home_pos_finish, 014_historico, 015_pos_reopen

### Arquivos (enviar estes 5 PNG)

1. `qa/live_mapping/screenshots/treino/treino_011_pre_finish.png`
2. `qa/live_mapping/screenshots/treino/treino_012_finish_confirm.png`
3. `qa/live_mapping/screenshots/treino/treino_013_home_pos_finish.png`
4. `qa/live_mapping/screenshots/treino/treino_014_historico.png`
5. `qa/live_mapping/screenshots/treino/treino_015_pos_reopen.png`

### Prompt para colar no ChatGPT

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada:
Treino (finalizar + persistencia)

Pacote:
TREINO 3/3

Screenshots: treino_011 a treino_015 (pre-finish, confirmacao, home pos finish, historico, reopen)

O que testei:
- Finalizar treino
- Voltar Home
- Historico de treinos
- force-stop + reopen app

Problemas ja percebidos:
- Treino 1 exercicio durante toda sessao
- Finalizar visivel cedo (25%, 1/4 series)

Responda: Diagnostico visual | Bugs | Melhorias | Prioridade P0-P3 | Proxima acao unica
```

---

## PACOTE HOME 3/3A — Scroll + Continuar treino

**Status:** ANALISE_RECEBIDA_E_REGISTRADA  
**Enviado em:** 2026-05-30  
**Canal:** Dever de casa → Chat do Cursor (Playwright/navegador PC)  
**Resumo:** `HOME_3_3A_CHATGPT_ANALYSIS_SUMMARY.md` · resposta completa em `CHATGPT_ANALYSIS_RESPONSES.md`  
**Arquivos enviados:** home_deep_001_top, 002_bottom, 004_treino_aberto, 008_descanso_action, 010_after_save_set, 011_home_after_workout_action

### Arquivos (enviar estes 6 PNG)

1. `qa/live_mapping/screenshots/home_deep/home_deep_001_top.png`
2. `qa/live_mapping/screenshots/home_deep/home_deep_002_bottom.png`
3. `qa/live_mapping/screenshots/home_deep/home_deep_004_treino_aberto.png`
4. `qa/live_mapping/screenshots/home_deep/home_deep_008_descanso_action.png`
5. `qa/live_mapping/screenshots/home_deep/home_deep_010_after_save_set.png`
6. `qa/live_mapping/screenshots/home_deep/home_deep_011_home_after_workout_action.png`

### Prompt

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada: Home (funcional profundo)
Pacote: HOME 3/3A — Scroll + Continuar treino

Objetivo: Validar scroll da Home, treino como função real (descanso, salvar série), e se Home atualiza após voltar.

Screenshots:
1. home_deep_001_top — Home topo
2. home_deep_002_bottom — Home scroll final (+ Expandir/Beber água)
3. home_deep_004_treino_aberto — Após Continuar treino
4. home_deep_008_descanso_action — Botão Descanso acionado
5. home_deep_010_after_save_set — Após salvar série
6. home_deep_011_home_after_workout_action — Home após voltar do treino

Problemas já observados:
- Exercício 1 de 1 (esperado multi)
- Finalizar treino visível com 25%
- Home não atualizou proteína/streak após salvar série
- Streak Home "Dia 1" vs Treino "0 dias"

Responda: Diagnóstico visual | Bugs | Melhorias | P0-P3 | Próxima ação única
```

---

## PACOTE HOME 3/3B — Registrar refeição

### Arquivos (enviar estes 6 PNG)

1. `qa/live_mapping/screenshots/home_deep/home_deep_013_nutricao_aberta.png`
2. `qa/live_mapping/screenshots/home_deep/home_deep_014_chip_ovos.png`
3. `qa/live_mapping/screenshots/home_deep/home_deep_017_chip_whey.png`
4. `qa/live_mapping/screenshots/home_deep/home_deep_019_after_montar_refeicao.png`
5. `qa/live_mapping/screenshots/home_deep/home_deep_021_after_save_meal.png`
6. `qa/live_mapping/screenshots/home_deep/home_deep_022_home_after_meal.png`

### Prompt

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada: Home → Nutrição (funcional profundo)
Pacote: HOME 3/3B — Registrar refeição

Screenshots:
1. home_deep_013 — Nutrição aberta via Registrar refeição
2. home_deep_014 — Chip +2 ovos
3. home_deep_017 — Chip +1 whey
4. home_deep_019 — Após Montar refeição (frango 150g arroz 100g)
5. home_deep_021 — Após tentativa Salvar refeição
6. home_deep_022 — Home após voltar (proteína ainda 0/150g)

Problemas já observados:
- Meta proteína Home 150g vs Nutrição 160g
- Proteína Home não atualizou após chips + montar refeição
- Salvar refeição inconclusivo (UI sem confirmação clara)

Responda: Diagnóstico visual | Bugs | Melhorias | P0-P3 | Próxima ação única
```

---

## PACOTE HOME 3/3C — Insights + Coach

### Arquivos (enviar estes 5 PNG)

1. `qa/live_mapping/screenshots/home_deep/home_deep_024_insights_top.png`
2. `qa/live_mapping/screenshots/home_deep/home_deep_025_insights_bottom.png`
3. `qa/live_mapping/screenshots/home_deep/home_deep_026_after_unlock_plan.png`
4. `qa/live_mapping/screenshots/home_deep/home_deep_027_coach_after_home_actions.png`
5. `qa/live_mapping/screenshots/home_deep/home_deep_028_home_final_state.png`

### Prompt

```
AUDITORIA VISUAL — EVOLUÇÃO APP

Aba analisada: Home → Insights + Coach (coerência final)
Pacote: HOME 3/3C

Screenshots:
1. home_deep_024 — Insights topo (banner PRO)
2. home_deep_025 — Insights scroll final (ranking)
3. home_deep_026 — Após Desbloquear meu plano
4. home_deep_027 — Coach após todas as ações da Home
5. home_deep_028 — Home estado final

Problemas já observados:
- Paywall PRO antes dos dados úteis
- Ranking social (Leo, Você…) sem contexto mock/real
- Streak/XP divergem entre Home, Insights e Treino
- Coach não reflete treino/refeição feitos na sessão
- Microcopy sem acento (Voce, Sugestao)

Responda: Diagnóstico visual | Bugs | Melhorias | P0-P3 | Próxima ação única
NÃO declarar PASS na Home ainda.
```

---

## Instrucao de envio (atualizada)

**Nao consegui anexar as imagens automaticamente ao ChatGPT.**

Felipe, envie manualmente no chat **Dever de casa / chat para o cursor**:

**HOME 1/2:** home_001_inicio.png, home_002_continuar_treino.png, home_003_registrar_refeicao.png, home_004_ver_insights.png

**HOME 2/2:** home_005_tab_treino.png, home_006_tab_nutricao.png, home_007_tab_coach.png, home_008_tab_mais.png, home_010_tab_home.png

**HOME 3/3A:** home_deep_001_top.png, 002_bottom, 004_treino_aberto, 008_descanso_action, 010_after_save_set, 011_home_after_workout_action

**HOME 3/3B:** home_deep_013_nutricao_aberta, 014_chip_ovos, 017_chip_whey, 019_after_montar_refeicao, 021_after_save_meal, 022_home_after_meal

**HOME 3/3C:** home_deep_024_insights_top, 025_insights_bottom, 026_after_unlock_plan, 027_coach_after_home_actions, 028_home_final_state

**TREINO 1/3:** treino_001_inicio_ex1.png … treino_005_progresso_parcial.png

**TREINO 2/3:** treino_006_ex3_inicio.png … treino_010_rest_presets.png

**TREINO 3/3:** treino_011_pre_finish.png … treino_015_pos_reopen.png
