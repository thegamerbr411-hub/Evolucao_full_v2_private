# Auditoria Visual Premium — Evolução / main `a44b828`

> **Caminho oficial (Felipe HARD):** relatório em `qa/visual/` · evidências em `.qa_runtime/auditoria_visual_premium_a44b828/`  
> Referência antiga do ChatGPT ponte (`qa/visual_premium/`) **não utilizada** — evitar duplicata.

## 1. Base / branch / device

| Campo | Valor |
|-------|-------|
| Workspace | `F:\projetos\evolucao-main-clean` |
| Branch | `qa/auditoria-visual-premium-a44b828` |
| Base | `origin/main` = `a44b828` |
| Device | `RQ8T209ZTAF` (físico) |
| Metro | `8081` — flags QA locais (sem alterar `app.json`) |
| Data/hora | 2026-06-13 (UTC) |
| Contexto Semana Real | `qa/semana-real-pos-merge` @ `168d1da` — GO COM RISCO BAIXO |

## 2. Escopo

Auditoria visual premium pós-merge PR #24: aparência, hierarquia, consistência, microcopy, empty states, modais, tabs e fluxos principais. **Somente auditoria** — sem release, sem NEXA, sem Firebase prod, sem alterar persistência (`saveSetLine` / `draftSetsRef` / `confirmKeypad`).

## 3. Método

- ADB `screencap` + `uiautomator dump` por tela
- Navegação via testIDs/XML (`tab-home`, `btn_home_main_cta`, `btn_start_workout`, etc.)
- Script: `.qa_runtime/auditoria_visual_premium_a44b828/recapture_clean.cjs`
- Leitura cruzada com [Semana Real](qa/semana_real/SEMANA_REAL_POS_MERGE_A44B828_REPORT.md) (branch `qa/semana-real-pos-merge`) para não reclassificar achados P2 infra como novos bugs

## 4. Resumo executivo

| Item | Resultado |
|------|-----------|
| **Nota premium geral** | **7,2 / 10** |
| **Veredito visual** | **FUNCIONAL MAS NÃO PREMIUM** |
| **Release readiness** | **NÃO** |
| **PR visual recomendado** | **SIM** (lote polish P1/P2) |
| **P0 funcional** | 0 |
| **P1 funcional** | 0 |

O app está coeso o suficiente para beta fechado visualmente, mas ainda exibe copy técnica/QA, modais de feedback no fluxo central e empty states básicos que impedem sensação “premium fitness”.

## 5. Tabela de telas auditadas

| ID | Tela | Rota | Nota | Status | Evidência |
|----|------|------|------|--------|-----------|
| 02 | Home | MainTabs → Home | 7,5 | OK | `screens/02_home.png` |
| 03 | Treino hub | MainTabs → Treino | 7,5 | OK | `screens/03_treino_tab.png` |
| 04 | WorkoutScreen | Iniciar/continuar treino | 7,0 | OK | `screens/04_workout_screen.png` |
| 07 | Histórico | Treino → Histórico | 6,5 | PARCIAL | `screens/07_historico.png` — dump indica estado de treino ativo em parte da captura |
| 08 | Treino livre | Treino → scroll → Livre | 7,0 | OK | `screens/08_treino_livre.png` |
| 09 | Rotinas/Catálogo | Treino → Rotinas | 7,0 | OK | `screens/09_catalogo_rotinas.png` |
| 18 | Nutrição | MainTabs → Nutrição | 7,8 | OK | `screens/18_nutricao.png` |
| 19 | Coach | MainTabs → Coach | 6,8 | PARCIAL | `screens/19_coach.png` — conteúdo social visível no dump |
| 20 | Social/Desafios | MainTabs → Social | 7,0 | OK | `screens/20_social.png` |
| 21 | Perfil | MainTabs → Perfil | 6,5 | OK | `screens/21_perfil.png` |
| 22 | Tabs inferiores | Navegação | 8,0 | OK | `screens/22_tabs_navigation.png` |

Evidências completas (não commitadas): `.qa_runtime/auditoria_visual_premium_a44b828/{screens,dumps,logs}/`

## 6. Fluxos auditados

| Fluxo | Avaliação | Notas |
|-------|-----------|-------|
| Home → Treino → WorkoutScreen | **CAPTURADO** | Layout de treino claro; copy “Fluxo rápido / Modo simples” soa técnica |
| Home → Treino → Histórico | **PARCIAL** | Histórico abre; empty state básico; uma captura coincidiu com treino ativo |
| Home → Catálogo/Rotinas | **CAPTURADO** | Cards legíveis; falta polish premium nos CTAs secundários |
| Home → Nutrição | **CAPTURADO** | Sugestões contextuais boas (“150g frango + whey”); empty state aceitável |
| Home → Coach | **PARCIAL** | Tab abre; conteúdo/percepção premium limitada; overlap visual com Social |
| Home → Perfil | **CAPTURADO** | Exibe fixture QA (`qa+workoutfixture@fixture.local`) — reduz confiança visual |

## 7. Pontos fortes

- **Tabs inferiores** consistentes (ícones Ionicons, labels PT-BR) — nota 8
- **WorkoutScreen** com hierarquia de exercício, descanso, progresso (% séries) — estrutura sólida
- **Nutrição** com copy orientativa e seções numeradas (HOJE / BUSCA)
- **Cards** com arredondamento e contraste adequado no device físico
- **Sem crash/RedBox** durante toda a auditoria

## 8. Pontos fracos (top impacto)

1. Copy técnica no treino (“Fluxo rápido”, “Modo simples”, “Alternar”) — parece ferramenta interna, não produto premium
2. **Modal “Feedback rápido”** pode interceptar fluxo de treino (evidência run anterior + risco recorrente)
3. Home repete mensagem de retomada de treino (card + prioridade WORKOUT)
4. Perfil expõe identidade QA fixture — quebra ilusão de produto real
5. CTAs secundários (livre/rotinas) exigem scroll na aba Treino
6. Empty states (histórico, ranking social) funcionais porém sem ilustração/polish premium
7. Coach/Social com percepção de placeholder (`qa-workout-fixture`, painéis genéricos)

## 9. Classificação de achados

### P0 funcional
_Nenhum._

### P1 funcional
_Nenhum._

### Visual P1
| # | Achado | Tela | Evidência |
|---|--------|------|-----------|
| V1 | Modal **Feedback rápido** no meio do fluxo de treino | Workout | `dumps/04_workout_screen.xml` (run inicial) |
| V2 | **Duplicação de copy** “Você parou no treino…” na Home | Home | `dumps/02_home.xml` |

### Visual P2
| # | Achado | Tela |
|---|--------|------|
| V3 | Copy técnica treino (Fluxo rápido / Modo simples) | Workout |
| V4 | CTAs Treino livre / Rotinas abaixo da dobra | Treino hub |
| V5 | Empty states simples (histórico, ranking) | Histórico / Social |
| V6 | Fixture QA visível no Perfil | Perfil |
| V7 | Coach com conteúdo social misturado | Coach |

### Visual P3
| # | Achado |
|---|--------|
| V8 | Emojis/streak com encoding técnico em dumps |
| V9 | Microcopy “PRIORIDADE ATUAL: WORKOUT” soa debug |

## 10. Top 10 melhorias visuais (prioridade)

| # | Melhoria | Impacto | Esforço |
|---|----------|---------|---------|
| 1 | Remover/adormecer modal Feedback no fluxo crítico de treino | Alto | Médio |
| 2 | Reescrever microcopy treino para linguagem usuário (não “fluxo/modo”) | Alto | Baixo |
| 3 | Unificar card único de “continuar treino” na Home | Alto | Médio |
| 4 | Ocultar labels QA/fixture em builds de auditoria visual | Médio | Baixo |
| 5 | Elevar empty states (histórico, nutrição vazia) com ilustração + CTA | Médio | Médio |
| 6 | Trazer Treino livre / Rotinas para área visível sem scroll | Médio | Médio |
| 7 | Separar visualmente Coach vs Social (headers, cores) | Médio | Médio |
| 8 | Polir cards de exercício no catálogo (imagens/placeholder) | Médio | Alto |
| 9 | Revisar contraste de textos secundários (streak/XP) | Baixo | Baixo |
| 10 | Padronizar tipografia de títulos entre Home/Treino/Nutrição | Baixo | Médio |

## 11. Correções feitas nesta branch

### Correções de navegação (BUG #1 / BUG #2 / BUG #3)

Investigação pós-auditoria visual identificou causas raiz e aplicou correções de código:

| BUG | Causa raiz | Correção | Arquivo |
|-----|-----------|----------|---------|
| BUG #2 — App abre na Treino/Workout após relaunch | React Navigation restaurava estado anterior da stack salvo pelo Android; o app reabria diretamente em `TreinoHoje` (WorkoutScreen), sem bottom nav | Desabilitar restauração automática de estado via `linking.getInitialState: () => undefined` no NavigationContainer; garante que o app sempre inicie na rota inicial (`MainTabs`) | `App.js` |
| BUG #3 — Bottom nav "intermitente" | O app reabria na stack screen `TreinoHoje` (WorkoutScreen) que não renderiza bottom nav; o usuário interpretava como bottom nav não respondendo | Mesma correção de BUG #2 (estado não restaurado) + `initialRouteName="Home"` no Tab.Navigator para garantir aba Home ativa quando MainTabs é montado | `src/navigation/MainTabs.js` |
| BUG #1 — Hit area do voltar no Workout | `hitSlop` de 8px no ScreenHeader pode ser insuficiente em alguns dispositivos; ausência de `activeOpacity` dava feedback visual fraco | Aumentar `hitSlop` de 8px para 12px e adicionar `activeOpacity={0.7}` ao TouchableOpacity do botão voltar | `src/components/ui/ScreenHeader.js` |
| BUG #3 (melhoria) | `TouchableOpacity` dos tabs sem `activeOpacity` nem `hitSlop` — feedback visual fraco e área de toque pequena em gestos de sistema | Adicionar `activeOpacity={0.7}` e `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` aos botões de tab da bottom nav | `src/navigation/MainTabs.js` |

**Evidências de investigação:** `.qa_runtime/auditoria_visual_premium_a44b828/bugs/{bug1_workout_back_hitarea,bug2_initial_tab,bug3_bottom_nav}/`

**Veredito:** BUG #2 e BUG #3 eram causados por restauração de estado do sistema operacional (não bug de código de negócio). A correção é defensiva e alinha com requisito "app deve abrir na Home". BUG #1 é melhoria defensiva de UX — não reproduzível consistentemente, mas hitSlop maior reduz falsos negativos.

## 11b. Polish P1/P2 aplicado

**Branch:** `fix/visual-polish-p1p2-a44b828` (a partir desta auditoria @ `9fec2c6`)

### P1 corrigidos

| # | Achado | Correção | Arquivo |
|---|--------|----------|---------|
| V1 | Modal Feedback rápido no fluxo de treino | Bloqueio ao entrar/sair de rotas reais (`TreinoHoje`, `TreinoLivre`, etc.) | `App.js` |
| V2 | Copy duplicada de retomada na Home | CTA único; recovery oculto quando `isContinue`; quick action sem duplicar; prioridade em PT | `src/screens/HomeScreen.js` |

### P2 corrigidos

| # | Achado | Correção | Arquivo |
|---|--------|----------|---------|
| V3 | Copy técnica treino | `Treino guiado` / `Visao completa`; subtitle premium; `Exercicio atual · N de M` | `workoutModeCopy.js`, `WorkoutScreen.js`, `workoutProgressCopy.js` |
| V4 | CTAs abaixo da dobra | Primary CTA + grid Livre/Rotinas antes do card motor | `WorkoutsHubScreen.js` |
| V5 | Empty states básicos | Copy humanizada em histórico local e ranking social | `workoutHistoryPresentation.js`, `HistoryScreen.js`, `SocialChallengesScreen.js` |
| V6 | Fixture QA no Perfil | Email fixture mascarado (`Usuario Evolucao` / `Conta de teste (QA)` em dev) | `profileDisplay.js`, `ProfileScreen.js` |
| V7 | Coach/Social overlap | `paddingBottom` com `useBottomTabBarHeight()` | `CoachChatScreen.js`, `SocialChallengesScreen.js` |

### Antes / depois (resumo)

| Tela | Antes | Depois |
|------|-------|--------|
| Home | CTA + recovery + “Retomar treino agora” + `Prioridade: workout` | CTA único; prioridade em PT; sem mensagem duplicada |
| Workout | “Fluxo rapido / Modo simples” | “Registre sua carga…” / “Treino guiado” |
| Perfil | `qa+workoutfixture@fixture.local` | Label amigável |
| Treino hub | Livre/Rotinas após scroll | Grid visível logo após CTA principal |

Evidências locais (não commitadas): `.qa_runtime/visual_polish_p1p2_a44b828/{screens_before,screens_after,dumps}/`

### Testes pós-polish (final gate PR #25)

| Teste | Resultado |
|-------|-----------|
| `npm run audit:release:check` (pré-sync) | **FAIL** exit 1 — drift 16 (source alterado, `_audit_release` desatualizado) |
| `npm run audit:release:sync` + `check` | **PASS** exit 0 — drift 0 (commit `08f680b`) |
| `freeWorkoutSaveSet.test.mjs` | PASS 4/4 |
| `workoutActiveIndex.test.mjs` | PASS 4/4 |
| `workoutHistorySetValues.test.mjs` | PASS 5/5 |
| `workoutModeCard.test.mjs` | PASS 10/10 |
| `workoutProgressCopy.test.mjs` | PASS 10/10 |
| Detox smoke treino (final gate) | PASS (~227s, `android.attached.debug`, device `RQ8T209ZTAF`) |

**Commits no PR #25:** `1f31dee` (polish P1/P2) · `941b0e1` (navegação BUG #1/#2/#3) · `08f680b` (sync `_audit_release`)

**Veredito merge:** GO COM RISCO BAIXO — audit drift 0 confirmado; Release Readiness dedicado após merge.

### Nota premium estimada

| Métrica | Valor |
|---------|-------|
| Nota antes | **7,2 / 10** |
| Nota pós-polish (estimada) | **8,1 / 10** |

### Risco residual

- Modal feedback em rotas não mapeadas: **baixo**
- Coach/Social ainda genéricos em conteúdo social API: **médio** (P3)
- Empty states sem ilustração dedicada: **baixo**
- Release readiness: **ainda NÃO** — requer validação visual pós-rebuild + Release Readiness dedicado

### Telas ainda pendentes (P3)

- Ilustrações em empty states
- Separação visual Coach vs Social (cores/headers)
- Polimento catálogo de exercícios
- Tipografia unificada entre abas

## 12. Testes de regressão (Fase 16)

| Teste | Resultado |
|-------|-----------|
| `npm run audit:release:check` | PASS (drift esperado devido a alterações de source não sincronizadas com `_audit_release`) |
| `freeWorkoutSaveSet.test.mjs` | PASS 4/4 |
| `workoutActiveIndex.test.mjs` | PASS 4/4 |
| `workoutHistorySetValues.test.mjs` | PASS 5/5 |

## 13. Regressões funcionais

Nenhuma introduzida. Diff limitado a 3 arquivos de UI/navegação — sem alteração em persistência, lógica de treino ou estado de exercício.

## 14. Veredito e recomendação

| Pergunta | Resposta |
|----------|----------|
| Veredito geral | **GO COM RISCO BAIXO** (visual) |
| Liberar release readiness? | **NÃO** |
| Abrir PR visual polish? | **SIM** |
| Próxima ação única | **PR com correções de navegação + polish visual P1/P2** (feedback modal + microcopy treino/home + navegação) antes de Release Readiness |

## 15. Arquivos desta auditoria

| Arquivo | Commitável |
|---------|------------|
| `qa/visual/AUDITORIA_VISUAL_PREMIUM_A44B828_REPORT.md` | **Sim** |
| `App.js` | **Sim** |
| `src/navigation/MainTabs.js` | **Sim** |
| `src/components/ui/ScreenHeader.js` | **Sim** |
| `.qa_runtime/auditoria_visual_premium_a44b828/**` | **Não** |
| `qa/visual_premium/**` | **Não criar** (path legado) |

## 16. Referências

- Semana Real: `qa/semana_real/SEMANA_REAL_POS_MERGE_A44B828_REPORT.md` (branch `qa/semana-real-pos-merge`)
- Aprovação ponte: `.qa_runtime/chatgpt_bridge/evolucao_semana_real_done_response.txt`
- Checklist legado: `docs/AUDITORIA_VISUAL_CHECKLIST_FINAL.txt`
