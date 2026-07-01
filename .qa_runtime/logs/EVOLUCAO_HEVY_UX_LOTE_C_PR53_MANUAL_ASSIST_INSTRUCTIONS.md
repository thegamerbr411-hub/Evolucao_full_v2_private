# Manual assist — PR #53 Visual QA V5 (emulator-5554 ONLY)

## Device
- Serial: **emulator-5554** only
- Package: com.tipolt.evolucaofullv2
- Real device RQ8T209ZTAF: **do not use**

## Current screen texts
- Treinos
- Execute, registre e evolua.
- HOJE
- EXERCÍCIOS
- SÉRIES
- Em andamento
- STATUS
- CONTINUAR TREINO
- TREINO LIVRE
- ROTINAS
- IMPORTAR TREINO
- DESAFIOS
- RANKING
- TREINO SUGERIDO
- Peito + Triceps + Ombro
- • Baseado nos seus ultimos treinos
- • Ajustado para sua frequencia semanal
- Ver histórico de treinos
- Home
- Treino
- Nutrição
- Coach
- Social
- Perfil

## Actions (on emulator only)
1. Ensure simple mode (toggle if advanced).
2. Tap active exercise if "Toque para focar".
3. Fill weight **10** and reps **10** on pending set.
4. Tap **Salvar série** — repeat until **Finalizar treino** appears.
5. Tap **Finalizar treino** and confirm modal if shown.
6. When screen-workout-complete is visible, re-run:
   `node .qa_runtime/scripts/hevy_ux_lote_c_sandbox_v5.cjs --resume-capture-only`

Marker path: `F:\projetos\evolucao-main-clean\.qa_runtime\visual_audit\hevy_ux_lote_c_v5\MANUAL_ASSIST_DONE.marker`
