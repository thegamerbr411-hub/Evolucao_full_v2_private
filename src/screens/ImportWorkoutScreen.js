import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, AppInput, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';
import { EXERCISE_NAMES_V2 } from '../data/exerciseLibraryV2';

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseLine(rawLine = '') {
  const safeLine = String(rawLine || '').trim();
  const match = safeLine.match(/(\d{1,2})\s*(x|de)\s*(\d{1,3})/i);
  const sets = match ? Math.max(1, Number(match[1] || 3)) : 3;
  const reps = match ? String(Number(match[3] || 10)) : '10';
  const cleanName = safeLine
    .replace(/(\d{1,2})\s*(x|de)\s*(\d{1,3})/i, '')
    .replace(/[-*•]+/g, ' ')
    .trim();
  return { raw: safeLine, candidateName: cleanName, sets, reps };
}

function buildSets(sets = 3, reps = '10') {
  const safeSets = Math.max(1, Math.min(12, Number(sets || 3)));
  return Array.from({ length: safeSets }).map(() => ({ reps: String(reps || '10'), weight: '', done: false }));
}

function getSuggestions(name = '', catalog = []) {
  const source = normalize(name);
  if (!source) {
    return [];
  }
  return catalog
    .filter((entry) => {
      const target = normalize(entry);
      return target.includes(source) || source.includes(target);
    })
    .slice(0, 6);
}

export default function ImportWorkoutScreen({ navigation }) {
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState({ type: 'idle', text: '' });
  const [previewItems, setPreviewItems] = useState([]);
  const [manualOverrides, setManualOverrides] = useState({});
  const { setWorkout } = useApp();

  const catalog = useMemo(() => Array.from(new Set(EXERCISE_NAMES_V2 || [])), []);
  const catalogIndex = useMemo(() => {
    const map = new Map();
    catalog.forEach((name) => {
      const key = normalize(name);
      if (key && !map.has(key)) {
        map.set(key, name);
      }
    });
    return map;
  }, [catalog]);

  const unresolvedCount = previewItems.filter((item, index) => {
    const override = manualOverrides[index];
    const resolved = override || item.matchedName;
    return !resolved;
  }).length;
  const canConfirmImport = previewItems.length > 0 && unresolvedCount === 0;

  const runPreview = () => {
    const lines = String(input || '')
      .split('\n')
      .map((line) => line.replace(/^[-*•\s]+/, '').trim())
      .filter(Boolean);

    if (!lines.length) {
      setPreviewItems([]);
      setFeedback({ type: 'error', text: 'Cole o treino em texto para analisar.' });
      return;
    }

    const nextPreview = lines.map((line) => {
      const parsed = parseLine(line);
      const exact = catalogIndex.get(normalize(parsed.candidateName)) || '';
      return {
        ...parsed,
        matchedName: exact,
        suggestions: exact ? [] : getSuggestions(parsed.candidateName, catalog),
      };
    });

    setPreviewItems(nextPreview);
    setManualOverrides({});

    const missing = nextPreview.filter((item) => !item.matchedName).length;
    if (missing > 0) {
      setFeedback({
        type: 'error',
        text: `${missing} exercicio(s) precisam de revisao antes de salvar.`,
      });
      return;
    }

    setFeedback({
      type: 'success',
      text: `Preview pronto com ${nextPreview.length} exercicio(s) validos.`,
    });
  };

  const handleConfirmImport = () => {
    if (!previewItems.length) {
      setFeedback({
        type: 'error',
        text: 'Gere o preview antes de confirmar.',
      });
      return;
    }

    if (!canConfirmImport) {
      setFeedback({
        type: 'error',
        text: 'Revise todos os exercicios pendentes antes de salvar.',
      });
      return;
    }

    const exercises = [];
    for (let index = 0; index < previewItems.length; index += 1) {
      const item = previewItems[index];
      const override = String(manualOverrides[index] || '').trim();
      const exactOverride = override ? catalogIndex.get(normalize(override)) : '';
      const resolvedName = exactOverride || item.matchedName;
      if (!resolvedName) {
        setFeedback({
          type: 'error',
          text: `Revise o item ${index + 1}. Nao permitimos substituicao silenciosa.`,
        });
        return;
      }

      exercises.push({
        name: resolvedName,
        sets: buildSets(item.sets, item.reps),
      });
    }

    setWorkout({ name: 'Treino importado', exercises });
    setFeedback({ type: 'success', text: `Treino confirmado com ${exercises.length} exercicio(s).` });
    navigation.navigate('Workout');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Importar treino" subtitle="Cole texto livre e converta para treino estruturado." />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <AppCard>
          <Text style={styles.label}>Entrada de treino</Text>
          <TextInput
            placeholder="Supino Reto 4x10\nLeg Press 4x12"
            placeholderTextColor={colors.textSecondary}
            value={input}
            onChangeText={setInput}
            multiline
            style={styles.input}
          />
          {feedback.text ? (
            <Text style={[styles.feedbackText, feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
              {feedback.text}
            </Text>
          ) : null}
          <PrimaryButton title="1. Gerar preview" onPress={runPreview} />
        </AppCard>

        {previewItems.length ? (
          <AppCard style={styles.previewCard}>
            <Text style={styles.label}>2. Revisar antes de salvar</Text>
            <Text style={styles.reviewSummary}>
              {unresolvedCount > 0
                ? `${unresolvedCount} item(ns) ainda precisam de correcao manual.`
                : 'Todos os itens foram validados. Agora voce pode confirmar com seguranca.'}
            </Text>
            {previewItems.map((item, index) => {
              const override = String(manualOverrides[index] || '');
              const hasResolved = Boolean(item.matchedName || catalogIndex.get(normalize(override)));
              return (
                <View key={`${item.raw}-${index}`} style={[styles.previewItem, !hasResolved ? styles.previewItemError : null]}>
                  <Text style={styles.previewRaw}>{index + 1}. {item.raw}</Text>
                  {item.matchedName ? (
                    <Text style={styles.previewResolved}>Match exato: {item.matchedName}</Text>
                  ) : (
                    <>
                      <Text style={styles.previewWarning}>Nao encontrado. Escolha manualmente:</Text>
                      <AppInput
                        value={override}
                        onChangeText={(value) => setManualOverrides((prev) => ({ ...prev, [index]: value }))}
                        placeholder="Digite nome exato do catalogo"
                        autoCapitalize="words"
                      />
                      <View style={styles.suggestionWrap}>
                        {item.suggestions.map((suggestion) => (
                          <TouchableOpacity
                            key={`${index}-${suggestion}`}
                            style={styles.suggestionChip}
                            onPress={() => setManualOverrides((prev) => ({ ...prev, [index]: suggestion }))}
                          >
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}
                </View>
              );
            })}

            <PrimaryButton
              title="3. Confirmar e salvar"
              onPress={handleConfirmImport}
              style={[styles.confirmButton, !canConfirmImport ? styles.confirmButtonDisabled : null]}
            />
            {unresolvedCount > 0 ? (
              <Text style={styles.reviewHint}>Faltam {unresolvedCount} item(ns) para revisar.</Text>
            ) : null}
          </AppCard>
        ) : null}

        <SecondaryButton title="Voltar" onPress={() => navigation.goBack()} style={styles.secondary} />
      </ScrollView>
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
  scrollContent: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  secondary: {
    marginTop: spacing.sm,
  },
  previewCard: {
    marginTop: spacing.sm,
  },
  previewItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: 6,
  },
  previewItemError: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerMuted,
  },
  previewRaw: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  previewResolved: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  previewWarning: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmButton: {
    marginTop: spacing.xs,
  },
  confirmButtonDisabled: {
    opacity: 0.55,
  },
  reviewHint: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewSummary: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  feedbackError: {
    color: colors.warning,
  },
  feedbackSuccess: {
    color: colors.success,
  },
});
