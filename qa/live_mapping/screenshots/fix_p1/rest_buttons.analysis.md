# BUG_REST — Análise presets + timer Descanso

**Device:** emulator-5554  
**App:** com.tipolt.evolucaofullv2  
**Tela:** Treino de hoje · Exercício 1 de 5  
**Script:** `fix_rest_validate.ps1`  
**Timestamp:** 2026-05-30T23:16:25  
**Resultado:** **PASS** (`bugRestPass: true`)

---

## Presets visíveis

| Item | Valor |
|---|---|
| Botões 30s / 60s / 120s | **Sim** — `btn-rest-preset-30/60/120` no XML |
| Botão Descanso | **Sim** — `btn-start-rest-manual` · texto "Descanso" |
| Label ativo | `text-rest-preset-active` · formato `Descanso: Xs` |

---

## Preset inicial

- **Estado:** `Descanso: 60s` (default)
- **Evidência:** `rest_001_presets_visible.xml` · `presetSeconds: 60`
- **Visual:** apenas `btn-rest-preset-60` com `selected="true"`

---

## Seleção após cada clique

| Passo | Arquivo | Preset XML | Label |
|---|---|---|---|
| Inicial | rest_001 | 60s | Descanso: 60s |
| Tap 30s | rest_002 | 30s | Descanso: 30s |
| Tap 60s | rest_003 | 60s | Descanso: 60s |
| Tap 120s | rest_004 | 120s | Descanso: 120s |

**Correção aplicada:** estilos `presetBtnActive` vs `presetBtnIdle` — um único preset ativo por vez (antes 30s+60s pareciam ativos juntos).

---

## Botão Descanso

- **Texto:** "Descanso" (`btn-start-rest-manual`)
- **Ação:** inicia overlay flutuante com countdown
- **Evidência timer:** `rest_005_timer_started.png` — overlay "Descanso" + **01:58** (~120s)
- **Nota XML:** uiautomator timeout no overlay (`rest_005_timer_started.xml` vazio); timer inferido por PNG + sequência

---

## Timer

| Item | Resultado |
|---|---|
| Apareceu | **Sim** — card flutuante `rest-timer-floating` |
| Tempo inicial | **~01:58** (120s preset, drift normal pós-tap) |
| Após ~3s | **~01:42** em `rest_006_timer_after_wait.png` — countdown OK |
| Respeitou preset | **Sim** — 120s selecionado antes do tap Descanso |
| Botões saída | **+30s** (`btn-rest-extend-30`) · **Pular** (`btn-rest-skip`) visíveis no PNG |

---

## Estado do treino durante descanso

| Check | Resultado |
|---|---|
| Render Error | **Não** |
| Finalizar treino visível | **Não** (`finishVisible: false`) |
| Treino marcado concluído | **Não** — 0/17 séries, 0% |
| Exercício | Permanece **1 de 5** |
| Série quebrada | **Não** observado |

---

## Logcat / erros

- Nenhum crash ou Render Error na sequência
- uiautomator timeout no overlay é limitação de dump, não bug de app

---

## Compreensão do estado (UX)

- **Antes fix:** múltiplos presets pareciam selecionados (auditoria externa HOME 3/3A P1)
- **Depois fix:** label `Descanso: Xs` + um botão highlighted + timer flutuante claro
- Usuário entende: preset escolhido → tap Descanso → countdown com Pular/+30s

---

## Evidências

| Arquivo | Tipo |
|---|---|
| rest_001_presets_visible.png/.xml | Presets iniciais |
| rest_002_30s_selected.png/.xml | 30s |
| rest_003_60s_selected.png/.xml | 60s |
| rest_004_120s_selected.png/.xml | 120s |
| rest_005_timer_started.png/.xml | Timer iniciado |
| rest_006_timer_after_wait.png/.xml | Countdown |
| fix_rest_metrics.json | Métricas gate |

**Status BUG_REST:** **FIXED**
