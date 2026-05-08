# QA Migration Report — Phase 3 Semantic Selector System
**Data:** 2026-05-08  
**Versão:** 3.0.0  
**Status:** ✅ CONSOLIDADO

---

## Resumo Executivo

Esta migração substituiu o sistema legado de IDs arbitrários por um **sistema semântico centralizado** baseado em contratos de seletor imutáveis. O resultado é uma suite de QA determinística, legível e resistente a refatorações de UI.

---

## Estado Anterior (Legacy)

### Padrões Problemáticos Identificados

| Padrão Legado | Arquivo | Problema |
|---|---|---|
| `by.id('screen-home')` | `e2e/01-onboarding.e2e.js` | Hardcoded, sem fonte de verdade central |
| `by.id('home-ready')` | `e2e/01-onboarding.e2e.js` | ID arbitrário criado ad-hoc no componente |
| `by.id('tab-home')` | `e2e/08-navigation.e2e.js` | Diverge do ID real do componente |
| `by.id('tab-treino')` | múltiplos | Singular vs plural inconsistente |
| `by.id('screen-treinos')` | múltiplos | Sem namespace nem convenção |
| `sleep(N)` | `e2e/helpers/utils.js` | Magic number sem semântica |
| IDs diferentes em tela e teste | múltiplos | Desacoplamento silencioso |

### Riscos do Sistema Legado
- IDs hardcoded em 22+ arquivos de teste → qualquer rename de componente quebra múltiplos testes
- Sem validação em tempo de compilação → IDs errados só são detectados em runtime
- Aliases manuais e espalhados → `ID_ALIASES` incompleto, cobertura parcial
- Nenhum mecanismo para rastrear quais telas/elementos o QA cobre

---

## Migração Implementada

### Fase 3 — Infraestrutura Semântica

#### 1. Registro Central de Seletores
**Arquivo:** `src/qa/selectorRegistry.js`

```js
// Fonte única de verdade — imutável
export const QA_SCREENS = Object.freeze({ home: 'screen_home', treinos: 'screen_treinos', ... })
export const QA_ELEMENTS = Object.freeze({ btnLogin: 'btn_login', tabHome: 'tab_home', ... })
export const QA_ALIASES = Object.freeze({ tab_home: ['tab-home'], ... })  // compatibilidade legada
```

**Contrato:** todo `testID` usado em testes deve existir neste registro.

#### 2. Wiring no Runtime do App
Todos os componentes críticos foram atualizados com `qaProps()` e `qaAliasProps()`:

| Arquivo | Elemento | ID Semântico |
|---|---|---|
| `App.js` | Root View | `app_root` |
| `App.js` | Bootstrap Ready | `app_bootstrap_ready` |
| `RootNavigator.js` | Loading Screen | `screen_loading` |
| `MainTabs.js` | Tab Home | `tab_home` |
| `MainTabs.js` | Tab Treinos | `tab_treinos` |
| `MainTabs.js` | Tab Nutricao | `tab_nutricao` |
| `MainTabs.js` | Tab Coach | `tab_coach` |
| `MainTabs.js` | Tab Social | `tab_social` |
| `MainTabs.js` | Tab Profile | `tab_profile` |
| `HomeScreen.js` | Screen Root | `screen_home` |
| `HomeScreen.js` | CTA Principal | `btn_home_main_cta` |
| `HomeScreen.js` | Iniciar Treino | `btn_start_workout` |
| `WorkoutsHubScreen.js` | Screen Root | `screen_treinos` |
| `WorkoutsHubScreen.js` | Iniciar Treino | `btn_start_workout` |
| `RegisterScreen.js` | Screen Login | `screen_login` |
| `RegisterScreen.js` | Screen Register | `screen_register` |
| `RegisterScreen.js` | Input Email | `input_email` |
| `RegisterScreen.js` | Input Password | `input_password` |
| `RegisterScreen.js` | Btn Login | `btn_login` |
| `RegisterScreen.js` | Btn Register | `btn_register` |
| `ProfileScreen.js` | Screen Root | `screen_profile` |
| `ProfileScreen.js` | Btn Logout | `btn_logout` |
| `ProfileScreen.js` | Btn Google Login | `btn_google_login` |
| `ExerciseDetailScreen.js` | Screen Root | `screen_exercise_detail` |
| `ExerciseDetailScreen.js` | Player | `player_internal` |
| `ExerciseDetailScreen.js` | Fullscreen | `btn_player_fullscreen` |
| `DebugHealthScreen.js` | Screen Root | `screen_debug_health` |

#### 3. Sistema de Alias Bidirecional
O helper `e2e/helpers/utils.js` foi expandido com mapeamento bidirecional:

```js
// Novo ID semântico → antigo legado
screen_home: ['screen_home', 'screen-home', 'home-screen'],
tab_home: ['tab_home', 'tab-home'],
// Antigo legado → novo semântico
'screen-home': ['screen-home', 'screen_home', 'home-screen'],
'tab-home': ['tab-home', 'tab_home'],
```

Isso garante que testes legados continuam funcionando enquanto a migração é feita incrementalmente.

#### 4. Helpers de Testes Semânticos
`e2e/semantic/helpers/semanticHelpers.js` — utilitários fortemente tipados:

- `waitForSemantic(id)` — aguarda elemento semântico
- `tapSemantic(id)` — toca com validação prévia
- `typeSemantic(id, text)` — digita com clear + retry
- `assertScreen(screenId)` — asserta tela atual
- `waitForAppReady()` — detecta boot via múltiplos sinais
- `tapTab(tabId, expectedScreenId)` — navega e valida

---

## Testes Semânticos Criados

| Arquivo | Cenários | Cobertura |
|---|---|---|
| `e2e/semantic/00-semantic-smoke.e2e.js` | boot, landing detection | app_root, app_bootstrap_ready, screen_home/login |
| `e2e/semantic/01-semantic-auth.e2e.js` | auth screens, campos, botões | screen_login, input_email, input_password, btn_login |
| `e2e/semantic/02-semantic-navigation.e2e.js` | tabs, rotação | tab_home, tab_treinos, tab_profile, screen_* |
| `e2e/semantic/03-semantic-logout.e2e.js` | logout, pós-logout | btn_logout, screen_profile, screen_login |
| `e2e/semantic/04-semantic-qa-health.e2e.js` | infra QA, debug screen | screen_debug_health, qa_health_export |

---

## Compatibilidade com Testes Legados

Os 22 testes existentes (`e2e/01-*.e2e.js` a `e2e/22-*.e2e.js`) **continuam funcionando** sem modificação graças ao sistema de alias bidirecional. A migração é incremental: testes legados coexistem com testes semânticos na mesma suite.

---

## Próximos Passos (Roadmap)

1. Migrar testes legados restantes para seletores semânticos (prioridade: 02, 03, 16, 21)
2. Adicionar validação CI: lint que detecta testID hardcoded fora do selectorRegistry
3. Expandir cobertura semântica para fluxos de nutrição e coach
4. Integrar `global.__EVOLUCAO_QA_HEALTH__` nos assertores Detox

---

*Gerado automaticamente pela consolidação Phase 3 QA — Evolução App*
