# KNOWN ISSUES

## OAuth Google (historico)
- Sintoma: invalid_request com erro de custom URI scheme e code challenge.
- Causa raiz provavel: mismatch entre client_id, redirect e tipo de client.
- Mitigacao aplicada: padronizacao de redirect nativo Android no authService.
- Estado: monitorando em runtime real apos patch.

## Auditoria visual manual
- Sintoma: cobertura ampla existe, mas ciclo humano de 5 rodadas ainda nao concluido nesta execucao.
- Risco: regressao visual/UX residual.
- Acao: executar checklist completo com scrcpy visivel.

## Artefatos grandes no repo
- Sintoma: alto volume de logs/videos antigos.
- Risco: ruído e manutencao lenta.
- Acao: script cleanup-artifacts-safe.ps1 com dry-run e archive seguro.