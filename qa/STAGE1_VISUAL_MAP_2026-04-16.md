# ETAPA 1 - Varredura Visual Total

Data de consolidacao: 2026-04-16
Escopo: mobile (Detox attached + emulator) e web dashboard

## Cobertura consolidada (evidencia por screenshot)

- Mobile total: 2148 imagens
- Fluxo mandatory (onboarding + fluxo principal): 974 imagens
- Fluxo visual-map audit: 308 imagens
- Fluxo smoke (abas principais): 8 imagens
- Fluxo UX social audit: 56 imagens
- Checkpoints de relaunch/persistencia: 76 imagens
- Web dashboard: 4 imagens

## Mapa visual por area

### Onboarding e entrada
- questionnaire start/mid/end
- validacao de retorno apos relaunch (persistencia)
- evidencias em arquivos mandatory-questionnaire-*.png

### Home
- home topo/meio/fim com scroll
- estado de feedback de agua (acao e resposta)
- quick actions para treino, nutricao e coach
- evidencias em mandatory-home-*.png, visual-map-*-home-main-*.png, visual-map-*-home-water-*.png

### Treino
- hub de treino topo/meio/fim
- treino livre topo/meio/fim
- popup/alert de salvar rotina
- rotinas topo/meio/fim
- treino em andamento topo/meio/fim
- checkpoint de retorno para fluxo
- evidencias em mandatory-workout-*.png, mandatory-routine-*.png, visual-map-*-treino-*.png, visual-map-*-rotinas-*.png

### Social e ranking
- aba social obrigatoria validada
- social vindo do hub e via tab
- ranking start
- evidencias em mandatory-social-*.png, ux-social.png, smoke-social-*.png, visual-map-*-social-*.png, visual-map-*-ranking-start.png

### Coach
- coach chat topo/meio/fim
- quick-coach
- evidencias em mandatory-coach-chat-*.png, visual-map-*-coach-main-*.png, visual-map-*-quick-coach-*.png

### Nutricao
- nutricao topo/meio/fim
- quick-nutrition
- evidencias em mandatory-nutrition-*.png, visual-map-*-nutricao-main-*.png, visual-map-*-quick-nutrition-*.png

### Perfil
- perfil start/mid/end com scroll
- evidencias em mandatory-profile-*.png e visual-map-*-perfil-*.png

### Estados especiais cobertos por imagem
- popup/modal/alert: treino-livre-save-routine-popup, treino-livre-alert-ok
- feedback interno: home-water-feedback, mandatory-water-feedback
- scroll longo: home, treino-hub, treino-livre, rotinas, coach, nutricao, social, perfil
- checkpoint/relaunch: checkpoint-after-social, checkpoint-before-guided-workout, checkpoint-before-coach

### Web dashboard
- dashboard login
- dashboard principal
- submissao de catalogo
- responsividade mobile
- evidencias:
  - artifacts/qa-full/screens/web/dashboard-login-ok.png
  - artifacts/qa-full/screens/web/dashboard-main.png
  - artifacts/qa-full/screens/web/catalog-submitted.png
  - artifacts/qa-full/screens/web/dashboard-mobile-responsive.png

## Amostras de evidencias (caminhos reais)

- artifacts/detox/android.attached.debug.2026-04-15 21-44-00Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-questionnaire-start.png
- artifacts/detox/android.attached.debug.2026-04-15 21-44-00Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-home-top.png
- artifacts/detox/android.attached.debug.2026-04-15 21-44-00Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-social-top.png
- artifacts/detox/android.attached.debug.2026-04-16 04-39-06Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-workout-list-top.png
- artifacts/detox/android.attached.debug.2026-04-16 06-39-37Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-coach-chat-top.png
- artifacts/detox/android.attached.debug.2026-04-16 06-39-37Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-nutrition-top.png
- artifacts/detox/android.attached.debug.2026-04-16 06-39-37Z/✗ 14 - full visual functional executa fluxo usuario real com evidencias visuais amplas/mandatory-profile-top.png
- artifacts/detox/android.attached.debug.2026-04-16 21-00-54Z/✓ 18 - visual map audit captura mapa visual completo antes de melhorias/visual-map-visual-audit-1-20260416180052-home-main-start.png
- artifacts/detox/android.attached.debug.2026-04-16 21-00-54Z/✓ 18 - visual map audit captura mapa visual completo antes de melhorias/visual-map-visual-audit-1-20260416180052-treino-livre-save-routine-popup.png
- artifacts/detox/android.attached.debug.2026-04-16 21-00-54Z/✓ 18 - visual map audit captura mapa visual completo antes de melhorias/visual-map-visual-audit-1-20260416180052-ranking-start.png
- artifacts/detox/android.attached.debug.2026-04-16 17-20-09Z/✓ 17 - social tab smoke abre social pela tab principal/smoke-social-screen-social.png
- artifacts/detox/android.emulator.debug.2026-04-16 02-56-34Z/✓ 16 - treino tab smoke abre treino pela tab principal/smoke-treino-screen-treinos.png
- artifacts/detox/android.attached.debug.2026-04-15 20-16-41Z/✓ 13 - social ux audit valida aba social obrigatoria e captura evidencias visuais/ux-home-with-social-tab.png
- artifacts/detox/android.attached.debug.2026-04-15 20-16-41Z/✓ 13 - social ux audit valida aba social obrigatoria e captura evidencias visuais/ux-social.png

## Resultado da ETAPA 1

- Cobertura visual total consolidada com evidencias organizadas.
- Nenhuma melhoria aplicada nesta etapa.
- Nenhuma analise qualitativa aplicada nesta etapa.
- Etapa pronta para iniciar ETAPA 2 (analise das screenshots).
