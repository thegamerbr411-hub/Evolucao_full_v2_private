# DECISOES TECNICAS

## OAuth
- Decisao: centralizar auth em src/services/authService.js e manter authService.ts como wrapper de compatibilidade.
- Motivo: evitar drift JS/TS em runtime.

## Export beta
- Decisao: pacote multi-arquivo em vez de depender apenas de JSON unico.
- Motivo: facilitar forense de uso, timeline e observabilidade.

## Controle de conta
- Decisao: bloquear/desbloquear/revogar sessao no backend com reflexo no Admin.
- Motivo: controle de APK compartilhado em beta fechado.

## Limpeza
- Decisao: mover artefatos para archive em vez de deletar direto.
- Motivo: preservar evidencias de QA/release.