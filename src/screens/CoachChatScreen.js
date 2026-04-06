import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

const COACH_MEMORY_KEY = 'coach.memory.v1';
const TRIGGER_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function getMessageVariant(options, seed) {
  if (!options.length) {
    return '';
  }
  return options[Math.abs(seed) % options.length];
}

function detectIntents(message) {
  const text = String(message || '').toLowerCase();
  const intents = [];

  const pushIntent = (intent) => {
    if (!intents.includes(intent)) {
      intents.push(intent);
    }
  };

  if (text.includes('madrugada') || text.includes('treinei tarde') || text.includes('treinei de madrugada')) {
    pushIntent('late_workout');
  }
  if (text.includes('nao consegui treinar') || text.includes('não consegui treinar') || text.includes('nao treinei')) {
    pushIntent('missed_workout');
  }
  if (text.includes('comi ') || text.includes('comi') || text.includes('pao') || text.includes('pão') || text.includes('ovo') || text.includes('proteina') || text.includes('proteína') || text.includes('comida') || text.includes('refeicao') || text.includes('refeição')) {
    pushIntent('nutrition');
  }
  if (text.includes('bebi pouca') || text.includes('bebi pouco') || text.includes('agua') || text.includes('água') || text.includes('hidrat')) {
    pushIntent('hydration');
  }
  if (text.includes('me monta uma rotina') || text.includes('monta rotina') || text.includes('rotina') || text.includes('semana') || text.includes('planejar') || text.includes('planejamento')) {
    pushIntent('routine');
  }
  if (text.includes('treino') || text.includes('carga') || text.includes('exercicio') || text.includes('exercício')) {
    pushIntent('training');
  }

  if (!intents.length) {
    pushIntent('general');
  }

  return intents;
}

function getDayPeriod() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'morning';
  }
  if (hour < 18) {
    return 'afternoon';
  }
  return 'night';
}

function getTransitionMessage(lastIntent, currentIntent, context) {
  if (lastIntent === 'missed_workout' && currentIntent === 'nutrition') {
    return `Ja que voce nao treinou hoje, capricha na proteina agora. Faltam ${Math.max(0, context.proteinTarget - context.proteinToday)}g para fechar melhor o dia.`;
  }

  if (lastIntent === 'nutrition' && currentIntent === 'training') {
    return 'Boa sequencia. Nutriu e agora o treino rende mais. Vamos para um bloco objetivo de treino.';
  }

  if (lastIntent === 'hydration' && currentIntent === 'training') {
    return 'Hidratacao alinhada ajuda performance. Agora vale iniciar o treino principal.';
  }

  return '';
}

function getCoachMultiIntentReply(intents, context) {
  const done = [];
  const missing = [];
  const next = [];

  if (intents.includes('training') || intents.includes('late_workout')) {
    done.push(context.trainedToday ? 'Voce ja treinou hoje.' : 'Treino de hoje ainda nao foi concluido.');
    if (!context.trainedToday) {
      missing.push(`Semana em ${context.smart.trainedThisWeek}/${context.smart.weeklyTarget}.`);
      next.push('Faca um treino curto agora para nao acumular.');
    }
  }

  if (intents.includes('nutrition')) {
    const proteinGap = Math.max(0, context.proteinTarget - context.proteinToday);
    done.push(`Proteina atual: ${context.proteinToday}g.`);
    if (proteinGap > 0) {
      missing.push(`Faltam ${proteinGap}g de proteina.`);
      next.push('Coloque uma refeicao proteica ainda hoje.');
    }
  }

  if (intents.includes('hydration')) {
    const waterGap = Math.max(0, context.waterTarget - context.waterToday);
    done.push(`Agua atual: ${context.waterToday}ml.`);
    if (waterGap > 0) {
      missing.push(`Faltam ${waterGap}ml de agua.`);
      next.push('Beba +300ml agora e repita no proximo bloco do dia.');
    }
  }

  if (intents.includes('routine')) {
    missing.push('Rotina da semana precisa de execucao consistente.');
    next.push('Defina os proximos 2 treinos e cumpra em dias alternados.');
  }

  const doneText = done.length ? done.join(' ') : 'Voce ja comecou bem hoje.';
  const missingText = missing.length ? missing.join(' ') : 'Nada critico pendente no momento.';
  const nextText = next.length ? next[0] : 'Mantenha o plano atual e execute o proximo bloco.';

  return `Ja foi feito: ${doneText} Falta: ${missingText} Agora: ${nextText}`;
}

function getCoachReply(message, context, turnIndex, memory) {
  const intents = detectIntents(message);
  const intent = intents[0];
  const seed = String(message || '').length + turnIndex;
  const transitionText = getTransitionMessage(memory.lastUserIntent, intent, context);

  if (transitionText) {
    return transitionText;
  }

  if (intents.length > 1) {
    return getCoachMultiIntentReply(intents, context);
  }

  if (intent === 'missed_workout') {
    const intro = getMessageVariant([
      'Acontece. O importante e proteger a consistencia da semana.',
      'Sem drama. Um dia ruim nao precisa virar semana ruim.',
      'Tranquilo, a gente corrige sem exagerar no volume.'
    ], seed);
    return `${intro} Hoje voce esta em ${context.smart.trainedThisWeek}/${context.smart.weeklyTarget} treinos na semana. ${context.smart.isBehindWeek ? 'Minha sugestao: treino curto de 20-30min hoje para nao ficar para tras.' : 'Voce ainda esta no ritmo. Podemos fazer mobilidade ou treino leve.'}`;
  }

  if (intent === 'late_workout') {
    const intro = getMessageVariant([
      'Boa disciplina. Treinar de madrugada conta e muito.',
      'Excelente compromisso. Mesmo fora do horario padrao, treino feito vale.',
      'Mandou bem em manter consistencia ate de madrugada.'
    ], seed);
    return `${intro} Hoje priorize recuperacao: agua, refeicao proteica e sono de qualidade para consolidar o treino.`;
  }

  if (intent === 'nutrition') {
    const intro = getMessageVariant([
      'Boa, vamos direto no que fecha sua meta.',
      'Perfeito, vamos otimizar sua proxima refeicao.',
      'Fechou, foco em nutricao inteligente agora.'
    ], seed);
    const proteinGap = Math.max(0, context.proteinTarget - context.proteinToday);
    const weakMealsHint = context.weakMeals > 0 ? `Voce teve ${context.weakMeals} refeicoes fracas em proteina hoje.` : 'Suas refeicoes estao em boa direcao.';
    return `${intro} Hoje voce esta com ${context.proteinToday}/${context.proteinTarget}g de proteina. ${weakMealsHint} ${proteinGap > 0 ? `Faltam ${proteinGap}g - sugiro 1 fonte forte agora (frango, ovos ou whey).` : 'Meta batida. Mantenha esse padrao no jantar.'}`;
  }

  if (intent === 'hydration') {
    const intro = getMessageVariant([
      'Hidratacao mexe direto com performance no treino.',
      'Boa chamada, agua muda energia e recuperacao.',
      'Excelente ponto, vamos ajustar isso rapido.'
    ], seed);
    const gap = Math.max(0, context.waterTarget - context.waterToday);
    return `${intro} Seu status agora: ${context.waterToday}/${context.waterTarget}ml. ${gap > 0 ? `Faltam ${gap}ml. Faz +300ml agora e mais +300ml no proximo bloco do dia.` : 'Meta de agua batida. So manter.'}`;
  }

  if (intent === 'routine') {
    const intro = getMessageVariant([
      'Vamos montar uma semana que voce consiga cumprir.',
      'Plano bom e plano executavel.',
      'Bora organizar sem sobrecarregar.'
    ], seed);
    return `${intro} Seu alvo atual e ${context.smart.weeklyTarget} treinos/semana e voce fez ${context.smart.trainedThisWeek}. ${context.smart.isBehindWeek ? 'Prioridade: 2 sessoes curtas nos proximos 3 dias.' : 'Prioridade: manter frequencia e aumentar qualidade das series.'}`;
  }

  if (intent === 'training') {
    const intro = getMessageVariant([
      'Treino bom e o que voce executa com consistencia.',
      'Vamos tornar seu treino de hoje objetivo.',
      'Perfeito, foco em decisao pratica de treino.'
    ], seed);
    return `${intro} Recomendacao atual: ${context.smart.title}. ${context.smart.justification} ${context.trainedToday ? 'Voce ja treinou hoje, entao foque em recuperacao e alimentacao.' : 'Se puder, inicia com os exercicios principais primeiro.'}`;
  }

  return getMessageVariant([
    `Voce ainda pode melhorar seu dia agora: treino, proteina ou rotina. Status de proteina: ${context.proteinToday}/${context.proteinTarget}g.`,
    `Hora de agir no proximo passo: treino, nutricao ou hidratacao. Agua atual: ${context.waterToday}/${context.waterTarget}ml.`,
    `Prioridade agora: treino do dia e depois fechar proteina. Semana em ${context.smart.trainedThisWeek}/${context.smart.weeklyTarget}.`
  ], seed);
}

function buildPainSafetyLine(pain = '') {
  const normalized = String(pain || '').toLowerCase();
  if (!normalized || normalized.includes('nenhuma')) {
    return '';
  }

  if (normalized.includes('ombro')) {
    return 'Atenção dor no ombro: reduza carga em movimentos de empurrar e priorize execucao sem falha tecnica.';
  }

  if (normalized.includes('joelho')) {
    return 'Atenção dor no joelho: reduza amplitude e carga em agachamentos pesados hoje.';
  }

  if (normalized.includes('lombar') || normalized.includes('coluna')) {
    return 'Atenção lombar: evite cargas altas em hinge/agachamento e mantenha coluna neutra o treino inteiro.';
  }

  return 'Dor relatada no perfil: treine com margem de seguranca e ajuste carga antes de buscar falha.';
}

function getUrgencyStyles(level) {
  if (level === 'alta') {
    return {
      borderColor: '#EF4444',
      backgroundColor: '#2B1717',
      badge: 'Alta urgencia',
    };
  }

  if (level === 'media') {
    return {
      borderColor: '#F59E0B',
      backgroundColor: '#2D2415',
      badge: 'Urgencia moderada',
    };
  }

  return {
    borderColor: '#22C55E',
    backgroundColor: '#15271B',
    badge: 'Sob controle',
  };
}

export default function CoachChatScreen({ navigation }) {
  const {
    profile,
    history,
    getDailyMacroTargets,
    plan,
    workoutLogs,
    getSmartWorkoutRecommendation,
    getTodayFoodLog,
    getWorkoutGamification,
    buildDailyCoachState,
    buildCoachMessage,
    addWaterIntake,
  } = useApp();
  const [input, setInput] = useState('');
  const [coachCard, setCoachCard] = useState({
    doneText: '',
    missingText: '',
    action: '',
    urgencyLevel: 'baixa',
    quickActions: {
      trainingTitle: 'Iniciar treino',
      nutritionTitle: 'Registrar refeicao',
      waterTitle: '+300ml agua',
      routineTitle: 'Ver rotina',
      waterQuickMl: 300,
    },
    completedGoals: 0,
    totalGoals: 3,
    isPerfectDay: false,
  });
  const [actionFeedback, setActionFeedback] = useState('');
  const [optimisticWaterDelta, setOptimisticWaterDelta] = useState(0);
  const [memory, setMemory] = useState({
    lastUserIntent: null,
    lastCoachMessage: '',
    lastActions: [],
    lastAction: null,
    lastTriggerAt: {},
  });
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'coach',
      text: 'Seu coach aqui. Vamos agir no que falta hoje: treino, agua e proteina.',
    },
  ]);

  const today = useMemo(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);

  const todayHistory = history.find((item) => item.date === today) || {};
  const macroTargets = getDailyMacroTargets();
  const context = {
    proteinToday: Number(todayHistory?.protein || 0),
    proteinTarget: Number(macroTargets?.protein || 0),
    waterToday: Number(todayHistory?.waterMl || 0),
    waterTarget: Number((plan?.waterLitersPerDay || 0) * 1000),
  };

  const effectiveContext = useMemo(() => ({
    ...context,
    waterToday: Math.max(0, Number(context.waterToday || 0) + Number(optimisticWaterDelta || 0)),
  }), [context.proteinToday, context.proteinTarget, context.waterToday, context.waterTarget, optimisticWaterDelta]);

  const smart = getSmartWorkoutRecommendation();
  const workoutGamification = getWorkoutGamification();
  const trainedToday = workoutLogs.some((item) => item.date === today);
  const todayMeals = getTodayFoodLog();
  const weakMeals = todayMeals.filter((meal) => meal.quality?.level === 'weak_protein').length;
  const dayPeriod = getDayPeriod();
  const currentPain = String(profile?.currentPain || profile?.pain || 'nenhuma dor informada');

  const refreshCoachCard = () => {
    const state = buildDailyCoachState({
      protein: effectiveContext.proteinToday,
      proteinTarget: effectiveContext.proteinTarget,
      water: effectiveContext.waterToday,
      waterTarget: effectiveContext.waterTarget,
      workoutsThisWeek: smart.trainedThisWeek,
      weeklyTarget: smart.weeklyTarget,
      didWorkoutToday: trainedToday,
    });
    setCoachCard(buildCoachMessage(state));
  };

  useEffect(() => {
    refreshCoachCard();
  }, [effectiveContext.proteinToday, effectiveContext.proteinTarget, effectiveContext.waterToday, effectiveContext.waterTarget, smart.trainedThisWeek, smart.weeklyTarget, trainedToday]);

  useEffect(() => {
    setOptimisticWaterDelta(0);
  }, [context.waterToday]);

  useEffect(() => {
    const loadCoachMemory = async () => {
      try {
        const raw = await AsyncStorage.getItem(COACH_MEMORY_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setMemory({
            lastUserIntent: parsed.lastUserIntent || null,
            lastCoachMessage: parsed.lastCoachMessage || '',
            lastActions: Array.isArray(parsed.lastActions) ? parsed.lastActions : [],
            lastAction: parsed.lastAction || null,
            lastTriggerAt: parsed.lastTriggerAt && typeof parsed.lastTriggerAt === 'object' ? parsed.lastTriggerAt : {},
          });
        }
      } catch (error) {
        // Ignore invalid cache and keep defaults.
      }
    };

    loadCoachMemory();
  }, []);

  useEffect(() => {
    const persistCoachMemory = async () => {
      try {
        await AsyncStorage.setItem(COACH_MEMORY_KEY, JSON.stringify(memory));
      } catch (error) {
        // Ignore local persistence failures.
      }
    };

    persistCoachMemory();
  }, [memory]);

  const rememberAction = (action) => {
    setMemory((prev) => {
      const history = Array.isArray(prev.lastActions) ? prev.lastActions : [];
      const next = [...history, `${Date.now()}:${action}`].slice(-8);
      return {
        ...prev,
        lastActions: next,
        lastAction: action,
      };
    });
  };

  useEffect(() => {
    const hour = new Date().getHours();
    const proteinLeft = Math.max(0, effectiveContext.proteinTarget - effectiveContext.proteinToday);
    const waterLeft = Math.max(0, effectiveContext.waterTarget - effectiveContext.waterToday);
    const triggerCandidates = [];

    if (hour < 12 && effectiveContext.proteinToday < 20) {
      triggerCandidates.push({
        key: 'morning_protein_low',
        text: 'Manha: voce ainda nao bateu base proteica. Comece com 1 refeicao forte em proteina.',
      });
    }

    if (hour >= 16 && !trainedToday) {
      triggerCandidates.push({
        key: 'afternoon_no_workout',
        text: 'Tarde: treino ainda nao saiu. Bloqueie 30-40min agora para nao empurrar para noite.',
      });
    }

    if (hour >= 20 && proteinLeft > 40) {
      triggerCandidates.push({
        key: 'night_high_protein_gap',
        text: 'Noite: faltam mais de 40g de proteina. Se dormir assim, sua recuperacao piora.',
      });
    }

    if (hour >= 18 && waterLeft > 700) {
      triggerCandidates.push({
        key: 'evening_water_low',
        text: 'Fim de dia: hidratacao ainda baixa. Faça blocos de +300ml para fechar sua meta.',
      });
    }

    if (!triggerCandidates.length) {
      return;
    }

    const now = Date.now();
    const trigger = triggerCandidates.find((candidate) => {
      const lastAt = Number(memory.lastTriggerAt?.[candidate.key] || 0);
      return !lastAt || now - lastAt >= TRIGGER_COOLDOWN_MS;
    });

    if (!trigger) {
      return;
    }

    setMemory((prev) => ({
      ...prev,
      lastTriggerAt: {
        ...(prev.lastTriggerAt || {}),
        [trigger.key]: now,
      },
    }));

    setMessages((prev) => {
      const triggerId = `trigger-${today}-${trigger.key}-${Math.floor(now / TRIGGER_COOLDOWN_MS)}`;
      if (prev.some((item) => item.id === triggerId)) {
        return prev;
      }

      return [
        ...prev,
        {
          id: triggerId,
          role: 'coach',
          text: `Ja foi feito: ${coachCard.doneText}. Falta: ${coachCard.missingText}. Agora: ${trigger.text}`,
        },
      ];
    });
  }, [today, trainedToday, effectiveContext.proteinToday, effectiveContext.proteinTarget, effectiveContext.waterToday, effectiveContext.waterTarget, coachCard.doneText, coachCard.missingText, memory.lastTriggerAt]);

  const sendMessage = () => {
    const trimmed = String(input || '').trim();
    if (!trimmed) {
      return;
    }
    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    const intents = detectIntents(trimmed);
    const intent = intents[0] || 'general';
    const liveContext = {
      ...effectiveContext,
      smart,
      trainedToday,
      weakMeals,
    };
    const baseReply = getCoachReply(trimmed, liveContext, messages.length, memory);
    const painSafety = (intent === 'training' || intent === 'routine' || intent === 'late_workout')
      ? buildPainSafetyLine(currentPain)
      : '';

    let tunedReply = baseReply;
    const recentActions = Array.isArray(memory.lastActions) ? memory.lastActions.slice(-4).join(' ') : '';
    if (recentActions.includes('water') && intent === 'hydration') {
      tunedReply = 'Ja foi feito: voce adicionou agua recentemente. Falta: manter ritmo em blocos menores. Agora: apenas +100ml na proxima hora.';
    }

    const coachMessage = {
      id: `c-${Date.now()}`,
      role: 'coach',
      text: [tunedReply, painSafety].filter(Boolean).join(' '),
    };

    if (coachMessage.text === memory.lastCoachMessage) {
      coachMessage.text = `${coachMessage.text} Se quiser, eu te passo 1 acao unica para agora.`;
    }

    setMessages((prev) => [...prev, userMessage, coachMessage]);
    setMemory({
      lastUserIntent: intent,
      lastCoachMessage: coachMessage.text,
      lastActions: Array.isArray(memory.lastActions) ? memory.lastActions : [],
      lastAction: memory.lastAction || null,
      lastTriggerAt: memory.lastTriggerAt || {},
    });
    setInput('');
    refreshCoachCard();
  };

  const addWaterQuick = () => {
    const ml = Number(coachCard.quickActions?.waterQuickMl || 0);
    if (ml > 0) {
      setOptimisticWaterDelta((prev) => Number(prev || 0) + ml);
      addWaterIntake(ml);
      rememberAction(`water_${ml}`);
      setActionFeedback(`Boa, +${ml}ml registrado 💧`);
      setMessages((prev) => [
        ...prev,
        {
          id: `coach-action-water-${Date.now()}`,
          role: 'coach',
          text: 'Ja foi feito: hidratacao incrementada agora. Falta: manter blocos menores no restante do dia. Agora: siga para o proximo bloco de foco.',
        },
      ]);
    }
    refreshCoachCard();
  };

  const openWorkout = () => {
    rememberAction('workout_open');
    setActionFeedback('Treino aberto. Finaliza essa sessao para fechar o loop de hoje.');
    setMessages((prev) => [
      ...prev,
      {
        id: `coach-action-training-${Date.now()}`,
        role: 'coach',
        text: 'Ja foi feito: treino iniciado. Falta: concluir o treino de hoje. Agora: termine a sessao e volte para registrar fechamento.',
      },
    ]);
    navigation.navigate('TreinoHoje');
  };

  const openNutrition = () => {
    rememberAction('nutrition_open');
    setActionFeedback('Boa. Registra a refeicao para reduzir o gap de proteina.');
    navigation.navigate('Scanner');
  };

  const openRoutines = () => {
    rememberAction('routines_open');
    setActionFeedback('Perfeito. Ajuste a rotina para garantir consistencia na semana.');
    navigation.navigate('MainTabs', { screen: 'Rotinas' });
  };

  const urgencyUI = getUrgencyStyles(coachCard.urgencyLevel);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Conversa com o Personal/Nutri" subtitle="Conversa orientada pelo seu treino, agua e macros do dia." />

      <AppCard style={[styles.coachCard, { borderColor: urgencyUI.borderColor, backgroundColor: urgencyUI.backgroundColor }]}> 
        <Text style={styles.urgencyBadge}>{urgencyUI.badge}</Text>
        <Text style={styles.coachTitle}>Ja foi feito</Text>
        <Text style={styles.coachLine}>{coachCard.doneText}</Text>

        <Text style={styles.coachTitle}>Falta</Text>
        <Text style={styles.coachLine}>{coachCard.missingText}</Text>

        <Text style={styles.coachTitle}>Agora</Text>
        <Text style={styles.coachAction}>{coachCard.action}</Text>
        <Text style={styles.progressLine}>Progresso do dia: {coachCard.completedGoals || 0}/{coachCard.totalGoals || 3} metas</Text>
        {coachCard.isPerfectDay ? <Text style={styles.perfectDayLine}>Dia perfeito 🔥</Text> : null}
        {actionFeedback ? <Text style={styles.feedbackLine}>{actionFeedback}</Text> : null}

        <View style={styles.quickActionRow}>
          <PrimaryButton testID="btn-chat-train" title={coachCard.quickActions?.trainingTitle || 'Iniciar treino'} onPress={openWorkout} style={styles.quickMainBtn} />
          <SecondaryButton testID="btn-chat-eat" title={coachCard.quickActions?.nutritionTitle || 'Registrar refeicao'} onPress={openNutrition} style={styles.quickBtn} />
          <SecondaryButton testID="btn-add-water-chat" title={coachCard.quickActions?.waterTitle || '+300ml agua'} onPress={addWaterQuick} style={styles.quickBtn} />
          <SecondaryButton testID="btn-chat-routine" title={coachCard.quickActions?.routineTitle || 'Ver rotina'} onPress={openRoutines} style={styles.quickBtn} />
        </View>
      </AppCard>

      <ScrollView style={styles.chatBox} contentContainerStyle={styles.chatContent}>
        {messages.map((message) => (
          <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.coachBubble]}>
            <Text style={[styles.bubbleText, message.role === 'user' ? styles.userText : styles.coachText]}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          testID="chat-input"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          blurOnSubmit={false}
          placeholder="Ex: Nao consegui treinar hoje"
          placeholderTextColor="#7A8B99"
          style={styles.input}
        />
        <TouchableOpacity testID="btn-chat-send" style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
  },
  chatBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  coachCard: {
    marginBottom: 10,
    borderWidth: 1,
  },
  urgencyBadge: {
    color: '#F3F4F6',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  coachTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 3,
    marginTop: 6,
  },
  coachLine: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  coachAction: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '800',
  },
  progressLine: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  perfectDayLine: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  feedbackLine: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  quickActionRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  quickMainBtn: {
    minWidth: 110,
  },
  quickBtn: {
    minWidth: 88,
  },
  chatContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubble: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: '88%',
  },
  userBubble: {
    backgroundColor: colors.secondary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: '#141922',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  userText: {
    color: colors.textPrimary,
  },
  coachText: {
    color: colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  sendButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: '#000000',
    fontWeight: '800',
  },
});
