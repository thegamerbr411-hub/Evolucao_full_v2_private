# Home — Análise: registro de água sem escolher quantidade

**Data:** 2026-06-04  
**ID:** `BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT`  
**Severidade:** P2  
**Status:** **CORRIGIDO** (2026-06-04 — OK Felipe) — ver [`HOME_WATER_QUICK_ADD_FIX_REPORT.md`](HOME_WATER_QUICK_ADD_FIX_REPORT.md)

---

## Sintoma

Na Home, a ação **"+ Beber água"** (`btn_add_water`) registra hidratação **imediatamente**, sem perguntar quantidade (200, 250, 300, 500, 510 ml ou valor personalizado).

## Impacto

- Registro pode ficar **impreciso** sem o usuário perceber.
- Reduz confiança no controle de hidratação na Home.
- Coach/Nutrição leem totais derivados do mesmo estado — erro na Home contamina leitura do dia.

## Comportamento esperado

Ao tocar em registrar água, abrir confirmação de quantidade (modal ou bottom sheet):

**Título:** Registrar água  
**Texto:** Quanto você bebeu agora?

**Opções rápidas:** 200 ml · 300 ml · 500 ml · 510 ml · Personalizado  
**Botões:** Cancelar · Registrar

**Personalizado:** campo numérico em ml; valor > 0; limite superior (ex. 5000 ml).

**Após registrar:** atualizar card de água na Home; feedback tipo `Água registrada: 300 ml`.

---

## Onde está no código

| Item | Local |
|------|--------|
| Botão / label | [`src/screens/HomeScreen.js`](../../src/screens/HomeScreen.js) — quick action `water`, label `+ Beber água` |
| testID | `btn_add_water` (legacy `btn-add-agua`) |
| Quantidade fixa | `addWaterIntake?.(300)` no `onPress` |
| Feedback UI | `+300ml adicionados` (estado local `waterFeedback`, ~3 s) |
| API de registro | `addWaterIntake(amountMl)` em [`src/context/AppContext-v2.ts`](../../src/context/AppContext-v2.ts) |
| Store hidratação | `nutritionStore.addHydrationIntake` → `hydration.consumedMl` (cap 15000) |
| Histórico dia | `nutritionStore.updateHistoryEntry` → `history[].waterMl` |
| Leitura unificada | [`src/services/dailyState.js`](../../src/services/dailyState.js) — `waterTodayMl = max(hydration.consumedMl, history.waterMl)` |

### Trecho relevante (Home)

```javascript
// HomeScreen.js — quick action water
onPress: () => {
  if (waterDebounceRef.current) return;
  const result = addWaterIntake?.(300);  // 300 ml fixos, sem UI
  setWaterFeedback(true);
  // ...
}
```

### Trecho relevante (context)

```javascript
// AppContext-v2.ts — addWaterIntake
nutritionStore.addHydrationIntake(safeAmount);
nutritionStore.updateHistoryEntry(today, { waterMl: currentWater + safeAmount, ... });
```

---

## Causa raiz

**UX incompleta:** implementação de “quick add” com **300 ml hardcoded**, não bug de soma ou de `dailyState`. Debounce de 3 s só evita duplo toque; não pede confirmação.

**Quantidade automática atual:** **300 ml** (único valor usado na Home).

**Timestamp:** `hydration.updatedAt` é atualizado no store; não há lista de eventos por copo na Home — escopo de correção deve manter compatibilidade.

---

## Fonte de estado

| Consumidor | Fonte |
|------------|--------|
| Home (card + botão) | `dailyState.waterTodayMl` / `hydration` / `history` |
| Coach (texto) | `context.waterToday` / `waterTarget` — leitura alinhada, sem mesmo botão |
| Nutrição profunda | não alterar neste fix |

---

## Correção mínima recomendada (após OK Felipe)

1. **`src/services/waterQuickAdd.js`** (novo, testável):
   - `normalizeWaterAmountMl(value)` — min 1, max 5000
   - `WATER_QUICK_OPTIONS_ML = [200, 300, 500, 510]`
   - `canRegisterWaterAmount(value)`
2. **`HomeScreen.js`:** `onPress` abre sheet/modal; só chama `addWaterIntake(amount)` após escolha.
3. Feedback dinâmico: `Água registrada: {N} ml`.
4. **`__tests__/waterQuickAdd.test.mjs`** — casos válidos/inválidos/cancelar.
5. **Não** resetar app · **não** apagar histórico · **não** mudar schema grande.

### Riscos

| Risco | Nível |
|-------|--------|
| Escopo só Home | Baixo |
| Coach disparar `addWaterIntake` sem UI no futuro | Médio — manter escopo Home-only |
| Rotinas ainda não validadas no device | Bloqueio de ordem — validar Rotinas primeiro |

---

## Testes sugeridos (quando autorizado)

1. 200 / 300 / 500 / 510 ml válidos  
2. Valor vazio inválido  
3. Negativo inválido  
4. Valor absurdo bloqueado/limitado  
5. Cancelar não altera total  
6. Registrar atualiza `waterTodayMl` do dia  

---

## Ordem correta

1. Rotinas **VALIDADO** no emulator-5554 (RQ8T209ZTAF descartado).  
2. Fix água **implementado** — revalidação visual na Home com Metro ativo.  
3. **Não** misturar com PASS global nem commit sem OK Felipe.

---

## CHECKPOINT — BUG HOME ÁGUA REGISTRADO / ANALISADO

| Item | Valor |
|------|--------|
| Bug registrado? | **SIM** |
| ID | `BUG_HOME_WATER_QUICK_ADD_NO_AMOUNT` |
| Área | Home / Hidratação / dailyState |
| Severidade | **P2** |
| Onde fica o botão | `HomeScreen.js` — `+ Beber água` (`btn_add_water`) |
| Quantidade automática atual | **300 ml** fixos |
| Fonte de estado usada | `addWaterIntake` → `hydration.consumedMl` + `history.waterMl` |
| Arquivos analisados | `HomeScreen.js`, `AppContext-v2.ts`, `useNutritionStore.ts`, `dailyState.js`, `CoachChatScreen.js` (leitura) |
| Correção recomendada | Modal/sheet com opções + personalizado antes de `addWaterIntake` |
| Risco | Baixo (Home-only); ordem bloqueada por validação Rotinas |
| Pode corrigir agora? | **SIM** — OK Felipe recebido |
| Código alterado nesta rodada? | **SIM** |
| Commit/push feito? | **NÃO** |
| PASS global do app? | **NÃO** |
| Próxima ação única | Felipe: Metro reload → Home → Expandir → + Beber água → confirmar sheet |
