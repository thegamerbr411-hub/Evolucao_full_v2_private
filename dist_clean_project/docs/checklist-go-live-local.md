# Checklist Go-Live Local (60 segundos)

Objetivo:
- Confirmar rapidamente se o app esta pronto para uma rodada de teste manual.
- Evitar iniciar teste com ambiente quebrado ou estado inconsistente.

## Sequencia rapida
1. Instalar dependencias (se necessario):
```bash
npm ci
```

2. Validar ambiente Expo:
```bash
npx expo-doctor
```

3. Validar regressao funcional:
```bash
npm run test
```

4. Subir app localmente:
```bash
npm run start
```

## Criterio de aprovacao (go/no-go)
- `expo-doctor`: 100% checks pass.
- `npm run test`: 0 fail.
- `expo start`: Metro iniciado sem erro critico.

Se qualquer item falhar:
- NO-GO para sessao de UX.
- Corrigir primeiro, testar depois.

## Fallback rapido por tipo de erro
- Porta ocupada no Metro:
  - Fechar processo usando a porta ou aceitar nova porta quando solicitado.
- Erro de dependencias:
  - Rodar `npm ci` e repetir `npx expo-doctor`.
- Falha de teste:
  - Corrigir regressao antes de abrir sessao manual.

## Pre-flight da sessao UX (2 min)
- Abrir roteiro: `docs/roteiro-teste-estrategico-ux.md`.
- Abrir scorecard: `docs/scorecard-teste-ux.md`.
- Definir objetivo do dia: 1 friccao para eliminar.
- Rodar sessao de 20-30 min.

## Regra operacional
- 1 sessao por dia.
- 1 ajuste prioritario por dia.
- 1 decisao objetiva por dia: manter, iterar ou rollback.
