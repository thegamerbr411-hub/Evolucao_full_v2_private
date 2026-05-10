# STRESS VALIDATION REPORT

Data: 2026-05-08T14:39:17.439Z
Runs executadas: 16
Runs com sucesso: 0
Runs com falha: 16

## Flows exercitados
- smoke
- auth
- navigation
- treino
- video
- admin
- logout
- relaunch
- fullscreen

## Sinais de instabilidade detectados
- auth: Critico (pass rate 0%, transicoes 0)
- logout: Critico (pass rate 0%, transicoes 0)
- navigation: Critico (pass rate 0%, transicoes 0)
- other: Critico (pass rate 0%, transicoes 0)
- smoke: Critico (pass rate 0%, transicoes 0)

## Crashes e erros relevantes
- MEDIA x69: #-# #:#:#.#  #  # I DetoxWSClient: Sending out action 'testFailed' (ID ##)
- MEDIA x32: #-# #:#:#.#  # # I DetoxWSClient: Sending out action 'testFailed' (ID ##)

## Artefatos
- qa_runs/
- stress_runs/
- regression_runs/
- baseline_runs/
- nightly_runs/