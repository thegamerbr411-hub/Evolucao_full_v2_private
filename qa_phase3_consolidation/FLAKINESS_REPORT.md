# Flakiness Report — Phase 3 Semantic QA System
**Data:** 2026-05-08  
**Versão:** 3.0.0  
**Status:** ✅ SISTEMA ANTI-FLAKINESS IMPLEMENTADO

---

## Definição de Flakiness no Contexto Evolução

Um teste é **flaky** quando produz resultados inconsistentes (pass/fail) para o mesmo código, sem mudança de comportamento real do app. Causas mais comuns identificadas na suite legada:

---

## Causas Identificadas na Suite Legada

### 1. Hardcoded Sleeps
**Frequência:** Alta  
**Impacto:** Testes lentos em device rápido, falhos em device lento

```js
// PROBLEMA — legado
await sleep(2000); // quão rápido é o device?

// SOLUÇÃO — semântico Phase 3
await waitFor(element(by.id('screen_home'))).toBeVisible().withTimeout(12000);
```

### 2. IDs Desacoplados entre App e Teste
**Frequência:** Alta  
**Impacto:** Falha silenciosa quando componente é renomeado

```js
// PROBLEMA — legado
await expect(element(by.id('home-screen'))).toBeVisible(); // ID arbitrário no componente

// SOLUÇÃO — semântico Phase 3
// App.js usa qaProps(QA_SCREENS.home) → testID = 'screen_home'
await expect(element(by.id('screen_home'))).toBeVisible(); // contrato garantido
```

### 3. Scroll Containers Não Descobertos
**Frequência:** Média  
**Impacto:** Elemento existe mas não é visível → falha esporádica

```js
// PROBLEMA — legado
await element(by.id('btn-logout')).tap(); // pode estar fora do viewport

// SOLUÇÃO — semântico Phase 3
// semanticHelpers.js tenta scroll automático antes de falhar
await tapSemantic('btn_logout'); // com retry + scroll
```

### 4. Aliases Incompletos
**Frequência:** Média  
**Impacto:** Testa um ID, app usa outro → test never finds element

**Solução:** Alias bidirecional completo em `e2e/helpers/utils.js` — 60+ mapeamentos cobrindo todos os IDs críticos.

### 5. Race Conditions na Navegação
**Frequência:** Baixa  
**Impacto:** Tap em tab antes da animação terminar → tela errada detectada

**Solução:** `assertScreen()` usa `waitFor` com timeout de 10s, não snapshot instantâneo.

---

## Mecanismos Anti-Flakiness Phase 3

### Resolução com Fallback
```js
// resolveElementWithFallback: tenta isVisible, toBeVisible, toExist com aliases
// Se não visível, tenta scroll automático via tryScrollToTarget
// Só falha depois de esgotar todos os candidatos
```

### Retry com Backoff
```js
// replaceInput: 3 tentativas com clear + retype
// humanDelay: delay variável com jitter (evita timing fixo)
```

### Detecção de Boot Resiliente
```js
// waitForAppReady: tenta 5 sinais diferentes (appBootstrapReady, appRoot, screen_home, ...)
// Timeout de 30s com polling de 300ms
```

### Dismissal de Diálogos do Sistema
```js
// dismissBlockingSystemDialogs: testa 10 labels diferentes (PT + EN) antes de cada ação
```

---

## Métricas de Flakiness Esperadas

| Cenário | Legado (estimado) | Phase 3 (estimado) |
|---|---|---|
| Boot detection | 15% fail | < 3% fail |
| Auth screen detection | 10% fail | < 2% fail |
| Tab navigation | 8% fail | < 2% fail |
| Logout flow | 20% fail | < 5% fail |
| Elemento fora do viewport | 25% fail | < 3% fail |

---

## Padrões de Estabilidade Aplicados

### Princípio 1: Sem IDs Hardcoded
Todo `testID` em testes vem de `SCREENS.*` ou `ELEMENTS.*` importados de `semanticHelpers.js`.

### Princípio 2: Timeout Explícito Sempre
Nenhum `waitFor` sem `withTimeout()` — sempre >= 8000ms.

### Princípio 3: Soft Assert onde Appropriado
Elementos condicionais (existem só em `__DEV__`, ou dependem de auth state) usam `soft pass` com `console.log` em vez de falhar o teste.

### Princípio 4: Aliases Bidirecionais
ID legado → semântico e semântico → legado, ambos mapeados. Nenhuma quebra ao migrar incrementalmente.

### Princípio 5: Estado Rastreado via qaAutomationState
O `global.__EVOLUCAO_QA_HEALTH__` permite que testes leiam o estado real do app (currentScreen, auth, loading, player) para asserções baseadas em estado, não em tempo.

---

## Áreas de Risco Residual

| Área | Risco | Mitigação |
|---|---|---|
| Network (Firebase Auth) | Timeout em auth real | `QA_TEST_EMAIL/PASSWORD` são opcionais; teste skipa se não definidas |
| Video playback | Varia por velocidade de rede | Player tests usam timeouts generosos (20s+) |
| Animações de navegação | Variação por device | `waitFor` com timeout >= 10s |
| Permissões do sistema | Dialog blocker | `dismissBlockingSystemDialogs` antes de cada ação |

---

*Gerado pela consolidação Phase 3 QA — Evolução App*
