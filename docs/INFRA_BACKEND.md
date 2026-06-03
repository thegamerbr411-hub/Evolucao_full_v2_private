# INFRA BACKEND

## Funcao

API Node/Express para auth, workout, nutrition, sync, social e subscription.

## Entrada e rotas

- entrypoint: backend/server.js
- start script: npm start
- health: /health
- auth: /auth/*
- workout: /workouts/*
- nutrition: /nutrition/*
- sync: /sync/*
- social: /social/*

## Dependencias criticas

- express
- cors
- dotenv
- jsonwebtoken
- nodemailer

## O que quebra se alterar errado

- JWT_SECRET ausente: auth retorna 500.
- rota /health quebrada: deploy e monitoramento comprometidos.
- mudanca de contrato auth sem atualizar app: login/cadastro/reset quebram.

## Requisitos operacionais

- manter compatibilidade de payload em /auth/google, /auth/send-code, /auth/reset-password.
- manter middleware auth com bloqueio e revogacao de sessao.

## Validacao rapida

1. Backend sobe sem erro.
2. /health responde com ok true.
3. /auth/send-code responde sem 500.
4. /auth/google responde erro controlado quando token invalido (nao crash).
