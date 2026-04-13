# ⚡ QUICK START - Como Usar os Stores

## 📌 TL;DR - Começar Agora

### Opção 1: Usar Zustand Direto (Recomendado para novo código)
```typescript
import { useUserStore, useWorkoutStore } from '@/stores';

function Dashboard() {
  // Selectors - componente re-renderiza APENAS se esses mudam
  const profile = useUserStore((state) => state.profile);
  const workout = useWorkoutStore((state) => state.workout);
  
  return (
    <View>
      <Text>{profile?.goal}</Text>
      {/* ... */}
    </View>
  );
}
```

### Opção 2: Usar Context (Para código legado que quer migrar lentamente)
```typescript
import { useApp } from '@/context/AppContext-v2';

function Dashboard() {
  // Mantém compatibilidade, mas menos otimizado
  const { profile, workout } = useApp();
  
  return (
    <View>
      <Text>{profile?.goal}</Text>
      {/* ... */}
    </View>
  );
}
```

---

## 🔧 PADRÕES DE USO

### Pattern 1: Apenas Ler Estado
```typescript
import { useUserStore } from '@/stores';

function ShowProfile() {
  const profile = useUserStore((state) => state.profile);
  
  return <Text>{profile?.goal}</Text>;
}
```

### Pattern 2: Ler + Atualizar Estado
```typescript
import { useUserStore } from '@/stores';

function EditProfile() {
  const profile = useUserStore((state) => state.profile);
  const updateProfile = useUserStore((state) => state.updateProfile);
  
  return (
    <Button 
      onPress={() => updateProfile({ goal: 'ganhar_massa' })}
    >
      Update Goal
    </Button>
  );
}
```

### Pattern 3: Usar Múltiplos Stores
```typescript
import { useUserStore, useWorkoutStore, useNutritionStore } from '@/stores';

function CompleteView() {
  const profile = useUserStore((state) => state.profile);
  const workout = useWorkoutStore((state) => state.workout);
  const nutritionLogs = useNutritionStore((state) => state.nutritionLogs);
  
  return (
    <ScrollView>
      <Section title={profile?.goal} />
      <Section title={workout?.exercises?.length} exercises={workout?.exercises} />
      <Section title={nutritionLogs?.length} logs={nutritionLogs} />
    </ScrollView>
  );
}
```

### Pattern 4: Computações Memoizadas
```typescript
import { useWorkoutStore } from '@/stores';
import { useMemo } from 'react';

function WorkoutStats() {
  const workoutLogs = useWorkoutStore((state) => state.workoutLogs);
  
  // Computação re-calcula APENAS se workoutLogs mudar
  const totalSets = useMemo(() => {
    return workoutLogs.reduce((acc, log) => acc + 1, 0);
  }, [workoutLogs]);
  
  return <Text>{totalSets} series today</Text>;
}
```

### Pattern 5: Ações (Múltiplas Mutações)
```typescript
import { useWorkoutStore, useGamificationStore } from '@/stores';

function CompleteWorkout() {
  const addWorkoutLog = useWorkoutStore((state) => state.addWorkoutLog);
  const addXp = useGamificationStore((state) => state.addXp);
  
  const handleSetCompletion = (exerciseName) => {
    // Múltiplas mutações em coordenação
    addWorkoutLog({
      id: `${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      exerciseName,
      weight: 100,
      reps: 8,
      failed: false,
      mode: 'guided',
      createdAt: new Date().toISOString(),
    });
    
    addXp(10); // XP por série
  };
  
  return <Button onPress={() => handleSetCompletion('Bench Press')}>Done</Button>;
}
```

---

## 🎯 CADA STORE EM DETALHES

### useUserStore
```typescript
import { useUserStore } from '@/stores';

// Usar estado
const profile = useUserStore((state) => state.profile);
const user = useUserStore((state) => state.user);
const isHydrated = useUserStore((state) => state.isHydrated);

// Chamar ações
const setProfile = useUserStore((state) => state.setProfile);
const updateProfile = useUserStore((state) => state.updateProfile);
```

### useWorkoutStore
```typescript
import { useWorkoutStore } from '@/stores';

// Estado
const workout = useWorkoutStore((state) => state.workout);
const workoutLogs = useWorkoutStore((state) => state.workoutLogs);
const exerciseTargets = useWorkoutStore((state) => state.exerciseTargets);

// Ações
const addWorkoutLog = useWorkoutStore((state) => state.addWorkoutLog);
const removeWorkoutLog = useWorkoutStore((state) => state.removeWorkoutLog);
const updateExerciseTarget = useWorkoutStore((state) => state.updateExerciseTarget);
```

### useNutritionStore
```typescript
import { useNutritionStore } from '@/stores';

// Estado
const nutritionLogs = useNutritionStore((state) => state.nutritionLogs);
const history = useNutritionStore((state) => state.history);
const plan = useNutritionStore((state) => state.plan);

// Ações
const addNutritionLog = useNutritionStore((state) => state.addNutritionLog);
const updateHistoryEntry = useNutritionStore((state) => state.updateHistoryEntry);
const updatePlan = useNutritionStore((state) => state.updatePlan);
```

### useAppStore
```typescript
import { useAppStore } from '@/stores';

// Estado
const isLoading = useAppStore((state) => state.isLoading);
const isOnline = useAppStore((state) => state.isOnline);
const monetization = useAppStore((state) => state.monetization);
const userRoutines = useAppStore((state) => state.userRoutines);

// Ações
const setLoading = useAppStore((state) => state.setLoading);
const setOnline = useAppStore((state) => state.setOnline);
const updateUserRoutines = useAppStore((state) => state.updateUserRoutines);
```

### useCoachStore
```typescript
import { useCoachStore } from '@/stores';

// Estado
const message = useCoachStore((state) => state.message);
const suggestions = useCoachStore((state) => state.suggestions);
const missions = useCoachStore((state) => state.missions);

// Ações
const setMessage = useCoachStore((state) => state.setMessage);
const setSuggestions = useCoachStore((state) => state.setSuggestions);
const addCompletedMission = useCoachStore((state) => state.addCompletedMission);
```

### useGamificationStore
```typescript
import { useGamificationStore } from '@/stores';

// Estado
const gamification = useGamificationStore((state) => state.gamification);

// Ações
const addXp = useGamificationStore((state) => state.addXp);
const updateStreak = useGamificationStore((state) => state.updateStreak);
const addMissionCompletion = useGamificationStore((state) => state.addMissionCompletion);
```

---

## 🧪 EXEMPLOS REAIS

### Exemplo 1: Componente que Salva um Set de Treino
```typescript
import { useWorkoutStore, useGamificationStore, useNutritionStore } from '@/stores';
import { useState } from 'react';

function SetLogger({ exerciseName }) {
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  
  const addWorkoutLog = useWorkoutStore((state) => state.addWorkoutLog);
  const addXp = useGamificationStore((state) => state.addXp);
  
  const handleSaveSet = () => {
    // Salvar o log
    addWorkoutLog({
      id: `${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      exerciseName,
      weight: Number(weight),
      reps: Number(reps),
      failed: false,
      mode: 'guided',
    });
    
    // Dar XP
    addXp(10);
    
    // Limpar form
    setWeight(0);
    setReps(0);
  };
  
  return (
    <View>
      <TextInput 
        value={weight.toString()} 
        onChangeText={(text) => setWeight(Number(text))}
        placeholder="Weight (kg)"
      />
      <TextInput 
        value={reps.toString()} 
        onChangeText={(text) => setReps(Number(text))}
        placeholder="Reps"
      />
      <Button onPress={handleSaveSet}>Save Set</Button>
    </View>
  );
}
```

### Exemplo 2: Dashboard que Mostra Dados de Múltiplos Stores
```typescript
import { 
  useUserStore, 
  useWorkoutStore, 
  useNutritionStore,
  useGamificationStore 
} from '@/stores';
import { useMemo } from 'react';

function Dashboard() {
  // Selectors - cada um é memoizado internamente
  const profile = useUserStore((state) => state.profile);
  const workoutLogs = useWorkoutStore((state) => state.workoutLogs);
  const nutritionLogs = useNutritionStore((state) => state.nutritionLogs);
  const gamification = useGamificationStore((state) => state.gamification);
  
  // Computações locais
  const todayKey = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);
  
  const todayWorkoutLogs = useMemo(() => {
    return workoutLogs.filter((log) => log.date === todayKey);
  }, [workoutLogs, todayKey]);
  
  const todayNutritionLogs = useMemo(() => {
    return nutritionLogs.filter((log) => log.date === todayKey);
  }, [nutritionLogs, todayKey]);
  
  return (
    <ScrollView>
      <Card title="Perfil">
        <Text>Goal: {profile?.goal}</Text>
        <Text>Level: {profile?.level}</Text>
      </Card>
      
      <Card title="Hoje">
        <Text>Treinos: {todayWorkoutLogs.length} séries</Text>
        <Text>Refeições: {todayNutritionLogs.length}</Text>
        <Text>XP: {gamification.xp}</Text>
        <Text>Streak: {gamification.streakDays} dias 🔥</Text>
      </Card>
      
      <Card title="Histórico">
        <Text>Total de séries: {workoutLogs.length}</Text>
        <Text>Total de alimentos: {nutritionLogs.length}</Text>
      </Card>
    </ScrollView>
  );
}
```

### Exemplo 3: Adicionar Comida no Histórico Nutricional
```typescript
import { useNutritionStore } from '@/stores';

function AddFoodLogScreen() {
  const addNutritionLog = useNutritionStore((state) => state.addNutritionLog);
  const addHistoryEntry = useNutritionStore((state) => state.addHistoryEntry);
  const history = useNutritionStore((state) => state.history);
  
  const handleAddFood = ({ foodName, quantity, calories, protein }) => {
    const todayKey = new Date().toISOString().split('T')[0];
    
    // Adicionar na nutrition log
    addNutritionLog({
      id: `${Date.now()}`,
      date: todayKey,
      loggedAt: new Date().toISOString(),
      foodKey: foodName.toLowerCase(),
      label: foodName,
      quantity,
      calories,
      protein,
      carbs: 0, // Calcular se necessário
      fats: 0,
    });
    
    // Atualizar history do dia
    const todayHistory = history.find((h) => h.date === todayKey);
    if (todayHistory) {
      addHistoryEntry({
        ...todayHistory,
        calories: todayHistory.calories + calories,
        protein: todayHistory.protein + protein,
      });
    }
  };
  
  return (
    <Button onPress={() => handleAddFood({ 
      foodName: 'Chicken Breast',
      quantity: 150,
      calories: 250,
      protein: 50
    })}>
      Add Food
    </Button>
  );
}
```

---

## 🚀 DICAS DE PERFORMANCE

### ✅ BOM: Selectors específicos
```typescript
const profile = useUserStore((state) => state.profile); // Apenas profile
```

### ❌ RUIM: Puchar store inteira
```typescript
const state = useUserStore(); // Todo o state (menos ótimo)
```

### ✅ BOM: Memoizar computações
```typescript
const totalXP = useMemo(() => {
  return gamification.xp * multiplier;
}, [gamification.xp, multiplier]);
```

### ❌ RUIM: Computação inline
```typescript
// Recalcula a cada render (ineficiente)
<Text>{gamification.xp * multiplier}</Text>
```

---

## 🆚 COMPARAÇÃO RÁPIDA: Context vs Zustand

| Operação | Context (AppContext-v2) | Zustand |
|----------|-------------------------|---------|
| Ler estado | `useApp()` | `useUserStore(...)` |
| Atualizar | `setProfile(...)` (via context) | `updateProfile(...)`  |
| Seletor | Não (pucha tudo) | Sim (otimizado) |
| Performance | OK | Melhor ⭐ |
| Re-renders | Todos subscribers | Apenas seletor |
| Legível | Alto | Alto |
| Type-safe | Parcial | 100% |

---

## 📋 CHECKLIST - Pronto para Usar

- [ ] Compilação `npm run tsc --noEmit` passou
- [ ] App.tsx usa `AppContext-v2`
- [ ] Consegue importar de `@/stores`
- [ ] Consegue usar `useUserStore` em componente
- [ ] Estado muda reativo ao chamar ações
- [ ] Leu `VALIDATION_GUIDE.md`

✅ Se todos passaram, estava pronto para usar!

---

**Próximo passo**: Começar migração de componentes usando estes padrões! 🚀
