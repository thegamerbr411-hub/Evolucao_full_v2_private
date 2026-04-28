# MASTER BACKLOG FINAL - EVOLUCAO APP

Data de referencia: 27-04-2026
Escopo: transformacao de produto, nao apenas melhorias pontuais.

Objetivo final:
- UX fluida sem atrito
- recompensa emocional constante
- identidade de produto forte
- confianca tecnica para publicacao

Legenda de status:
- DONE
- PARCIAL
- PENDENTE

## SPRINT 0 - BUGS CRITICOS (FAZER ANTES DE TUDO)

### TASK 0.1 - Crash na tela de exercicio
Status: DONE
Arquivo alvo: `src/screens/ExerciseDetailScreen.js`

Escopo:
- Null safety completa para:
	- videoUrl
	- instructions
	- history
	- metadata
- Nunca renderizar dado undefined.
- Usar optional chaining em toda cadeia sensivel.
- Mostrar fallback UI quando dado faltar.

Regra de video invalido:
- Nao renderizar video player.
- Exibir placeholder com icone + texto: "Video indisponivel".
- Log silencioso de erro (sem quebrar UI).

Aceite:
- Nunca crasha.
- Sempre mostra algo util.

### TASK 0.2 - Video nao carrega
Status: DONE
Arquivo alvo: `src/screens/ExerciseDetailScreen.js`

Escopo:
- Validar URL antes de render.
- Adicionar loading state com spinner.
- Adicionar fallback UI de erro.

Regra:
- Se falhar, mostrar placeholder.
- Nao retentar infinitamente.

Aceite:
- Sem tela quebrada em cenarios de rede ruim/url invalida.

### TASK 0.3 - Importacao de treino errada
Status: DONE
Arquivo alvo: `src/screens/ImportWorkoutScreen.js`

Escopo:
- Parser com prioridade de match exato.
- Se nao encontrou, abrir tela de revisao.
- Nunca substituir exercicio silenciosamente.

Fluxo obrigatorio:
1. Parse de texto.
2. Preview da lista.
3. Edicao de mismatches.
4. Confirmacao antes de salvar.

Regra de exercicio nao encontrado:
- Destacar em vermelho.
- Permitir escolha manual.

Aceite:
- Zero exercicio inventado.
- Confianca de importacao alta.

### TASK 0.4 - Modo simples inconsistente
Status: DONE
Arquivo alvo: `src/screens/WorkoutScreen.js`

Escopo:
- Mesmo data source para modo simples e modo pro.
- Sem logica duplicada.
- Estrutura de treino unica.

Regra:
- Modo simples apenas esconde UI avancada.
- Modo simples nao muda dados.

Aceite:
- Exercicios de rotinas aparecem igual nos dois modos.

### TASK 0.5 - Coach sem intencao detectada
Status: DONE
Arquivo alvo: `src/screens/CoachChatScreen.js`

Escopo:
- Detectar intencao ANTES de responder.
- Cobrir intents:
	- greeting (oi, ola)
	- duvida de treino
	- duvida de nutricao
	- duvida de progresso
	- comando (ex: criar treino)

Regras:
- Greeting -> resposta curta e amigavel.
- Nunca responder assunto sem relacao.
- Evitar respostas genericas.

Fallback:
- "Nao entendi, pode explicar melhor?"

Aceite:
- Alta precisao de contexto nas respostas.

## SPRINT 1 - BASE GLOBAL (INFRA)

Status: DONE

Itens mantidos:
- Toast global
- Sanitizacao
- Validacao em tempo real
- Keyboard fix

## SPRINT 2 - TREINO (CORE)

### TASK 2.1 - Unificar sistema de treino
Status: PENDENTE
Arquivos alvo: `src/screens/WorkoutScreen.js`, `src/screens/FreeWorkoutScreen.js`, `src/context/AppContext-v2.ts`

Escopo:
- Unificar fontes:
	- free workout
	- routine workout
	- recommended workout
- Criar modelo unico `WorkoutSession`.
- Modos:
	- simple = UI simplificada
	- pro = UI completa

Regra:
- Nao duplicar logica entre modos.

Aceite:
- Uma unica estrutura de sessao para todos os fluxos.

### TASK 2.2 - Limpeza total da UI de treino
Status: PARCIAL
Arquivo alvo: `src/screens/WorkoutScreen.js`

Escopo:
- Reduzir densidade visual em ~30%.
- Manter visivel apenas:
	- nome do exercicio
	- serie atual
	- campos de input
- Mover:
	- historico -> expansivel
	- stats -> oculto por padrao
	- avancado -> somente modo pro

Aceite:
- Tela mais leve e orientada a execucao.

### TASK 2.3 - UX automatico (zero atrito)
Status: PARCIAL
Arquivo alvo: `src/screens/WorkoutScreen.js`

Escopo:
- Autofocus: peso -> reps -> salvar set no Done.
- Depois de salvar:
	- feedback XP
	- descanso automatico
	- foco no proximo input

Aceite:
- Usuario executa sem pensar no fluxo.

### TASK 2.4 - Timer premium
Status: PENDENTE
Arquivo alvo: `src/screens/WorkoutScreen.js`

Escopo:
- Timer fixo em posicao consistente.
- Blur de fundo.
- Barra de progresso.
- Animacao suave.

Aceite:
- Timer de descanso premium e legivel em qualquer contexto.

## SPRINT 3 - NUTRICAO (SIMPLIFICACAO)

### TASK 3.1 - Definir um fluxo principal
Status: PENDENTE
Arquivo alvo: `src/screens/NutritionScanner.js`

Escopo:
- Definir fluxo principal unico: "Registrar refeicao rapida".
- Fluxos texto/foto viram secundarios.

Aceite:
- Um caminho dominante, sem concorrencia de fluxos.

### TASK 3.2 - Visual de macros
Status: PARCIAL
Arquivo alvo: `src/screens/NutritionScanner.js`

Escopo:
- Trocar texto bruto por barras de progresso.
- Cores por macro.
- Meta vs consumido visivel.

Aceite:
- Leitura de macros em < 2 segundos.

## SPRINT 4 - COACH INTELIGENTE

### TASK 4.1 - Resposta humana
Status: PARCIAL
Arquivo alvo: `src/screens/CoachChatScreen.js`

Escopo:
- Respostas de 3-5 linhas maximo.
- Bullets quando fizer sentido.
- Sempre terminar com acao.

Exemplo alvo:
- "Voce treinou bem hoje."
- "- Falta proteina"
- "- Beba mais agua"
- "Quer registrar agora?"

Aceite:
- Coach util, direto e com voz propria.

### TASK 4.2 - Coach com acao
Status: DONE
Arquivo alvo: `src/screens/CoachChatScreen.js`

Escopo:
- Botoes de acao no chat:
	- Registrar refeicao
	- Iniciar treino
	- Ver progresso

Aceite:
- Chat vira ponto de acao, nao apenas texto.

## SPRINT 5 - PERFIL (UPGRADE)

### TASK 5.1 - Redesign completo
Status: PENDENTE
Arquivo alvo: `src/screens/ProfileScreen.js`

Secoes alvo:
1. Header (foto, nome, nivel)
2. Progresso (peso, meta, evolucao)
3. Preferencias
4. Configuracoes
5. Conta

Aceite:
- Layout em cards com espacamento premium consistente.

### TASK 5.2 - Configuracoes reais
Status: PENDENTE
Arquivos alvo: `src/screens/ProfileScreen.js`, `src/stores/*`

Escopo:
- Units (kg/lb)
- Notifications
- Theme
- Coach style
- Privacy

Aceite:
- Sistema de settings funcional e persistente.

## SPRINT 6 - SOCIAL QUE PRENDE

### TASK 6.1 - Remover User ID do amigo
Status: DONE
Arquivo alvo: `src/screens/SocialScreen.js`

Escopo:
- Remover input manual de user id.
- Usar invite link por share.
- Contact picker fica para fase futura.

### TASK 6.2 - Ranking viciante
Status: PARCIAL
Arquivo alvo: `src/screens/SocialScreen.js`

Escopo:
- Destacar usuario no ranking.
- Mostrar mudanca de posicao (subiu/caiu).
- Mostrar proxima meta (XP para subir).

Aceite:
- Competicao clara em menos de 2 segundos de leitura.

## SPRINT 7 - EXPERIENCIA PREMIUM

### TASK 7.1 - Modo missao (Home)
Status: PARCIAL
Arquivo alvo: `src/screens/HomeScreen.js`

Escopo:
- Antes do treino: mostrar somente
	- missao do dia
	- botao treino
- Depois do treino: liberar stats e progresso.

Aceite:
- Home orientada por estado da jornada.

### TASK 7.2 - Recompensa viciante
Status: PARCIAL
Arquivos alvo: `src/screens/WorkoutScreen.js`, `src/screens/WorkoutCompleteScreen.js`

Escopo:
- Animacao de XP
- Pulse effect
- Sound opcional (nao obrigatorio)

Aceite:
- Recompensa imediata perceptivel por serie e no fim do treino.

### TASK 7.3 - Tela final nivel jogo
Status: PARCIAL
Arquivo alvo: `src/screens/WorkoutCompleteScreen.js`

Escopo:
- Confetti
- XP grande
- Mensagem motivacional
- CTA de proximo passo

Aceite:
- Final de treino com sensacao de conquista clara.

## REGRAS DE OURO (OBRIGATORIO)

Nunca fazer:
- logica duplicada
- UI sobrecarregada
- resposta generica no coach
- Alert.alert para fluxo de sucesso
- multiplos fluxos concorrendo

Sempre fazer:
- 1 acao principal por tela
- feedback imediato
- fallback para tudo
- simplificar antes de adicionar

## ORDEM REAL DE EXECUCAO

1. Sprint 0 (bugs criticos)
2. Sprint 1 (base)
3. Sprint 2 (treino)
4. Sprint 4 (coach)
5. Sprint 3 (nutricao)
6. Sprint 5 (perfil)
7. Sprint 6 (social)
8. Sprint 7 (polimento)

## GATE TECNICO DE FECHAMENTO

Obrigatorio antes de release:
- `npm run test:basic` OK
- smoke detox de treino/tab OK
- detox attached estabilizado ou justificativa + evidencia alternativa
- checklist de release atualizado

## RISCO ATUAL CRITICO

- Instabilidade recorrente no ciclo detox attached no host atual.

Mitigacao imediata:
- manter smoke minimo em emulator debug a cada alteracao critica
- executar attached em ambiente limpo e janela dedicada
- registrar artifacts por ciclo para rastreabilidade
