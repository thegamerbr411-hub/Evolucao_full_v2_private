# RELATORIO UX PRODUTO

Data: 2026-04-26

## 1. Problemas por tela

### [src/screens/QuestionnaireScreen.js](src/screens/QuestionnaireScreen.js)
- Objetivo: onboarding rápido.
- Diagnóstico: objetivo claro; baixo ruído.
- Risco UX: entrada numérica ainda pode gerar erro de preenchimento para usuário iniciante.

### [src/screens/HomeScreen.js](src/screens/HomeScreen.js)
- Objetivo: orientar o dia e iniciar treino.
- Diagnóstico anterior: treino estava visível, mas sem CTA principal dominante e com distrações de navegação na própria Home.
- Problemas:
  - ação principal não era a mais forte visualmente
  - excesso de atalhos secundários no mesmo nível de importância

### [src/screens/WorkoutsHubScreen.js](src/screens/WorkoutsHubScreen.js)
- Objetivo: central de treino.
- Diagnóstico anterior: CTA bom, mas texto pouco urgente e sem atalho explícito para histórico (retorno/continuidade).
- Problemas:
  - foco difuso entre muitas ações simultâneas
  - falta de ponte clara treino concluído -> histórico

### [src/screens/WorkoutScreen.js](src/screens/WorkoutScreen.js)
- Objetivo: executar e registrar treino com fricção mínima.
- Diagnóstico: fluxo principal funciona, mas no resumo final os botões podiam orientar melhor o próximo passo.
- Problemas:
  - pós-treino com linguagem menos objetiva para retorno

### [src/screens/WorkoutCompleteScreen.js](src/screens/WorkoutCompleteScreen.js)
- Objetivo: reforçar conquista e direcionar próxima ação.
- Diagnóstico: já estava bom após ajuste anterior; possui histórico e home.

### [src/screens/HistoryScreen.js](src/screens/HistoryScreen.js)
- Objetivo: retenção por consistência.
- Diagnóstico: funcional e direto.
- Risco UX: pode ganhar CTA mais forte de retorno para treino do dia em próxima etapa.

### [src/screens/NutritionScanner.js](src/screens/NutritionScanner.js)
- Objetivo: registrar refeição rápido.
- Diagnóstico: funcionalidade rica e útil, porém extensa para usuário novo.
- Risco UX: alta densidade de ações na mesma tela.

### [src/screens/CoachChatScreen.js](src/screens/CoachChatScreen.js)
- Objetivo: orientação contextual.
- Diagnóstico: oferece ações rápidas boas, mas pode competir com Home para ação principal do dia.

### [src/screens/ProfileScreen.js](src/screens/ProfileScreen.js)
- Objetivo: configurações e identidade.
- Diagnóstico: completo; tende a ficar carregado para uso recorrente.

### [src/screens/RoutinesScreen.js](src/screens/RoutinesScreen.js)
- Objetivo: criar e gerenciar rotinas.
- Diagnóstico: funcional, mas com múltiplas ações avançadas.

### [src/screens/FreeWorkoutScreen.js](src/screens/FreeWorkoutScreen.js)
- Objetivo: treino livre.
- Diagnóstico: útil para usuário avançado, não é fluxo primário diário.

### [src/screens/ImportWorkoutScreen.js](src/screens/ImportWorkoutScreen.js)
- Objetivo: importar treino por texto.
- Diagnóstico: claro, mas secundário ao fluxo principal.

### [src/screens/InsightsScreen.js](src/screens/InsightsScreen.js)
- Objetivo: análise e upsell.
- Diagnóstico: relevante para retenção, mas deve ficar fora do fluxo principal de início do dia.

### [src/screens/DayAnalysisScreen.js](src/screens/DayAnalysisScreen.js)
- Objetivo: análise do dia.
- Diagnóstico: complementar; não deve competir com CTA de treino.

### [src/screens/WeeklyInsightScreen.js](src/screens/WeeklyInsightScreen.js)
- Objetivo: revisão semanal.
- Diagnóstico: tela de profundidade, não primária.

### [src/screens/WeeklyMacroScreen.js](src/screens/WeeklyMacroScreen.js)
- Objetivo: macro semanal e monetização.
- Diagnóstico: correta para camada PRO, não deve poluir jornada base.

### [src/screens/SocialChallengesScreen.js](src/screens/SocialChallengesScreen.js)
- Objetivo: engajamento social e desafios.
- Diagnóstico: boa para retenção social, mas secundária no fluxo diário inicial.

### [src/screens/SocialScreen.js](src/screens/SocialScreen.js)
- Objetivo: social (legado/paralelo).
- Diagnóstico: potencial duplicidade funcional com SocialChallenges.
- Risco UX: sobreposição de proposta social.

### [src/screens/RankingEvolutionScreen.js](src/screens/RankingEvolutionScreen.js)
- Objetivo: evolução competitiva.
- Diagnóstico: boa camada de motivação; secundária ao treino diário.

### [src/screens/ExerciseDetailScreen.js](src/screens/ExerciseDetailScreen.js)
- Objetivo: detalhe técnico do exercício.
- Diagnóstico: bom como apoio contextual.

### [src/screens/AutoCoachScreen.js](src/screens/AutoCoachScreen.js)
- Objetivo: recurso premium de automação.
- Diagnóstico: tela de valor, não primária.

### [src/screens/PaywallScreen.js](src/screens/PaywallScreen.js)
- Objetivo: conversão.
- Diagnóstico: deve aparecer em contexto de valor percebido, não no fluxo base de treino.

### [src/screens/AdminScreen.js](src/screens/AdminScreen.js)
- Objetivo: operação/admin.
- Diagnóstico: não participa do fluxo de produto final para usuário comum.

### [src/screens/DebugMetricsScreen.js](src/screens/DebugMetricsScreen.js)
- Objetivo: diagnóstico técnico.
- Diagnóstico: utilitário interno, fora da jornada de usuário final.

## 2. Melhorias aplicadas

### Home crítica simplificada
Arquivo: [src/screens/HomeScreen.js](src/screens/HomeScreen.js)
- adicionado CTA principal explícito: COMEÇAR TREINO AGORA
- mantido treino do dia e progresso no topo
- reduzida distração: seção de atalhos menos prioritária e enxuta
- removidos atalhos de baixa prioridade imediata da Home (mantidos em outras áreas do app)

### Experiência de treino mais direta
Arquivo: [src/screens/WorkoutsHubScreen.js](src/screens/WorkoutsHubScreen.js)
- CTA principal renomeado para linguagem direta e urgente
- adicionado botão de acesso rápido ao histórico para reforçar continuidade

### Pós-treino com próximo passo claro
Arquivo: [src/screens/WorkoutScreen.js](src/screens/WorkoutScreen.js)
- resumo final agora orienta ações mais claras:
  - Voltar para Home
  - Ver histórico
  - Ver evolução

## 3. Fluxo otimizado

Fluxo alvo validado e ajustado:
- onboarding -> home -> treino -> conclusão -> retorno

Estado atual do fluxo:
1. Onboarding claro em Questionário.
2. Home com ação principal dominante para iniciar treino.
3. Treino com conclusão e feedback de progresso.
4. Pós-treino com saída clara para histórico/home.
5. Retorno com histórico acessível em 1 toque.

Pontos de fricção removidos nesta rodada:
- ambiguidade de CTA principal na Home
- falta de atalho explícito para histórico no hub de treino
- baixa clareza de botões no resumo pós-treino

## 4. Sugestões de evolução

1. Unificar a experiência social para evitar sobreposição entre Social e SocialChallenges (sem remoção imediata, validar uso antes).
2. Simplificar NutritionScanner em modo progressivo (blocos expandíveis), mantendo o fluxo rápido padrão.
3. Adicionar retorno contextual no History para recomeçar treino do dia em 1 toque.
4. Priorizar métricas de retenção visíveis no app:
   - streak
   - treinos na semana
   - última evolução de carga/volume
5. Executar rodada de teste visual focada em tempo até primeira ação de treino (meta: < 5 segundos na Home).

## Resumo executivo
- foco mantido em simplicidade e clareza
- sem mudanças arquiteturais desnecessárias
- sem backend novo
- fluxo principal mais direto para uso diário real
