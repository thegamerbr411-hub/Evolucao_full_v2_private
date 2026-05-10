# CHECKLIST PRE RELEASE

## Infra
- [ ] scripts/check-infra.ps1 passou sem falhas.
- [ ] scripts/check-oauth.ps1 passou.
- [ ] scripts/check-env.ps1 passou.
- [ ] scripts/check-render-config.ps1 passou.

## Auth
- [ ] login e-mail ok.
- [ ] cadastro+codigo+cooldown ok.
- [ ] reset senha real ok.
- [ ] login Google real ok sem invalid_request.
- [ ] bloqueio/desbloqueio/revogacao ok.

## Produto
- [ ] Coach sem quebra visual/teclado.
- [ ] Nutricao/OCR com parse confiavel.
- [ ] Treino completo sem regressao.
- [ ] Social/desafios com persistencia.
- [ ] Perfil premium coerente e exportando.

## Exportacao beta
- [ ] analise
- [ ] diagnostico
- [ ] melhorias
- [ ] timeline
- [ ] pacote de suporte

## Release gate
- [ ] nenhuma regressao P0/P1 aberta.
- [ ] evidencia visual manual registrada.