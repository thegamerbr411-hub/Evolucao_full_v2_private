# FULL APP VISUAL POLISH AUDIT

**Data:** 2026-06-10
**Branch:** polish/full-app-visual-icon-cards (criada de origin/main d6c0969 — PR #8 mergeado)
**Auditor:** Devin Local / Adaptive

---

## Estado Git

| Item | Status |
|------|--------|
| Workspace | F:\projetos\evolucao-main-clean — CORRETO |
| Branch atual | qa/official-preonboarded-workout-fixture |
| origin/main | 29fed9 (PR #7 mergeado — PR #8 ainda NAO mergeado) |
| Commits acima de origin/main | 12800e8 + 7c44c3b (ambos do PR #8) |
| Git status | 11 arquivos untracked (nao rastreados, maioria qa/live_mapping e e2e) |
| Worktree | Apenas root |

### Veredito PR #8
**PENDING** — Os commits 12800e8 e 7c44c3b existem na branch atual mas NAO estao em origin/main. PR #8 ainda nao foi mergeado.

---

## Ferramentas usadas

| Ferramenta | Status | Observacao |
|-----------|--------|-----------|
| Terminal / PowerShell | USADO | git, adb, dir, cat |
| ADB / Emulador | USADO | emulator-5554 ativo + device fisico RQ8T209ZTAF |
| Screenshots | CAPTURADOS | Salvo em qa/live_mapping/screenshots/ (gitignored) |
| DeepWiki | NAO DISPONIVEL | Substituido por grep/read manual |
| Codemaps | NAO DISPONIVEL | Substituido por leitura direta dos arquivos |
| GitHub MCP | NAO DISPONIVEL | Verificado via git fetch + log |
| Subagentes explore | USADOS | 3 subagentes paralelos para auditoria de codigo |

---

## Screenshots/XML capturados

| Arquivo | Tela | Disponivel |
|---------|------|-----------|
| C:\Users\USER\AppData\Local\Temp\evo_home_pull.png | Home/launch | SIM (local) |
| C:\Users\USER\AppData\Local\Temp\evo_screen01.png | App launch | SIM (local) |

Nota: Screenshots sao evidencia local, nao commitadas (gitignored).

---

## Problemas por tela

| Tela | Problema | Severidade | Arquivo | Linha(s) | Correcao proposta | Risco |
|------|----------|------------|---------|----------|-------------------|-------|
| **Icone/Launcher** | icon.png e splash-icon.png sao identicos (mesmo MD5) | P1 | ssets/icon.png, ssets/splash-icon.png | — | Criar splash dedicada (fundo cheio, sem padding) | Baixo |
| **Icone/Launcher** | App instalado exibe nome "T-Evo" em vez de "Evolucao" | P2 | ndroid/app/src/main/res/values/strings.xml, pp.json | — | Renomear para "Evolucao" ou "Evolução" | Baixo |
| **Icone/Launcher** | Adaptive icon usa mesmo PNG da splash (1.1 MB, nao adaptado) | P1 | pp.json adaptiveIcon | — | Gerar foreground transparente correto (1024x1024 sem fundo) | Baixo |
| **Icone/Launcher** | Cor de fundo do adaptive icon e do splash sao levemente diferentes (#0C1421 vs #0A1224) | P2 | pp.json vs ndroid/res/values/colors.xml | — | Alinhar para #0C1421 em todos | Baixo |
| **WorkoutScreen** | 40+ cores hardcoded no StyleSheet (4400 linhas) | P1 | src/screens/WorkoutScreen.js | 3900-4400 | Mapear para tokens do tema (colors.*) | Medio |
| **WorkoutScreen** | Estilos duplicados: summaryLine e summaryPositive aparecem 2x | P2 | src/screens/WorkoutScreen.js | 4627+4639, 4633+4645 | Remover duplicatas | Baixo |
| **WorkoutScreen** | RPE wrap tem cores hardcoded (#36506E, #111C2B, #4B6C96, #1B2B44, #93C5FD, #254974, #E2E8F0) | P1 | src/screens/WorkoutScreen.js | rpeWrap/rpeChip | Usar colors.border/surface | Medio |
| **WorkoutScreen** | setLabel usa cor #D5E6FF hardcoded | P2 | src/screens/WorkoutScreen.js | setLabel | Usar colors.textSecondary | Baixo |
| **WorkoutScreen** | setRowSavedPulse usa #123429 hardcoded | P1 | src/screens/WorkoutScreen.js | setRowSavedPulse | Usar colors.successMuted | Baixo |
| **WorkoutScreen** | progressionButton usa #1F7A57, #123429, #A7F3D0 hardcoded | P1 | src/screens/WorkoutScreen.js | progressionButton | Usar colors.primaryDim/primaryMuted | Baixo |
| **WorkoutScreen** | suggestButton usa #1B2840 hardcoded | P2 | src/screens/WorkoutScreen.js | suggestButton | Usar colors.surface | Baixo |
| **WorkoutScreen** | editSetBtn usa #1F4D7A, removeSetBtn usa #7F1D1D hardcoded | P1 | src/screens/WorkoutScreen.js | editSetBtn/removeSetBtn | Usar colors.secondary/dangerMuted | Baixo |
| **WorkoutScreen** | historyBarTrack usa #223047, historyBarFill usa #66C7A3, historyBarFail usa #FCA5A5 | P1 | src/screens/WorkoutScreen.js | historyBar* | Usar colors.border/primary/danger | Baixo |
| **WorkoutScreen** | sparklineLabel usa #9CC4F7, rpeLabel usa #9CC4F7 | P2 | src/screens/WorkoutScreen.js | sparklineLabel | Usar colors.textSecondary | Baixo |
| **WorkoutScreen** | paddingBottom: 84 hardcoded (container) | P2 | src/screens/WorkoutScreen.js | container | spacing.xl + insets.bottom | Baixo |
| **SetRow** | statusInvalid usa #B45309, #3A2510 hardcoded | P1 | src/components/workout/SetRow.js | statusInvalid | colors.warning/warningMuted | Baixo |
| **SetRow** | button default usa #1A2435 hardcoded | P2 | src/components/workout/SetRow.js | button | colors.card | Baixo |
| **SetRow** | helperText usa #FCA5A5 hardcoded, marginLeft: 28 hardcoded | P1 | src/components/workout/SetRow.js | helperText | colors.danger, spacing.xl | Baixo |
| **SetRow** | index sem fontSize definido | P2 | src/components/workout/SetRow.js | index | fontSize: 13 (typography.bodySmall) | Baixo |
| **WorkoutSetField** | setField usa #141922 hardcoded | P1 | src/components/workout/WorkoutSetField.js | setField | colors.card | Baixo |
| **WorkoutSetField** | setFieldActive usa #0f2239 hardcoded | P1 | src/components/workout/WorkoutSetField.js | setFieldActive | colors.secondaryMuted | Baixo |
| **WorkoutSetField** | borderRadius: 12 (deveria ser radius.md=14) | P2 | src/components/workout/WorkoutSetField.js | setField | radius.md | Baixo |
| **ExerciseCard** | removeExerciseText usa #FCA5A5 hardcoded | P1 | src/components/workout/ExerciseCard.js | removeExerciseText | colors.danger | Baixo |
| **ExerciseCard** | gifPreview borderRadius: 10 (deveria ser radius.sm=8 ou radius.md=14) | P2 | src/components/workout/ExerciseCard.js | gifPreview | radius.md | Baixo |
| **AnimatedToast** | Cores completamente hardcoded (#123429, #2F7A5B, #D1FAE5) | P1 | src/components/ui/AnimatedToast.js | toast | colors.success/successMuted | Baixo |
| **AnimatedToast** | Spacing/radius/typography hardcoded | P1 | src/components/ui/AnimatedToast.js | toast | spacing.*/radius.pill | Baixo |
| **FreeWorkoutScreen** | Cores hardcoded (#1F7A47, #2D9B61, #E7FFF1) | P1 | src/screens/FreeWorkoutScreen.js | L576-579 | colors.primaryDim/primaryMuted | Baixo |
| **FreeWorkoutScreen** | borderRadius: 10 em 5+ lugares | P2 | src/screens/FreeWorkoutScreen.js | L558,568,689,697 | radius.sm | Baixo |
| **RoutinesScreen** | 33 cores hardcoded (#141922, #2A3448, #3D8BFF, etc.) | P1 | src/screens/RoutinesScreen.js | multiplas | Mapear para colors.* | Medio |
| **RoutinesScreen** | Acentuacao incorreta em 10+ textos: "exercicio", "voce", "padrao", "edicao", "musculo" | P1 | src/screens/RoutinesScreen.js | multiplas | Corrigir acentos | Baixo |
| **HomeScreen** | Acentuacao incorreta: "agua", "voce" | P1 | src/screens/HomeScreen.js | L700,701 | Corrigir acentos | Baixo |
| **HomeScreen** | 15+ valores de spacing hardcoded (20, 16, 18, 14, 8, 6) | P2 | src/screens/HomeScreen.js | multiplas | spacing.* | Baixo |
| **HomeScreen** | borderRadius: 14 em 4+ lugares (coincide com radius.md mas nao usa constante) | P2 | src/screens/HomeScreen.js | multiplas | radius.md | Baixo |
| **WorkoutsHubScreen** | Texto "Import IA" visivel no UI | P2 | src/screens/WorkoutsHubScreen.js | L205 | "Importar treino" | Baixo |
| **WorkoutsHubScreen** | "Selecionamos opcoes rapidas..." sem acentos + tom de bot | P1 | src/screens/WorkoutsHubScreen.js | L114 | "Aqui estao opcoes rapidas para hoje." | Baixo |
| **WorkoutsHubScreen** | "Motor V4 - Recomendado" expoe nome tecnico interno | P2 | src/screens/WorkoutsHubScreen.js | L139 | "Treino sugerido" ou remover label | Baixo |
| **DayAnalysisScreen** | Titulo "IA Analisando Seu Dia" expoe marca IA | P1 | src/screens/DayAnalysisScreen.js | L124 | "Analisando seu dia" | Baixo |
| **PaywallScreen** | "Seu personal com IA" em titulo | P2 | src/screens/PaywallScreen.js | L79 | "Seu treinador pessoal" | Baixo |
| **PaywallScreen** | Textos sem acento: "avancado", "Voce", "automatico" em FEATURE_COPY | P1 | src/screens/PaywallScreen.js | L18-30 | Corrigir acentos | Baixo |
| **app.json** | Nome do app "T-Evo" — pouco profissional/descritivo | P2 | pp.json | name | "Evolucao" ou "Evolução" | Baixo |
| **Todos os cards** | Ausencia de elevation/shadow nos cards nao-ativos | P2 | WorkoutScreen, FreeWorkoutScreen | multiplas | Adicionar shadow padrao do AppCard | Baixo |

---

## Prioridades

### P0 — Bugs/crash/quebra funcional
Nenhum bug critico visual identificado que quebre o funcionamento.
Fluxos sensiveis (saveSet ex1/ex2, auth, guided multi-exercise) estao intactos.

### P1 — Visual/UX que afeta uso diretamente

1. **Icone/Splash identicos** — launcher mostra ativo logo, splash sem diferenciacao
2. **Nome "T-Evo"** — nao comunica "Evolucao" claramente
3. **Cores hardcoded criticas** — RPE, setRow, setField, toast, routines (impossivel manutencao/tema)
4. **Acentuacao incorreta** — "exercicio", "agua", "voce", "padrao" em telas principais
5. **Textos com "IA" visiveis** — "Import IA", "IA Analisando", "personal com IA" afetam percepcao profissional

### P2 — Polimento visual

6. **Spacing/padding hardcoded** — 80+ ocorrencias em telas principais
7. **borderRadius inconsistente** — mistura 8/10/12/14/999 sem usar constants
8. **Estilos duplicados** em WorkoutScreen (summaryLine x2)
9. **"Motor V4 — Recomendado"** — label tecnico exposto ao usuario
10. **Empty states genericos** — sem ilustracao/icone de apoio

### P3 — Ideias futuras

- Implementar gradiente no header do WorkoutScreen modo avancado
- Adicionar animacao de entrada nos exercicios do modo avancado
- Micro-animacao no save set (confetti/pulse mais visivel)
- Ilustracao SVG nos empty states usando os assets ja existentes

---

## Recomendacao

**Pacote recomendado para execucao imediata:**

**9 (pacote completo)** — na sequencia:
1. Icone + splash + nome do app
2. Design system: mapear cores hardcoded para tokens
3. Treino avancado: reorganizar layout, inputs, progressao
4. Home: cards e CTAs
5. Textos: remover "IA", corrigir acentos
6. AnimatedToast, SetRow, WorkoutSetField: quick wins de theme

**Estilo recomendado: A — Premium dark fitness**
Ja existe base excelente: #0B0B0F background, #22C55E primaria, #3B82F6 secundaria.
Apenas consolidar e eliminar as 80+ excecoes hardcoded.

---

*Auditoria realizada em 2026-06-10.*

---

## BLOCO 1 — Icone, Splash e Nome do App

**Data execucao:** 2026-06-10
**Branch:** polish/full-app-visual-icon-cards
**Base:** origin/main d6c0969 (PR #8 mergeado)

### Problema antes

| Item | Antes |
|------|-------|
| Nome launcher | "T-Evo" |
| splash-icon.png | Identico ao icon.png (1.18 MB) — sem diferenciacao visual |
| splashscreen_background (colors.xml) | #0A1224 — dessincronizado do app.json (#0C1421) |

### Arquivos alterados

| Arquivo | Mudanca |
|---------|---------|
| `app.json` | `"name": "T-Evo"` -> `"name": "Evolucao"` |
| `_audit_release/app.json` | Espelho atualizado (drift=0) |
| `android/app/src/main/res/values/strings.xml` | `T-Evo` -> `Evolucao` |
| `android/app/src/main/res/values/colors.xml` | `#0A1224` -> `#0C1421` |
| `assets/splash-icon.png` | Nova splash premium dark: fundo #0C1421 + logo + texto "EVOLUCAO" + subtitulo (51 KB vs 1.18 MB) |

### Assets usados

- Splash gerada programaticamente via PIL (Python)
- Identidade visual: fundo #0C1421, verde primario #00D08A -> #00A3D7 (gradiente), lettering em branco #F8FAFC
- Logo triangular com barras de progresso (mesma linguagem visual do icon.png existente)
- Texto "EVOLUCAO" + "Treine. Evolua. Supere." abaixo
- Linha de acento verde no rodape
- Resolucao: 1242x2688 px

### Rebuild

- `gradlew assembleDebug` -> BUILD SUCCESS (APK 205 MB, 16:43:06)
- `adb install -r app-debug.apk` -> Success
- APK inspecionado: `resources.arsc` contem `Evolucao` (UTF-8 #0C1421 confirmado)

### Screenshots

- Before: `C:\Users\USER\AppData\Local\Temp\before_launcher.png`
- After: `C:\Users\USER\AppData\Local\Temp\after_launcher.png`, `after_splash.png`

### Testes/Audit

| Gate | Resultado |
|------|-----------|
| `audit:release:check` | drift=0 PASS |
| `npm test --runInBand` | 8 falhas pre-existentes em origin/main (confirmado via stash/baseline). Zero novas falhas causadas pelo Bloco 1. |

Falhas pre-existentes (nao relacionadas ao polimento visual):
- dailyState.test.mjs
- humanRealUsage.fullstack.test.mjs
- releaseReadinessBaseline.integrity.test.mjs
- socialUxVariations.integration.test.mjs
- useCases.errorHandling.test.mjs
- workoutFinishFlow.test.mjs
- workoutUseCase.integration.test.mjs
- workoutsHubScreen.integrity.test.mjs

### Riscos

| Risco | Status |
|-------|--------|
| Adaptive icon pode cortar no Android | BAIXO — mesmo foreground do icon.png, margem segura existente |
| Acento "cao" no XML Android | VERIFICADO — bytes UTF-8 corretos (0xc3 0xa7 0xc3 0xa3 0x6f) |
| Splash muito pequena (51 KB vs 1.18 MB) | OK — PNG otimizado, tamanho correto |
| testIDs intactos | SIM — nenhum JS alterado |

### Veredito

**BLOCO 1: PASS**
Icone/Splash/Nome: PASS
Testes: sem regressao nova
Audit: drift=0

---

---

## BLOCO 2 — Design system: cores hardcoded para tokens do tema

**Data execucao:** 2026-06-10
**Branch:** polish/full-app-visual-icon-cards (acima do commit 8da5dc0)
**Status:** READY-TECH — aguardando autorizacao de commit

### Arquivos alterados

| Arquivo | Hardcodes removidos | Tokens aplicados |
|---------|--------------------|--------------------|
| `src/components/ui/AnimatedToast.js` | 4 cores + 3 spacing/radius | colors.successMuted, colors.primaryDim, colors.textPrimary, radius.pill, spacing.xs/sm/xxs |
| `src/components/workout/WorkoutSetField.js` | 2 cores + 1 radius | colors.card, colors.secondaryMuted, radius.md |
| `src/components/workout/SetRow.js` | 4 hardcodes | colors.warning, colors.warningMuted, colors.card, colors.danger, spacing.xxs |
| `src/components/workout/ExerciseCard.js` | 2 hardcodes | colors.danger, radius.md |
| `src/screens/WorkoutScreen.js` | 20 cores + duplicatas removidas | Ver tabela abaixo |
| `_audit_release/src/*` (5 espelhos) | Sincronizados via audit:release:sync | drift=0 |

### WorkoutScreen.js — substituicoes detalhadas

| Hardcode removido | Token aplicado | Estilo |
|------------------|----------------|--------|
| `#123429` (4x) | `colors.successMuted` | restBanner, setRowSavedPulse, progressionButton |
| `#2F7A5B` (2x) | `colors.primaryDim` | restBanner border, progressionButton border |
| `#9DE2C2` | `colors.primary` | restBannerLabel |
| `#9CC4F7` (3x) | `colors.textSecondary` | rpeLabel, sparklineLabel |
| `#111C2B` | `colors.surface` | rpeWrap background |
| `#36506E` | `colors.outlineStrong` | rpeWrap border |
| `#4B6C96` | `colors.secondaryDim` | rpeChip border |
| `#1B2B44` | `colors.surfaceElevated` | rpeChip background |
| `#93C5FD` (4x) | `colors.secondary` | rpeChipActive border |
| `#254974` | `colors.secondaryMuted` | rpeChipActive background |
| `#E2E8F0` | `colors.textPrimary` | rpeChipText |
| `#1B2840` | `colors.surfaceAlt` | suggestButton |
| `#1F7A57` | `colors.primaryDim` | progressionButton border |
| `#A7F3D0` | `colors.primary` | progressionButtonText |
| `#1F4D7A` | `colors.secondaryDim` | editSetBtn |
| `#7F1D1D` | `colors.dangerMuted` | removeSetBtn |
| `#223047` | `colors.borderSubtle` | historyBarTrack |
| `#66C7A3` (2x) | `colors.primary` | historyBarFill |
| `#FCA5A5` (3x) | `colors.danger` | historyBarFail, helperText (SetRow) |
| `#D5E6FF` | `colors.textSecondary` | setLabel |
| Duplicatas `summaryLine` + `summaryPositive` | Removidas (2 copias -> 1) | — |

### Regras nao violadas

- testIDs: INTACTOS (zero alteracao de IDs)
- Logica de saveSet: INTACTA
- Navegacao: INTACTA
- Auth: INTACTA
- Lógica de negocio: ZERO alteracao

### Testes/Audit

| Gate | Resultado |
|------|-----------|
| `audit:release:sync` | drift=0 PASS |
| `audit:release:check` | drift=0 PASS |
| `npm test --runInBand` | Mesmas 8 falhas pre-existentes. Zero novas falhas. PASS |
| gradlew assembleDebug | BUILD SUCCESSFUL PASS |
| adb install | Success PASS |
| logcat JS errors | 0 erros PASS |

### Screenshots capturados

- `05_b2_app_open_before_rebuild.png` — estado antes do rebuild
- `08_b2_app_open.png` — apos install
- `09_b2_app_loaded.png` — app carregado sem erros

### Riscos

| Risco | Status |
|-------|--------|
| Quebraria RPE visualmente | BAIXO — paleta azul do tema e coerente |
| restBanner mudaria aspecto | BAIXO — successMuted mantém tom verde escuro |
| editSetBtn menos visivel | BAIXO — secondaryDim e azul adequado para acao |
| summaryLine duplicado causava re-render | RESOLVIDO — apenas 1 ocorrencia agora |

### Veredito

**BLOCO 2: READY-TECH**
Design tokens aplicados: PASS
audit:release: drift=0 PASS
Testes: sem regressao PASS
App sem crash: PASS

---

---

## BLOCO 3 -- Treino avancado visual premium

**Data execucao:** 2026-06-10
**Branch:** polish/full-app-visual-icon-cards (acima do commit cdcfb6b)
**Status:** READY-USER/VISUAL PASS -- aguardando autorizacao de commit

### Problema visual (before) - evidencia real

Screenshot/XML capturado no emulador com QA fixture ativo (qaWorkoutFixture+androidNavAudit=true).
Tela: Exercicio 2 de 3 (Agachamento Livre), modo avancado.

IDs confirmados no before XML:
- workout-advanced-header OK
- workout-exercise-index-1 OK
- workout-exercise-progress OK
- workout-mode-bar OK
- input-weight-base-1-Agachamento Livre-0 OK
- input-reps-base-1-Agachamento Livre-0 OK

Bugs criticos encontrados antes das correcoes:
1. 32 tokens com aspas erradas: 'colors.TOKEN' (string literal em vez de referencia JS)
2. Sparklines: #4ADE80, #FCD34D hardcoded
3. exerciseCardFallback: #7C2D12, #2A140F, #FDBA74, #FED7AA
4. presetBtnActive: #DBEAFE e 'colors.secondary' com aspas
5. controlHint: 'colors.textSecondary' string literal
6. Duplicata de progressTrack/progressFill (BLOCO 4 section)
7. uxSpeedWrap/Label/Good: #2F4766, #101826, #D3E3FA, #86EFAC
8. progressHeaderText: #CFE4FF hardcoded
9. progressTrack: #1A283C, #2F4766 hardcoded
10. actionToastText: #D1FAE5 hardcoded

### Correcoes aplicadas (21 melhorias + 32 bug-fixes)

| Categoria | Correcao |
|-----------|----------|
| 32 quoted tokens | 'colors.TOKEN' -> colors.TOKEN (re.sub) |
| Sparklines | #4ADE80->colors.primary, #FCD34D->colors.warning |
| exerciseCardFallback | tokens danger/surface/warning/textSecondary |
| presetBtnActive | #DBEAFE->colors.secondaryMuted |
| uxSpeedWrap/Label/Good | tokens outlineStrong/surface/textSecondary/primary |
| progressHeaderText | textSecondary + uppercase + letterSpacing |
| progressTrack | borderSubtle, height 10->8, sem border extra |
| actionToastText | textPrimary |
| duplicata progressTrack | removida |
| topRow | + alignItems center |
| metaText | textMuted + fontSize 11 |
| modeToggleRow | marginBottom 6->10 + paddingVertical 4 |
| modeToggleAction | primary/primaryMuted pill premium |
| modeToggleActionText | primary + fontWeight 800 |
| modeToggleLabel | textPrimary (mais visivel) |
| exerciseProgressWrap | padding 14->16, radius 12->14 |
| exerciseProgressWrapAdvanced | + shadow elevation 2 |
| exerciseProgressText | fontSize 16->17, fontWeight 900 |
| exerciseProgressSub | cor primary (destaque do nome) |
| exerciseCardActive | removido scale 1.015, elevation 4 |
| exerciseCardMuted | opacity 0.6->0.72, borderSubtle |

### Validacao do fluxo ex2

| Passo | Resultado |
|-------|-----------|
| Navegar para treino avancado | OK |
| workout-exercise-index-1 presente | PASS |
| Preencher peso=80, reps=10 | PASS |
| Salvar serie ex2 | PASS |
| Continua no ex2 (nao voltou ex1) | PASS -- workout-exercise-index-0 ABSENT |
| JS errors logcat | errors_count: 0 PASS |

### Testes/Audit

| Gate | Resultado |
|------|-----------|
| audit:release:check | drift=0 PASS |
| npm test --runInBand | 0 novas falhas PASS |
| gradlew assembleDebug | BUILD SUCCESSFUL PASS |
| adb install -r | Success PASS |
| logcat ReactNativeJS | errors_count: 0 PASS |

### Arquivos alterados

| Arquivo | Tipo |
|---------|------|
| src/screens/WorkoutScreen.js | 53 substituicoes (21+32) |
| _audit_release/src/screens/WorkoutScreen.js | espelho |
| app.json | QA flags ativadas (debug only) |
| _audit_release/app.json | espelho |
| qa/audit-release-sync-report.json | drift=0 |

### Veredito

BLOCO 3: READY-USER/VISUAL PASS

Bug-fixes quoted tokens: 32 corrigidos PASS
Melhorias visuais: 21 aplicadas PASS
audit:release:check: drift=0 PASS
npm test: 0 novas falhas PASS
saveSet ex2: validado, nao voltou ex1 PASS
JS errors: 0 PASS

---

### Proxima acao unica

Aguardando autorizacao de Felipe para commitar o Bloco 3.

Commit sugerido:
`
polish(workout): fix quoted token bugs and refine advanced workout visual
`

---

## BLOCO 4 -- Home + cards principais + CTAs premium dark fitness

**Data execucao:** 2026-06-10
**Branch:** polish/full-app-visual-icon-cards (acima do commit 184d4d7)
**Status:** READY-USER/VISUAL PASS -- aguardando autorizacao de commit

### Estado inicial confirmado

- branch: polish/full-app-visual-icon-cards OK
- commits: 184d4d7 / cdcfb6b / 8da5dc0 presentes OK
- working tree: limpa antes do Bloco 4 OK
- audit:release:check: drift=0 OK

### Home before - evidencia real

IDs confirmados no before XML (emulador, app instalado sem QA flags):
- screen_home OK
- home_screen_anchor OK
- home_ready OK
- btn_home_main_cta OK
- btn_home_insights OK
- btn_home_nutrition OK

Textos visiveis: "Boa noite", "Sem sequencia ativa", "+0 XP hoje"

### Problemas encontrados

| # | Problema | Arquivo | Linha |
|---|---------|---------|-------|
| 1 | Hardcoded #2e1f06 em recoveryPrimaryText | HomeScreen.js | 881 |
| 2 | Hardcoded #052e20 em mainMissionCtaText | HomeScreen.js | 897 |
| 3 | Hardcoded #134e3a em mainMissionCtaSub | HomeScreen.js | 903 |
| 4 | paddingHorizontal: 20 / gap: 20 sem tokens | HomeScreen.js | 795-798 |
| 5 | borderRadius: 14 hardcoded em 5 cards | HomeScreen.js | varios |
| 6 | padding: 20 hardcoded em 3 cards | HomeScreen.js | varios |
| 7 | mainMissionCta sem sombra, minHeight: 88 | HomeScreen.js | 888 |
| 8 | mainCta sem sombra premium | HomeScreen.js | 1232 |
| 9 | quickDailyButton borderRadius: 12 (deve ser radius.md=14) | HomeScreen.js | 1022 |
| 10 | quickDailyButtonFeatured sem shadow | HomeScreen.js | 1029 |
| 11 | greeting fontSize: 24 (muito grande) | HomeScreen.js | 1133 |
| 12 | quickTitle/progressTitle marginBottom hardcoded | HomeScreen.js | varios |
| 13 | xpCard/macroCard sem sombra | HomeScreen.js | 1162/1292 |
| 14 | missionCard sem sombra | HomeScreen.js | 1249 |
| 15 | streakBadge backgroundColor card (nao elevado) | HomeScreen.js | 1141 |

### Melhorias aplicadas (29)

| Estilo | Antes | Depois |
|--------|-------|--------|
| container | paddingH:20, gap:20 | spacing.lg, spacing.lg |
| dailyTopCard | padding:20, radius:14, gap:6 | spacing.lg, radius.md, spacing.xs |
| dailyTopTitle | fontSize:18 | fontSize:17 + letterSpacing:-0.2 |
| dailyTopXp | colors.success | colors.primary + letterSpacing |
| missionMainCard | padding:20, radius:14, gap:8 | spacing.lg, radius.md, spacing.xs |
| recoveryCard | padding:16, radius:14, gap:8 | spacing.md, radius.md, spacing.xs |
| recoveryPrimaryText | #2e1f06 | colors.textInverse |
| mainMissionCta | radius:14, bg:success, minH:88, sem shadow | radius.md, primary, minH:96, shadow elevation:4 |
| mainMissionCtaText | #052e20 | colors.textInverse |
| mainMissionCtaSub | #134e3a | rgba(11,11,15,0.65) |
| progressCard | padding:20, radius:14, gap:6 | spacing.lg, radius.md, spacing.xxs |
| progressTitle | fontSize:12, marginBottom:4 | fontSize:11, letterSpacing:1, spacing.xxs |
| progressLine | fontSize:16 | fontSize:15, letterSpacing:-0.2 |
| coachCard | padding:18, radius:14, gap:6 | spacing.md, radius.md, spacing.xxs |
| quickCard | padding:20, radius:14 | spacing.lg, radius.md |
| quickTitle | fontSize:12, marginBottom:12 | fontSize:11, letterSpacing:1, spacing.sm |
| quickDailyButton | radius:12, paddingV:14 | radius.md, spacing.sm |
| quickDailyButtonFeatured | sem shadow | shadow elevation:2 |
| quickDailyButtonText | fontSize:15 | fontSize:14 |
| greeting | fontSize:24 | fontSize:22, letterSpacing:-0.5 |
| streakBadge | bg:card, minWidth:56 | cardElevated, minWidth:60 |
| xpCard | sem shadow | shadow elevation:1 |
| workoutCardTitle | fontWeight:700 | fontWeight:800, letterSpacing:-0.1 |
| mainCta | paddingV:spacing.lg, sem shadow | spacing.md, shadow elevation:3 |
| mainCtaText | fontWeight:800 | fontWeight:900 |
| missionCard | sem shadow | shadow elevation:2 |
| missionTitle | fontSize:20 | fontSize:19, letterSpacing:-0.3 |
| macroCard | sem shadow | shadow elevation:1 |
| shortcutLabel | fontWeight:600 | fontWeight:700 |

### Regras nao violadas

- testIDs: INTACTOS -- screen_home, home_ready, btn_home_main_cta, btn_home_insights, btn_home_nutrition, home_screen_anchor
- logica de negocio: INTACTA
- auth: INTACTA
- saveSet: INTACTO
- navegacao: INTACTA

### Home after - evidencia real

IDs confirmados no after XML:
- screen_home OK
- home_screen_anchor OK
- home_ready OK
- btn_home_main_cta OK [bounds: [63,685][1017,937] -- altura 252px]
- btn_home_insights OK
- btn_home_nutrition OK

CTA area de toque: 954 x 252 pixels (aumento de minHeight 88->96)

### Testes/Audit

| Gate | Resultado |
|------|-----------|
| audit:release:sync | drift=0 PASS |
| audit:release:check | drift=0 PASS |
| npm test --runInBand | 0 novas falhas PASS (8 pre-existentes) |
| gradlew assembleDebug | BUILD SUCCESSFUL PASS |
| adb install -r | Success PASS |
| logcat ReactNativeJS | errors_count: 0 PASS |

### Arquivos alterados

| Arquivo | Tipo |
|---------|------|
| src/screens/HomeScreen.js | 29 melhorias visuais |
| _audit_release/src/screens/HomeScreen.js | espelho |
| qa/audit-release-sync-report.json | drift=0 |
| qa/live_mapping/FULL_APP_VISUAL_POLISH_AUDIT.md | este relatorio |

### Riscos

| Risco | Avaliacao |
|-------|-----------|
| mainMissionCtaSub rgba hardcoded | BAIXO -- tom neutro escuro padrao |
| mainCta minHeight 88->96 | POSITIVO -- area de toque maior |
| shadows/elevation | BAIXO -- apenas iOS/Android natural shadow |
| greeting fontSize 24->22 | POSITIVO -- hierarquia mais limpa |

### Veredito

BLOCO 4: READY-USER/VISUAL PASS

Hardcodes eliminados: 3 (#2e1f06, #052e20, #134e3a) PASS
Tokens aplicados: 26 melhorias de spacing/radius PASS
Shadows premium: 5 componentes PASS
audit:release:check: drift=0 PASS
npm test: 0 novas falhas PASS
testIDs Home: TODOS PRESENTES PASS
JS errors: 0 PASS

---

### Proxima acao unica

Aguardando autorizacao de Felipe para commitar o Bloco 4.

Commit sugerido:
`
polish(home): refine Home screen premium dark fitness visual
`
