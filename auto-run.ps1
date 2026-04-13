while ($true) {
  Clear-Host

  Write-Host "=============================="
  Write-Host "RODANDO TESTES"
  Write-Host "=============================="
  npm run test:all

  Write-Host "=============================="
  Write-Host "RODANDO STRESS"
  Write-Host "=============================="
  npm run qa:stress:ux:10m

  Write-Host "=============================="
  Write-Host "CHECK PRODUCAO"
  Write-Host "=============================="
  npm run qa:prod:check

  Write-Host "Reiniciando em 10 segundos..."
  Start-Sleep -Seconds 10
}
