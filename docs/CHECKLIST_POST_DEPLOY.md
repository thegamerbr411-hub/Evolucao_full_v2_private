# CHECKLIST POST DEPLOY

## Backend
- [ ] /health responde ok true.
- [ ] latencia aceitavel nas rotas de auth.
- [ ] sem 5xx recorrente nos logs do Render.

## Auth/OAuth
- [ ] login Google em device real.
- [ ] login e-mail/reset funcionando.
- [ ] erros invalid_request nao reapareceram.

## Funcional
- [ ] coach respondeu sem quebrar layout.
- [ ] treino salvou e persistiu.
- [ ] nutricao/OCR salvou e exportou.
- [ ] social atualizou feed/desafio.

## Observabilidade
- [ ] export beta gerou pacote multi-arquivo.
- [ ] timeline contendo eventos de sessao.
- [ ] erros relevantes documentados em KNOWN_ISSUES.

## Decisao final
- [ ] GO
- [ ] NO-GO (registrar causa em RELEASE_FINAL_AUDITORIA_MASTER)