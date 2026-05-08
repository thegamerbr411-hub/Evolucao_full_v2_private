# VIDEO SYSTEM ANALYSIS

## Superficie mapeada

- Tela principal: src/screens/ExerciseDetailScreen.js
- Fonte de URLs: src/data/exercises.js e src/data/exerciseLibraryV2.js
- Tecnologia atual: expo-av Video
- Fallback externo: expo-web-browser

## Fluxo observado antes da correcao

1. A tela resolvia exercise -> videoUrl.
2. O player interno so era habilitado por estado local.
3. Nao havia ref do player para operacoes de unload/fullscreen.
4. Nao havia cleanup quando a tela perdia foco ou o app ia para background.
5. O fallback externo funcionava, mas sem trilha estruturada de eventos.

## Problemas encontrados

- ausencia de unload explicito
- ausencia de pausa/cleanup em blur/unmount/background
- fullscreen sem CTA explicita e sem instrumentacao
- buffering sem visibilidade operacional
- erro de player sem tag padronizada de observabilidade

## Correcoes aplicadas

- ref do player adicionada
- unloadPlayer centralizado
- cleanup acionado em:
  - screen_unmount
  - screen_blur
  - app_inactive/background
- logs estruturados adicionados para:
  - screen_ready
  - load_start
  - loaded
  - buffering_start
  - buffering_end
  - fullscreen_requested
  - fullscreen_update
  - unload
  - external_open
  - video_error
- CTA explicita adicionada para fullscreen
- CTA explicita adicionada para fechar player

## Lifecycle esperado apos a mudanca

1. Usuario abre detalhe do exercicio.
2. Tela registra screen_ready com contexto do asset.
3. Usuario habilita player interno.
4. Player loga load_start -> loaded.
5. Buffering relevante passa a ser rastreado.
6. Se houver blur, unmount ou background, o player descarrega explicitamente.
7. Se fullscreen for acionado, a transicao passa a ser registrada.

## Matriz de validacao alvo

| Cenario | Estado atual |
| ------ | ------ |
| Abrir video interno | Implementado, aguardando prova em device |
| Abrir fullscreen | Implementado, aguardando prova em device |
| Voltar da tela | Cleanup implementado |
| Background/foreground | Cleanup implementado |
| Reabrir player | Fluxo preparado |
| Buffering visivel | Instrumentado |
| Erro silencioso | Coberto com log estruturado |

## Problemas restantes

- dependência atual continua sendo expo-av, que já emite warning deprecado
- a validacao real de orientacao e fullscreen ainda depende de rodada em device
- o player ainda precisa ser medido sob navegacao rapida e multitarefa real

## Evidencia real desta entrada

- Execucao real realizada com script dedicado em `RQ8T209ZTAF`.
- Artefato principal: `stabilization_phase_2/VIDEO_VALIDATION/run_20260508_053834/phase2_validation.mp4`.
- Resultado observado em `summary.txt` da rodada:
  - `videoFound=False`
  - `internalPlayerTriggered=False`
  - `fullscreenTriggered=False`

Conclusao: a camada de lifecycle foi implementada no codigo, mas a prova funcional de video/fullscreen ainda nao foi obtida porque o fluxo nao alcançou de forma deterministica a tela de detalhe com player no ciclo automatizado atual.

## Proxima acao obrigatoria

- executar rodada real em device capturando:
  - player interno
  - fullscreen
  - voltar
  - minimizar/restaurar
  - reentrada rapida