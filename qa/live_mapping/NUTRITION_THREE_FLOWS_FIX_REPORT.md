# Nutrição — três fluxos separados (Fase B)

**Data:** 2026-06-02  
**Branch sugerida:** `feat/nutrition-three-flows` (a partir de `hotfix/p0-auth-persistence-reopen-20260511` pós-push Rotinas/Água)

## Problema

O card “Foto do prato (beta)” chamava `runPhotoEstimate` → `parseNutritionLabel` (pipeline de **tabela**), não estimativa de prato. Texto e foto competiam no mesmo fluxo mental.

## Solução

| Fluxo | testID card | Handler / provider | Confiança |
|--------|-------------|-------------------|-----------|
| Descrever refeição por texto | `nutrition-flow-text` | `buildDraftFromFreeText` | média |
| Ler tabela nutricional por texto | `nutrition-flow-label` | `buildDraftFromLabel` (texto obrigatório; foto só referência) | média/alta (parser) |
| Estimar prato | `nutrition-flow-plate` | `buildDraftFromPlateHint` + foto opcional | **baixa** |

**Regra:** preview em `nutrition-result-card` → **Adicionar ao rascunho** / **Editar no rascunho** → `btn-save-meal`. Sem `addFoodLogEntriesBatch` direto nos fluxos de estimativa.

## Arquivos

- `src/screens/NutritionScanner.js` — 3 cards, handlers `runNutritionLabelScan` / `runPlateEstimate`, resultado unificado
- `src/services/nutritionDraftProvider.js` — stub para API futura
- `__tests__/nutritionDraftFlows.test.mjs` — testes unitários (sem UI)

## Testes

```powershell
node --test __tests__/nutritionDraftFlows.test.mjs
```

## QA visual (emulator-5554) — 2026-06-04

| Fluxo | Status | Evidência |
|--------|--------|-----------|
| Texto | PARCIAL (paywall na automação ADB) | `nutrition_flow_text_*.png` |
| Tabela | PARCIAL (paste truncado; UX erro OK) | `nutrition_flow_label_*.png` |
| Prato | **SIM** | `nutrition_flow_plate_02_low_confidence.png`, `_03_draft.png` |

Checkpoint: [`videos/first_install_tabs_20260603_1346/NUTRITION_THREE_FLOWS_VISUAL_CHECKPOINT.md`](videos/first_install_tabs_20260603_1346/NUTRITION_THREE_FLOWS_VISUAL_CHECKPOINT.md)

Testes: **9/9 PASS** (`nutritionDraftFlows.test.mjs`) · PASS global: **NÃO** · commit: **NÃO**

## QA manual (emulator-5554)

1. Nutrição → texto “2 ovos, 1 pao” → resultado → Adicionar ao rascunho → Salvar refeição → Home macros
2. Colar texto de tabela (kcal, C, P, G) → Processar → rascunho
3. Prato “100g frango, arroz” → Estimar pela descricao → disclaimer baixa confiança → revisar rascunho

## UX label (2026-06-04)

Copy honesta: sem prometer OCR na foto. Ver [`NUTRITION_LABEL_TEXT_ONLY_UX_REPORT.md`](NUTRITION_LABEL_TEXT_ONLY_UX_REPORT.md).

| QA | Status |
|----|--------|
| Automação pré-validação | PARCIAL (dump UI sem foto ref) |
| **Validação visual emulator-5554** | **VALIDADO** — PNGs `*_VALIDADO.png` + Metro reload OK |

Evidências: `nutrition_label_text_only_copy_VALIDADO.png`, `nutrition_label_empty_text_error_VALIDADO.png`, `nutrition_label_monster_result_VALIDADO.png`.

## Fora de escopo

- OpenAI/Gemini API, OCR real, ML Kit
- Alterar commits `e5f3c10` / `ae4bb91` já enviados
