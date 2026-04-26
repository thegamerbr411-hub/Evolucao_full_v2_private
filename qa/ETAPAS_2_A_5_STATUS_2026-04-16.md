# ETAPAS 2-5 - Status Consolidado

Data: 2026-04-16
Escopo: analise visual, melhorias aplicadas, validacao funcional e estabilidade

## 1) Mapa visual

- Consolidado principal: qa/STAGE1_VISUAL_MAP_2026-04-16.md
- Cobertura inclui onboarding, home, treino, social, coach, nutricao, perfil e dashboard web.

## 2) Problemas encontrados (ETAPA 2)

- Rotulo de quantidade em nutricao fixo como "x" mesmo quando unidade real era g/ml.
- Cabecalho do coach com risco de truncamento em telas menores.
- Estado vazio social com mensagem tecnica (baixa clareza para usuario final).
- Cartao de recomendacao de treino com fonte podendo ficar vazia.
- Ranking com mensagem enganosa de XP restante quando dados vinham incompletos.
- Fragilidade de runtime em Detox attached: bootstrap sem alvo detectavel no app.

## 3) Melhorias propostas

- Tornar a unidade de quantidade explicita na deteccao e na UI de nutricao.
- Simplificar texto do cabecalho do coach para evitar truncamento.
- Trocar copy tecnica do social por orientacao de onboarding.
- Aplicar fallback de fonte para recomendacao de treino.
- Calcular XP restante com fallback robusto e copy de degradacao quando dados incompletos.
- Reforcar bootstrap E2E com alvos adicionais de tabs e fallback de deteccao por texto.
- Instrumentar marcador de bootstrap pronto no app para depuracao do startup em attached.

## 4) Melhorias aplicadas

- src/services/nutritionIntelligence.js: adicionada propriedade quantityUnit no parser textual.
- src/screens/NutritionScanner.js: adicionado formatQuantityLabel(...) e uso da unidade correta nos chips.
- src/screens/CoachChatScreen.js: cabecalho ajustado para "Coach Diario" e subtitulo mais curto.
- src/screens/SocialChallengesScreen.js: copy de estado vazio ajustada para "Perfil social ainda nao conectado".
- src/screens/WorkoutsHubScreen.js: fallback de fonte em recomendacao para motor_v4/local.
- src/screens/RankingEvolutionScreen.js: ajuste de XP restante com fallback por xpToNextLevel.
- App.js: adicionado marcador app-bootstrap-ready apos NavigationContainer.onReady.
- e2e/helpers/flows.js: bootstrap atualizado com tabs atuais, fallback por texto e tolerancia a disconnect em disableSynchronization no attached.
- scripts/visual-audit-loop.ps1 e scripts/qa-global-audit-loop.ps1: contagem de falhas robusta para evitar failed nulo.

## 5) Testes executados

- npm run test -> PASS
- npm run qa:smoke -> PASS
- DETOX_CONFIGURATION=android.attached.debug + e2e/17-social-tab-smoke.e2e.js -> FAIL (bootstrap)

## 6) Resultados

- Camadas de negocio, integracao e smoke API estaveis.
- Melhorias de UX/copy e robustez de dados aplicadas com cobertura de testes nao-UI verde.
- E2E attached continua com falha de inicializacao antes da interacao de aba.
- Em uma tentativa com terminate agressivo, ocorreu disconnect do app Detox server; sem terminate agressivo, voltou o erro de bootstrap sem alvo detectavel.

## 7) Fragilidades atuais

- Detox attached ainda nao detecta alvos de UI no startup em alguns ciclos.
- Dependencia forte de estabilidade do device fisico para concluir ETAPA 5/6 com ciclo completo.
- Apesar de melhorias no bootstrap, attached segue intermitente entre disconnect e ausencia de alvos detectaveis.

## 8) Proximos ajustes prioritarios

1. Instrumentar telemetria de bootstrap no app (marcadores de montagem inicial) para diagnostico deterministico do attached.
2. Criar smoke E2E de fallback com detector por texto e por route-name para reduzir falso negativo em startup.
3. Revalidar os loops de auditoria visual/global para confirmar em execucao real que failed permanece numerico no markdown e no JSON.
4. Reexecutar ciclo completo (ETAPA 6) apos estabilizar bootstrap attached.
