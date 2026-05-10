# QA_RUNS — Histórico de Execuções Reais

Esta pasta contém os artefatos de cada execução real de testes Detox no device físico.

## Estrutura de cada run

```
QA_RUNS/
  run_YYYYMMDD_HHMMSS/
    report.md            ← resultado consolidado da run
    logs/
      smoke.log          ← log principal do runner PS1
      jest-output.txt    ← saída raw do Jest/Detox
      logcat.txt         ← logcat do device durante a execução
    screenshots/         ← screenshots capturadas automaticamente pelo Detox
    video/               ← screenrecord (apenas em regression runs)
      regression.mp4
```

## Como adicionar uma run real

Após executar qualquer runner:
```powershell
# Exemplo — copiar a última run de smoke para aqui
$LatestRun = Get-ChildItem qa_runs\smoke -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Copy-Item $LatestRun.FullName -Destination "qa_phase3_consolidation\QA_RUNS\$($LatestRun.Name)" -Recurse
```

## Runs Registradas

*(Nenhuma run real registrada ainda — executar `.\run_smoke.ps1` para gerar a primeira)*
