import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AnimatedToast, AppCard, AppInput, PrimaryButton } from '../components/ui';
import { getOrCreateUserIdentity, saveUserIdentity } from '../services/appIdentityService';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { colors, spacing } from '../theme';

export default function RegisterScreen({ navigation }) {
  const { setUser } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const handleRegister = async () => {
    const safeName = String(name || '').trim();
    const safeEmail = String(email || '').trim().toLowerCase();

    if (!safeName) {
      setToast('Informe seu nome para continuar.');
      return;
    }

    if (safeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      setToast('E-mail inválido. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    try {
      const identity = await getOrCreateUserIdentity();
      await saveUserIdentity({ userId: identity.userId, source: 'local' });
      setQaRuntimeAuth({ userId: identity.userId });

      setUser({
        id: identity.userId,
        role: 'user',
        name: safeName,
        email: safeEmail || null,
      });

      navigation.replace('Questionario');
    } catch {
      setToast('Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedToast message={toast} onHide={() => setToast('')} />

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>⚡</Text>
            </View>
            <Text style={styles.heroTitle}>Bem-vindo ao Evolução</Text>
            <Text style={styles.heroSubtitle}>
              Seu treinador pessoal com IA. Treinos, nutrição e progresso — tudo em um lugar.
            </Text>
          </View>

          {/* Benefícios */}
          <View style={styles.benefitsRow}>
            {[
              { icon: '💪', text: 'Treinos personalizados' },
              { icon: '🍗', text: 'Controle de nutrição' },
              { icon: '📈', text: 'Progresso em tempo real' },
            ].map((item) => (
              <View key={item.text} style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>{item.icon}</Text>
                <Text style={styles.benefitText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Form */}
          <AppCard style={styles.card}>
            <Text style={styles.cardTitle}>Criar minha conta</Text>

            <AppInput
              label="Seu nome"
              value={name}
              onChangeText={setName}
              placeholder="Como gostaria de ser chamado?"
              autoCapitalize="words"
              autoFocus
            />

            <View style={styles.spacer} />

            <AppInput
              label="E-mail (opcional)"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </AppCard>

          <PrimaryButton
            title={loading ? 'Criando conta...' : 'Começar agora →'}
            onPress={handleRegister}
            style={styles.btn}
          />

          <Text style={styles.terms}>
            Seus dados são armazenados localmente no seu dispositivo.{'\n'}
            Nenhuma informação é compartilhada sem sua autorização.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoEmoji: {
    fontSize: 44,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
    gap: 8,
  },
  benefitItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  benefitIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  spacer: {
    height: spacing.sm,
  },
  btn: {
    marginTop: spacing.md,
  },
  terms: {
    marginTop: spacing.md,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
