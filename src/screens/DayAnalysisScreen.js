import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

function statusColor(status) {
  if (status === 'ok') {
    return '#2A9E66';
  }

  if (status === 'alto') {
    return '#C57D00';
  }

  return '#C14343';
}

function MacroBar({ label, consumed, target, status }) {
  const ratio = target ? Math.max(0, Math.min(1, consumed / target)) : 0;

  return (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroValue}>{consumed}g / {target}g</Text>
      </View>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: statusColor(status) }]} />
      </View>
      <Text style={[styles.macroStatus, { color: statusColor(status) }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

function humanMacroFeedback(macroInsight) {
  if (!macroInsight?.status) {
    return '';
  }

  const parts = [];
  if (macroInsight.status.protein === 'baixo') {
    parts.push('⚠️ Proteina baixa: isso pode prejudicar sua recuperacao muscular.');
  }
  if (macroInsight.status.carbs === 'baixo') {
    parts.push('⚠️ Carbo baixo: sua energia para treinar pode cair.');
  }
  if (macroInsight.status.fats === 'alto') {
    parts.push('⚠️ Gordura alta: pode estar estourando suas calorias do dia.');
  }

  if (!parts.length) {
    parts.push('✅ Macros equilibrados hoje. Continue nessa consistencia.');
  }

  return parts.join('\n');
}

export default function DayAnalysisScreen({ route }) {
  const { plan, analyzeDay, getDailyMacroTargets } = useApp();
  const params = route?.params || {};
  const [consumedCalories, setConsumedCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [trainedToday, setTrainedToday] = useState(false);
  const [insight, setInsight] = useState(null);

  const targetCalories = useMemo(() => plan?.caloriesPerDay ?? 0, [plan]);
  const macroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);

  React.useEffect(() => {
    if (params.prefillCalories) {
      setConsumedCalories(String(params.prefillCalories));
    }
    if (params.prefillProtein) {
      setProtein(String(params.prefillProtein));
    }
    if (params.prefillCarbs) {
      setCarbs(String(params.prefillCarbs));
    }
    if (params.prefillFats) {
      setFats(String(params.prefillFats));
    }
  }, [params.prefillCalories, params.prefillProtein, params.prefillCarbs, params.prefillFats]);

  const handleAnalyze = () => {
    const result = analyzeDay({
      consumedCalories: Number(consumedCalories),
      protein: Number(protein),
      carbs: Number(carbs),
      fats: Number(fats),
      trainedToday,
    });
    setInsight(result);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>IA Analisando Seu Dia</Text>
      <Text style={styles.subtitle}>Receba uma recomendacao rapida com base no seu plano.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Meta de calorias</Text>
        <Text style={styles.bigNumber}>{targetCalories ? `${targetCalories} kcal` : '-'}</Text>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Calorias consumidas hoje</Text>
        <TextInput
          keyboardType="numeric"
          value={consumedCalories}
          onChangeText={setConsumedCalories}
          placeholder="Ex: 1850"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Proteina consumida (g)</Text>
        <TextInput
          keyboardType="numeric"
          value={protein}
          onChangeText={setProtein}
          placeholder="Ex: 130"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Carboidrato consumido (g)</Text>
        <TextInput
          keyboardType="numeric"
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Ex: 220"
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Gordura consumida (g)</Text>
        <TextInput
          keyboardType="numeric"
          value={fats}
          onChangeText={setFats}
          placeholder="Ex: 65"
          style={styles.input}
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Treinou hoje?</Text>
        <Switch value={trainedToday} onValueChange={setTrainedToday} />
      </View>

      <TouchableOpacity style={styles.button} onPress={handleAnalyze}>
        <Text style={styles.buttonText}>Analisar meu dia</Text>
      </TouchableOpacity>

      {insight ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Diagnostico IA</Text>
          <Text style={styles.resultMessage}>{insight.message}</Text>
          <Text style={styles.resultSubTitle}>Analise de macros</Text>
          <MacroBar
            label="Proteina"
            consumed={Number(protein || 0)}
            target={insight?.macroTargets?.protein || macroTargets.protein}
            status={insight?.macroInsight?.status?.protein || 'baixo'}
          />
          <MacroBar
            label="Carbo"
            consumed={Number(carbs || 0)}
            target={insight?.macroTargets?.carbs || macroTargets.carbs}
            status={insight?.macroInsight?.status?.carbs || 'baixo'}
          />
          <MacroBar
            label="Gordura"
            consumed={Number(fats || 0)}
            target={insight?.macroTargets?.fats || macroTargets.fats}
            status={insight?.macroInsight?.status?.fats || 'baixo'}
          />
          <Text style={styles.macroFeedback}>{insight?.macroInsight?.message}</Text>
          <Text style={styles.macroCoachFeedback}>{humanMacroFeedback(insight?.macroInsight)}</Text>
          <Text style={styles.autoSaved}>Analise salva automaticamente no historico.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F8FC',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#121826',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: '#495268',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    color: '#4A5267',
    marginBottom: 6,
  },
  bigNumber: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0C1A38',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3346',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C9D2E4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  row: {
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#111C3D',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  resultCard: {
    marginTop: 16,
    backgroundColor: '#EAF2FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B9CFFF',
    padding: 14,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#12387D',
    marginBottom: 6,
  },
  resultMessage: {
    color: '#1B2C54',
    fontSize: 14,
    lineHeight: 20,
  },
  autoSaved: {
    marginTop: 10,
    color: '#2C4E9B',
    fontSize: 12,
    fontWeight: '600',
  },
  resultSubTitle: {
    marginTop: 10,
    fontSize: 13,
    color: '#12387D',
    fontWeight: '800',
  },
  macroRow: {
    marginTop: 8,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  macroLabel: {
    color: '#1B2C54',
    fontWeight: '700',
  },
  macroValue: {
    color: '#35508A',
    fontSize: 12,
    fontWeight: '700',
  },
  macroTrack: {
    height: 8,
    backgroundColor: '#C8D6F2',
    borderRadius: 999,
    overflow: 'hidden',
  },
  macroFill: {
    height: 8,
  },
  macroStatus: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '800',
  },
  macroFeedback: {
    marginTop: 8,
    color: '#173262',
    fontSize: 13,
    lineHeight: 18,
  },
  macroCoachFeedback: {
    marginTop: 8,
    color: '#10386D',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
});
