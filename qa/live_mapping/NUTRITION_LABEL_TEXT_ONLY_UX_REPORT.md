# Nutrição — UX tabela nutricional (texto only, sem OCR)

**Data:** 2026-06-04  
**Device QA:** emulator-5554  
**Commit/push:** NÃO (aguarda OK Felipe)

## Problema

O card **“Ler tabela nutricional”** sugeria leitura por foto (`Fotografe a embalagem ou cole o texto…`). No código, `runNutritionLabelScan` só chama `buildDraftFromLabel({ ocrText: labelHintText })` — a imagem não entra no parser. Usuário que só tira foto recebia erro genérico.

## Solução (copy + mensagens)

| Área | Mudança |
|------|---------|
| Card `nutrition-flow-label` | Título **Ler tabela nutricional por texto**; subtítulo e aviso `nutrition-label-ocr-disclaimer` |
| Campo | Label **Cole aqui os dados da embalagem**; placeholder com exemplo Monster |
| Foto | Seção **Adicionar foto do rótulo como referência**; botões **Câmera/Galeria (referência)** |
| `buildDraftFromLabel` | Texto vazio → `LABEL_EMPTY_MESSAGE`; macros insuficientes → `LABEL_INSUFFICIENT_MESSAGE` |

Arquivos: `src/screens/NutritionScanner.js`, `src/services/nutritionDraftProvider.js`, `__tests__/nutritionDraftFlows.test.mjs`.

## Exemplo Monster (porção 200 ml)

```
Porção 200 ml
Valor energético 6 kcal
Carboidratos 2,8 g
Proteínas 0 g
Gorduras totais 0 g
Sódio 156 mg
```

Parser local (sem API): ~6 kcal, carbs 2–3 g, proteína/gordura 0, sódio 156 mg — teste unitário **PASS**.

## Testes

```powershell
node --test __tests__/nutritionDraftFlows.test.mjs
```

**9/9 PASS** (inclui vazio, Monster, meta `Tabela nutricional`).

## QA visual (emulator-5554)

Script: `tools/visual_qa_nutrition_label_ux.ps1`

| Evidência | Arquivo |
|-----------|---------|
| Card + copy | `videos/first_install_tabs_20260603_1346/nutrition_label_text_only_copy.png` |
| Erro sem texto | `nutrition_label_empty_text_error.png` |
| Monster processado | `nutrition_label_monster_result.png` |

**Nota:** dump UI (`HAS_DISCLAIMER=False`) no APK da sessão pode não refletir bundle Metro até dev client conectado; revisar PNGs manualmente após reload. `POST http://127.0.0.1:8081/reload` executado antes das capturas.

Checklist manual:

1. Nutrição → card com aviso amarelo sobre foto não automática  
2. Processar sem texto → mensagem com “leitura automática da foto ainda não está disponível”  
3. Colar texto Monster → **Fluxo: Tabela nutricional** → Adicionar/Editar rascunho (sem save automático)

## CHECKPOINT — UX TABELA NUTRICIONAL AJUSTADA

| Item | Status |
|------|--------|
| Fluxo ajustado | SIM (código) |
| Promessa de OCR removida? | SIM (copy + mensagens) |
| Foto marcada como referência? | SIM |
| Campo de texto ficou claro? | SIM |
| Erro sem texto ficou claro? | SIM |
| Exemplo Monster validado? | SIM (unit); visual **revisar PNG** |
| Testes rodados | 9/9 PASS |
| Evidências | 3 PNGs em `first_install_tabs_20260603_1346/` |
| Código alterado? | SIM |
| Commit/push feito? | NÃO |
| PASS global do app? | NÃO |

**Próxima ação única:** Felipe validar os 3 PNGs no emulador com bundle atualizado → OK explícito → commit Nutrição (se escopo incluir este patch).

---

## Validação visual 2026-06-04 (emulator-5554)

**Script:** `tools/visual_qa_nutrition_label_ux_VALIDADO.ps1` · **Metro:** `POST http://127.0.0.1:8081/reload` OK (200) · **Dados:** sem `pm clear`

| Evidência VALIDADO | Conteúdo confirmado |
|--------------------|---------------------|
| `nutrition_label_text_only_copy_VALIDADO.png` | Título “por texto”, aviso amarelo sem OCR, label/placeholder Monster |
| `nutrition_label_empty_text_error_VALIDADO.png` | Mensagem “leitura automática da foto ainda não está disponível”; Câmera/Galeria (referência) |
| `nutrition_label_monster_result_VALIDADO.png` | Fluxo Tabela nutricional; 6 kcal; Carbo 3 g; P/G 0; Sódio 156 mg; Porção 200 ml; rascunho |

**JSON:** `nutrition_label_ux_VALIDATION_RESULT.json` (`podeCommitar: true` no dump UI; revisão visual confirma foto referência e placeholder)

## CHECKPOINT — UX TABELA NUTRICIONAL VALIDADA VISUALMENTE

| Item | Status |
|------|--------|
| Device usado | emulator-5554 |
| Metro/reload | OK (200) |
| Título novo visível? | **SIM** |
| Disclaimer sem OCR visível? | **SIM** |
| Foto marcada como referência? | **SIM** (copy + botões Câmera/Galeria referência) |
| Campo/placeholder claro? | **SIM** |
| Erro vazio amigável? | **SIM** |
| Monster processado? | **SIM** (6 kcal, ~3 g carbo, sódio 156) |
| Resultado tabela, não prato? | **SIM** |
| Rascunho antes de salvar? | **SIM** |
| Pode commitar Nutrição? | **SIM** — aguardando OK explícito Felipe |
| Código alterado além do fix? | **NÃO** (esta rodada só QA/docs) |
| Commit/push feito? | **NÃO** |
| PASS global do app? | **NÃO** |

**Próxima ação única:** OK explícito Felipe → commit Nutrição (3 fluxos + UX label).
