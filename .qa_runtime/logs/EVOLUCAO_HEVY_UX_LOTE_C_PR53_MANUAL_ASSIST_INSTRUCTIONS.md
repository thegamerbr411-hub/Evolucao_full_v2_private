# Manual assist — PR #53 Visual QA V4 (emulator-5554 ONLY)

## Device
- Serial: **emulator-5554** only
- Package: com.tipolt.evolucaofullv2
- Real device RQ8T209ZTAF: **do not use**

## Current screen texts
- Allow Evolução to send you notifications?
- Allow
- Don’t allow

## Actions (on emulator only)
1. Ensure simple mode (toggle if advanced).
2. Tap active exercise if "Toque para focar".
3. Fill weight **10** and reps **10** on pending set.
4. Tap **Salvar série** — repeat until **Finalizar treino** appears.
5. Tap **Finalizar treino** and confirm modal if shown.
6. When screen-workout-complete is visible, re-run:
   `node .qa_runtime/scripts/hevy_ux_lote_c_sandbox_v4.cjs --resume-capture-only`

Marker path: `F:\projetos\evolucao-main-clean\.qa_runtime\visual_audit\hevy_ux_lote_c_v4\MANUAL_ASSIST_DONE.marker`
