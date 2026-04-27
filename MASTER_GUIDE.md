# MASTER_GUIDE

## Objetivo
Guia unico para operar, validar e evoluir o projeto com base na arquitetura atual (store-first + backend-first em fluxos criticos).

## Estrutura principal
- `src/stores`: fonte de verdade de estado da aplicacao.
- `src/features`: regras de dominio isoladas por feature (social, progressao, workoutGenerator).
- `src/context`: camada de compatibilidade enquanto a migracao final de consumidores nao termina.
- `src/data`: bases estaticas de exercicios e catálogos.
- `src/services`: integracoes e orquestracoes existentes.

## Regras de arquitetura (obrigatorias)
- Priorizar seletores de store em tela e fluxo novo.
- Evitar adicionar nova logica em contexto legado.
- Manter social/XP/ranking com backend como verdade quando endpoint existir.
- Fallback local deve ser explicito, curto e isolado por modulo.
- Mudancas de UX apenas quando corrigirem friccao/erro real.

## Hidratacao (fonte de regra)
- Formula diaria base: `35 ml/kg`.
- Bonus por treino no dia: `+700 ml por hora de treino`.
- Persistencia em store para continuidade offline/online.

## Fluxo de evolucao recomendado
1. Migrar consumidores restantes de contexto para seletores.
2. Remover arquivos/funcoes mortos apos confirmar zero imports.
3. Consolidar contratos de API social/progressao sem fallback duplicado.
4. Ativar gerador de treino de forma incremental sobre scaffold atual.
5. Rodar bateria final de testes e publicar RC.

## Validacao padrao antes de merge
- Testes de unidade/integridade principais passando.
- Fluxo real de treino + social + ranking sem regressao.
- Sem erros novos de lint/sintaxe nos arquivos alterados.
- Sem aumento de acoplamento com contexto legado.

## Como rodar (operacional)
- App em modo Expo: `npm start`
- App Android com heap estavel (evita OOM do Metro): `npm run start:android:stable`
- Build release + install no device conectado: `npm run release:install`
- Build release sem instalar (APK fixo): `npm run release:apk`

## Como testar (operacional)
- Smoke backend: `npm run test:basic`
- Testes principais: `npm test`
- Integracao social: `node --test __tests__/socialUxVariations.integration.test.mjs`
- Detox emulador: `npm run detox:test`
- Detox device conectado: `npm run detox:test:attached`

## Build e artefatos
- APK release local: `build-output/app-release.apk`
- Build Android nativo: `android/app/build/outputs/apk/release/app-release.apk`
- Zip limpo final: `evolucao_v2_clean_final.zip`

## Dependencias externas
- Google OAuth (opcional por build): quando ausente, app deve manter fluxo local sem quebra.
- Firebase/Functions (opcional): parser de treino possui fallback local resiliente.
- Backend QA/API: quando indisponivel, social/hidratacao usam fallback offline controlado.

## Bloqueios conhecidos (estado real)
- Suite Detox visual (mapa completo) com falha de detecção de tela inicial em [e2e/helpers/flows.js](e2e/helpers/flows.js).
- Pode ocorrer disputa de sessao Detox em attached (`app is already connected to the session`).
- Warning de compatibilidade Expo SDK 55 com pacotes levemente abaixo da versao esperada.

## Convenções operacionais
- Mudanca pequena e focada por arquivo.
- Nao alterar UI global sem necessidade de produto.
- Documentacao informacional centralizada em `docs/informacoes-centralizadas`.

## Entregavel de release limpa
- Artefato final: `evolucao_v2_clean_final.zip`.
- Deve conter somente codigo essencial de app/back/core (sem logs e sem artefatos de auditoria).
