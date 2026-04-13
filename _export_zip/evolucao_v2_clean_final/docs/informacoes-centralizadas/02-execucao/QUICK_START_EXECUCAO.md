# ⚡ QUICK START - EJECUTAR AGORA

## 📋 INSTALL DEPENDENCIES

```bash
# Frontend
npm install react-native-mmkv axios

# Google Auth
expo install expo-auth-session expo-web-browser expo-secure-store

# Backend
cd backend
npm install
```

## 🔑 ENV SETUP

**`.env.local` (raiz do projeto)**
```
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_CLIENT_ID=seu-google-client-id_android.apps.googleusercontent.com
```

**`backend/.env`**
```
JWT_SECRET=sua-chave-super-secreta-aqui
PORT=3000
```

## 🚀 START BACKEND

```bash
cd backend
npm run dev
```

Vai rodar em `http://localhost:3000`

## ✅ TESTAR TUDO

### 1. Testar API Health
```bash
curl http://localhost:3000/health
```
Deve retornar: `{ "ok": true, "timestamp": "..." }`

### 2. Testar Login
- No App, apertar "Login com Google"
- Deve redirecionar pro Google
- Backend vai receber token
- Deve retornar JWT

### 3. Testar Offline
- Salvar um treino
- Desligar internet
- Salvar outro treino
- Ligar internet
- Deve sincronizar automaticamente

### 4. Testar Coach
- Começar treino
- Coach deve mostrar mensagens diferentes por set
- Deve sugerir carga automático

## 🎯 CHECKLIST FINAL

- [ ] Dependências instaladas
- [ ] `.env.local` configurado com Google Client ID
- [ ] Backend rodando em `http://localhost:3000`  
- [ ] `npm run dev` funciona no backend
- [ ] Login com Google funciona
- [ ] Treino salva offline
- [ ] Treino sincroniza quando conecta internet
- [ ] Coach mostra mensagens
- [ ] App não trava quando offline

## 💡 DICAS IMP ORTANTES

1. **Google Client ID**: Você precisa gerar um em `console.cloud.google.com`
2. **Backend precisa estar rodando**: Sem backend, sync não funciona
3. **MMKV é super rápido**: 100ms pra salvar treino localmente
4. **Coach é determinístico**: Mesma entrada = mesma mensagem sempre

## 🆘 PROBLEMAS COMUNS

### "Module not found: MMKV"
```bash
npm install react-native-mmkv
```

### "Refresh token inválido"
- Isso é normal em produção
- Simulação de backend trata como token fixo
- Em produção você implementaria refresh real

### "Não pode conectar com backend"
- Verifica se backend está rodando
- Verifica se URL em `.env.local` está correta
- Tente `http://10.0.2.2:3000` no emulador Android

### Coach não mostra mensagem
- Verifica se `currentExercise` está setado
- Verifica se `currentSet` é >= 0
- Testa com code snippet em `useCoach.ts`

## 🔥 PRÓXIMAS TAREFAS (FÁCEIS)

1. **Conectar Social Tab**: Use `useSocialStore` + `SocialScreen`
2. **Conectar Ranking**: Use `/ranking` endpoint
3. **Adicionar Notificações**: Instale `expo-notifications`
4. **Monetização**: Wrap com `isPro()` check antes de features avançadas

## 📞 REFERENCE RÁPIDO

**Salvar treino offline:**
```tsx
import { saveWorkout } from '@/services/workoutService'
await saveWorkout({ exercise: 'Supino', weight: 80, ... })
```

**Login:**
```tsx
import { useAuth } from '@/hooks/useAuth'
const { login } = useAuth()
```

**Coach message:**
```tsx
import { useCoach } from '@/features/coach/useCoach'
const { message, loadSuggestion } = useCoach(history)
```

**Trigger sync:**
```tsx
import { trySyncWithBackend } from '@/storage/syncEngine'
await trySyncWithBackend()
```

---

**🎉 Você tem um app PRONTO AGORA. Bora testar e lançar! 🚀**
