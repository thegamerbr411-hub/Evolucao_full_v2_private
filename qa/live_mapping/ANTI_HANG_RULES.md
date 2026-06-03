# ANTI-HANG RULES — EVOLUÇÃO APP QA

## Objetivo

Evitar travamentos do Cursor/PowerShell durante automações Android/Expo no Windows.

Este documento é **obrigatório** para qualquer auditoria visual, validação P1 ou execução com ADB no projeto Evolução.

**Projeto:** `F:\projetos\evolucao app`  
**Device padrão:** `emulator-5554`  
**App:** `com.tipolt.evolucaofullv2`

---

## Causas confirmadas de travamento

### 1. uiautomator dump sem timeout

Comando perigoso:

```powershell
adb shell uiautomator dump /sdcard/qa_*.xml
```

**Risco:**

- pode ficar preso por minutos;
- pode travar o shell do agente;
- pode parecer que o Cursor "morreu".

**Regra:** Nunca usar uiautomator dump sem timeout hard.

---

### 2. uiautomator com overlay/timer React Native

**Cenário confirmado:** WorkoutScreen com timer flutuante de descanso.

**Sintoma:** XML pode retornar:

```xml
<!-- uiautomator unavailable or timeout -->
```

**Regra:** Se overlay/timer estiver aberto e XML falhar 2 vezes, aceitar evidência por PNG + métricas disponíveis. Não insistir em dump XML.

---

### 3. Loops Wait-UntilUiNeedle longos

**Problema:** Scripts antigos repetiam screencap + XML dump por até 90s ou mais, várias vezes.

**Regra:** Todo script QA precisa ter:

- `MaxScriptSec` hard;
- limite de tentativas;
- XML timeout por captura;
- saída clara em caso de falha.

---

### 4. Metro iniciado junto com validação

**Problema:** Subir Metro e rodar validação no mesmo comando longo já travou.

**Regra:** Metro deve ser iniciado separado, com log próprio.

Usar:

- `qa/live_mapping/metro_debug/start_metro_logged.ps1`
- `qa/live_mapping/metro_debug/wait_metro_ready.ps1`
- `qa/live_mapping/metro_debug/stop_metro_evolucao.ps1`

Validação deve rodar só depois de Metro responder `http://127.0.0.1:8081/status` com `packager-status:running`.

---

### 5. Scripts antigos de auditoria pesada

**Não rodar sem revisão:**

- `live_watch_mapping.ps1`
- `home_deep_batch_audit.ps1`
- `treino_batch_audit.ps1`
- versões antigas de `fix_p1_validate.ps1`
- qualquer script com loop infinito ou dump XML ilimitado

---

## Regras obrigatórias para novos scripts QA

Todo script novo deve ter:

- `MaxScriptSec` máximo de **120s**;
- `XmlTimeoutSec` entre **8 e 12s**;
- no máximo **6 dumps XML** por execução;
- screencap como fonte principal;
- XML como apoio, não como dependência absoluta;
- saída com código claro;
- logs em arquivo;
- **não rodar em paralelo** com outro script QA.

---

## Limites recomendados

| Parâmetro | Valor |
|---|---|
| MaxScriptSec — validação curta | 60s |
| MaxScriptSec — validação média | 100s |
| MaxScriptSec — validação longa excepcional | 120s |
| XmlTimeoutSec — padrão | 8s |
| XmlTimeoutSec — máximo | 12s |
| Dumps XML — ideal | 3 a 5 |
| Dumps XML — máximo | 6 |

**Screenshots:** usar `adb exec-out screencap -p`; salvar PNG mesmo se XML falhar.

---

## Quando parar imediatamente

Parar a execução se:

- comando ficar mais de **2 minutos** sem output;
- uiautomator falhar **2 vezes seguidas**;
- Metro estiver offline;
- app estiver em tela branca por falta de bundle;
- SystemUI/notificações abrir por erro de swipe;
- script exceder `MaxScriptSec`.

---

## Como reagir sem travar

### Se Metro estiver offline

1. Não fazer loop de relaunch.
2. Sair com status `METRO_OFFLINE`.
3. Registrar log.
4. Usar scripts `metro_debug` para estabilizar.

### Se uiautomator falhar

1. Capturar PNG.
2. Registrar `XML unavailable`.
3. Continuar com análise visual por PNG.
4. Não repetir dump infinitamente.

### Se app estiver em tela branca

1. Checar Metro.
2. Checar bundle.
3. Force-stop/relaunch.
4. Capturar nova evidência.
5. Não declarar bug de UI se a causa for bundle ausente.

---

## Comandos seguros

Checar device:

```powershell
adb -s emulator-5554 devices
```

Checar Metro:

```powershell
Invoke-WebRequest http://127.0.0.1:8081/status -UseBasicParsing
```

Capturar PNG:

```powershell
adb -s emulator-5554 exec-out screencap -p > arquivo.png
```

Rodar validação com timeout próprio (somente se explicitamente necessário):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "F:\projetos\evolucao app\qa\live_mapping\fix_finish_validate.ps1" -Serial emulator-5554 -MaxScriptSec 100

powershell -NoProfile -ExecutionPolicy Bypass -File "F:\projetos\evolucao app\qa\live_mapping\fix_rest_validate.ps1" -Serial emulator-5554 -MaxScriptSec 110
```

---

## Processos que não devem ficar rodando

Não deixar em background:

- `live_watch_mapping.ps1`
- scripts de screenshot a cada 2s
- múltiplos `adb shell uiautomator dump`
- múltiplos Metro na porta 8081
- validação QA em paralelo com outra validação QA

---

## Scripts — NÃO repetir sem motivo explícito

Validações já **PASS** em 2026-05-30. Não rerodar por ansiedade:

| Script | Status | Evidência |
|---|---|---|
| `fix_p1_validate.ps1` | PASS | `fix_p1_metrics.json` |
| `fix_finish_validate.ps1` | PASS | `fix_finish_metrics.json` |
| `fix_rest_validate.ps1` | PASS | `fix_rest_metrics.json` (bugRestPass: true) |
| `home_deep_batch_audit.ps1` | Captura concluída | 27 PNG em `screenshots/home_deep/` |
| `live_watch_mapping.ps1` | PAUSADO | não usar em paralelo |
| `treino_batch_audit.ps1` | Captura concluída | aguarda envio ChatGPT |

Só rerodar com `MaxScriptSec` hard e motivo documentado.

---

## Estado atual confirmado em 2026-05-30

| Item | Status |
|---|---|
| P1 Estado global | **PASS técnico** |
| BUG_FINISH_BUTTON_VISIBLE_TOO_EARLY | **FIXED** |
| BUG_REST_BUTTONS_STATE_CONFUSING | **FIXED** |
| Multi-exercício | **PASS** — Exercício 1 de 5 confirmado |
| Proteína | **PASS** — meta unificada 160g |
| Streak/XP | **PASS técnico** |
| Debug "Registrar 10kg" | Ausente |
| HOME 3/3A | **ANALISE_RECEBIDA_E_REGISTRADA** |
| TREINO 1/3–3/3 | Aguardando autorização Felipe |
| dailyState.test.mjs | 6/6 PASS |

---

## Regra final

**Não repetir validações PASS por ansiedade.**

Próxima ação deve ser determinada pelo gate atual:

- se P1 técnico PASS;
- se HOME 3/3A registrado;
- se Felipe autorizar;
- então enviar **TREINO 1/3–3/3** via Playwright ao ChatGPT no projeto **Dever de casa** / chat **chat para o cursor**.

**Não** rodar scripts QA agora sem necessidade explícita.  
**Não** iniciar Nutrição profunda (3/3B).  
**Não** declarar app pronto.
