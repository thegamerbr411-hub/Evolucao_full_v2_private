# Limpeza de Repositório com Preservação de Evidências

## Objetivo

Reduzir peso e ruído operacional sem apagar evidências úteis de QA/release.

## Inventário desta rodada

Foram encontrados artefatos grandes recorrentes, principalmente:

- logs de device Detox dentro de artifacts/
- vídeos de validação em Evolucaomidia/
- capturas antigas em qa_runs/ e QA_RUNS/

Há múltiplos arquivos individuais acima de 30 MB.

## Estratégia segura adotada

1. Não deletar direto.
2. Mover para pasta de arquivamento local versionada por execução.
3. Manter trilha de auditoria por data/hora da limpeza.

## Script criado

- scripts/cleanup-artifacts-safe.ps1

Modo padrão:

- dry-run (somente lista candidatos)

Aplicação real:

- move arquivos candidatos para cleanup_archive/run_YYYYMMDD_HHMMSS/

## Execução recomendada

1. Dry-run:
   powershell -ExecutionPolicy Bypass -File .\scripts\cleanup-artifacts-safe.ps1
2. Aplicar limpeza segura:
   powershell -ExecutionPolicy Bypass -File .\scripts\cleanup-artifacts-safe.ps1 -Apply -OlderThanDays 14

## Regras de preservação

Não mover automaticamente:

- documentação final de release
- relatório final de QA vigente
- evidências da rodada atual em aberto
- arquivos necessários para crash symbols em produção

## Resultado esperado

- Redução significativa de ruído e tamanho de workspace.
- Evidência preservada em arquivo organizado para auditoria futura.
