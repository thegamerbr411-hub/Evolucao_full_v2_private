import React, { useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';

const STATUS_COLOR = {
  ok: '#2A9E66',
  baixo: '#C14343',
  alto: '#C57D00',
};

function classifyColor(status) {
  return STATUS_COLOR[status] ?? '#4A6080';
}

function MacroPill({ label, status }) {
  const color = classifyColor(status);
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: color + '22' }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

function AvgCard({ label, value, unit, target, status }) {
  const color = classifyColor(status);
  const pct = target > 0 ? Math.min(Math.round((value / target) * 100), 200) : 0;
  const barWidth = Math.min(pct, 100);
  return (
    <View style={styles.avgCard}>
      <Text style={styles.avgLabel}>{label}</Text>
      <Text style={[styles.avgValue, { color }]}>
        {value}
        <Text style={styles.avgUnit}>{unit}</Text>
      </Text>
      <Text style={styles.avgTarget}>meta: {target}{unit}</Text>
      <View style={styles.avgBarBg}>
        <View style={[styles.avgBarFill, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.avgPct, { color }]}>{pct}%</Text>
    </View>
  );
}

function DayRow({ item, isLast }) {
  const dateParts = item.date ? item.date.slice(5) : '??-??';
  return (
    <View style={[styles.dayRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={styles.dayLeft}>
        <Text style={styles.dayDate}>{dateParts}</Text>
        <Text style={styles.dayTrained}>{item.trained ? '🏋️' : '  —'}</Text>
      </View>
      <View style={styles.dayPills}>
        <MacroPill label={`P ${item.protein}g`} status={item.proteinStatus} />
        <MacroPill label={`C ${item.carbs}g`} status={item.carbStatus} />
        <MacroPill label={`G ${item.fats}g`} status={item.fatStatus} />
      </View>
      <Text style={styles.dayKcal}>{item.calories} kcal</Text>
    </View>
  );
}

export default function WeeklyMacroScreen({ navigation }) {
  const { getWeeklyMacroSummary, hasFeatureAccess } = useApp();

  if (!hasFeatureAccess('weekly_macros')) {
    return (
      <View style={[styles.container, styles.lockContainer]}>
        <Text style={styles.title}>Macros da Semana</Text>
        <Text style={styles.emptyText}>Esse recurso faz parte do Evolucao PRO.</Text>
        <TouchableOpacity
          style={styles.unlockButton}
          onPress={() => navigation.replace('Paywall', { featureKey: 'weekly_macros', source: 'weekly_macro_screen' })}
        >
          <Text style={styles.unlockButtonText}>Desbloquear PRO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const summary = useMemo(() => getWeeklyMacroSummary(), [getWeeklyMacroSummary]);

  const {
    days,
    avgProtein,
    avgCarbs,
    avgFats,
    avgCalories,
    trainedDays,
    lowProteinDays,
    macroTargets,
    insight,
    analyzedDays,
  } = summary;

  function macroStatus(avg, target) {
    if (!target) return 'ok';
    const ratio = avg / target;
    if (ratio < 0.8) return 'baixo';
    if (ratio > 1.2) return 'alto';
    return 'ok';
  }

  const proteinStatus = macroStatus(avgProtein, macroTargets?.protein);
  const carbStatus = macroStatus(avgCarbs, macroTargets?.carbs);
  const fatStatus = macroStatus(avgFats, macroTargets?.fats);

  const proteinTarget = macroTargets ? Math.round(macroTargets.protein) : 0;
  const carbTarget = macroTargets ? Math.round(macroTargets.carbs) : 0;
  const fatTarget = macroTargets ? Math.round(macroTargets.fats) : 0;
  const calTarget = macroTargets ? Math.round(macroTargets.calories) : 0;

  const hasData = days && days.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Macros da Semana</Text>

      {!hasData ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Nenhum dia registrado ainda.{'\n'}Analise seu dia para ver o resumo semanal aqui.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{analyzedDays}</Text>
              <Text style={styles.statLbl}>dias</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statNum}>{trainedDays}</Text>
              <Text style={styles.statLbl}>treinos</Text>
            </View>
            <View style={[styles.statChip, lowProteinDays > 0 && styles.statChipWarn]}>
              <Text style={[styles.statNum, lowProteinDays > 0 && styles.statNumWarn]}>
                {lowProteinDays}
              </Text>
              <Text style={styles.statLbl}>prot. baixa</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Médias dos últimos 7 dias</Text>

          <View style={styles.avgRow}>
            <AvgCard
              label="Calorias"
              value={avgCalories}
              unit=" kcal"
              target={calTarget}
              status={macroStatus(avgCalories, calTarget)}
            />
            <AvgCard
              label="Proteína"
              value={avgProtein}
              unit="g"
              target={proteinTarget}
              status={proteinStatus}
            />
          </View>
          <View style={styles.avgRow}>
            <AvgCard
              label="Carbo"
              value={avgCarbs}
              unit="g"
              target={carbTarget}
              status={carbStatus}
            />
            <AvgCard
              label="Gordura"
              value={avgFats}
              unit="g"
              target={fatTarget}
              status={fatStatus}
            />
          </View>

          <Text style={styles.sectionTitle}>Registro por dia</Text>
          <View style={styles.daysCard}>
            {days.map((item, idx) => (
              <DayRow key={item.date} item={item} isLast={idx === days.length - 1} />
            ))}
          </View>

          <Text style={styles.sectionTitle}>IA — nutrição × treino</Text>
          <View style={styles.insightCard}>
            <Text style={styles.insightIcon}>🧠</Text>
            <Text style={styles.insightText}>{insight}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const DARK = '#0F172A';
const CARD = '#1E293B';
const BORDER = '#2E3F58';
const TEXT = '#E2E8F0';
const MUTED = '#94A3B8';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 12,
  },
  backText: {
    color: '#60A5FA',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    marginTop: 12,
  },
  statChip: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statChipWarn: {
    borderColor: '#C14343',
    backgroundColor: '#321A1A',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
  },
  statNumWarn: {
    color: '#F87171',
  },
  statLbl: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  avgRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  avgCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avgLabel: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 4,
    fontWeight: '600',
  },
  avgValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  avgUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
  avgTarget: {
    fontSize: 11,
    color: MUTED,
    marginTop: 2,
    marginBottom: 8,
  },
  avgBarBg: {
    height: 4,
    backgroundColor: '#2E3F58',
    borderRadius: 4,
    overflow: 'hidden',
  },
  avgBarFill: {
    height: 4,
    borderRadius: 4,
  },
  avgPct: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  daysCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
    overflow: 'hidden',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 8,
  },
  dayLeft: {
    width: 54,
    alignItems: 'center',
  },
  dayDate: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT,
  },
  dayTrained: {
    fontSize: 14,
    marginTop: 2,
  },
  dayPills: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dayKcal: {
    fontSize: 11,
    color: MUTED,
    textAlign: 'right',
    minWidth: 62,
  },
  insightCard: {
    backgroundColor: '#172033',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2B4A6F',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  insightIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 20,
    alignItems: 'center',
  },
  lockContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 56,
  },
  unlockButton: {
    marginTop: 14,
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  unlockButtonText: {
    color: '#E2ECFF',
    fontWeight: '800',
  },
  emptyText: {
    color: MUTED,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
  },
});
