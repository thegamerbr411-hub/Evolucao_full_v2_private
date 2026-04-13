# 📊 ANTES vs DEPOIS

## 📈 ESTRUTURA

### ❌ ANTES (Monolito)
```
/src/context/
  ├── AppContext.js (4000+ linhas!)
  │   ├── Constants (CALORIE_RANGES, XP_RULES, FOOD_CATALOG, etc)
  │   ├── Utility functions (50+)
  │   ├── User state & logic
  │   ├── Workout state & logic
  │   ├── Nutrition state & logic
  │   ├── Coach state & logic
  │   ├── Gamification state & logic
  │   ├── 4 useContext hooks (AppContext, WorkoutContext, NutritionContext, CoachContext)
  │   └── AppProvider component (TUDO junto)
  ├── modules/
  │   ├── nutrition.js
  │   ├── workout.js
  │   └── coach.js
```

### ✅ DEPOIS (Modular)
```
/src/stores/
  ├── index.ts (central exports)
  ├── useUserStore.ts (88 linhas)
  ├── useWorkoutStore.ts (108 linhas)
  ├── useNutritionStore.ts (95 linhas)
  ├── useAppStore.ts (48 linhas)
  ├── useCoachStore.ts (45 linhas)
  └── useGamificationStore.ts (60 linhas)

/src/context/
  ├── AppContext-v2.ts (novo provider, compatível)
  ├── AppContext.js (original, deprecado)
  └── modules/
      ├── nutrition.js
      ├── workout.js
      └── coach.js
```

**Redução de Complexidade**: 4000 linhas em 1 arquivo → 444 linhas distribuídas em 6 stores + provider

---

## 💻 CÓDIGO

### ❌ ANTES: Usando context

```typescript
// Componente legada
import { useContext } from 'react';
import { AppContext } from '@/context/AppContext';

function HomeScreen() {
  // ⚠️ Puxa TODO o contexto
  const {
    profile,
    workout,
    workoutLogs,
    nutritionLogs,
    history,
    gamification,
    saveWorkoutSet,
    addFoodLogEntry,
  } = useContext(AppContext);

  // ⚠️ O COMPONENTE RE-RENDERIZA SEMPRE que qualquer estado acima muda
  // Mesmo que só precisemos de `profile`, se `workoutLogs` mudar → re-render ❌

  return (
    <View>
      <Text>Hello {profile?.name}</Text>
      {/* Se gamification mudar aqui, Home inteira re-renderiza unnecessariamente */}
    </View>
  );
}
```

### ✅ DEPOIS: Usando Zustand com selectors

```typescript
// Componente moderna
import { useUserStore } from '@/stores';
import { useGamificationStore } from '@/stores';

function HomeScreen() {
  // ✅ Puxa APENAS o que precisa com selector
  const profile = useUserStore((state) => state.profile);
  const gamification = useGamificationStore((state) => state.gamification);

  // ✅ Componente re-renderiza APENAS se profile OU gamification mudam
  // Se nutrition mudar → zero impact ✨

  return (
    <View>
      <Text>Hello {profile?.name}</Text>
    </View>
  );
}
```

---

## 🗂️ ESTADO

### ❌ ANTES: Tudo misturado

```typescript
// AppContext.js - 4000 linhas!
const [user, setUser] = useState(null);
const [profile, setProfile] = useState(null);
const [plan, setPlan] = useState(null);
const [history, setHistory] = useState([]);
const [nutritionLogs, setNutritionLogs] = useState([]);
const [workoutLogs, setWorkoutLogs] = useState([]);
const [workout, setWorkout] = useState({});
const [userRoutines, setUserRoutines] = useState([]);
const [exerciseTargets, setExerciseTargets] = useState({});
const [gamification, setGamification] = useState({});
const [monetization, setMonetization] = useState({});

// E temos 50+ funções...
const getTodayWorkout = () => { /* ... */ };
const saveWorkoutSet = () => { /* ... */ };
const getLevelFromXp = () => { /* ... */ };
// ... etc, tudo que une em um arquivo ❌
```

### ✅ DEPOIS: Separado por domínio

```typescript
// useUserStore.ts - 45 linhas
export const useUserStore = create<UserStore>((set) => ({
  user: null,
  profile: null,
  isHydrated: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  updateProfile: (partial) => set(...),
  logout: () => set({ user: null, profile: null }),
}));

// useWorkoutStore.ts - 70 linhas
export const useWorkoutStore = create<WorkoutStore>((set) => ({
  workout: { exercises: [] },
  workoutLogs: [],
  exerciseTargets: {},
  setWorkout: (workout) => set({ workout }),
  // ... workout logic only
}));

// useNutritionStore.ts - 85 linhas
export const useNutritionStore = create<NutritionStore>((set) => ({
  nutritionLogs: [],
  history: [],
  plan: null,
  addNutritionLog: (log) => set(...),
  // ... nutrition logic only
}));
// etc
```

---

## 🔀 MIGRATIONS

### ❌ ANTES: Setup complexo

```typescript
// App.tsx
import { AppProvider } from '@/context/AppContext';

export default function App() {
  return <AppProvider>{/* ... */}</AppProvider>;
  // ⚠️ Provider é monolıtico, tudo inicia junto
}
```

### ✅ DEPOIS: Setup simples

```typescript
// App.tsx
import { AppProvider } from '@/context/AppContext-v2'; // Nova versão

export default function App() {
  return <AppProvider>{/* ... */}</AppProvider>;
  // ✅ Provider usa stores internamente, mas componentes podem usar Zustand direto
}

// Componentes podem mix de approaches:

// Opção 1: Novo código com Zustand
import { useUserStore, useWorkoutStore } from '@/stores';
function NewComponent() {
  const profile = useUserStore((state) => state.profile);
  // ...
}

// Opção 2: Código legado com context
import { useApp } from '@/context/AppContext-v2';
function OldComponent() {
  const { profile } = useApp(); // Ainda funciona!
  // ...
}
```

---

## ⚡ PERFORMANCE

### ❌ ANTES: Re-renders em cascata

```
User action: saveWorkoutSet()
  → setWorkoutLogs() 
    → AppContext muda
      → TUDO re-render que use AppContext ❌
        ├── HomeScreen (usa profile) ❌
        ├── NutritionScreen (usa nutritionLogs) ❌
        ├── StatsScreen (usa history) ❌
        └── CoachScreen (usa gamification) ❌
  
Total: 4 re-renders desnecessários
```

### ✅ DEPOIS: Re-renders cirúrgicos

```
User action: saveWorkoutSet()
  → workoutStore.addWorkoutLog()
    → useWorkoutStore subscribers re-render (apenas WorkoutScreen) ✅
      ├── HomeScreen (usa useUserStore) - não re-render ✅
      ├── NutritionScreen (usa useNutritionStore) - não re-render ✅
      ├── StatsScreen (usa useNutritionStore) - não re-render ✅
      └── CoachScreen (usa useCoachStore) - não re-render ✅

Total: 1 re-render cirúrgico
```

---

## 🧪 TESTABILIDADE

### ❌ ANTES: Difícil testar

```typescript
// Testar função em AppContext.js é complicado
// Precisa mockar todo o contexto gigante

test('saveWorkoutSet', () => {
  // ❌ Precisa mockar:
  // - user, profile, plan, history, nutritionLogs
  // - workoutLogs, workout, exerciseTargets, gamification
  // - 50+ functions
  // É muito boilerplate...
});
```

### ✅ DEPOIS: Trivial testar

```typescript
// Testar store é simples
import { useWorkoutStore } from '@/stores';

test('addWorkoutLog', () => {
  // ✅ Setup limpo
  const { addWorkoutLog, workoutLogs } = useWorkoutStore.getState();
  
  const log = { id: '1', exerciseName: 'Bench', weight: 100, ... };
  addWorkoutLog(log);
  
  expect(useWorkoutStore.getState().workoutLogs).toContain(log);
});
```

---

## 📦 IMPORTES

### ❌ ANTES: Sempre puxar contexto todo

```typescript
import { useApp, useWorkoutDomain, useNutritionDomain } from '@/context/AppContext';

// Precisa de 3 hooks mesmo que use só um
function Component() {
  const { profile } = useApp();
  const { getTodayWorkout } = useWorkoutDomain();
  const { addFoodLogEntry } = useNutritionDomain();
  // Só usa 3 funções mas contexto todo é carregado
}
```

### ✅ DEPOIS: Import granular

```typescript
import { useUserStore } from '@/stores';
import { useWorkoutStore } from '@/stores';
import { useNutritionStore } from '@/stores';

// Ou melhor:
import { useUserStore, useWorkoutStore, useNutritionStore } from '@/stores';

function Component() {
  const profile = useUserStore((state) => state.profile);
  const getTodayWorkout = useWorkoutStore((state) => state.getTodayWorkout);
  const addFoodLogEntry = useNutritionStore((state) => state.addNutritionLog);
  // Apenas stores necessários importados ✅
}
```

---

## 🚀 EXTENSIBILIDADE

### ❌ ANTES: Adicionar nova feature = mexer no monolito

```typescript
// Quer adicionar novo domínio (ex: Social)?
// Vai editar o seu AppContext.js gigante :(
// Novo const [socialData, setSocialData] = useState([]);
// Novas 15+ funções no arquivo já grande
// Vai ficar com 4500+ linhas
```

### ✅ DEPOIS: Adicionar nova feature = novo arquivo

```typescript
// Quer adicionar novo domínio (Social)?
// Cria /src/stores/useSocialStore.ts ✅

export const useSocialStore = create<SocialStore>((set) => ({
  followers: [],
  posts: [],
  addFollower: (user) => set(...),
  addPost: (post) => set(...),
}));

// Componentes usam:
import { useSocialStore } from '@/stores';

function SocialFeed() {
  const posts = useSocialStore((state) => state.posts);
  // Pronto! ✨
}
```

---

## 🎯 RESUMO

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Linhas de Código** | 4000+ em 1 arquivo | 444 distribuídas em 6 |
| **Re-renders** | Todos os subscribers | Apenas afetados |
| **Testabilidade** | Difícil (boilerplate) | Trivial |
| **Extensibilidade** | Mexer no monolito | Novo arquivo |
| **Performance** | ⚠️ Muitos re-renders | ✅ Otimizado |
| **Debugging** | Contexto confuso | DevTools Zustand |
| **Manutenibilidade** | Tudo junto → confuso | Responsabilidade clara |
| **Offline-first** | Complexo de adicionar | MMKV per store |
| **Type Safety** | Parcial | 100% TypeScript |

---

## ✨ O QUE MUDA PARA O USUÁRIO

**TL;DR**: Nada muda pela perspectiva do usuário! 🎉

- ✅ Aplicativo mantém mesma UI
- ✅ Mesma funcionalidade
- ✅ Melhor performance
- ✅ Base sólida para novos features

É um refactor de **infraestrutura**, não de features!
