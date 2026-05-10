# HISTORICO HOTFIXES

## 2026-05-10
- Harden OAuth Android redirect no authService.
- Unificacao JS/TS da camada de auth (wrapper TS).
- Perfil: adicionada exportacao de pacote de suporte.
- Documentacao de auditoria final e limpeza segura adicionada.

## 2026-05-10 (rodada infra persistente)
- Criados docs INFRA_*.
- Criados checklists pre/post/beta testers.
- Criados docs de memoria operacional (issues/decisoes/hotfixes/estado estavel).
- Criados scripts check-infra, check-oauth, check-env, check-render-config.

## 2026-05-10 (auth hardening backend)
- Detectado em smoke: /auth/google aceitava token invalido.
- Hotfix: validacao do id_token via tokeninfo do Google.
- Hotfix: remocao do fallback que criava usuario com email sintetico.
- Resultado esperado: /auth/google retorna 401 para token invalido.

## Regra
Todo hotfix deve registrar:
1. sintoma
2. causa raiz
3. arquivo alterado
4. validacao
5. risco residual