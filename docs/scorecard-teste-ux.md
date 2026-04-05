# Scorecard Diario de Teste UX (5 min)

Objetivo:
- Transformar teste manual em decisao objetiva no mesmo dia.
- Priorizar 1 ajuste por rodada com maior impacto em crescimento.
- Evitar backlog inflado e manter ciclo curto de melhoria.

Como usar:
1. Rodar o roteiro em `docs/roteiro-teste-estrategico-ux.md`.
2. Preencher notas por fluxo (0-10).
3. Aplicar regra automatica no final.

Escala de nota (0-10):
- 9-10: fluxo obvio, rapido, sem atrito.
- 7-8: bom, com friccoes leves.
- 5-6: atrito moderado, impacta conclusao.
- 0-4: risco de abandono.

## Bloco 1 - Notas por fluxo
Data:
Sessao:
Responsavel:

- Treino (0-10):
  - Maior friccao:
  - Momento >2s:

- Nutricao (0-10):
  - Maior friccao:
  - Momento >2s:

- Paywall (0-10):
  - Faz sentido no contexto? (sim/nao)
  - Maior friccao:

- Retencao (0-10):
  - App puxa retorno com clareza? (sim/nao)
  - Maior friccao:

## Bloco 2 - Sinais operacionais
- Quantidade de hesitacoes >2s:
- Quantidade de momentos "quase desisti":
- Friccao critica encontrada? (sim/nao)
- Erro tecnico percebido no fluxo? (sim/nao)

## Bloco 3 - Conversao para backlog
Registrar somente 1 item prioritario do dia:
- Problema:
- Impacto:
- Tipo (aquisicao/ativacao/retencao/receita):
- Severidade (alta/media/baixa):
- Confidence (alta/media/baixa):
- Revenue impact (direto/indireto):
- Ajuste proposto:
- Owner:
- Prazo:

Regra de foco:
- Se surgirem 3-5 friccoes, escolher apenas 1 para executar no dia.

## Bloco 4 - Motor de decisao automatica
Regras:
1. Se houve friccao critica ou nota <= 6 em retencao/treino/nutricao:
   - Decisao: ITERAR hoje no item prioritario.
2. Se nota >= 8 no fluxo alterado por 2 dias e sem alerta tecnico:
   - Decisao: MANTER.
3. Se nota caiu por 2 dias seguidos apos mudanca ou erro tecnico subiu:
   - Decisao: ROLLBACK.

Desempate de prioridade (quando houver mais de 1 opcao):
1. Retencao + confidence alta.
2. Receita direta + confidence media/alta.
3. Ativacao + confidence alta.

Decisao final da rodada:
- [ ] Manter
- [ ] Iterar
- [ ] Rollback

Justificativa objetiva (1-2 linhas):

## Bloco 5 - KPI de controle rapido
Preencher com o snapshot do dia anterior:
- North star `daily_dual_adherence_rate`:
- Treino `workout_started -> workout_completed`:
- Nutricao `nutrition_day_saved -> nutrition_day_completed`:
- Monetizacao `paywall_viewed -> paywall_clicked -> paywall_converted`:
- Retencao `streak_updated` e `missed_day`:

## Bloco 6 - Painel de 10 segundos
Responder em sequencia:
1. North star subiu ou caiu?
2. Treino melhorou ou piorou?
3. Nutricao melhorou ou piorou?
4. Clique de paywall melhorou ou piorou?
5. Alertas tecnicos subiram?

Gatilho de controle:
- Se 2 ou mais respostas forem "pior", pausar novas mudancas e atacar a friccao principal.

## Meta de disciplina operacional
- 1 sessao por dia.
- 1 ajuste prioritario por dia.
- 1 decisao objetiva por dia.
