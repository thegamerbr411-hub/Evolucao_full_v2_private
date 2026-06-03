# ARQUITETURA GERAL

## Camadas
- Mobile: React Native + Expo.
- Backend: Node.js + Express (Render).
- Identidade: Firebase Auth + Google OAuth.
- Dados de runtime: stores locais e sincronizacao via API.
- Observabilidade/export: snapshots + pacote beta multi-arquivo.

## Modulos principais
- Auth: login email/google, reset, bloqueio/revogacao.
- Treino: rotinas, series, progresso.
- Nutricao: logs, OCR, plano e historico.
- Coach: chat/sugestoes/missoes.
- Social: amigos, desafios, leaderboard.
- Admin: controle de conta e cadastros operacionais.

## Fluxos criticos
1. Cadastro/login/reset.
2. Google login e retorno ao app.
3. Persistencia de sessao e revogacao.
4. Export beta (analise, timeline, diagnostico, suporte).

## Riscos arquiteturais
- Divergencia de auth JS/TS (mitigado com wrapper unico).
- Drift de OAuth client/scheme.
- Regressao em tela de Perfil e exportacoes.

## Diretriz de evolucao
- Toda mudanca de infra deve atualizar docs/INFRA_*.md + scripts/check-*.ps1 + historico de hotfix.