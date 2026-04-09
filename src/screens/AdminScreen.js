import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { createMission, giveXP, removeXP } from '../services/adminService';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

export default function AdminScreen() {
  const { user } = useApp();
  const [userId, setUserId] = useState('');
  const [xp, setXP] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionReward, setMissionReward] = useState('50');

  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Admin" subtitle="Area restrita." />
        <Text style={styles.denied}>Acesso negado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
              Alert.alert('Sucesso', 'XP adicionado.');
            } catch (error) {
              Alert.alert('Erro', 'Falha ao dar XP.');
            }
          }}
        />

        <SecondaryButton
          title="Remover XP"
          onPress={async () => {
            try {
              await removeXP(userId, Number(xp));
              Alert.alert('Sucesso', 'XP removido.');
            } catch (error) {
              Alert.alert('Erro', 'Falha ao remover XP.');
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
            Alert.alert('Missao criada', `${mission.title} (+${mission.rewardXP} XP)`);
          }}
        />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
