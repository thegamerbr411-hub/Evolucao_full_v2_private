# 🗺️ MAPA DE ARQUIVOS - ONDE ESTÁ TUDO

## 📍 ESTRUTURA COMPLETA PÓS-REFACTORING

```
Evolucao_full_v2/
│
├── 📁 src/
│   │
│   ├── 📁 stores/ (⭐ NOVO - Zustand Stores)
│   │   ├── useUserStore.ts           ✅ User + Profile state
│   │   ├── useWorkoutStore.ts        ✅ Workout + Logs state
│   │   ├── useNutritionStore.ts      ✅ Nutrition + History state
│   │   ├── useAppStore.ts            ✅ Global UI state
│   │   ├── useCoachStore.ts          ✅ Coach + Messages state
│   │   ├── useGamificationStore.ts   ✅ XP + Streak state
│   │   └── index.ts                  ✅ Central exports
│   │
│   ├── 📁 context/
│   │   ├── AppContext-v2.ts          ✅ (NOVO) Provider com Zustand
│   │   ├── AppContext.js             ⚠️ (LEGADO) Mantido para compatibilidade
│   │   └── modules/
│   │       ├── nutrition.js
│   │       ├── workout.js
│   │       └── coach.js
│   │
│   ├── 📁 components/
│   ├── 📁 screens/
│   └── ... (resto do projeto)
│
├── 📁 (_export_zip/)         (cache antigo)
├── 📁 analysis/              (analise antiga)
├── 📁 artifacts/
├── 📁 android/
├── 📁 e2e/
├── 📁 functions/
├── 📁 scripts/
├── 📁 test-results/
│
├── 📄 REFACTORING_SUMMARY.md      ✅ Explicação técnica
├── 📄 BEFORE_AFTER.md             ✅ Comparação visual
├── 📄 VALIDATION_GUIDE.md         ✅ Como validar + roadmap
├── 📄 QUICK_START.md              ✅ Exemplos de código
├── 📄 DELIVERY_SUMMARY.md         ✅ Sumário de entrega
├── 📄 CHECKLIST_FINAL.md          ✅ Checklist tudo feito
├── 📄 FILE_MAP.md                 ✅ Este arquivo
│
├── App.js
├── app.json
├── package.json
├── babel.config.js
└── ... (resto arquivos)
```

---

## 📋 LOCALIZAÇÃO DE CADA COISA

### Stores Zustand
```
Localização: src/stores/

📄 useUserStore.ts
   └─ Para: Gerenciar user + profile
   └─ Usar em componentes: import { useUserStore } from '@/stores';

📄 useWorkoutStore.ts
   └─ Para: Gerenciar workout + exerciseTargets + workoutLogs
   └─ Usar em componentes: import { useWorkoutStore } from '@/stores';

📄 useNutritionStore.ts
   └─ Para: Gerenciar nutrition + history + plan
   └─ Usar em componentes: import { useNutritionStore } from '@/stores';

📄 useAppStore.ts
   └─ Para: Gerenciar global state (loading, online, routines, etc)
   └─ Usar em componentes: import { useAppStore } from '@/stores';

📄 useCoachStore.ts
   └─ Para: Gerenciar coach state (messages, suggestions)
   └─ Usar em componentes: import { useCoachStore } from '@/stores';

📄 useGamificationStore.ts
   └─ Para: Gerenciar gamification (xp, streak, missions)
   └─ Usar em componentes: import { useGamificationStore } from '@/stores';

📄 index.ts
   └─ Para: Centralizar exports
   └─ Usar: import { useUserStore, useWorkoutStore } from '@/stores';
```

### Provider & Contexto
```
Localização: src/context/

📄 AppContext-v2.ts (⭐ NOVO)
   └─ Para: Novo provider que usa Zustand internamente
   └─ Mantém compatibilidade com código legado
   └─ Importar em App.tsx: import { AppProvider } from '@/context/AppContext-v2';

📄 AppContext.js (⚠️ LEGADO)
   └─ Para: Código original (para referência)
   └─ Status: DEPRECIADO (será deletado em Fase 5)
   └─ Não remover ainda! (compatibilidade)
```

### Documentação
```
Localização: Raiz do projeto (Evolucao_full_v2/)

📄 REFACTORING_SUMMARY.md
   └─ Conteúdo: Explicação técnica completa
   └─ Público: Arquitetos, Tech Leads
   └─ Ler: Antes de começar migração
   └─ Tempo: 15-20 min

📄 BEFORE_AFTER.md
   └─ Conteúdo: Comparação visual antes/depois
   └─ Público: Developers, QA
   └─ Ler: Para entender impacto
   └─ Tempo: 10-15 min

📄 VALIDATION_GUIDE.md
   └─ Conteúdo: Como validar + roadmap 5 fases
   └─ Público: Implementadores
   └─ Ler: PRIMEIRA COISA após receber código
   └─ Tempo: 20-30 min

📄 QUICK_START.md
   └─ Conteúdo: Exemplos reais de uso
   └─ Público: Developers escrevendo ao vivo
   └─ Ler: Quando começar a codar
   └─ Tempo: 30-40 min

📄 DELIVERY_SUMMARY.md
   └─ Conteúdo: Sumário visual de entrega
   └─ Público: Todos
   └─ Ler: Para visão geral rápida
   └─ Tempo: 5-10 min

📄 CHECKLIST_FINAL.md
   └─ Conteúdo: Checklist de tudo feito
   └─ Público: PM, Project Lead
   └─ Ler: Para validar completude
   └─ Tempo: 10 min

📄 FILE_MAP.md (este arquivo)
   └─ Conteúdo: Orientação de onde está tudo
   └─ Público: Todos
   └─ Ler: Quando está perdido
```

---

## 🎯 POR CASO DE USO

### "Quero entender o que foi feito"
```
Leque recomendado:
1. DELIVERY_SUMMARY.md     (visão geral rápida - 5 min)
2. BEFORE_AFTER.md         (entender impacto - 10 min)
3. REFACTORING_SUMMARY.md  (detalhes técnicos - 15 min)
```

### "Quero começar a usar agora"
```
Leia na ordem:
1. QUICK_START.md          (exemplos - 20 min)
2. VALIDATION_GUIDE.md     (próximos passos - 15 min)
3. src/stores/index.ts     (ver os exports - 5 min)
```

### "Quero validar que tudo está pronto"
```
Checklist:
1. VALIDATION_GUIDE.md     (Passo 1-3 de validação)
2. Compilar: npm run tsc   (deve passar)
3. CHECKLIST_FINAL.md      (confirmar tudo)
```

### "Quero migrar um componente"
```
Processo:
1. QUICK_START.md          (Pattern 1: Ler Estado)
2. QUICK_START.md          (Pattern 2: Atualizar)
3. Escolher exemplo real más próximo
4. Adaptar para seu componente
```

### "Tenho dúvida ou erro"
```
Debugging:
1. VALIDATION_GUIDE.md     (seção Troubleshooting)
2. QUICK_START.md          (seção Dicas de Performance)
3. Código exemplo em QUICK_START.md
```

---

## ⚡ PRÓXIMOS PASSOS HOJE

### Passo 1: Confirmar que tudo existe
```bash
ls -la src/stores/
# Deve listar: useUserStore.ts, useWorkoutStore.ts, ... index.ts

ls -la src/context/AppContext-v2.ts
# Deve existir

ls -la *.md | grep -E "(REFACTORING|BEFORE|VALIDATION|QUICK|DELIVERY|CHECKLIST)"
# Deve listar 6 arquivos .md
```

### Passo 2: Ler documentação principal (Hoje)
```
30 min: QUICK_START.md
15 min: VALIDATION_GUIDE.md
```

### Passo 3: Validar compilação (Hoje)
```bash
npm run tsc --noEmit
# Esperado: ✅ Zero errors
```

### Passo 4: Trocar provider (Hoje)
```typescript
// Em App.tsx:
import { AppProvider } from '@/context/AppContext-v2';
```

### Passo 5: Testar que funciona (Hoje)
```bash
npm start
# Esperado: ✅ App inicia normalmente
```

---

## 📚 REFERÊNCIA RÁPIDA

### Imports mais comuns

```typescript
// Usar Zustand diretamente (NEW - Preferred)
import { useUserStore, useWorkoutStore, useNutritionStore } from '@/stores';

// Usar context legado (OLD - Para mig gradual)
import { useApp, useWorkoutDomain, useNutritionDomain } from '@/context/AppContext-v2';

// Usar todas as stores
import * as stores from '@/stores';
```

### Estrutura básica

```
Novo código (Zustand):
const profile = useUserStore((state) => state.profile);

Código legado (Context):
const { profile } = useApp();
```

### Arquivo para referência

```
Para exemplos reais:     src/stores/*.ts
Para uso legado:          src/context/AppContext-v2.ts
Para documentação:        *.md (raiz)
```

---

## 🎯 TIMELINE ESPERADA

```
Hoje (2h):
├── Ler QUICK_START.md
├── Ler VALIDATION_GUIDE.md
├── Trocar App.tsx
└── Testar compilação

Esta semana (5h):
├── Migrar HomeScreen
├── Migrar WorkoutScreen
├── Testar performance
└── Documentar lições

Próximas 2 semanas (15h):
├── Migrar 5-10 componentes
├── Integração testes
└── Performance baseline

Semana 3-4 (10h):
├── Integrar MMKV
├── Deletar AppContext.js antigo
└── Cleanup geral
```

---

## 🆘 REFERÊNCIA DE PROBLEMAS

### Erro: "Cannot find module '@/stores'"
```
Arquivo: tsconfig.json ou babel.config.js
Solução: Verificar paths aliases
```

### Erro: "useApp is undefined"
```
Arquivo: App.tsx
Solução: Trocar para AppContext-v2
```

### Re-renders não melhoraram
```
Arquivo: Seu componente
Solução: Verificar QUICK_START.md - Pattern 1 (Seletores)
```

### Store não persiste
```
Arquivo: Fase 4 (MMKV not implemented yet)
Solução: Ver VALIDATION_GUIDE.md - FASE 4
```

---

## 📞 RESUMO SUPER RÁPIDO

### O que foi criado
- ✅ 6 Zustand stores em `src/stores/`
- ✅ 1 novo provider em `src/context/AppContext-v2.ts`
- ✅ 6 documentos detallados na raiz

### Onde está cada coisa
- Stores → `src/stores/` (6 arquivos)
- Provider → `src/context/AppContext-v2.ts`
- Docs → Raiz do projeto (6 arquivos .md)

### Como começar
1. Ler FILE_MAP.md (você está aqui! ✓)
2. Ler QUICK_START.md (exemplos)
3. Ler VALIDATION_GUIDE.md (próximos passos)
4. Executar validação de compilação
5. Começar migração

---

🎉 **Tudo está mapeado e pronto!**

Próximo passo: Ler `QUICK_START.md` como recomendado. 🚀
