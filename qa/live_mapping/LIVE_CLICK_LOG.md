# Log de Cliques — Mapeamento ao Vivo (Batch Audit)

**Device:** `emulator-5554`  
**Modo:** Auditoria por pacotes (`home_batch_audit.ps1`)  
**Timestamp batch:** 2026-05-30 13:29

---

## Clique 001 — Home → Continuar treino

**Tela antes:** Home (app ja em Treino no dump inicial — ver observacao)  
**Elemento clicado:** Botao "Continuar treino" / `btn_home_main_cta`  
**Coordenada estimada:** (via testID tap, nao capturada)  

**Screenshot antes:** `screenshots/home/home_001_inicio.png`  
**Screenshot depois:** `screenshots/home/home_002_continuar_treino.png`  

**Tela depois:** Treino de hoje / WorkoutScreen  

**Resultado:** **BUG** (navegacao OK, estado do treino invalido)  

**Observacoes:**
- Dump pos-clique: **Exercicio 1 de 1** · **Series: 0/4**
- Nao e teste valido de treino multi-exercicio
- Bugs: `MULTI_EXERCISE_WORKOUT_NOT_LOADED`, `WORKOUT_PRESET_ONLY_ONE_EXERCISE`
- Nao declarar PASS

**Proxima acao recomendada:** Enviar HOME 1/2 ao ChatGPT; depois validar treino com 5 exercicios

---

## Clique 002 — Home → Registrar refeicao

**Tela antes:** Pos-voltar treino (`home_001b_pos_voltar_treino.png`)  
**Elemento clicado:** "+ Registrar refeicao" / `btn_home_nutrition`  
**Screenshot antes:** `screenshots/home/home_001b_pos_voltar_treino.png`  
**Screenshot depois:** `screenshots/home/home_003_registrar_refeicao.png`  
**Tela depois:** Nutricao / refeicao  
**Resultado:** **OK**  
**Observacoes:** Tela de registro/refeicao abriu.

---

## Clique 003 — Home → Ver insights do dia

**Tela antes:** `screenshots/home/home_001c_pre_insights.png`  
**Elemento clicado:** "Ver insights do dia" / `btn_home_insights`  
**Screenshot depois:** `screenshots/home/home_004_ver_insights.png`  
**Tela depois:** Insights  
**Resultado:** **OK**  
**Observacoes:** Fluxo Home → Insights funcional.

---

## Clique 004 — Aba Treino

**Screenshot depois:** `screenshots/home/home_005_tab_treino.png`  
**Tela depois:** Hub Treino  
**Resultado:** **OK**  

---

## Clique 005 — Aba Nutricao

**Screenshot depois:** `screenshots/home/home_006_tab_nutricao.png`  
**Tela depois:** Nutricao / refeicao  
**Resultado:** **OK**  

---

## Clique 006 — Aba Coach

**Screenshot depois:** `screenshots/home/home_007_tab_coach.png`  
**Tela depois:** (dump rotulou Hub Treino — verificar visualmente no pacote 2/2)  
**Resultado:** **INCONCLUSIVO** (rotulo automatico impreciso)  

---

## Clique 007 — Aba Mais

**Screenshot depois:** `screenshots/home/home_008_tab_mais.png`  
**Tela depois:** Mais / Perfil (dump impreciso)  
**Resultado:** **OK** (screenshot capturado)  

---

## Clique 008 — Aba Home (retorno)

**Screenshot depois:** `screenshots/home/home_010_tab_home.png`  
**Tela depois:** Home / Treino de hoje (dump)  
**Resultado:** **OK**  

---

*(Entradas watcher anteriores arquivadas — ver secoes "Mudanca NNN" acima deste arquivo no historico git)*

---

## Fase Treino — Batch Audit (`treino_batch_audit.ps1`)

**Timestamp:** 2026-05-30 14:01  
**Pre-condicao:** QA reset → Ex **1 de 1** · PASS bloqueado

---

## Clique 009 — Salvar 1a serie ex1

**Screenshot antes:** `screenshots/treino/treino_001_inicio_ex1.png`  
**Screenshot depois:** `screenshots/treino/treino_002_ex1_parcial.png`  
**Hints dump:** Exercicio 1 de 1 · 25% concluido · Series 1/4 · Rest presets visiveis  
**Resultado:** **OK** (salvar funcionou; estado treino invalido)

---

## Clique 010 — Completar series ex1

**Screenshot antes:** `screenshots/treino/treino_002_ex1_parcial.png`  
**Screenshot depois:** `screenshots/treino/treino_003_ex1_concluido.png`  
**Hints dump:** Exercicio 1 de 1 · 25% · Series 1/4  
**Resultado:** **OK** (UI nao avancou contador de series no dump)

---

## Clique 011 — Transicao ex2

**Screenshot depois:** `screenshots/treino/treino_004_ex2_inicio.png`  
**Resultado:** **BUG** — permaneceu Exercicio 1 de 1

---

## Clique 012 — Progresso parcial

**Screenshot depois:** `screenshots/treino/treino_005_progresso_parcial.png`  
**Resultado:** **OK** (captura evidencia 25%)

---

## Clique 013 — Avancar ate ex3

**Screenshot depois:** `screenshots/treino/treino_006_ex3_inicio.png`  
**Resultado:** **INCONCLUSIVO** — ex3 nao alcancado (1 de 1)

---

## Clique 014 — Modo avancado → ex5

**Screenshot depois:** `screenshots/treino/treino_007_ex5_inicio.png`  
**Resultado:** **INCONCLUSIVO** — ex5 nao alcancado; Finalizar treino visivel

---

## Clique 015 — Toggle modo simples

**Screenshot depois:** `screenshots/treino/treino_008_modo_simples.png`  
**Resultado:** **INCONCLUSIVO**

---

## Clique 016 — Toggle modo avancado

**Screenshot depois:** `screenshots/treino/treino_009_modo_avancado.png`  
**Resultado:** **INCONCLUSIVO**

---

## Clique 017 — Rest presets 30/60/120

**Screenshot depois:** `screenshots/treino/treino_010_rest_presets.png`  
**Resultado:** **OK** — REST_BUTTONS_MISSING **nao confirmado**

---

## Clique 018 — Finalizar treino

**Screenshot antes:** `screenshots/treino/treino_011_pre_finish.png`  
**Screenshot depois:** `screenshots/treino/treino_012_finish_confirm.png`  
**Resultado:** **OK** (tap Finalizar)

---

## Clique 019 — Home pos finalizar

**Screenshot depois:** `screenshots/treino/treino_013_home_pos_finish.png`  
**Resultado:** **OK**

---

## Clique 020 — Historico de treino

**Screenshot depois:** `screenshots/treino/treino_014_historico.png`  
**Resultado:** **OK**

---

## Clique 021 — Reopen app (force-stop)

**Screenshot depois:** `screenshots/treino/treino_015_pos_reopen.png`  
**Resultado:** **OK**

---

## Fase HOME 3/3 — Deep Audit (`home_deep_batch_audit.ps1`)

**Timestamp:** 2026-05-30 14:28  
**Cliques:** 022–044 (23 acoes)  
**Screenshots:** `screenshots/home_deep/home_deep_001` … `028`  
**Relatorio:** `HOME_DEEP_AUDIT_REPORT.md`

| Clique | Acao | Resultado | Evidencia |
|---|---|---|---|
| 022–024 | Scroll Home top/bottom + Expandir | OK | 001, 002 |
| 025 | Continuar treino | OK (1 de 1 BUG) | 003→004 |
| 026–28 | Rest 30/60/120 + Descanso | OK | 005–008 |
| 029–30 | Salvar serie | OK (25% 1/4) | 009–010 |
| 031 | Home pos treino | OK (resumo inalterado) | 011 |
| 032–36 | Registrar refeicao + chips | OK | 012–017 |
| 37–38 | Montar + Salvar refeicao | Save INCONCLUSIVO | 018–021 |
| 39 | Home pos refeicao | prot 0/150g inalterada | 022 |
| 40–42 | Insights scroll + PRO | OK | 023–026 |
| 043–44 | Coach + Home final | OK | 027–028 |
