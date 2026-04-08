# App Store Ready Checklist (Android)

## 1) Build local (debug/validação)

```bash
npx expo prebuild
npx expo run:android
```

## 2) Build de distribuição (AAB recomendado)

```bash
eas build -p android --profile preview
```

Se for publicar na Play Store, prefira profile de producao (AAB assinado):

```bash
eas build -p android --profile production
```

## 3) Artefatos

- AAB para Play Store (recomendado)
- APK para QA interno (opcional)

## 4) Metadados obrigatórios da Play Store

- Nome do app
- Icone (alta resolucao)
- Screenshots: Home, Treino, Nutricao, Coach
- Descricao curta e completa
- Politica de privacidade (URL publica)

## 5) Descricao sugerida

Transforme seu treino e alimentacao com um app simples e inteligente.

- Registre seus treinos facilmente
- Controle sua alimentacao em segundos
- Acompanhe sua evolucao diaria
- Receba orientacao de um coach inteligente

Comece hoje e evolua todos os dias.

## 6) Checklist de release

- Versao e build incrementados em `app.json`
- Fluxo critico E2E validado (`e2e/flow.test.js`)
- Testes unitarios/integracao verdes
- Crash logs revisados
- Permissoes Android revisadas
- Politica de privacidade e suporte atualizados
