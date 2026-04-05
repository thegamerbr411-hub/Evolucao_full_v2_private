# Roteiro de Teste Estrategico (UX + Conversao)

Objetivo:
- Validar fluidez, clareza de proximo passo e pontos de travamento.
- Detectar friccoes que derrubam conclusao de fluxo.

Pergunta principal da sessao:
- "Em que momento eu quase desisti?"

Regra do teste:
- Nao testar como dev.
- Tratar qualquer pausa de 1 segundo como sinal de friccao.
- Se gerou duvida, registrar como bug de UX.
- Se houve busca ativa por um CTA, registrar como bug de produto.
- Se pensou por >= 2 segundos para decidir o proximo passo, tratar como friccao critica.

Duracao alvo da sessao:
- 20-30 minutos no total.

Scorecard de consolidacao:
- Preencher apos a sessao: docs/scorecard-teste-ux.md

Blocos sugeridos:
1. Treino: 5-7 min.
2. Nutricao: 5-7 min.
3. Paywall: 3-5 min.
4. Retencao: 3-5 min.

## Preparacao (5 min)
- Build/app aberto em ambiente real de uso.
- Sem inspecionar codigo durante o teste.
- Cronometro ligado para cada fluxo.
- Bloco de notas aberto com template abaixo.

Template de anotacao por evento:
- Fluxo:
- Passo:
- Tempo no passo (s):
- Hesitacao? (sim/nao):
- Friccao encontrada:
- Gravidade (alta/media/baixa):
- Hipotese da causa:
- Ajuste sugerido:

Template backlog-ready (usar no debrief):
- Problema:
- Impacto:
- Tipo (aquisicao/ativacao/retencao/receita):
- Severidade (alta/media/baixa):
- Confidence (alta/media/baixa):
- Ajuste proposto:

---

## Teste 1 - Fluxo de treino (critico)
Passos:
1. Abrir app.
2. Ir para treino.
3. Registrar 3 exercicios.
4. Finalizar treino.

Observar:
- Demorou para achar CTA principal?
- Teve passo ambigou ou com dupla interpretacao?
- Em algum ponto bateu preguica de concluir?
- Em algum ponto voce quase desistiu?

Criterio de aprovacao:
- Conclusao do fluxo sem duvida relevante.
- Nenhuma hesitacao > 1 segundo em CTA principal.
- Tempo total consistente com uso real (sem exploracao dev).

Eventos para conferir depois:
- `workout_started`
- `workout_set_saved`
- `workout_completed`
- `workout_set_save_failed` (se houver)

---

## Teste 2 - Fluxo de nutricao
Passos:
1. Adicionar comida.
2. Salvar.
3. Fechar o dia.

Observar:
- Ficou obvio quando fechar o dia?
- Exigiu pensar demais para concluir?
- Teve cliques desnecessarios?
- Teve momento de cansaco por excesso de passos?

Criterio de aprovacao:
- Usuario entende quando e como fechar o dia.
- Fluxo sem retorno/ida e volta desnecessaria.

Eventos para conferir depois:
- `meal_logged`
- `nutrition_day_saved`
- `nutrition_day_completed`
- `quick_meal_save_failed` / `meal_draft_save_failed` (se houver)

---

## Teste 3 - Paywall sem vies
Passos:
1. Completar um treino.
2. Observar quando e como paywall aparece.

Pergunta-chave:
- "Faz sentido o paywall aparecer agora?"
- "Eu pagaria isso agora sem resistencia?"

Criterio de aprovacao:
- Momento de exibicao apos percepcao de valor.
- Sem sensacao de interrupcao forcada.

Eventos para conferir depois:
- `paywall_viewed`
- `paywall_clicked`
- `paywall_converted`

---

## Teste 4 - Retencao
Cenario:
- Simular 1 dia sem uso.
- Reabrir app no dia seguinte.

Observar:
- App puxa retorno com acao clara?
- Sinal de continuidade (streak, proximo passo) aparece?
- Sensacao de app "morto"?
- O primeiro passo de retorno e obvio em ate 2 segundos?

Criterio de aprovacao:
- Usuario recebe incentivo claro para voltar ao fluxo.
- Proximo passo direto e acionavel em 1 toque.

Eventos para conferir depois:
- `missed_day`
- `streak_updated`
- `app_opened`

---

## Matriz de severidade para priorizar ajustes
- Alta:
  - Impede conclusao do fluxo.
  - Cria duvida em CTA principal.
  - Gera abandono.
- Media:
  - Nao impede, mas aumenta atrito/tempo.
- Baixa:
  - Incomodo leve sem impacto claro na conclusao.

Prioridade pos-teste:
1. Alta severidade em retencao/receita.
2. Alta severidade em ativacao.
3. Media severidade com alta recorrencia.

Regra de acao:
- Se melhorou metrica-alvo e guardrails estao estaveis: manter.
- Se piorou por 2 dias ou elevou erro/falha: rollback rapido.

---

## Debrief pos-rodada (10 min)
- Top 3 travas reais encontradas:
1.
2.
3.

- Ajustes cirurgicos pro proximo dia:
1.
2.
3.

- Decisao operacional:
- Manter:
- Iterar:
- Rollback:
