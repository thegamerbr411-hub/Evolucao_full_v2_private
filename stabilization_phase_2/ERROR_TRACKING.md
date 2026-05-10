# ERROR TRACKING

## Padrão introduzido nesta rodada

- [AUTH]
- [VIDEO]
- [PLAYER]
- [STORE]

## Fontes de captura relevantes

- Error boundary global: App.js
- Error boundary local do detalhe do exercicio: src/screens/ExerciseDetailScreen.js
- Handler global de ErrorUtils: App.js
- Observabilidade central: src/core/observability.js
- Logger estruturado incremental: src/utils/runtimeLogger.js

## Eventos e erros agora rastreados no slice de video

- [VIDEO] screen_ready
- [VIDEO] load_start
- [VIDEO] loaded
- [VIDEO] app_state_change
- [VIDEO] external_open
- [PLAYER] internal_player_enabled
- [PLAYER] retry_internal_player
- [PLAYER] buffering_start
- [PLAYER] buffering_end
- [PLAYER] fullscreen_requested
- [PLAYER] fullscreen_update
- [PLAYER] unload
- [VIDEO] erro de render
- [PLAYER] erro de fullscreen
- [PLAYER] erro de unload

## Eventos e erros agora rastreados no slice de auth/logout

- [AUTH] logout_start
- [AUTH] firebase_signout error
- [AUTH] logout_complete
- [STORE] falha ao apagar SecureStore
- [STORE] falha ao limpar MMKV
- [STORE] falha ao limpar snapshot de observabilidade

## Warnings e riscos ainda monitorados

- warning deprecado de expo-av
- warning deprecado de InteractionManager
- possiveis conflitos de navegacao durante reset pos-logout
- possiveis falhas de media stack no fullscreen Android

## Resultado real desta rodada (logs + artefatos)

- `stabilization_phase_2/VIDEO_VALIDATION/run_20260508_053834/logs/logcat_reactnativejs.txt`
- `stabilization_phase_2/VIDEO_VALIDATION/run_20260508_053834/summary.txt`
- `stabilization_phase_2/VIDEO_VALIDATION/run_20260508_053834/phase2_validation.mp4`

Status objetivo da rodada final:
- sem confirmacao de evento funcional de player/fullscreen no ciclo automatizado
- sem confirmacao de acionamento do CTA de logout completo no ciclo automatizado
- estado de auth detectado apos relaunch

Nota: os artefatos existem e devem ser usados como baseline de investigacao para o proximo passe de automacao/text-driven navigation.

## Stack traces

- stack traces de runtime continuam sendo capturados por logRuntimeError.
- stack traces de render do detalhe do exercicio continuam sendo capturados pelo boundary local.

## Proxima ampliacao recomendada

- aplicar o logger estruturado tambem em:
  - [NAVIGATION]
  - [NETWORK]
  - [ERROR_BOUNDARY]
  - [STORE] de hydration