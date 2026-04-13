## 🚀 PRÓXIMOS PASSOS - PLANO DE AÇÃO

**Data Última Atualização:** 13 de Abril de 2026

---

## 📋 O Que Fazer Agora

### ✅ JÁ CONCLUÍDO
- ✔️ Navegação com 6 abas
- ✔️ Social store + service
- ✔️ SocialScreen UI completo
- ✔️ Callback em WorkoutScreen
- ✔️ Testes automatizados
- ✔️ App compilando

### ⏳ PRÓXIMO: Testar em Device Real

#### 1. Preparar Device (Android/iOS)
```bash
# Android: Conectar device via USB
adb devices

# iOS: Conectar via Xcode
```

#### 2. Testar fluxo básico
```bash
# Treino → Finalizar → Ver XP no Social
Home > Treino > [COMEÇAR]
Exercício > Séries > [FINALIZAR TREINO]
Social > Ranking (ver posição)
```

#### 3. Testar competição (2 devices)
```
Device 1: User A treina
Device 2: User B treina (volume maior)
Result: User B sobe no ranking de A
```

---

## 🎯 Features para Adicionar (Roadmap)

### FASE 1: Notificações (3-5 dias)

#### 1.1 Notificação Push
```javascript
// Quando amigo passa você
if (userPosition > previousPosition) {
  sendNotification({
    title: "🔥 João passou você!",
    body: "Ele está em #2 agora",
  })
}
```

**Onde adicionar:**
- Arquivo: `src/services/notificationService.ts`
- Hook: `useNotifications.ts`
- Trigger: `socialEngagementService.ts`

#### 1.2 Notificação no app
```javascript
// Floating banner no app
<NotificationBanner
  icon="🔥"
  text="João passou você"
/>
```

**Onde adicionar:**
- Arquivo: `src/components/NotificationBanner.js`
- Wrapper: `App.js`

---

### FASE 2: Achievements/Badges (5-7 dias)

#### 2.1 Definir Achievements
```typescript
const ACHIEVEMENTS = {
  first_workout: { icon: "🎯", name: "Primeiro Treino" },
  streak_7: { icon: "🔥", name: "Streak de 7 dias" },
  top_10: { icon: "📈", name: "Top 10" },
  top_3: { icon: "🥉", name: "Top 3" },
  volume_1000: { icon: "💪", name: "1000kg Volume" },
}
```

**Arquivo:** `src/data/achievements.ts`

#### 2.2 Check Achievement
```javascript
// Após cada treino
checkAchievements(userId, {
  volume,
  streak,
  position,
})
```

**Arquivo:** `src/services/achievementService.ts`

#### 2.3 UI para Awards
```javascript
// Mostrar ao terminar treino
<AchievementUnlocked icon="🔥" name="Streak 7 dias" />
```

**Arquivo:** `src/components/AchievementUnlocked.js`

---

### FASE 3: Coach Inteligente Durante Treino (7-10 dias)

#### 3.1 Coach Overlay
```javascript
// Não em chat separado → no treino
<FloatingCoachTip>
  "Aumenta 2.5kg próxima série"
</FloatingCoachTip>
```

**Arquivo:** `src/components/CoachTip.js`

**Onde adicionar:**
- `src/screens/WorkoutScreen.js` (durante exercício)

#### 3.2 Sugestões Inteligentes
```javascript
// Coach sugere baseado em:
// - Histórico
// - RPE
// - Volume
// - Streak
// - Posição no ranking

const suggestion = coachService.getSuggestion({
  exercise,
  lastWeight,
  rpe,
  streakDays,
  position,
})
```

**Arquivo:** `src/services/coachService.ts`

#### 3.3 Mensagens Context-Awareness
```javascript
// Diferentes mensagens por contexto
if (rpe === 7 && volume < lastVolume) {
  "Aumenta mais, você tá mole"
} else if (rpe === 10 && volume > lastVolume) {
  "Excelente progressão!"
} else if (streakDays === 1) {
  "Mantém o streak!"
}
```

---

### FASE 4: Integração Wearables (2-3 semanas)

#### 4.1 Google Fit / Apple Health
```javascript
// Sync dados de steps, heart rate
importFromGoogleFit()
importFromAppleHealth()
```

#### 4.2 Mostrar na Home
```
Steps: 8,234 / 10,000
HR: 72 BPM
Sleep: 7h 23m
```

---

### FASE 5: Real-Time Leaderboard (1-2 semanas)

#### 5.1 WebSocket Connection
```javascript
// Socket for real-time updates
io.on('ranking:updated', (newRanking) => {
  useSocialStore.setRanking(newRanking)
  // Re-render SocialScreen
})
```

#### 5.2 Animate Position Change
```javascript
// Quando posição muda
<Animated.View>
  {/* Slide animation */}
</Animated.View>
```

---

## 💰 Monetização (Paywall Pro)

### Pro Features
```javascript
if (!isPro) {
  // Limite 5 amigos
  // Sem histórico completo
  // Sem wearables
  // Sem export
  
  // Mostrar paywall no momento certo
}
```

### Paywall Contexto
```javascript
// Mostrar quando:
if (userPosition === 3) {
  <PaywallModal
    benefit="Você poderia estar em #1"
    features={["Histórico infinito", "5 amigos → 50"]}
  />
} else if (friends.length === 5) {
  <PaywallModal
    benefit="Adicione mais amigos"
  />
}
```

---

## 📌 Checklist de Implementação

### Antes de cada feature

- [ ] Criar branch: `git checkout -b feature/nome`
- [ ] Adicionar testes em `__tests__/`
- [ ] Validar `npm run test:all` passa
- [ ] Testar em device real
- [ ] Code review
- [ ] Merge em main
- [ ] Deploy em staging
- [ ] Tag version

---

## 🔍 Debugging Reference

### Se Social não atualiza
```bash
# 1. Check store
useGamificationStore.getState() 
useSocialStore.getState()

# 2. Check console logs
[SOCIAL_ENGAGEMENT] 🔥
[WORKOUT_SCREEN] 🎯

# 3. Force refresh
FlatList → key must be unique
```

### Se callback não é chamado
```bash
# 1. Validate import
import { onWorkoutCompleted } from '../services/socialEngagementService'

# 2. Check function exists
typeof onWorkoutCompleted === 'function'

# 3. Add console.log
console.log('[WORKOUT] Finishing...', workoutData)
console.log('[CALLBACK] Dispatching...')
```

### Se tests falham
```bash
npm run test:all
# Look for:
# ✔ = pass
# ✗ = fail
# Aumentar timeout se necessário
```

---

## 📚 Referência Rápida

| Arquivo | Função |
|---------|--------|
| `useSocialStore.ts` | Feed + Ranking (Zustand) |
| `socialEngagementService.ts` | XP + Callback |
| `SocialScreen.js` | UI (Feed, Ranking, Friends) |
| `FLUXO_ENGAJAMENTO.md` | Arquitetura técnica |
| `UX_ELITE_BLUEPRINT.md` | Regras UX |
| `test-engagement-flow.js` | Teste automatizado |

---

## 🎯 Métricas para Acompanhar

Após deploy, monitorar:

```
📊 DAU (Daily Active Users)
📊 Session Time (target: 8+ min)
📊 D1/D7 Retention (target: 70%+)
📊 XP Distribution (target: 95%+ com XP)
📊 Social Engagement (target: 60%+ clicam Social)
📊 Friends Added (target: 2+ por user)
```

---

## 🚨 Possíveis Problemas

### Problema 1: Ranking lento
**Causa:** Muitos posts no feed
**Solução:** Limitar feed a 100 posts (já feito)
**Código:** `feed.slice(0, 100)`

### Problema 2: Re-renders excessivos
**Causa:** Store não memoizado
**Solução:** Usar `useMemo` em SocialScreen (já feito)

### Problema 3: XP calculado errado
**Causa:** Volume não em kg
**Solução:** Validar `calculateVolume()` em performanceEngine.ts

### Problema 4: Post não aparece no feed
**Causa:** `addPostToFeed()` não chamado
**Solução:** Check console -> [SOCIAL_ENGAGEMENT] logs

---

## 💡 Pro Tips

1. **Sempre testar com 2 devices** para validar competição
2. **Monitor logs usando Expo DevTools**
3. **Use React DevTools para debug de stores**
4. **Test offline: disable network em device**
5. **Profile performance: Flipper + React Profiler**

---

## 📞 Contact

Se tiver dúvidas:
1. Veja `CHECKLIST_VALIDACAO.md`
2. Veja `FLUXO_ENGAJAMENTO.md`
3. Run `test-engagement-flow.js`
4. Check console logs `[SOCIAL_ENGAGEMENT]`

---

**Pronto para executar? Boa sorte! 🚀**

