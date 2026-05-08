# AUTH REAL FLOW REPORT

Date: 2026-05-08T16:42:32.317Z

## Firebase / Google readiness
- firebase project id (google-services): t-evo-b069a
- oauth clients em google-services.json: 0
- plugin google-services ativo no gradle: sim
- expo-web-browser plugin: sim

## Evidencia de auth em runtime
- auth logs: 0
- tentativas login Google: 0
- sinais firebase auth: 4
- erros de auth: 0

## Persistencia / restore / reconnect
- reconnect signals: 597
- Persistencia por SecureStore/MMKV permanece implementada no app; validacao manual real depende de credenciais ativas.

## Status
- BLOCKER: Google Sign-In real bloqueado por oauth_client ausente em google-services.json
- BLOCKER: Evidencia de login Google real ainda não encontrada nos logs coletados
