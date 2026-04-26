# QA Controlled Loop (Build Nova + ADB + Validacao)

Este fluxo executa ciclos controlados com ordem obrigatoria:

1. Captura total
2. Analise das capturas
3. Aplicacao de melhorias
4. Geracao de build nova
5. Instalacao via ADB no celular
6. Reabertura do app
7. Teste funcional real
8. Limpeza automatica de imagens brutas

## Comando principal

```bash
npm run qa:controlled
```

## Escolher quantidade de ciclos

```bash
npm run qa:controlled -- --cycles=3
```

Atalho pronto:

```bash
npm run qa:controlled:3x
```

## Escolher device ADB e configuracao Detox

```bash
npm run qa:controlled -- --configuration=android.attached.debug --device=R58MXXXXXXX
```

## Build nova + instalacao ADB + relaunch (automatico)

O executor sempre faz build nova por ciclo com:

```bash
npx detox build --configuration <config>
```

Depois instala e valida no device:

```bash
adb -s <serial> install -r -d -g <apk>
adb -s <serial> shell am force-stop com.tipolt.evolucaofullv2
adb -s <serial> shell am start -W -n com.tipolt.evolucaofullv2/.MainActivity
```

A validacao confirma que a instalacao foi atualizada por hash do APK remoto (quando disponivel) ou por mudanca de `lastUpdateTime` no `dumpsys package`.

## Como passar comandos reais de melhoria

Voce pode rodar comandos de melhoria no meio do ciclo (aplicacao real):

```bash
npm run qa:controlled -- --improve-cmd="npm run test" --improve-cmd="node scripts/ai-brain.js"
```

Tambem pode colocar patches em `qa/improve/pending/*.patch` para aplicacao automatica via `git apply`.

## Cobertura de captura e teste

Configuracao padrao em `qa/core/controlled-loop.config.json`:

- Captura: `e2e/14-full-visual-functional.e2e.js`, `e2e/18-visual-map-audit.e2e.js`
- Funcional: `e2e/14-full-visual-functional.e2e.js`, `e2e/17-social-tab-smoke.e2e.js`

Pode sobrescrever por CLI:

```bash
npm run qa:controlled -- --capture-tests=e2e/14-full-visual-functional.e2e.js,e2e/18-visual-map-audit.e2e.js --functional-tests=e2e/14-full-visual-functional.e2e.js,e2e/16-treino-tab-smoke.e2e.js,e2e/17-social-tab-smoke.e2e.js
```

## Relatorios e evidencias

Saida por execucao em:

`artifacts/controlled-loop/run-YYYYMMDD-HHMMSS`

Arquivos principais:

- `run-summary.json` (resultado geral)
- `cycle-XXX/cycle-report.json` (resultado por ciclo)
- `cycle-XXX/capture/capture-summary.json`
- `cycle-XXX/analysis/analysis-report.json`
- `cycle-XXX/build/build-metadata.json`
- `cycle-XXX/build/install-report.json`
- `cycle-XXX/test/functional-tests-report.json`
- `cycle-XXX/cleanup/cleanup-report.json`

## Limpeza de prints usados

Por padrao, imagens brutas copiadas para analise sao removidas ao fim de cada ciclo.

Se quiser tambem limpar imagens antigas de `artifacts/detox`, use:

```bash
npm run qa:controlled -- --cleanup-detox-root=true
```

## Ajustar comportamento depois

Edite `qa/core/controlled-loop.config.json` para defaults de:

- ciclos
- configuracao Detox
- pacote Android / activity
- testes de captura
- testes funcionais
- comandos de melhoria
- politicas de limpeza

Ajuda completa de CLI:

```bash
npm run qa:controlled:help
```
