# Recovery Checklist

## Etapas criticas
- [x] Diagnosticar arquitetura auth atual.
- [x] Definir estrategia unica temporaria (Firebase Auth puro).
- [x] Refatorar login/cadastro principal para Firebase.
- [x] Remover dependencia obrigatoria de `/auth/send-code` no caminho principal.
- [x] Adicionar erro explicito para falhas de auth.
- [x] Adicionar retry para erros transientes.
- [x] Sincronizar sessao Firebase com user store.
- [x] Ajustar navegacao inicial para recomputar rota.
- [x] Executar validacao automatizada minima.
- [ ] Coletar logcat/device completo apos login/cadastro real (bloqueado por adb no PATH nesta sessao).
