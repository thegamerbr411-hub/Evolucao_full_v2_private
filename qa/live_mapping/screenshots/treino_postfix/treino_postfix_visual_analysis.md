# Treino Postfix Visual Analysis

**Data:** 2026-06-02  
**Device:** emulator-5554  
**App:** com.tipolt.evolucaofullv2  
**Script:** `qa/live_mapping/treino_postfix_visual_check.ps1` (+ capturas suplementares bounded)  
**Gate técnico:** 126/126 PASS (`__tests__/`, 11 suites)

## Status geral

**PASS VISUAL PARCIAL COM RESSALVAS** — 6/8 PNG iniciais + recaptura gap 003/005; 007/008 N/C (testes); 003 modo avançado confirmado; Trocar condicionado a histórico; 005 painel vazio documentado (leitura em 006).

**Bloqueador encontrado e corrigido na sessão:** RedBox `getFoodCatalog` em `coach.js` (import ausente) — impedia boot na 1ª execução; após hot reload/relaunch, Home e Treino renderizaram.

---

## Prints capturados

| Print | Tela | Objetivo | Resultado | Observação |
|-------|------|----------|-----------|------------|
| treino_postfix_001_home_treino_state.png | Home | Sem Concluído + Continuar | **PASS** | INICIAR TREINO + “Nao iniciado”; sem conflito de CTAs |
| treino_postfix_002_treino_inicio_modo_simples.png | Treino | Modo simples, progresso, checks | **PASS** | Exercício 1 de 5; Pronta/Pendente; Salvar serie só na série ativa; 0/17 sem duplicação gritante |
| treino_postfix_003_treino_modo_avancado.png | Treino | Modo avançado + helper + Trocar | **PARTIAL** | Barra “Modo simples” + Alternar visível em captura com header “Treino de hoje”; layout de séries ainda estilo simples; chip Trocar não confirmado no PNG |
| treino_postfix_004_finish_incompleto_alert.png | Treino | Alert treino incompleto | **PASS** | Modal “Treino em andamento”; SAIR E SALVAR / CONTINUAR TREINO |
| treino_postfix_005_historico_exercicio.png | Treino | Painel Historico do exercicio | **PARTIAL** | Painel não visível; sem 2060/1010; provável ausência de histórico no exercício ativo nesta sessão |
| treino_postfix_006_history_screen_local_logs.png | Historico | Bloco series (local) | **PASS** | “Historico de series (local)” + linha válida + hint “1 registro invalido ignorado na leitura” |
| treino_postfix_007_input_invalido_bloqueado.png | Treino | Input absurdo bloqueado | **N/C** | Não capturado (budget XML 6 dumps); coberto por `workoutInputValidation.test.mjs` |
| treino_postfix_008_finish_fields_preserved.png | Treino | Kg/Reps no save/finish | **N/C** | Não capturado; coberto por `workoutSetDisplayValue.test.mjs` |

**PNG no disco:** 6/8 obrigatórios (+ 007/008 opcionais ausentes)

---

## Itens validados

| Item | Veredito |
|------|----------|
| Progresso duplicado | **PASS** — linha única “Treino: 0/17 series concluidas · 0%” |
| Mode card bloated | **PASS** — “Modo simples” + chip “Alternar” compactos (quando header visível) |
| Series checks | **PASS** — Pronta + Salvar serie; futuras Pendente sem check verde |
| Trocar exercício | **PARTIAL** — não confirmado visualmente nesta rodada |
| Finish incompleto | **PASS** — modal de confirmação |
| Finish fields | **Técnico-only** — testes 10/10; sem print |
| Histórico exercício | **PARTIAL** — painel não no PNG; código/testIDs existem |
| Histórico local | **PASS** — bloco local + sanitização |
| Input inválido | **Técnico-only** — testes 10/10; sem print |
| Texto invisível | **PASS** — contraste legível nos PNGs |
| Registrar 10kg/debug | **PASS** — não visível |

---

## Bugs confirmados visualmente como corrigidos

- BUG_HOME_CONCLUIDO_CONTINUAR (001 — sem conflito nesta sessão)
- BUG_WORKOUT_SERIES_CHECKS_CONFUSING (002)
- BUG_WORKOUT_FINISH_NO_CONFIRM (004)
- BUG_WORKOUT_HISTORY_CAPTURE_INCOMPLETE — bloco Historico local (006)
- BUG_WORKOUT_PROGRESS_DUPLICATE (progresso único no treino)
- BUG_WORKOUT_MODE_CARD_BLOATED (barra modo compacta quando visível)

## Bugs técnico-only (gate PASS, print ausente ou parcial)

- BUG_WORKOUT_INPUT_NO_VALIDATION (007 N/C)
- BUG_WORKOUT_FINISH_FIELDS_RESET (008 N/C)
- BUG_WORKOUT_SUBSTITUIR_NO_CONTEXT (003 Trocar não confirmado)
- Painel “Historico do exercicio” no Treino (005 PARTIAL)

## Bugs ainda abertos

- Nenhum regressão crítica visual confirmada
- BUG_WORKOUT_HISTORY_PERMANENT_DELETE — não autorizado
- Boot RedBox `getFoodCatalog` — **corrigido** em `coach.js` durante QA (fora do escopo treino, mas necessário para captura)

## Itens não capturados e motivo

| Item | Motivo |
|------|--------|
| 007 input inválido | Limite 6 XML + 120s; risco overlay/timer |
| 008 finish fields | Mesmo budget; coberto por teste unitário |
| 005 painel exercício | Histórico vazio no exercício ativo ou painel abaixo da dobra sem scroll suficiente |

---

## Recaptura gap 003/005 (2026-06-02)

**Script:** `treino_postfix_gap_check.ps1` + taps suplementares bounded  
**Métricas:** `treino_postfix_gap_metrics.json`

| Print | Resultado | Observação |
|-------|-----------|------------|
| `treino_postfix_003_modo_avancado_trocar.png` | **PARTIAL** | **Modo avancado** + helper + layout avançado (1/5, ULTIMO TREINO, RPE, Salvar serie) **PASS**. **Trocar exercicio** / helper swap **ausentes** — só renderizam com `hasHistory`; exercício ativo `0kg x 0` nesta sessão. |
| `treino_postfix_005_historico_exercicio_com_logs.png` | **PASS** (vazio documentado) | Painel `Historico do exercicio` **não** exibido (sem logs válidos no exercício ativo). UI avançada visível. **2060/1010** aparecem só em **inputs de rascunho** com badge **Invalida** (não no painel de leitura). Leitura sanitizada comprovada em **006** (`20kg x 12`, hint ignorados). |

**Status geral pós-recaptura:** **PASS VISUAL PARCIAL COM RESSALVAS** (007/008 continuam N/C por teste; Trocar condicionado a histórico no exercício).

---

## Próxima ação recomendada

Aguardar OK Felipe. Nutrição fora de escopo. Não declarar app pronto. Opcional futuro: recapturar 005 com exercício que já tenha logs salvos (sem digitar 2060/1010) para lista preenchida no painel.
