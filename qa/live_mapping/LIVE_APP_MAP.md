# Mapa Vivo do App Evolução

**Device:** `emulator-5554`  
**Modo:** Auditoria por pacotes + envio ChatGPT navegador PC (2026-05-30)  
**Evidencias:** `screenshots/home/`

---

## Tela: Home

**Evidencia inicial:** `screenshots/home/home_001_inicio.png`

### Elementos mapeados

- Continuar treino
- Resumo de hoje (Treino pendente, Proteina, Agua)
- Prioridade WORKOUT
- Registrar refeicao
- Ver insights do dia
- Abas: Home, Treino, Nutricao, Coach, Mais

### Fluxos mapeados

| Elemento clicado | Vai para | Status | Evidencia |
|---|---|---|---|
| Continuar treino | Treino de hoje | **BUG** (1 de 1) | home_002_continuar_treino.png |
| Registrar refeicao | Nutricao / refeicao | OK | home_003_registrar_refeicao.png |
| Ver insights do dia | Insights | OK | home_004_ver_insights.png |
| Aba Treino | Hub Treino | OK | home_005_tab_treino.png |
| Aba Nutricao | Nutricao | OK | home_006_tab_nutricao.png |
| Aba Coach | Coach | OK (ChatGPT confirma) | home_007_tab_coach.png |
| Aba Mais | Mais / Perfil | OK | home_008_tab_mais.png |
| Aba Home | Home | OK | home_010_tab_home.png |

## Tela: Home (deep audit 3/3)

**Evidencias:** `screenshots/home_deep/`  
**Veredito:** **PASS PARCIAL** navegacao · **FAIL** funcao/estado/dados

### Fluxos profundos mapeados

| Fluxo | Acao real testada | Sync Home? | Evidencia |
|---|---|---|---|
| Scroll | Top + bottom + Expandir | — | 001, 002 |
| Continuar treino | Rest + save set | Nao (prot/streak iguais) | 003–011 |
| Registrar refeicao | Chips + montar + save | Nao (0/150g) | 012–022 |
| Ver insights | Scroll + PRO tap | XP/streak divergem | 023–026 |
| Coach pos-acoes | Tab Coach | Treino/prot nao refletidos | 027 |

### Coerencia multi-aba (deep)

- Streak: Home **Dia 1** vs Treino **0 dias** vs Insights **Streak 0**
- Proteina: Home **150g** vs Nutricao **160g**
- Treino: Home pendente apos salvar serie no treino

---

## Tela: Treino de hoje

**Evidencias:** `screenshots/home/home_002_continuar_treino.png`, `screenshots/treino/treino_001..015`  
**Estado pos reset QA:** Exercicio **1 de 1** · Series 1/4 · 25% concluido — **nao PASS**

### Elementos mapeados (batch Treino)

- btn-save-set + keypad (peso/reps)
- btn-toggle-workout-mode (simples / avancado)
- Rest presets 30s / 60s / 120s + btn Descanso
- Barra Treino: X% concluido
- Finalizar treino (1/4)
- Historico de treinos (hub Treino)

### Fluxos mapeados (Treino)

| Acao | Resultado | Evidencia |
|---|---|---|
| QA reset + abrir treino | 1 de 1 | treino_001_inicio_ex1.png |
| Salvar 1 serie | 25% · 1/4 | treino_002_ex1_parcial.png |
| Completar series ex1 | Sem ex2 | treino_003..004 |
| Modo simples / avancado | Toggle OK | treino_008..009 |
| Rest presets | Visiveis | treino_010_rest_presets.png |
| Finalizar treino | OK | treino_011..012 |
| Home pos finish | OK | treino_013 |
| Historico | OK | treino_014 |
| Reopen app | OK | treino_015 |

### Analise ChatGPT (HOME 2/2)

- Navegacao inferior **OK** — abas abrem telas corretas
- **P1:** Estado treino desincronizado Home/Treino/Coach
- **P1 fix 2026-05-30:** `dailyState.js` unifica proteina/streak/XP/treino — ver `P1_STATE_FIX_REPORT.md`
- Proteina pos-fix: meta unica **160g** (peso-based) em Home/Nutricao/Coach
- **P2:** Coach visualmente confusa; labels `[F-Coach]` debug
- **P2:** Aba Mais vazia; card Treino status "—"

### Problemas Treino (captura local)

- BUG_001, BUG_002 (1 exercicio)
- BUG_003: FINISH_BUTTON_VISIBLE_TOO_EARLY
- BUG_004: WORKOUT_PROGRESS_PREMATURE_25 (observacional)

---

## Tela: Insights

**Evidencia:** `screenshots/home/home_004_ver_insights.png`

---

## Tela: Hub Treino

**Evidencia:** `screenshots/home/home_005_tab_treino.png`
