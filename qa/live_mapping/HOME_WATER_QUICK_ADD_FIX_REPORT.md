# Home — Fix água com escolha de quantidade

**Data:** 2026-06-04  
**ID:** `BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT`  
**Autorização:** OK Felipe (após validação Rotinas no emulator-5554)  
**Device QA:** emulator-5554 (não usar RQ8T209ZTAF)

---

## CHECKPOINT — HOME ÁGUA VALIDADA VISUALMENTE

```text
Status: VALIDADO
Metro/reload: SIM (POST http://127.0.0.1:8081/reload)
Device: emulator-5554 apenas (RQ8T209ZTAF não usado)
Sheet apareceu? SIM (water-quick-add-sheet no UI dump)
Opções visíveis? SIM (200, 300, 500, 510, custom — testIDs no dump)
Registrar 200 ml? SIM (btn-confirm-water após water-option-200)
Home atualizou? SIM (card Água 0.3 / 1.2 L → 0.5 / 1.2 L após +200 ml)
Cancelar não alterou? SIM (0.5 / 1.2 L mantido após btn-cancel-water)
Toast 200 ml? SIM (comportamento; feedback transitório — card confirma +200 ml)
Evidências: *_VALIDADO.png em videos/first_install_tabs_20260603_1346/
  - home_water_quick_add_sheet_VALIDADO.png
  - home_water_quick_add_after_200_VALIDADO.png
  - home_water_quick_add_cancel_VALIDADO.png
Bundle antigo suspeito? NÃO (sem 300ml adicionados; sheet com testIDs)
QA nota: após Expandir, scroll na Home até btn_add_water visível no dump
Código alterado? SIM (pré-commit)
Commit/push feito? NÃO — aguarda OK explícito Felipe
PASS global do app? NÃO
Próxima ação única: Felipe autorizar commit escopo água (Home + helper + testes + QA docs)
```

---

## CHECKPOINT — HOME ÁGUA COM QUANTIDADE IMPLEMENTADA (código)

```text
Status: IMPLEMENTADO (código + testes)
Bug corrigido: BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT — SIM
Arquivos alterados:
  - src/services/waterQuickAdd.js (novo)
  - __tests__/waterQuickAdd.test.mjs (novo)
  - src/screens/HomeScreen.js (Modal sheet + wiring)
Helper criado? SIM — waterQuickAdd.js
Sheet/modal criado? SIM — Modal transparent + bottom sheet
Opções disponíveis: 200, 300, 500, 510 ml + Personalizado
Personalizado validado? SIM (unitário; max 3000 ml)
Cancelar não altera? SIM (fecha sheet sem addWaterIntake)
Home atualiza após registrar? SIM (addWaterIntake + homeStateTick + toast dinâmico)
Testes criados/rodados: __tests__/waterQuickAdd.test.mjs
Resultado dos testes: 13/13 PASS
Código alterado? SIM
Commit/push feito? NÃO
PASS global do app? NÃO
```

---

## Comportamento implementado

1. Toque em `btn_add_water` abre sheet (`water-quick-add-sheet`).
2. Opções rápidas: `water-option-200|300|500|510` + `water-option-custom`.
3. **Registrar** (`btn-confirm-water`) valida e chama `addWaterIntake(amountMl)`.
4. **Cancelar** (`btn-cancel-water`) fecha sem alterar estado.
5. Toast: `Água registrada: {N} ml` via `buildWaterRegisterCopy`.
6. `addWaterIntake` inalterado no context — mesma persistência `hydration` + `history.waterMl`.

---

## Nota UX Home

O botão `+ Beber água` fica em **Mais opções → Expandir** (não nas duas ações rápidas superiores). QA visual deve expandir antes de tocar.

---

## Evidência (VALIDADO emulator-5554 — 2026-06-04)

- [`videos/first_install_tabs_20260603_1346/home_water_quick_add_sheet_VALIDADO.png`](videos/first_install_tabs_20260603_1346/home_water_quick_add_sheet_VALIDADO.png)
- [`videos/first_install_tabs_20260603_1346/home_water_quick_add_after_200_VALIDADO.png`](videos/first_install_tabs_20260603_1346/home_water_quick_add_after_200_VALIDADO.png)
- [`videos/first_install_tabs_20260603_1346/home_water_quick_add_cancel_VALIDADO.png`](videos/first_install_tabs_20260603_1346/home_water_quick_add_cancel_VALIDADO.png)

Evidências anteriores (pré-validação dump): `home_water_quick_add_sheet.png`, `home_water_quick_add_after_200.png`

Análise original: [`HOME_WATER_QUICK_ADD_ANALYSIS.md`](HOME_WATER_QUICK_ADD_ANALYSIS.md)
