import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { createMission, giveXP, removeXP } from '../services/adminService';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from '../data/exercises';
import { getLocal, setLocal } from '../storage/mmkv';
import { colors, spacing } from '../theme';
import { postToAvailableQaHost, setQaRuntimeAuth } from '../utils/qaTransport';
import { getFromAvailableQaHost } from '../utils/qaTransport';
import { clearObservabilitySnapshot, getObservabilitySnapshot } from '../core/observability';

const ADMIN_TOKEN_STORAGE_KEY = 'evolucao.admin.token.v1';
const ADMIN_LOCAL_UNLOCK_KEY = 'evolucao.admin.local.unlock.v1';
const ADMIN_LOCAL_EXERCISES_KEY = 'admin.local.exercises.v1';
const ADMIN_LOCAL_FOODS_KEY = 'admin.local.foods.v1';
const EQUIPMENT_OPTIONS = ['maquina', 'halter', 'barra', 'cabo', 'peso_corporal', 'corda'];
const FALLBACK_MUSCLE_GROUPS = {
  LEGS: 'legs',
  CHEST: 'chest',
  BACK: 'back',
  SHOULDERS: 'shoulders',
  BICEPS: 'biceps',
  TRICEPS: 'triceps',
  HAMSTRINGS: 'hamstrings',
  GLUTES: 'glutes',
  CALVES: 'calves',
  CORE: 'core',
};
const SAFE_MUSCLE_GROUPS = MUSCLE_GROUPS && typeof MUSCLE_GROUPS === 'object'
  ? MUSCLE_GROUPS
  : FALLBACK_MUSCLE_GROUPS;
const SAFE_MUSCLE_GROUP_LABELS = MUSCLE_GROUP_LABELS && typeof MUSCLE_GROUP_LABELS === 'object'
  ? MUSCLE_GROUP_LABELS
  : {
    chest: 'Peito',
    back: 'Costas',
    shoulders: 'Ombro',
    biceps: 'Biceps',
    triceps: 'Triceps',
    legs: 'Pernas (Quadriceps)',
    hamstrings: 'Posterior',
    glutes: 'Gluteo',
    calves: 'Panturrilha',
    core: 'Abdomen / Core',
  };

function loadLocalExercises() {
  const persisted = getLocal(ADMIN_LOCAL_EXERCISES_KEY);
  return Array.isArray(persisted) ? persisted : [];
}

function loadLocalFoods() {
  const persisted = getLocal(ADMIN_LOCAL_FOODS_KEY);
  return Array.isArray(persisted) ? persisted : [];
}

export default function AdminScreen() {
  const { user, setUser } = useApp();
  const insets = useSafeAreaInsets();
  const [adminUser, setAdminUser] = useState('admin');
  const [adminPass, setAdminPass] = useState('');
  const [userId, setUserId] = useState('');
  const [xp, setXP] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionReward, setMissionReward] = useState('50');
  const [authLoading, setAuthLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [localExerciseName, setLocalExerciseName] = useState('');
  const [localPrimaryMuscle, setLocalPrimaryMuscle] = useState(SAFE_MUSCLE_GROUPS.LEGS || 'legs');
  const [localEquipment, setLocalEquipment] = useState('maquina');
  const [localExercises, setLocalExercises] = useState(() => loadLocalExercises());
  const [localFoodName, setLocalFoodName] = useState('');
  const [localFoodPortion, setLocalFoodPortion] = useState('100g');
  const [localFoodKcal, setLocalFoodKcal] = useState('0');
  const [localFoodCarbs, setLocalFoodCarbs] = useState('0');
  const [localFoodProtein, setLocalFoodProtein] = useState('0');
  const [localFoodFats, setLocalFoodFats] = useState('0');
  const [localFoods, setLocalFoods] = useState(() => loadLocalFoods());
  const [accountTarget, setAccountTarget] = useState('');
  const [accountBlockReason, setAccountBlockReason] = useState('beta_access_control');
  const [adminUsers, setAdminUsers] = useState([]);
  const [bugLogs, setBugLogs] = useState([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [localAdminUnlocked, setLocalAdminUnlocked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const unlocked = String((await AsyncStorage.getItem(ADMIN_LOCAL_UNLOCK_KEY)) || '').trim() === '1';
        if (mounted) {
          setLocalAdminUnlocked(unlocked);
          if (unlocked) {
            setUser((prev) => ({ ...prev, role: 'admin' }));
          }
        }
      } catch {
        // Sem bloqueio de render por falha de storage.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setUser]);

  const ADMIN_EMAILS_LOCAL = ['thegamerbr411@gmail.com'];
  const isAdmin = useMemo(
    () => (
      localAdminUnlocked
      || user?.role === 'admin'
      || ADMIN_EMAILS_LOCAL.includes(String(user?.email || '').toLowerCase().trim())
    ),
    [localAdminUnlocked, user?.role, user?.email]
  );

  const persistLocalExercises = (nextExercises) => {
    setLocal(ADMIN_LOCAL_EXERCISES_KEY, nextExercises);
    setLocalExercises(nextExercises);
  };

  const persistLocalFoods = (nextFoods) => {
    setLocal(ADMIN_LOCAL_FOODS_KEY, nextFoods);
    setLocalFoods(nextFoods);
  };

  const handleCreateLocalExercise = () => {
    const safeName = String(localExerciseName || '').trim();
    if (!safeName) {
      setToastMessage('Informe o nome do exercicio local.');
      return;
    }

    const duplicate = localExercises.some((item) => String(item?.name || '').trim().toLowerCase() === safeName.toLowerCase());
    if (duplicate) {
      setToastMessage('Ja existe um exercicio local com esse nome.');
      return;
    }

    const nextExercise = {
      id: `local_${Date.now()}`,
      name: safeName,
      primaryMuscle: localPrimaryMuscle,
      equipment: localEquipment,
      secondaryMuscles: [],
      category: 'compound',
      movementPattern: '',
      createdAt: new Date().toISOString(),
      source: 'admin_local',
    };

    const nextExercises = [nextExercise, ...localExercises];
    persistLocalExercises(nextExercises);
    setLocalExerciseName('');
    setToastMessage(`Exercicio local criado: ${safeName}.`);
  };

  const handleCreateLocalFood = () => {
    const safeName = String(localFoodName || '').trim();
    if (!safeName) {
      setToastMessage('Informe o nome do alimento local.');
      return;
    }

    const duplicate = localFoods.some((item) => String(item?.nome || '').trim().toLowerCase() === safeName.toLowerCase());
    if (duplicate) {
      setToastMessage('Ja existe um alimento local com esse nome.');
      return;
    }

    const nextFood = {
      id: `local_food_${Date.now()}`,
      nome: safeName,
      aliases: [safeName.toLowerCase()],
      porcao: String(localFoodPortion || '100g').trim() || '100g',
      kcal: Math.max(0, Number(localFoodKcal || 0)),
      carbo: Math.max(0, Number(localFoodCarbs || 0)),
      prot: Math.max(0, Number(localFoodProtein || 0)),
      gord: Math.max(0, Number(localFoodFats || 0)),
      createdAt: new Date().toISOString(),
      source: 'admin_local',
    };

    const nextFoods = [nextFood, ...localFoods];
    persistLocalFoods(nextFoods);
    setLocalFoodName('');
    setLocalFoodPortion('100g');
    setLocalFoodKcal('0');
    setLocalFoodCarbs('0');
    setLocalFoodProtein('0');
    setLocalFoodFats('0');
    setToastMessage(`Alimento local criado: ${safeName}.`);
  };

  const handleExportAdminPack = async () => {
    if (!localExercises.length && !localFoods.length) {
      setToastMessage('Nao ha exercicios/alimentos locais para exportar.');
      return;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      app: 'evolucao_full_v2',
      exercises: localExercises.map(({ name, primaryMuscle, equipment }) => ({
        name,
        primaryMuscle,
        equipment,
      })),
      foods: localFoods.map(({ nome, aliases, porcao, kcal, carbo, prot, gord }) => ({
        nome,
        aliases: Array.isArray(aliases) ? aliases : [],
        porcao,
        kcal,
        carbo,
        prot,
        gord,
      })),
    };

    await Clipboard.setStringAsync(JSON.stringify(exportPayload, null, 2));
    setToastMessage(`Pacote copiado: ${localExercises.length} exercicio(s) e ${localFoods.length} alimento(s). Cole aqui no chat.`);
  };

  const handleExportNewExercisesJson = async () => {
    if (!localExercises.length) {
      setToastMessage('Nao ha novos exercicios locais para exportar.');
      return;
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      source: 'admin_local',
      count: localExercises.length,
      exercises: localExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        primaryMuscle: exercise.primaryMuscle,
        equipment: exercise.equipment,
        secondaryMuscles: Array.isArray(exercise.secondaryMuscles) ? exercise.secondaryMuscles : [],
        category: exercise.category || 'compound',
        movementPattern: exercise.movementPattern || '',
        createdAt: exercise.createdAt || null,
      })),
    };

    await Clipboard.setStringAsync(JSON.stringify(payload, null, 2));
    Alert.alert('Exportacao concluida', `${localExercises.length} exercicio(s) copiado(s) em JSON.`);
    setToastMessage('Novos exercicios copiados para a area de transferencia.');
  };

  const loadAdminUsers = async () => {
    const response = await getFromAvailableQaHost('/api/auth/admin/users');
    if (!response?.ok) {
      setToastMessage(`Falha ao carregar usuarios: ${response?.error || 'erro desconhecido'}`);
      return;
    }

    const users = Array.isArray(response?.data?.users) ? response.data.users : [];
    setAdminUsers(users);
    setToastMessage(`${users.length} usuario(s) carregado(s).`);
  };

  const getAccountPayload = () => {
    const raw = String(accountTarget || '').trim();
    if (!raw) return null;
    if (raw.includes('@')) {
      return { email: raw.toLowerCase() };
    }
    return { userId: raw };
  };

  const handleBlockAccount = async () => {
    const payload = getAccountPayload();
    if (!payload) {
      setToastMessage('Informe UID ou e-mail para bloquear.');
      return;
    }

    const response = await postToAvailableQaHost('/api/auth/admin/block', {
      ...payload,
      reason: String(accountBlockReason || '').trim() || 'blocked_by_admin',
    });

    if (!response?.ok) {
      setToastMessage(`Falha ao bloquear: ${response?.error || response?.data?.error || 'erro desconhecido'}`);
      return;
    }

    setToastMessage('Conta bloqueada com sucesso.');
    loadAdminUsers();
  };

  const handleUnblockAccount = async () => {
    const payload = getAccountPayload();
    if (!payload) {
      setToastMessage('Informe UID ou e-mail para desbloquear.');
      return;
    }

    const response = await postToAvailableQaHost('/api/auth/admin/unblock', payload);
    if (!response?.ok) {
      setToastMessage(`Falha ao desbloquear: ${response?.error || response?.data?.error || 'erro desconhecido'}`);
      return;
    }

    setToastMessage('Conta desbloqueada com sucesso.');
    loadAdminUsers();
  };

  const handleRevokeSession = async () => {
    const payload = getAccountPayload();
    if (!payload) {
      setToastMessage('Informe UID ou e-mail para revogar sessao.');
      return;
    }

    const response = await postToAvailableQaHost('/api/auth/admin/revoke-session', payload);
    if (!response?.ok) {
      setToastMessage(`Falha ao revogar sessao: ${response?.error || response?.data?.error || 'erro desconhecido'}`);
      return;
    }

    setToastMessage('Sessao revogada com sucesso.');
    loadAdminUsers();
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.screenWrapper} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardWrapper}>
          <ScrollView
            contentContainerStyle={[styles.container, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.lg) }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
            <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
            <ScreenHeader title="Admin" subtitle="Area restrita. Entre com credenciais de admin." />
            <Text style={styles.denied}>Acesso negado</Text>
            <AppCard>
          <Text style={styles.label}>Admin user</Text>
          <TextInput value={adminUser} onChangeText={setAdminUser} placeholder="admin" placeholderTextColor={colors.textSecondary} style={styles.input} />

          <Text style={styles.label}>Admin password</Text>
          <TextInput value={adminPass} secureTextEntry onChangeText={setAdminPass} placeholder="senha" placeholderTextColor={colors.textSecondary} style={styles.input} />

          <PrimaryButton
            title={authLoading ? 'Entrando...' : 'Entrar como admin'}
            onPress={async () => {
              if (authLoading) {
                return;
              }

              setAuthLoading(true);
              try {
                const response = await postToAvailableQaHost('/login', {
                  pass: String(adminPass || ''),
                  user: String(adminUser || ''),
                });

                const token = String(response?.data?.token || '').trim();
                if (!response?.ok || !token) {
                  setToastMessage(`Falha no login: ${response?.error || response?.data?.error || 'Credenciais invalidas ou admin nao configurado no Render.'}`);
                  return;
                }

                await AsyncStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
                setQaRuntimeAuth({ jwt: token });
                setUser((prev) => ({ ...prev, role: 'admin' }));
                setToastMessage('Acesso liberado. Sessao admin ativa neste dispositivo.');
              } catch (error) {
                setToastMessage(`Erro: ${String(error?.message || 'Falha ao autenticar admin.')}`);
              } finally {
                setAuthLoading(false);
              }
            }}
          />

          <SecondaryButton
            title="Usar token salvo"
            style={styles.secondary}
            onPress={async () => {
              const token = String((await AsyncStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)) || '').trim();
              if (!token) {
                setToastMessage('Sem sessao salva. Nao ha token admin salvo neste dispositivo.');
                return;
              }
              setQaRuntimeAuth({ jwt: token });
              setUser((prev) => ({ ...prev, role: 'admin' }));
              setToastMessage('Sessao restaurada. Token admin aplicado com sucesso.');
            }}
          />

          <SecondaryButton
            title="Entrar modo local"
            style={styles.secondary}
            onPress={async () => {
              await AsyncStorage.setItem(ADMIN_LOCAL_UNLOCK_KEY, '1');
              setLocalAdminUnlocked(true);
              setUser((prev) => ({ ...prev, role: 'admin' }));
              setToastMessage('Modo local habilitado. Configuracoes gerais liberadas neste dispositivo.');
            }}
          />
            </AppCard>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screenWrapper} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardWrapper}>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: Math.max(spacing.xl, insets.bottom + spacing.lg) }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
          <ScreenHeader title="Admin" subtitle="Controle de XP e missoes." />

      <AppCard>
        <Text style={styles.label}>Sessao local</Text>
        <Text style={styles.helperText}>
          Se as configuracoes sumirem, mantenha o modo local ativo neste dispositivo.
        </Text>
        <SecondaryButton
          title="Desativar modo local"
          style={styles.secondary}
          onPress={async () => {
            await AsyncStorage.removeItem(ADMIN_LOCAL_UNLOCK_KEY);
            setLocalAdminUnlocked(false);
            setToastMessage('Modo local desativado.');
          }}
        />
      </AppCard>

      <AppCard>
        <Text style={styles.label}>User ID</Text>
        <TextInput value={userId} onChangeText={setUserId} placeholder="User ID" placeholderTextColor={colors.textSecondary} style={styles.input} />

        <Text style={styles.label}>XP</Text>
        <TextInput value={xp} onChangeText={setXP} placeholder="XP" keyboardType="numeric" placeholderTextColor={colors.textSecondary} style={styles.input} />

        <PrimaryButton
          title="Dar XP"
          onPress={async () => {
            try {
              await giveXP(userId, Number(xp));
              setToastMessage('Sucesso. XP adicionado.');
            } catch (error) {
              setToastMessage('Erro. Falha ao dar XP.');
            }
          }}
        />

        <SecondaryButton
          title="Remover XP"
          onPress={async () => {
            try {
              await removeXP(userId, Number(xp));
              setToastMessage('Sucesso. XP removido.');
            } catch (error) {
              setToastMessage('Erro. Falha ao remover XP.');
            }
          }}
          style={styles.secondary}
        />
      </AppCard>

      <AppCard>
        <Text style={styles.label}>Nova missao</Text>
        <TextInput value={missionTitle} onChangeText={setMissionTitle} placeholder="Titulo" placeholderTextColor={colors.textSecondary} style={styles.input} />
        <TextInput value={missionReward} onChangeText={setMissionReward} placeholder="Recompensa XP" keyboardType="numeric" placeholderTextColor={colors.textSecondary} style={styles.input} />
        <PrimaryButton
          title="Criar missao local"
          onPress={() => {
            const mission = createMission(missionTitle, Number(missionReward));
            setToastMessage(`Missao criada: ${mission.title} (+${mission.rewardXP} XP)`);
          }}
        />
      </AppCard>

      <AppCard>
        <Text style={styles.label}>Criar exercicio local</Text>
        <TextInput
          value={localExerciseName}
          onChangeText={setLocalExerciseName}
          placeholder="Nome"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>Grupo muscular principal</Text>
        <View style={styles.optionWrap}>
          {Object.entries(SAFE_MUSCLE_GROUP_LABELS).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={[styles.optionChip, localPrimaryMuscle === value ? styles.optionChipActive : null]}
              onPress={() => setLocalPrimaryMuscle(value)}
            >
              <Text style={[styles.optionChipText, localPrimaryMuscle === value ? styles.optionChipTextActive : null]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Equipamento</Text>
        <View style={styles.optionWrap}>
          {EQUIPMENT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.optionChip, localEquipment === option ? styles.optionChipActive : null]}
              onPress={() => setLocalEquipment(option)}
            >
              <Text style={[styles.optionChipText, localEquipment === option ? styles.optionChipTextActive : null]}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryButton title="Criar Exercício Local" onPress={handleCreateLocalExercise} />

        <Text style={styles.helperText}>{localExercises.length} exercicio(s) local(is) prontos para exportacao.</Text>
        {localExercises.slice(0, 5).map((exercise) => (
          <View key={exercise.id} style={styles.localExerciseRow}>
            <Text style={styles.localExerciseName}>{exercise.name}</Text>
            <Text style={styles.localExerciseMeta}>
              {SAFE_MUSCLE_GROUP_LABELS[exercise.primaryMuscle] || exercise.primaryMuscle} • {exercise.equipment}
            </Text>
          </View>
        ))}
      </AppCard>

      <AppCard>
        <Text style={styles.label}>Criar alimento local</Text>
        <TextInput
          value={localFoodName}
          onChangeText={setLocalFoodName}
          placeholder="Nome do alimento"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={localFoodPortion}
          onChangeText={setLocalFoodPortion}
          placeholder="Porcao (ex: 100g)"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={localFoodKcal}
          onChangeText={setLocalFoodKcal}
          placeholder="Kcal"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={localFoodCarbs}
          onChangeText={setLocalFoodCarbs}
          placeholder="Carboidratos"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={localFoodProtein}
          onChangeText={setLocalFoodProtein}
          placeholder="Proteinas"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={localFoodFats}
          onChangeText={setLocalFoodFats}
          placeholder="Gorduras"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <PrimaryButton title="Criar Alimento Local" onPress={handleCreateLocalFood} />

        <Text style={styles.helperText}>{localFoods.length} alimento(s) local(is) prontos para exportacao.</Text>
        {localFoods.slice(0, 5).map((food) => (
          <View key={food.id} style={styles.localExerciseRow}>
            <Text style={styles.localExerciseName}>{food.nome}</Text>
            <Text style={styles.localExerciseMeta}>
              {food.porcao} • {food.kcal} kcal • C {food.carbo} / P {food.prot} / G {food.gord}
            </Text>
          </View>
        ))}
      </AppCard>

      <AppCard>
        <Text style={styles.label}>Exportar pacote para me enviar</Text>
        <Text style={styles.helperText}>Gera JSON com exercicios e alimentos locais e copia para a area de transferencia.</Text>
        <PrimaryButton title="Exportar Pacote Admin (JSON)" onPress={handleExportAdminPack} />
        <SecondaryButton title="Exportar Novos Exercicios (JSON)" onPress={handleExportNewExercisesJson} style={styles.secondary} />
      </AppCard>

      <AppCard>
        <Text style={styles.label}>Controle de acesso beta</Text>
        <Text style={styles.helperText}>Bloqueia conta por UID/e-mail, revoga sessao e impede novo acesso quando bloqueada.</Text>
        <TextInput
          value={accountTarget}
          onChangeText={setAccountTarget}
          placeholder="UID ou e-mail"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <TextInput
          value={accountBlockReason}
          onChangeText={setAccountBlockReason}
          placeholder="Motivo do bloqueio"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <PrimaryButton title="Bloquear conta" onPress={handleBlockAccount} />
        <SecondaryButton title="Desbloquear conta" style={styles.secondary} onPress={handleUnblockAccount} />
        <SecondaryButton title="Revogar sessao" style={styles.secondary} onPress={handleRevokeSession} />
        <SecondaryButton title="Atualizar lista de usuarios" style={styles.secondary} onPress={loadAdminUsers} />

        {adminUsers.slice(0, 8).map((item) => (
          <View key={String(item?.id || item?.email)} style={styles.localExerciseRow}>
            <Text style={styles.localExerciseName}>{item?.email || item?.id}</Text>
            <Text style={styles.localExerciseMeta}>
              {item?.active === false ? 'BLOQUEADO' : 'ATIVO'} • role {item?.role || 'user'}
            </Text>
            {item?.blockedReason ? <Text style={styles.localExerciseMeta}>motivo: {item.blockedReason}</Text> : null}
          </View>
        ))}
      </AppCard>

      <AppCard>
        <Text style={styles.label}>Logs de erros do app</Text>
        <Text style={styles.helperText}>
          Erros capturados em tempo real durante o uso do app. Util para diagnostico de bugs.
        </Text>
        <View style={styles.logsBtnRow}>
          <PrimaryButton
            title={logsLoaded ? 'Atualizar' : 'Carregar logs'}
            onPress={() => {
              const snapshot = getObservabilitySnapshot();
              const errs = Array.isArray(snapshot?.errors) ? [...snapshot.errors].reverse() : [];
              setBugLogs(errs);
              setLogsLoaded(true);
              setToastMessage(`${errs.length} log(s) carregado(s).`);
            }}
          />
          <SecondaryButton
            title="Copiar tudo"
            style={styles.secondary}
            onPress={async () => {
              if (!bugLogs.length) {
                setToastMessage('Nenhum log para copiar.');
                return;
              }
              const text = bugLogs
                .map((e, i) => {
                  const ts = e.timestamp ? new Date(e.timestamp).toLocaleString('pt-BR') : '?';
                  const screen = e.context?.screen || e.context?.action || '?';
                  return `[${i + 1}] ${ts} | ${screen}\n${e.message}\n${e.stack ? e.stack.split('\n').slice(0, 3).join('\n') : ''}`;
                })
                .join('\n\n---\n\n');
              await Clipboard.setStringAsync(text);
              setToastMessage('Logs copiados para area de transferencia.');
            }}
          />
          <SecondaryButton
            title="Limpar logs"
            style={styles.secondary}
            onPress={() => {
              clearObservabilitySnapshot();
              setBugLogs([]);
              setLogsLoaded(false);
              setToastMessage('Logs apagados.');
            }}
          />
        </View>

        {logsLoaded && bugLogs.length === 0 ? (
          <Text style={[styles.helperText, { color: '#4ade80', marginTop: spacing.md }]}>
            Nenhum erro registrado. App sem crashs detectados.
          </Text>
        ) : null}

        {bugLogs.slice(0, 30).map((err, i) => {
          const ts = err.timestamp ? new Date(err.timestamp).toLocaleString('pt-BR') : '?';
          const screen = err.context?.screen || err.context?.action || err.context?.source || '?';
          const severity = err.context?.severity || 'high';
          const severityColor = severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : severity === 'medium' ? '#eab308' : '#94a3b8';
          return (
            <View key={err.id || i} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <Text style={[styles.logSeverity, { color: severityColor }]}>{severity.toUpperCase()}</Text>
                <Text style={styles.logMeta}>{ts} • {screen}</Text>
              </View>
              <Text style={styles.logMessage} numberOfLines={3}>{err.message}</Text>
              {err.stack ? (
                <Text style={styles.logStack} numberOfLines={2}>
                  {err.stack.split('\n').slice(1, 3).join(' | ')}
                </Text>
              ) : null}
            </View>
          );
        })}

        {bugLogs.length > 30 ? (
          <Text style={styles.helperText}>+ {bugLogs.length - 30} logs anteriores (use "Copiar tudo" para ver).</Text>
        ) : null}
      </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardWrapper: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  denied: {
    color: '#FCA5A5',
    fontSize: 16,
    fontWeight: '800',
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  secondary: {
    marginTop: spacing.sm,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#141922',
  },
  optionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionChipText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  optionChipTextActive: {
    color: colors.textInverse,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  localExerciseRow: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  localExerciseName: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  localExerciseMeta: {
    color: colors.textSecondary,
    marginTop: 2,
    fontSize: 12,
  },
  logsBtnRow: {
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logEntry: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: spacing.sm,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  logSeverity: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logMeta: {
    color: '#64748b',
    fontSize: 11,
    flex: 1,
  },
  logMessage: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  logStack: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
