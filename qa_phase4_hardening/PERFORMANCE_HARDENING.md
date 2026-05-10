# PERFORMANCE HARDENING

Data: 2026-05-08T14:39:17.440Z

| Cenario | Samples | Startup (ms) | Memoria TOTAL PSS (MB) | Janky Frames (%) |
| ------- | ------- | ------------ | ---------------------- | ---------------- |
| cold_start | 0 | 0 | 0 | 0 |
| warm_start | 0 | 0 | 0 | 0 |
| long_session | 0 | 0 | 0 | 0 |
| stress_session | 0 | 0 | 0 | 0 |

## Observacoes
- FPS aproximado inferido por janky frames do gfxinfo.
- Heuristicas de leak usam crescimento de PSS entre warm/long/stress.
- Recomendado manter trend de PSS e janky por rodada noturna.