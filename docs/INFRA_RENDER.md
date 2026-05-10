# INFRA RENDER

## Funcao

Hospedar o backend Node/Express em producao.

## Configuracao atual

- Arquivo fonte: render.yaml
- service name: evolucao-api
- dashboard service name atual: evolucao-api-dou2
- public URL: [https://evolucao-api-dou2.onrender.com](https://evolucao-api-dou2.onrender.com)
- type: web
- runtime: node
- rootDir: backend
- buildCommand: npm install
- startCommand: npm start
- healthCheckPath: /health
- branch de deploy (Render): main

## O que quebra se alterar errado

- rootDir diferente de backend: build falha ou sobe app errado.
- startCommand incorreto: API nao inicia.
- healthCheckPath invalido: deploy fica instavel ou rollback.
- variaveis de auth/email ausentes: login/reset e e-mail quebram.

## Variaveis relevantes (chaves)

- NODE_ENV
- ENABLE_QA_LOCAL_BYPASS
- JWT_SECRET
- RESEND_API_KEY
- RESEND_FROM
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- SMTP_FROM
- PASSWORD_RESET_URL

## Conta operacional

- Projeto Google/Firebase associado: t-evo-b069a
- Email de suporte visto no Firebase: thegamerbr411@gmail.com

## Validacao rapida

1. GET /health responde ok true.
2. POST /auth/send-code responde sem 5xx.
3. POST /auth/forgot-password responde sem 5xx.
4. Logs Render sem crash loop apos deploy.

## Prevencao de regressao

Rodar scripts/check-render-config.ps1 e scripts/check-infra.ps1 antes de release.
