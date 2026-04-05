# Fase 8 - Backlog de Crescimento (14 dias)

Objetivo macro:
- Aumentar `daily_dual_adherence_rate` (north star user-based).
- Melhorar conversao sem elevar friccao.
- Reduzir risco de churn precoce (`missed_day`).

## Priorizacao real (P0/P1/P2)

### P0 (comecar amanha)
- T2 - CTA concluir rapido treino.
- T4 - CTA fechar dia nutricao.
- T12 - Protocolo anti-missed_day.

Racional:
- esforco baixo, impacto alto na north star e retencao, risco baixo.

### P1 (depois de P0 estabilizar)
- T6 - Iteracao de copy/hierarquia de CTA.
- T10 - Timing do paywall.
- Extensao de T2: resumo pos-treino mais claro para reforco de conclusao.

### P2 (otimizacao e escala)
- T11 - Copy do paywall.
- T13 - Reforco de streak.
- T7 - Segmentacao novos vs recorrentes.

## Classificacao por ticket (confidence + impacto + receita)

Legenda:
- Confidence: alta | media | baixa.
- Impacto de funil: aquisicao | ativacao | retencao | receita.
- Revenue impact: direto | indireto.

| Ticket | Confidence | Impacto de funil | Revenue impact |
|---|---|---|---|
| T1 - Baseline congelado | alta | ativacao | indireto |
| T2 - CTA concluir rapido treino | alta | ativacao | indireto |
| T3 - Instrumentacao variante treino | alta | ativacao | indireto |
| T4 - CTA fechar dia nutricao | alta | ativacao | indireto |
| T5 - Revisao intermediaria/rollback | alta | retencao | indireto |
| T6 - Iteracao de copy CTA | media | ativacao | indireto |
| T7 - Segmentacao novos vs recorrentes | media | retencao | indireto |
| T8 - Go/No-Go semana 1 | alta | retencao | indireto |
| T9 - Baseline monetizacao por contexto | alta | receita | direto |
| T10 - Timing do paywall | media | receita | direto |
| T11 - Copy do paywall | media | receita | direto |
| T12 - Protocolo anti-missed_day | alta | retencao | indireto |
| T13 - Reforco de streak_updated | media | retencao | indireto |
| T14 - Consolidacao e review executivo | alta | receita | direto |

## Motor de prioridade operacional (usar todo dia)

Regra base:
- Sempre puxar primeiro: impacto em retencao ou receita + confidence alta.

Ordem padrao de execucao:
1. Retencao + confidence alta.
2. Receita direta + confidence media/alta.
3. Ativacao + confidence alta.
4. Demais itens.

Desempate (quando houver 2 itens na mesma faixa):
1. Menor risco tecnico.
2. Menor esforco de implementacao.
3. Maior velocidade de leitura de resultado (24-72h).

Regra de negocio:
- Retencao vem antes de monetizacao.
- Nao escalar monetizacao que degrade retencao de curto prazo.

Checklist de decisao diaria (2 minutos):
1. O ticket afeta retencao ou receita?
2. Confidence e alta?
3. O risco tecnico e baixo/moderado?
4. Consegue medir impacto em ate 72h?
5. Se piorar, rollback e simples?

Se qualquer resposta critica for "nao", rebaixar prioridade.

## Separacao produto vs codigo

### So produto (execucao rapida)
- copy do paywall;
- mensagens de streak e missed_day;
- hierarquia de CTA;
- texto de feedback nutricional.

### Produto + codigo (foco imediato)
- CTA fixo treino (T2);
- CTA fechar dia (T4);
- trigger anti-missed_day (T12);
- timing de paywall (T10).

### Mais tecnico (deixar para depois)
- segmentacao automatica;
- A/B mais robusto;
- personalizacao por comportamento.

## Plano de execucao (amanha)

### 0h-1h
- Implementar T2 e T4 em fluxo minimo funcional.

### 1h-2h
- Implementar T12 (trigger + mensagem de reforco).

### 2h-3h
- Validar eventos e payloads.
- Rodar suite e checar alertas/erros.

### 3h+
- Liberar para coleta.
- Registrar baseline do dia 1.

## Dashboard mental (10 segundos)
- North star de ontem: subiu ou caiu?
- Treino: taxa `workout_started -> workout_completed`.
- Nutricao: taxa `nutrition_day_saved -> nutrition_day_completed`.
- Monetizacao: `paywall_viewed -> paywall_clicked`.
- Operacao: alertas de erro ativos.

## Scripts de decisao automatica (if -> then)
- Se treino cair >= 8% por 2 dias:
  - reduzir friccao da tela de treino (1 clique a menos) e revisar CTA principal.
- Se nutricao cair >= 8% por 2 dias:
  - reforcar CTA "Fechar dia" e simplificar fechamento para 1 toque.
- Se p50 de duracao subir > 15%:
  - rollback da ultima mudanca de UI do fluxo afetado.
- Se erro tecnico subir acima da media semanal:
  - pausar rollout e corrigir causa raiz antes de continuar experimento.
- Se `paywall_viewed -> paywall_clicked` subir mas `click -> convert` cair:
  - manter timing vencedor e trocar copy/oferta imediatamente.

## Estrategia para bater dinheiro (foco crescimento)
- Meta primaria de receita:
  - aumentar `paywall_clicked -> paywall_converted` sem reduzir retencao.
- Alavancas prioritarias:
  - timing de paywall em momento de valor percebido (T10);
  - copy orientada a resultado semanal real (T11);
  - manter adesao de treino e nutricao para sustentar LTV (T2 + T4 + T12).
- Regra de negocio:
  - nunca escalar ganho de conversao que degrade retencao de curto prazo.

## Regras de decisao (globais)
- Promover experimento se:
  - melhora >= 8% na metrica-alvo;
  - sem piora em falha tecnica;
  - sem aumento > 15% no p50 de duracao do fluxo.
- Reverter experimento se:
  - piora da metrica-alvo por 2 dias seguidos; ou
  - qualquer spike operacional relevante em erros.

## KPIs e guardrails
- North star: `daily_dual_adherence_rate` (`userBasedValue`).
- Treino: `workout_started -> workout_completed`.
  - Guardrails: `workout_set_save_failed`, p50 `workout_completion`.
- Nutricao: `nutrition_day_saved -> nutrition_day_completed`.
  - Guardrails: `quick_meal_save_failed`, `meal_draft_save_failed`.
- Monetizacao: `paywall_viewed -> paywall_clicked -> paywall_converted`.
- Retencao: `streak_updated`, `missed_day`.

## T1 - Baseline congelado (Dia 1)
- Tipo: Setup
- Hipotese: baseline claro reduz decisao por intuicao e acelera iteracao valida.
- Implementacao:
  - Salvar snapshot diario por 7 dias em tabela operacional (arquivo/planilha/dashboard interno).
  - Criar painel diario com: north star, funis, friccao, erros e alertas.
- Metricas de sucesso:
  - baseline de 7 dias consolidado e publicado.
- Guardrails:
  - N/A (setup).
- Rollout:
  - 100% interno.
- Owner sugerido:
  - Produto + Engenharia.
- Status inicial:
  - TODO.

## T2 - Experimento A: CTA concluir rapido treino (Dia 2)
- Tipo: Experimento produto
- Hipotese: CTA de conclusao mais evidente reduz abandono de treino.
- Implementacao:
  - Destacar CTA de finalizacao apos set salvo.
  - Exibir resumo curto de progresso (sets concluidos/plano).
- Evento de sucesso:
  - `workout_started -> workout_completed`.
- Metricas de sucesso:
  - +8% ou mais na taxa start->complete.
- Guardrails:
  - `workout_set_save_failed` estavel.
  - p50 `workout_completion` sem subir > 15%.
- Rollout:
  - 50% usuarios (flag `exp_workout_fast_finish_v1`).
- Owner sugerido:
  - Engenharia mobile.
- Status inicial:
  - TODO.

## T3 - Instrumentacao de variante do Experimento A (Dia 2)
- Tipo: Analytics
- Hipotese: sem evento de variante nao ha leitura confiavel do A/B.
- Implementacao:
  - Incluir `experimentKey` e `variant` em eventos de treino (meta).
  - Exemplo: `experimentKey=exp_workout_fast_finish_v1`, `variant=A|B`.
- Evento de sucesso:
  - percentual de eventos com variante >= 95%.
- Guardrails:
  - sem aumento de payload invalido/erro.
- Rollout:
  - junto com T2.
- Owner sugerido:
  - Engenharia analytics.
- Status inicial:
  - TODO.

## T4 - Experimento B: Fechar dia com 1 toque (Dia 3)
- Tipo: Experimento produto
- Hipotese: CTA persistente de fechamento aumenta `nutrition_day_completed`.
- Implementacao:
  - Botao persistente "Fechar dia" ao atingir criterio minimo.
  - Copia curta com ganho claro.
- Evento de sucesso:
  - `nutrition_day_saved -> nutrition_day_completed`.
- Metricas de sucesso:
  - +10% ou mais na taxa saved->completed.
- Guardrails:
  - `quick_meal_save_failed` + `meal_draft_save_failed` estaveis.
  - p50 fluxo nutricional sem subir > 15%.
- Rollout:
  - 50% usuarios (flag `exp_nutrition_one_tap_close_v1`).
- Owner sugerido:
  - Engenharia mobile.
- Status inicial:
  - TODO.

## T5 - Revisao intermediaria e rollback parcial (Dia 4)
- Tipo: Operacao
- Hipotese: rollback rapido evita degradacao acumulada.
- Implementacao:
  - Rodar checklist de guardrails no fim do dia.
  - Se violar regra, rollback parcial da UI alterada.
- Metricas de sucesso:
  - tempo de decisao <= 15 min.
  - nenhuma degradacao segue para dia seguinte.
- Rollout:
  - interno.
- Owner sugerido:
  - Produto.
- Status inicial:
  - TODO.

## T6 - Iteracao de copy/hierarquia dos CTAs (Dia 5)
- Tipo: Otimizacao
- Hipotese: copy orientada a resultado aumenta clique sem aumentar ruido.
- Implementacao:
  - Ajustar titulo/subtitulo dos CTAs vencedores parciais.
  - Priorizar 1 CTA dominante por tela.
- Evento de sucesso:
  - aumento de click-through no CTA alvo.
- Guardrails:
  - sem queda nas taxas de conclusao dos funis.
- Rollout:
  - 50% (nova variante).
- Owner sugerido:
  - Produto + Design.
- Status inicial:
  - TODO.

## T7 - Segmentacao novos vs recorrentes (Dia 6)
- Tipo: Analise
- Hipotese: efeito das mudancas difere por maturidade do usuario.
- Implementacao:
  - Segmentar por idade de conta (<= 7 dias e > 7 dias).
  - Comparar uplift por segmento.
- Metricas de sucesso:
  - leitura segmentada publicada no daily report.
- Guardrails:
  - N/A (analise).
- Rollout:
  - interno.
- Owner sugerido:
  - Produto analytics.
- Status inicial:
  - TODO.

## T8 - Go/No-Go semana 1 (Dia 7)
- Tipo: Decisao
- Hipotese: consolidar apenas vencedores acelera ganho liquido.
- Implementacao:
  - Promover experimentos que bateram criterios.
  - Encerrar ou refatorar perdedores.
- Metricas de sucesso:
  - decisao registrada para cada experimento.
- Rollout:
  - de acordo com decisao (0%, 50% ou 100%).
- Owner sugerido:
  - Produto + Engenharia.
- Status inicial:
  - TODO.

## T9 - Baseline de monetizacao por contexto (Dia 8)
- Tipo: Setup monetizacao
- Hipotese: contexto correto aumenta click e conversao.
- Implementacao:
  - Quebrar funil por fonte: pos treino, pos insight, pos scanner.
- Metricas de sucesso:
  - ranking de contexto por `view->click` e `click->convert`.
- Guardrails:
  - sem piora relevante em retenção de curtissimo prazo.
- Rollout:
  - interno.
- Owner sugerido:
  - Produto growth.
- Status inicial:
  - TODO.

## T10 - Experimento C: Timing do paywall (Dia 9)
- Tipo: A/B paywall
- Hipotese: paywall pos valor percebido aumenta click com menor rejeicao.
- Implementacao:
  - Variante A: ponto atual.
  - Variante B: exibir apos momento de valor (resultado/insight).
- Evento de sucesso:
  - `paywall_viewed -> paywall_clicked`.
- Metricas de sucesso:
  - +8% ou mais em view->click.
- Guardrails:
  - `click->convert` nao piora.
- Rollout:
  - 50% (`exp_paywall_timing_v1`).
- Owner sugerido:
  - Engenharia mobile + Produto.
- Status inicial:
  - TODO.

## T11 - Experimento D: Copy do paywall (Dia 10)
- Tipo: A/B copy
- Hipotese: copy focada em resultado semanal converte melhor que copy de recurso.
- Implementacao:
  - Variante A: copy atual (feature-based).
  - Variante B: copy orientada a resultado mensuravel.
- Evento de sucesso:
  - `paywall_clicked -> paywall_converted`.
- Metricas de sucesso:
  - +8% ou mais em click->convert.
- Guardrails:
  - sem aumento em rejeicao imediata da tela.
- Rollout:
  - 50% (`exp_paywall_copy_v1`).
- Owner sugerido:
  - Produto + Conteudo.
- Status inicial:
  - TODO.

## T12 - Protocolo anti-missed_day (Dia 11)
- Tipo: Retencao
- Hipotese: reforco proativo em risco de quebra reduz `missed_day`.
- Implementacao:
  - Regra de risco (ex.: usuario sem treino no fim do dia + streak ativo).
  - Mensagem curta com acao unica.
- Evento de sucesso:
  - queda de `missed_day` diario.
- Metricas de sucesso:
  - reducao >= 8% em `missed_day` na coorte alvo.
- Guardrails:
  - sem aumento em opt-out/ignorar notificacao (se medido).
- Rollout:
  - 50% (`exp_retention_antimiss_v1`).
- Owner sugerido:
  - Engenharia + Produto.
- Status inicial:
  - TODO.

## T13 - Reforco de streak_updated (Dia 12)
- Tipo: Retencao
- Hipotese: micro celebracao com proximo passo aumenta continuidade.
- Implementacao:
  - Ao `streak_updated`, mostrar celebracao curta + CTA para proximo micro objetivo.
- Evento de sucesso:
  - aumento de engajamento no dia seguinte e queda relativa de `missed_day`.
- Guardrails:
  - sem elevar friccao do fluxo atual.
- Rollout:
  - 50% (`exp_streak_reinforcement_v1`).
- Owner sugerido:
  - Produto + Engenharia.
- Status inicial:
  - TODO.

## T14 - Consolidacao e review executivo (Dias 13-14)
- Tipo: Encerramento sprint
- Hipotese: consolidar vencedores com checklist evita ganhos falsos.
- Implementacao:
  - Consolidar vencedores em 100% gradualmente.
  - Registrar "escalou", "morreu", "backlog".
- Metricas de sucesso:
  - north star acima do baseline.
  - backlog priorizado para sprint seguinte.
- Rollout:
  - progressivo.
- Owner sugerido:
  - Produto.
- Status inicial:
  - TODO.

## Modelo rapido de ticket (copiar/colar)
- Titulo:
- Hipotese:
- Confidence: alta | media | baixa
- Mudanca:
- Impacto de funil: aquisicao | ativacao | retencao | receita
- Revenue impact: direto | indireto
- Evento de sucesso:
- Guardrails:
- Janela de leitura:
- Criterio de promocao:
- Criterio de rollback:
- Owner:
- Flag:

## Ritual diario (15 min)
1. Ler north star de ontem.
2. Ler funil treino e nutricao.
3. Checar alertas tecnicos.
4. Definir 1 acao unica do dia.
5. Registrar decisao: manter, iterar ou rollback.
