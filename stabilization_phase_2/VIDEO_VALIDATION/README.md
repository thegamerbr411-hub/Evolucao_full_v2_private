# VIDEO VALIDATION

Esta pasta foi preparada para armazenar as evidencias reais da Fase 2.

## Evidencias esperadas

- video_player_fullscreen.mp4
- video_background_foreground.mp4
- logout_full_cleanup.mp4
- stress_navigation_video.mp4
- deep_navigation_logout_restart.mp4

## Estado atual

- infraestrutura de estabilidade do player e do logout foi implementada nesta rodada
- build debug concluida e rodada real executada em device

## Rodadas reais geradas

- `run_20260508_053435`
- `run_20260508_053629`
- `run_20260508_053834`

Cada rodada contem:

- `phase2_validation.mp4`
- `logs/logcat_reactnativejs.txt`
- `summary.txt`
- `window_dump_latest.xml`

Resultado consolidado da rodada final:

- `videoFound=False`
- `externalOpenTriggered=False`
- `internalPlayerTriggered=False`
- `fullscreenTriggered=False`
- `logoutTriggered=False`
- `authScreenAfterRelaunch=True`

## Regra

- nenhum arquivo deve ser marcado como validado aqui sem prova real em device e logs correspondentes