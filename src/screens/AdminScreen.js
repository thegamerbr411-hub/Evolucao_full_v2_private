import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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

const ADMIN_TOKEN_STORAGE_KEY = 'evolucao.admin.token.v1';
const ADMIN_LOCAL_EXERCISES_KEY = 'admin.local.exercises.v1';
const ADMIN_LOCAL_FOODS_KEY = 'admin.local.foods.v1';
const EQUIPMENT_OPTIONS = ['maquina', 'halter', 'barra', 'cabo', 'peso_corporal', 'corda'];

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
  const [localPrimaryMuscle, setLocalPrimaryMuscle] = useState(MUSCLE_GROUPS.LEGS);
  const [localEquipment, setLocalEquipment] = useState('maquina');
  const [localExercises, setLocalExercises] = useState(() => loadLocalExercises());
  const [localFoodName, setLocalFoodName] = useState('');
  const [localFoodPortion, setLocalFoodPortion] = useState('100g');
  const [localFoodKcal, setLocalFoodKcal] = useState('0');
  const [localFoodCarbs, setLocalFoodCarbs] = useState('0');
  const [localFoodProtein, setLocalFoodProtein] = useState('0');
  const [localFoodFats, setLocalFoodFats] = useState('0');
  const [localFoods, setLocalFoods] = useState(() => loadLocalFoods());

  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

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
          {Object.entries(MUSCLE_GROUP_LABELS).map(([value, label]) => (
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
              {MUSCLE_GROUP_LABELS[exercise.primaryMuscle] || exercise.primaryMuscle} • {exercise.equipment}
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
});
