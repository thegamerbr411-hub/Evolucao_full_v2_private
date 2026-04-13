## 📅 SEGUNDA-FEIRA 14/04 - O QUE FAZER

**This is your kickoff day for 60-day scale.**

---

## ⏰ HORÁRIO (8 horas)

### 6:00-7:00 → Preparation (1h)
```
□ Leia: EXECUTIVE_SUMMARY_ROADMAP.md (5 min)
□ Leia: STRATEGY_ESCALA_30-60_DIAS.md (30 min)
□ Setup: Calendar com 60 dias de tarefas
□ Setup: Metrics dashboard (Google Sheets)
```

### 7:00-9:00 → Technology (2h)
```
□ Setup Firebase (free tier)
  └─ Navigate to console.firebase.google.com
  └─ Create projeto "Evolucao"
  └─ Enable Firestore
  └─ Enable Cloud Messaging
  └─ Enable Authentication

□ Clone repo locally
  └─ cd c:\Users\USER\Downloads\Evolucao_full_v2
  └─ git pull origin main

□ Create feature branch
  └─ git checkout -b feature/week1-emotion-streak
```

### 9:00-11:00 → Development Setup (2h)
```
□ Create architecture for Week 1

src/stores/
└─ useStreakStore.ts (120 linhas)
   ├─ streak counter
   ├─ lastTrainDate tracker
   └─ updateStreak() function

src/services/
└─ emotionService.ts (100 linhas)
   ├─ getEmotionalMessage(position, streak)
   └─ 5+ message templates

src/components/
└─ EmotionalCard.js (150 linhas)
   ├─ Display position + CTA
   └─ Show streak
```

### 11:00-12:00 → Communication (1h)
```
□ Email 50 amigos (template below)
□ WhatsApp group announcement
□ Slack #announcement (if team)
□ Schedule daily standup 9am
```

### 12:00-14:00 → Development (2h)
```
□ Impelemnt Streak Store (1h)
□ Implement Emotion Service (1h)
```

---

## 📬 EMAIL TEMPLATE (para 50 amigos)

```
Subject: 🔥 Beta Testing - Novo App de Treino (Ganha XP grátis)

Oi [Name],

Criei um app de treino que GAMIFICA academia.

O que é diferente:
✅ Você treina como sempre
✅ App calcula o XP automaticamente
✅ Sobe ranking com amigos
✅ Compete no social
✅ Tudo em tempo real

Como participar:
1. Baixa o app (link abaixo)
2. Faz login
3. Começa treino

Bônus: Se você convidar 3 amigos, desbloqueia +500 XP.

Link: [deep link do seu app]
Code: BETA2026

Abraço,
[Your name]

P.S. - Feedback é ouro. Reply me.
```

---

## ⚙️ TECHNICAL CHECKLIST (Desenvolvimento)

### Criar Arquivos
```
□ src/stores/useStreakStore.ts
  ├─ create: (set) => ({
  ├─   streak: 0
  ├─   lastTrainDate: null
  ├─   updateStreak: (userId) => { ... }
  ├─   resetStreak: () => { ... }
  └─ })

□ src/services/emotionService.ts
  ├─ export const getEmotionalMessage = (pos, streak) => {
  ├─   if (streak === 3) return "🔥 3 dias!"
  ├─   if (position === 1) return "🥇 VOCÊ LIDERA"
  ├─   if (position <= 3) return "📈 Pódio!"
  └─ }

□ src/components/EmotionalCard.js
  ├─ import styled components
  ├─ Build responsive card
  ├─ Show streak + CTA
  └─ Display position rank
```

### Update Existing Files
```
□ src/screens/SocialScreen.js
  ├─ Import EmotionalCard
  ├─ Add <EmotionalCard /> at top
  └─ Add streak display on feed

□ src/services/socialEngagementService.ts
  ├─ Import useStreakStore
  ├─ Call updateStreak() on workout complete
  └─ Include streak in social post
```

### Test
```
□ npm run test:all
  └─ Goal: All tests still pass
  └─ New tests for streak/emotion

□ npm start
  └─ Visual check on Expo Go
  └─ Streak shows on Home
  └─ Emotional card shows on Social
```

---

## 📊 METRICS BASELINE (Set Monday)

### Create Google Sheet com estas colunas:

```
DATE | DAU | SESSION_MIN | D1_RET | STREAK_% | NOTES
─────────────────────────────────────────────────────
4/14 | 100 | 3.0 | 50 | 0 | Baseline - before changes
```

**Goal:** Track every day

---

## 📞 TEAM COMMUNICATION

### If solo
```
Setup Notion/Trello with:
├─ Week 1 tasks (checklist)
├─ Daily progress
├─ Issues/blockers
└─ Metrics tracking
```

### If have team
```
Setup Slack channels:
├─ #evolucao-growth (announcements)
├─ #metrics (daily dashboard)
├─ #bugs (issues)
└─ Daily standup 9am
```

---

## 🎯 Monday Success Criteria

### You W win Monday if:
```
✅ Feature branch created
✅ Streak store architecture done
✅ Emotion service implemented
✅ EmotionalCard component drafted
✅ 50 testers invited
✅ Baseline metrics recorded
✅ Tests still passing
✅ Expo shows changes
```

### You can start Phase 1 Tuesday if:
```
✅ All above done
✅ Got 20+ testers
✅ No critical bugs
✅ Emotional card visible
✅ Streak tracking works
```

---

## 📱 WHAT TESTERS WILL SEE TUESDAY

```
HOME Tab:
┌─────────────────────┐
│ 🔥 Você lidera!     │
│ Faltam 100 XP      │
│ para sair do #5    │
│                     │
│ [COMEÇAR TREINO]   │
└─────────────────────┘
│ Streak: 🔥 3 dias   │
│ Last: Ontem         │

SOCIAL Tab:
├─ Feed (com posts)
├─ Ranking (top 10 + seus)
│  └─ YOU 🔥 Seu status
│  └─ Friend 1 🔥 X dias
│  └─ Friend 2 X dias
└─ Amigos
```

---

## 🚨 If Something Goes Wrong

### Scenario: "Changes not showing"
```
□ npm start
□ Clear Expo cache
□ Restart metro bundler
□ Force reload app (Ctrl+Shift+R)
```

### Scenario: "Tests failing"
```
□ npm run test:all
□ Check error message
□ Review changes made
□ Revert if needed
□ Ping Copilot for help
```

### Scenario: "Users not getting streak"
```
□ Check useStreakStore call
□ Verify onTrainComplete callback
□ Check lastTrainDate storage
□ Test with console.log()
```

---

## 📋 FINAL CHECKLIST (Before bed Monday)

- [ ] Feature branch pushed
- [ ] Code passes tests
- [ ] 50 testers invited  
- [ ] Metrics tracked
- [ ] Baseline recorded  
- [ ] Calendar set for Week 1
- [ ] Daily standup scheduled
- [ ] Emergency contact setup (if team)

---

## ✅ SLEEP KNOWING

Monday will be busy but focused.

By end of Monday:
- Week 1 architecture ready
- Testers invited
- Baseline metrics captured
- Ready to ship Tuesday

Then Tuesday-Friday is just:
- Polish code
- Gather feedback
- Iterate based on data

**You got this. 🚀**

---

**Today's mission:** Setup + first features + get testers

**This week's mission:** Launch Week 1 (Emotion + Streak)

**Next 60 days:** Execute the 4-pillar strategy

→ **Let's go!** 🔥
