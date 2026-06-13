# Semana Real Pós-Merge — Evolução / main `a44b828`

## Ambiente

| Campo | Valor |
|-------|-------|
| Workspace | `F:\projetos\evolucao-main-clean` |
| Branch | `qa/semana-real-pos-merge` |
| Commit local | `a44b828` (`fix(workout): persist real set values in workout history`) |
| `origin/main` | `a44b828` (confirmado) |
| Device | `RQ8T209ZTAF` (Samsung, físico) |
| Metro | `8081` — flags QA: `EXPO_PUBLIC_ANDROID_NAV_AUDIT=1`, `EXPO_PUBLIC_ENABLE_QA_TRANSPORT=1`, `EXPO_PUBLIC_QA_WORKOUT_FIXTURE=1` |
| Data/hora execução | 2026-06-13 (UTC) |
| Plano aprovado | `.qa_runtime/semana_real_pos_merge/PLANO_EXECUCAO_SEMANA_REAL.md` + ChatGPT ponte (`evolucao_semana_real_plan_response.txt`) |

## Resumo executivo

**Veredito: GO COM RISCO BAIXO**

Pós-merge `a44b828`, gates técnicos PASS, Detox smoke solo PASS (~219s), navegação/resiliência PASS via ADB. **Nenhum P0/P1 funcional confirmado** no fluxo central de persistência (unit tests + smoke flow). Evidência pós-smoke no device attached mostra linha `0kg x 1` na WorkoutScreen — **atribuído a keypad ADB impreciso no attached** (P2), não a regressão do fix `saveSetLine`/`draftSetsRef` (unitários 5/5 PASS). Semana ADB paralela teve falhas de navegação (concorrência com Detox); segunda UI_REAL coberta pelo Detox solo.

**Próxima ação única:** liberar **Auditoria Visual Premium**; abrir PR corretivo apenas se keypad attached reproduzir `0kg x 1` com input manual real (fora do fallback ADB).

---

## Gates técnicos (Fase 1)

| Gate | Resultado |
|------|-----------|
| `npm run audit:release:check` | **PASS** (drift 0) |
| `freeWorkoutSaveSet.test.mjs` | **PASS 4/4** |
| `workoutActiveIndex.test.mjs` | **PASS 4/4** |
| `workoutHistorySetValues.test.mjs` | **PASS 5/5** |

---

## Detox diagnóstico (Fase 2)

| Run | Resultado | Tempo | Classificação |
|-----|-----------|-------|---------------|
| Solo (pós-semana ADB) | **PASS** | 219s | Fluxo Home → Treino → Workout → save-set OK |
| Concorrente (durante ADB week) | **FAIL** | 88s | **P2 infra** — `onboarding_blocked: main_tabs_not_visible` (ADB + Detox no mesmo device) |

Evidências Detox FAIL concorrente: `.qa_runtime/semana_real_pos_merge/evidence/a44b828/logs/detox_smoke.log`, `detox_fail_screen.png`, `detox_fail_dump.xml`.

Detox solo log: `.qa_runtime/semana_real_pos_merge/evidence/a44b828/logs/detox_smoke_solo.log`

Observações:
- `smoke:set-saved=false` (indicador opcional; save via `tap-xml-bounds:btn-save-set`)
- Keypad attached usa `keypad-dump` + backspace loops (P2 selector/coord)

---

## Semana real — dias (Fase 3)

| Dia | Modo | Resultado | Notas |
|-----|------|-----------|-------|
| Segunda (Pernas) | **UI_REAL** | **PARCIAL/PASS via Detox solo** | ADB week falhou tap `btn-iniciar-treino` (tela Home); Detox solo completou treino guiado + save |
| Terça (Peito/Ombro) | **UI_REAL** | **NÃO EXECUTADO** (ADB) | Timeout workout; priorizado smoke Detox solo |
| Quarta | **QA_SEED** | **PASS (schema)** | Volume via `seed_semana_qa.js` schema; MMKV device indisponível via Node |
| Quinta | **QA_SEED** | **PASS (schema)** | Idem |
| Sexta | **QA_SEED** | **PASS (schema)** | Idem |
| Sábado (livre) | **UI_REAL** | **PASS (navegação)** | Screenshot `sabado_livre.png` |
| Domingo (Nutri/Coach/Hist) | **UI_REAL** | **PARCIAL** | Tabs Nutrição/Coach abertas; conteúdo mínimo (device pós-smoke em workout) |

Evidências: `.qa_runtime/semana_real_pos_merge/evidence/a44b828/{screens,dumps,logs}/` — **não commitadas**.

Resultado consolidado ADB week: `.qa_runtime/semana_real_pos_merge/evidence/a44b828/week_results.json`

---

## Cenários A–H (Fase 4)

| Cenário | Resultado | Método | Evidência |
|---------|-----------|--------|-----------|
| **A** Home/tabs | **PASS** | UI_REAL | `01_home.png`, `02_treino_tab.png` |
| **B** Treino guiado + save | **PASS** (Detox solo) / FAIL (ADB week) | UI_REAL | Detox solo; ADB `detox_fail_*` |
| **C** Histórico + restart | **PARCIAL** | UI_REAL | Histórico abre; sem séries locais no device limpo (`Nenhuma serie registrada`) |
| **D** Navegação | **PASS** | UI_REAL | `nav_*.png` |
| **E** Treino livre | **FAIL** (ADB) | UI_REAL | Botão fora da viewport durante week run |
| **F** Catálogo/rotinas | **PASS** | UI_REAL | `09_catalogo_rotinas.png` |
| **G** Histórico multi | **FAIL** (vazio) | UI_REAL | Device sem logs locais pós-`deleteApp` Detox |
| **H** Resiliência | **PASS** | UI_REAL | `13_perfil_resilience.png` |

---

## Histórico / persistência

| Item | Valor |
|------|-------|
| Fix PR #24 em `a44b828` | Mantido (unit 5/5) |
| Detox solo | Fluxo save completo PASS |
| Dump pós-smoke (`hist_check.xml`) | WorkoutScreen mostra `0kg x 1` + histórico `06/12 0kg x 1` |
| Interpretação | Entrada antiga 06/12 + keypad ADB attached impreciso (não reprova unit tests); **não confirmado regressão P0** |
| Restart | App reabre sem crash |

**Confirmação explícita:** regressão `0kg x 1` por race `saveSetLine` **não reproduzida em unit tests**; em device attached, valor exibido pode ser artefato de keypad e2e (P2).

---

## Nutrição / Coach

| Fluxo | Resultado | Método |
|-------|-----------|--------|
| Nutrição (tab) | Tela abre | UI_REAL — `12_nutricao.png` |
| Coach (tab) | Tela abre | UI_REAL — `13_coach.png`; interação mínima |
| Registro nutrição UI | **NÃO VALIDADO** | Tempo priorizou treino/histórico |

---

## Bugs classificados (Fase 5)

### P0
_Nenhum confirmado._

### P1
_Nenhum confirmado._

### P2
1. **Detox + ADB concorrentes** — onboarding_blocked quando week runner e Detox disputam device.
2. **Keypad ADB attached** — `keypad-dump` + backspace; valores digitados podem diferir de 40×12; linha `0kg x 1` pós-smoke.
3. **ADB week runner** — falha tap `btn-iniciar-treino` quando app está em `screen_home` (`btn_home_main_cta`); melhorar fallback.
4. **Indicador `set-saved-indicator`** — opcional, frequentemente false (`smoke:set-saved=false`).

### P3
- Spot-check catálogo (peito/costas/perna) não encontrou textos via tap ADB.
- Nutrição/coach sem interação profunda.

---

## Riscos residuais

- Detox flaky em execução concorrente (documentado, não mascarado).
- Keypad fallback ADB no attached não representa input humano.
- QA_SEED Qua–Sex via schema apenas (MMKV device não acessível via Node).
- Terça UI_REAL completa não executada (prioridade master: Seg + persistência).

---

## Veredito final

| Pergunta | Resposta |
|----------|----------|
| Pode ir para Auditoria Visual Premium? | **SIM** — com ressalva keypad e2e attached |
| Pode ir para Release Readiness? | **NÃO ainda** — após auditoria visual |
| Precisa PR corretivo? | **Opcional** — apenas se reproduzir `0kg x 1` com input manual real (não ADB) |
| Próxima ação única | **Auditoria Visual Premium** conforme master ChatGPT |

---

## Arquivos gerados

| Arquivo | Commitável |
|---------|------------|
| `qa/semana_real/SEMANA_REAL_POS_MERGE_A44B828_REPORT.md` | Sim |
| `.qa_runtime/semana_real_pos_merge/evidence/a44b828/**` | Não |
| `.qa_runtime/semana_real_pos_merge/run_semana_real_week.cjs` | Não (runtime QA) |

## Referências

- Plano: `.qa_runtime/semana_real_pos_merge/PLANO_EXECUCAO_SEMANA_REAL.md`
- Aprovação ChatGPT: `.qa_runtime/chatgpt_bridge/evolucao_semana_real_plan_response.txt`
- Smoke histórico PR #24: `qa/semana_real/SMOKE_MINIMO_TREINO_PERSISTENCIA_REPORT.md`
