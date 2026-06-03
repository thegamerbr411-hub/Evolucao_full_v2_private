# BUG_FINISH — Analise visual pos-fix

**Timestamp:** 2026-05-30T22:27:45  
**Device:** emulator-5554  
**Script:** `fix_finish_validate.ps1` (MaxScriptSec=100, bounded UI dump)

## Referencia antes (finish_001 / fix_005)

| Elemento | Antes |
|---|---|
| Hint inferior | **Feche em 1 toque: 1/17 series concluidas** |
| Botao primario | **Finalizar treino (1/17)** verde |
| Botao secundario | Salvar parcial e sair |
| Risco | Finalizar treino incompleto como concluido |

## Depois (finish_002_after_fix_1_of_17)

| Elemento | Depois |
|---|---|
| Hint inferior | **Progresso salvo: 0/17 series concluidas. Continue para completar o treino.** |
| Botao primario | **Continuar treino** (btn-continuar-treino) |
| Botao secundario | **Sair e salvar progresso** (btn-salvar-parcial) |
| Finalizar treino | **Ausente** |
| Feche em 1 toque | **Ausente** |
| Exercicio | 1 de 5 · Agachamento Livre |
| Presets descanso | 30s / 60s / 120s visiveis (restPresetsOk=true) |

## Metricas XML (finish_002)

- `fecheEm1Toque`: false  
- `finishButtonVisible`: false  
- `continueButtonVisible`: true  
- `partialExitVisible`: true  
- `progressHintVisible`: true  
- `finishVisibleEarly`: false  

## Saida parcial (finish_003)

- Tap em `btn-salvar-parcial` abre Alert nativo (partial_alert_visible)  
- Confirmacao: Sair e salvar  

## Home pos-saida (finish_004)

- Treino permanece retomavel (nao marcado como concluido)  
- partialExitVisible=true no dump pos-navegacao  

## BUG_FINISH

**Status: FIXED** — criterio 1/17 ou 0% atendido.

## BUG_REST

**Status: PASS parcial** — presets 30/60/120 visiveis; 60s selecionado; timer nao exercitado neste script.

## Regressao corrigida durante validacao

- Crash `Property 'displayedSeriesTotal' doesn't exist` — variavel de display restaurada (nao usada no gate de finish).

## Evidencia

- `finish_001_before_or_reference.png` (copia fix_005)  
- `finish_002_after_fix_1_of_17.png` + `.xml`  
- `finish_003_partial_exit_if_available.png`  
- `finish_004_home_after_partial_exit.png`  
- `fix_finish_metrics.json`
