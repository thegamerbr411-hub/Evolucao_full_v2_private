import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';
import { generateCoachInsight } from '../services/coachInsight';
import { sendMessage as sendRealtimeMessage, subscribeToMessages } from '../services/chatService.js';
import { getExerciseFallbackSuggestions, resolveGymExerciseMention } from '../data/exerciseDatabase.js';

const COACH_MEMORY_KEY = 'coach.memory.v1';
const TRIGGER_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY = '@workout:active-routine-id-v1';

function normalizeCoachInsight(insight) {
  if (insight && typeof insight === 'object' && !Array.isArray(insight)) {
    return {
      priority: String(insight.priority || 'geral'),
      summary: String(insight.summary || ''),
      actions: Array.isArray(insight.actions) ? insight.actions : [],
      profileLine: String(insight.profileLine || ''),
    };
  }

  return {
    priority: 'geral',
    summary: String(insight || ''),
    actions: [],
    profileLine: '',
  };
}

function getMessageVariant(options, seed) {
  if (!options.length) {
    return '';
  }
  return options[Math.abs(seed) % options.length];
}

// BLOCO 7: Coach Evoluído - Max 2-3 linhas + ações claras
function toCoachShortText(text) {
  if (!text || typeof text !== 'string') return '';
  
  // Split by period + space to get sentences
  const sentences = text.split('. ').slice(0, 2);
  let short = sentences.join('. ');
  if (sentences.length === 2) short += '.';
  
  // Max 140 chars to fit ~2-3 lines on mobile
  if (short.length > 140) {
    short = short.substring(0, 137) + '...';
  }
  
  return short;
}

// Extract action suggestions from coach message
function extractCoachAction(text) {
  if (!text || typeof text !== 'string') return null;
  
  const actions = [];
  const lower = text.toLowerCase();
  
  if (lower.includes('treino')) actions.push({ label: '💪 Iniciar treino', intent: 'training' });
  if (lower.includes('proteina') || lower.includes('refeicao')) actions.push({ label: '🍗 Registrar refeição', intent: 'nutrition' });
  if (lower.includes('agua') || lower.includes('hidrat')) actions.push({ label: '💧 Beber agua', intent: 'water' });
  if (lower.includes('rotina') || lower.includes('semana')) actions.push({ label: '📋 Ver rotina', intent: 'routine' });
  if (lower.includes('progresso') || lower.includes('evolucao')) actions.push({ label: '📊 Ver progresso', intent: 'progress' });
  
  return actions.length ? actions.slice(0, 2) : null; // Max 2 action buttons
}

function detectIntents(message) {
  const text = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!text) {
    return ['unknown'];
  }

  if (
    text === 'oi' ||
    text === 'ola' ||
    text.startsWith('oi ') ||
    text.startsWith('ola ') ||
    text.includes('bom dia') ||
    text.includes('boa tarde') ||
    text.includes('boa noite')
  ) {
    return ['greeting'];
  }

  if (
    text.includes('ajuda') ||
    text.includes('help') ||
    text.includes('socorro') ||
    text.includes('como funciona') ||
    text.includes('o que voce faz') ||
    text.includes('o que voce pode fazer')
  ) {
    return ['help'];
  }

  if (
    text.includes('progresso') ||
    text.includes('evolucao') ||
    text.includes('como estou') ||
    text.includes('resultado') ||
    text.includes('nivel') ||
    text.includes('xp')
  ) {
    return ['progress'];
  }

  if (
    text.includes('proteina') ||
    text.includes('comi') ||
    text.includes('refeicao') ||
    text.includes('agua') ||
    text.includes('hidrat') ||
    text.includes('dieta') ||
    text.includes('nutri') ||
    text.includes('whey') ||
    text.includes('ovo')
  ) {
    return ['nutrition'];
  }

  if (
    text.includes('criar treino') ||
    text.includes('montar treino') ||
    text.includes('iniciar treino') ||
    text.includes('treino') ||
    text.includes('rotina') ||
    text.includes('semana') ||
    text.includes('nao consegui treinar') ||
    text.includes('nao treinei') ||
    text.includes('treinei tarde') ||
    text.includes('madrugada') ||
    text.includes('carga') ||
    text.includes('exercicio') ||
    text.includes('series') ||
    text.includes('supino') ||
    text.includes('agachamento') ||
    text.includes('remada')
  ) {
    return ['workout'];
  }

  return ['unknown'];
}

function buildExerciseRecognitionLine(message = '') {
  const mention = resolveGymExerciseMention(message);
  if (!mention) {
    return '';
  }

  const canonicalName = mention?.canonicalExercise?.nome || mention?.nomePrincipal || '';
  if (!canonicalName) {
    return '';
  }

  const fallback = getExerciseFallbackSuggestions(message, 3);
  const fallbackList = Array.from(
    new Set([...(fallback?.similar || []), ...(fallback?.byGroup || [])])
  )
    .filter((name) => name && name !== canonicalName)
    .slice(0, 2);

  const recognitionText = mention?.aliasMatched
    ? `Entendi "${mention.aliasMatched}" como ${canonicalName}.`
    : `Entendi como ${canonicalName}.`;

  if (!fallbackList.length) {
    return recognitionText;
  }

  return `${recognitionText} Se estiver ocupado, pode trocar por ${fallbackList.join(' ou ')}.`;
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
  const normalizedMessage = String(message || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (intent === 'greeting') {
    return getMessageVariant([
      'Oi. Tamo junto hoje. Quer foco em treino, proteina ou agua?',
      'Fala. Me diz seu foco agora que eu te passo a ação direta.',
      'Boa. Vamos resolver o próximo passo do seu dia.'
    ], seed);
  }

  if (intent === 'workout' && (normalizedMessage.includes('nao consegui treinar') || normalizedMessage.includes('nao treinei'))) {
    const intro = getMessageVariant([
      'Acontece. Um dia ruim nao define sua semana.',
      'Sem culpa. Agora a gente ajusta e segue.',
      'Relaxa, ainda da para fechar a semana forte.'
    ], seed);
    return `${intro} Você está em ${context.smart.trainedThisWeek}/${context.smart.weeklyTarget} treinos. ${context.smart.isBehindWeek ? 'Faz 25 minutos hoje e salva o ritmo.' : 'Hoje pode ser treino leve ou mobilidade.'}`;
  }

  if (intent === 'workout' && (normalizedMessage.includes('madrugada') || normalizedMessage.includes('treinei tarde'))) {
    const intro = getMessageVariant([
      'Mandou bem. Treino feito fora de hora também conta.',
      'Excelente disciplina. Você não quebrou a sequência.',
      'Boa. Fez o que precisava ser feito.'
    ], seed);
    return `${intro} Agora fecha com água, proteína e sono bom.`;
  }

  if (intent === 'nutrition') {
    if (normalizedMessage.includes('agua') || normalizedMessage.includes('hidrat')) {
      const intro = getMessageVariant([
        'Boa chamada. Agua muda sua energia na hora.',
        'Perfeito. Isso impacta treino e recuperacao.',
        'Vamos ajustar rapido e seguir.'
      ], seed);
      const gap = Math.max(0, context.waterTarget - context.waterToday);
      return `${intro} Você está em ${context.waterToday}/${context.waterTarget}ml. ${gap > 0 ? `Faltam ${gap}ml. Toma +300ml agora.` : 'Meta batida. So manter.'}`;
    }

    const intro = getMessageVariant([
      'Fechou. Vamos resolver isso agora.',
      'Boa. Próxima refeição decide seu dia.',
      'Perfeito. Foco em proteína agora.'
    ], seed);
    const proteinGap = Math.max(0, context.proteinTarget - context.proteinToday);
    return `${intro} Hoje você está em ${context.proteinToday}/${context.proteinTarget}g. ${proteinGap > 0 ? `Faltam ${proteinGap}g. Um whey ou ovos já resolvem fácil.` : 'Meta batida. Só manter no jantar.'}`;
  }

  if (intent === 'workout') {
    if (normalizedMessage.includes('rotina') || normalizedMessage.includes('semana') || normalizedMessage.includes('planejar')) {
      const intro = getMessageVariant([
        'Vamos simplificar sua semana.',
        'Plano bom e plano que voce cumpre.',
        'Bora organizar sem complicar.'
      ], seed);
      return `${intro} Meta: ${context.smart.weeklyTarget} treinos. Você fez ${context.smart.trainedThisWeek}. ${context.smart.isBehindWeek ? 'Proxima acao: 2 sessoes curtas nos proximos 3 dias.' : 'Proxima acao: manter frequencia e caprichar na execucao.'}`;
    }

    const intro = getMessageVariant([
      'Hoje é dia de fazer o básico bem feito.',
      'Vamos direto no treino que traz resultado.',
      'Foco total: execução limpa e ritmo alto.'
    ], seed);
    const recognitionLine = buildExerciseRecognitionLine(message);
    return `${intro} ${context.smart.title}. ${context.trainedToday ? 'Como já treinou hoje, fecha recuperação e proteína.' : 'Comece pelos exercícios principais agora.'} ${recognitionLine}`.trim();
  }

  if (intent === 'progress') {
    return `Seu dia está em ${context.smart.trainedThisWeek}/${context.smart.weeklyTarget} treinos da semana. Proteína: ${context.proteinToday}/${context.proteinTarget}g. Próxima ação: ${context.trainedToday ? 'fechar água e proteína' : 'iniciar treino agora'}.`;
  }

  if (intent === 'help') {
    const nextAction = context.trainedToday ? 'fechar agua e proteina' : 'iniciar treino de hoje';
    return `Eu te ajudo com foco em treino, nutricao e progresso. Se quiser, me diga: "montar treino", "quanto falta de proteina" ou "como esta meu progresso". Agora, sua melhor acao e ${nextAction}.`;
  }

  const contextSuggestion = context.trainedToday
    ? 'fechar proteina ou agua'
    : 'iniciar treino agora';
  return `Pode me dizer mais? Temas que entendo: treino, proteina, agua, progresso, rotina. Agora, sua melhor acao e ${contextSuggestion}.`;
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
      borderColor: colors.warning,
      backgroundColor: colors.warningMuted,
      badge: 'Foco do dia',
    };
  }

  if (level === 'media') {
    return {
      borderColor: colors.secondary,
      backgroundColor: colors.secondaryMuted,
      badge: 'Ajuste recomendado',
    };
  }

  return {
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
    badge: 'Bom ritmo',
  };
}

export default function CoachChatScreen({ navigation }) {
  const {
    profile,
    history,
    getDailyMacroTargets,
    plan,
    userRoutines,
    workoutLogs,
    getSmartWorkoutRecommendation,
    getTodayFoodLog,
    getWorkoutGamification,
    getDailyState,
    buildDailyCoachState,
    buildCoachMessage,
    addWaterIntake,
    user,
  } = useApp();
  const safeHistory = Array.isArray(history) ? history : [];
  const safeWorkoutLogs = Array.isArray(workoutLogs) ? workoutLogs : [];
  const safeUserRoutines = Array.isArray(userRoutines) ? userRoutines : [];
  const getDailyMacroTargetsSafe = typeof getDailyMacroTargets === 'function' ? getDailyMacroTargets : () => ({});
  const getSmartWorkoutRecommendationSafe = typeof getSmartWorkoutRecommendation === 'function'
    ? getSmartWorkoutRecommendation
    : () => ({
      title: 'Treino de consistencia',
      justification: 'Execute o treino principal do dia.',
      trainedThisWeek: 0,
      weeklyTarget: Math.max(1, Number(profile?.trainingDaysPerWeek || 3)),
      isBehindWeek: true,
    });
  const getTodayFoodLogSafe = typeof getTodayFoodLog === 'function' ? getTodayFoodLog : () => [];
  const getWorkoutGamificationSafe = typeof getWorkoutGamification === 'function' ? getWorkoutGamification : () => ({});
  const getDailyStateSafe = typeof getDailyState === 'function' ? getDailyState : () => null;
  const buildDailyCoachStateSafe = typeof buildDailyCoachState === 'function' ? buildDailyCoachState : () => ({ done: {}, missing: {} });
  const buildCoachMessageSafe = typeof buildCoachMessage === 'function' ? buildCoachMessage : () => ({});
  const addWaterIntakeSafe = typeof addWaterIntake === 'function' ? addWaterIntake : () => ({ ok: false });
  const [input, setInput] = useState('');
  const [coachCard, setCoachCard] = useState({
    doneText: '',
    missingText: '',
    action: '',
    urgencyLevel: 'baixa',
    quickActions: {
      trainingTitle: 'Iniciar treino',
      nutritionTitle: 'Registrar refeicao',
      waterTitle: '💧 Agua',
      routineTitle: 'Ver rotina',
      waterQuickMl: 300,
    },
    completedGoals: 0,
    totalGoals: 3,
    isPerfectDay: false,
  });
  const [actionFeedback, setActionFeedback] = useState('');
  const [showCoachDetails, setShowCoachDetails] = useState(false);
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

  useEffect(() => {
    const chatId = String(user?.id || 'global');

    const unsubscribe = subscribeToMessages({
      chatId,
      max: 60,
      onData: (items) => {
        if (!Array.isArray(items) || !items.length) {
          return;
        }

        setMessages((prev) => {
          const merged = [...prev];
          items.forEach((item) => {
            const exists = merged.some((msg) => msg.id === item.id);
            if (!exists) {
              merged.push({
                id: item.id,
                role: item.from === 'user' ? 'user' : 'coach',
                text: String(item.text || ''),
              });
            }
          });
          return merged;
        });
      },
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const today = useMemo(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, []);

  const dailyState = useMemo(() => getDailyStateSafe(), [getDailyStateSafe, safeWorkoutLogs, safeHistory, profile, plan]);
  const todayHistory = safeHistory.find((item) => item.date === today) || {};
  const macroTargets = dailyState?.macroTargets || getDailyMacroTargetsSafe();
  const context = {
    proteinToday: Number(dailyState?.proteinToday ?? todayHistory?.protein ?? 0),
    proteinTarget: Number(dailyState?.proteinTarget ?? macroTargets?.protein ?? 0),
    waterToday: Number(dailyState?.waterTodayMl ?? todayHistory?.waterMl ?? 0),
    waterTarget: Number(dailyState?.waterTargetMl ?? (plan?.waterLitersPerDay || 0) * 1000),
  };

  const effectiveContext = useMemo(() => ({
    ...context,
    waterToday: Math.max(0, Number(context.waterToday || 0) + Number(optimisticWaterDelta || 0)),
  }), [context.proteinToday, context.proteinTarget, context.waterToday, context.waterTarget, optimisticWaterDelta]);

  const smart = getSmartWorkoutRecommendationSafe() || {};
  const workoutGamification = getWorkoutGamificationSafe();
  const trainedToday = Boolean(dailyState?.didWorkoutToday);
  const hasActiveWorkoutSession = Boolean(dailyState?.hasActiveWorkoutSession);
  const workoutStatus = dailyState?.workoutSession?.status || 'not_started';
  const todayMeals = getTodayFoodLogSafe();
  const weakMeals = (Array.isArray(todayMeals) ? todayMeals : []).filter((meal) => meal.quality?.level === 'weak_protein').length;
  const dayPeriod = getDayPeriod();
  const currentPain = String(profile?.currentPain || profile?.pain || 'nenhuma dor informada');
  const smartInsight = useMemo(() => normalizeCoachInsight(generateCoachInsight({
    trainedToday,
    protein: effectiveContext.proteinToday,
    proteinTarget: effectiveContext.proteinTarget,
    water: effectiveContext.waterToday,
    waterTarget: effectiveContext.waterTarget,
    weeklyDone: smart.trainedThisWeek,
    weeklyTarget: smart.weeklyTarget,
    weakMeals,
    hasRoutine: safeUserRoutines.length > 0,
    goal: profile?.goal,
    level: profile?.level,
    pain: currentPain,
  })), [trainedToday, effectiveContext.proteinToday, effectiveContext.proteinTarget, effectiveContext.waterToday, effectiveContext.waterTarget, smart.trainedThisWeek, smart.weeklyTarget, weakMeals, safeUserRoutines, profile?.goal, profile?.level, currentPain]);

  const refreshCoachCard = useCallback(() => {
    const state = buildDailyCoachStateSafe({
      protein: effectiveContext.proteinToday,
      proteinTarget: effectiveContext.proteinTarget,
      water: effectiveContext.waterToday,
      waterTarget: effectiveContext.waterTarget,
      workoutsThisWeek: smart.trainedThisWeek,
      weeklyTarget: smart.weeklyTarget,
      didWorkoutToday: trainedToday,
      hasActiveWorkoutSession,
      workoutStatus,
    });
    const nextCard = buildCoachMessageSafe(state);
    if (nextCard && typeof nextCard === 'object') {
      setCoachCard((prev) => ({
        ...prev,
        ...nextCard,
        quickActions: {
          ...prev.quickActions,
          ...(nextCard.quickActions || {}),
        },
      }));
    }
  }, [effectiveContext.proteinToday, effectiveContext.proteinTarget, effectiveContext.waterToday, effectiveContext.waterTarget, smart.trainedThisWeek, smart.weeklyTarget, trainedToday, hasActiveWorkoutSession, workoutStatus, buildDailyCoachStateSafe, buildCoachMessageSafe]);

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
        text: 'Noite: faltam mais de 40g de proteina. Se dormir assim, sua recuperacao pode ficar abaixo do ideal.',
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

  const sendMessage = async () => {
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
    const normalizedMessage = trimmed.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const baseReply = getCoachReply(trimmed, liveContext, messages.length, memory);
    const contextInsight = (intent === 'workout' || intent === 'progress' || intent === 'nutrition') && smartInsight?.summary
      ? `Insight: ${smartInsight.summary}`
      : '';
    const painSafety = intent === 'workout'
      ? buildPainSafetyLine(currentPain)
      : '';

    let tunedReply = baseReply;
    const recentActions = Array.isArray(memory.lastActions) ? memory.lastActions.slice(-4).join(' ') : '';
    if (recentActions.includes('water') && intent === 'nutrition' && normalizedMessage.includes('agua')) {
      tunedReply = 'Ja foi feito: voce adicionou agua recentemente. Falta: manter ritmo em blocos menores. Agora: apenas +100ml na proxima hora.';
    }

    let composedMessage = [tunedReply, contextInsight, painSafety].filter(Boolean).join(' ');
    if (!/agora:|iniciar treino|registrar refeicao|beber|abrir/i.test(composedMessage)) {
      composedMessage = `${composedMessage} Agora: toque em Iniciar treino ou Registrar refeicao.`;
    }

    const coachMessage = {
      id: `c-${Date.now()}`,
      role: 'coach',
      text: toCoachShortText(composedMessage),
    };

    if (coachMessage.text === memory.lastCoachMessage) {
      coachMessage.text = `${coachMessage.text} Se quiser, eu te passo 1 acao unica para agora.`;
    }

    setMessages((prev) => [...prev, userMessage, coachMessage]);
    await sendRealtimeMessage(String(user?.id || 'global'), trimmed, 'user');
    await sendRealtimeMessage(String(user?.id || 'global'), coachMessage.text, 'coach');
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
      addWaterIntakeSafe(ml);
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

  const openWorkout = async () => {
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

    try {
      const activeRoutineId = String((await AsyncStorage.getItem(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY)) || '').trim();
      if (activeRoutineId) {
        navigation.navigate('TreinoHoje', { workoutId: activeRoutineId });
        return;
      }
    } catch {
      // Fallback para fluxo padrao quando cache local falhar.
    }

    navigation.navigate('TreinoHoje');
  };

  const openNutrition = () => {
    rememberAction('nutrition_open');
    setActionFeedback('Boa. Registre a refeição para reduzir o gap de proteína.');
    navigation.navigate('Nutricao');
  };

  const openRoutines = () => {
    rememberAction('routines_open');
    setActionFeedback('Perfeito. Ajuste sua rotina direto no hub de treino.');
    navigation.navigate('Treino');
  };

  const urgencyUI = getUrgencyStyles(coachCard.urgencyLevel);
  const [showWaterPicker, setShowWaterPicker] = useState(false);
  const [customWaterInput, setCustomWaterInput] = useState('');
  const WATER_PRESETS = [150, 300, 500, 750, 1000];

  const addWaterAmount = (ml) => {
    const safeMl = Math.max(1, Number(ml || 0));
    if (!safeMl) return;
    setOptimisticWaterDelta((prev) => Number(prev || 0) + safeMl);
    addWaterIntakeSafe(safeMl);
    rememberAction(`water_${safeMl}`);
    setActionFeedback(`Boa, +${safeMl}ml registrado 💧`);
    setShowWaterPicker(false);
    setCustomWaterInput('');
    setMessages((prev) => [
      ...prev,
      {
        id: `coach-action-water-${Date.now()}`,
        role: 'coach',
        text: `Ja foi feito: +${safeMl}ml de hidratacao registrado. Falta: manter blocos menores no restante do dia. Agora: siga para o proximo bloco de foco.`,
      },
    ]);
    refreshCoachCard();
  };

  return (
    <SafeAreaView testID="screen-coach" style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
      <ScreenHeader title="Coach Diario" subtitle="Conversa orientada pelo seu treino, agua e macros do dia." />

      {__DEV__ ? (
        <View style={styles.devFeatureTagWrap}>
          <Text style={styles.devFeatureTag}>[F-Coach] Fluxo de decisao e resposta contextual</Text>
        </View>
      ) : null}

      <AppCard style={[styles.coachCard, { borderColor: urgencyUI.borderColor, backgroundColor: urgencyUI.backgroundColor }]}> 
        <Text style={styles.urgencyBadge}>{urgencyUI.badge}</Text>
        <Text style={styles.coachTitle}>Ja foi feito</Text>
        <Text style={styles.coachLine}>{coachCard.doneText}</Text>

        <Text style={styles.coachTitle}>Falta</Text>
        <Text style={styles.coachLine}>{coachCard.missingText}</Text>

        <Text style={styles.coachTitle}>Agora</Text>
        <Text style={styles.coachAction}>{coachCard.action}</Text>
        <TouchableOpacity style={styles.detailsToggle} onPress={() => setShowCoachDetails((prev) => !prev)}>
          <Text style={styles.detailsToggleText}>{showCoachDetails ? 'Ocultar detalhes IA' : 'Ver detalhes IA'}</Text>
        </TouchableOpacity>
        {showCoachDetails && (smartInsight.summary || smartInsight.profileLine || smartInsight.actions.length) ? (
          <>
            <Text style={styles.smartInsightLine}>Prioridade IA: {smartInsight.priority} | {smartInsight.summary}</Text>
            {smartInsight.profileLine ? <Text style={styles.supportLine}>{smartInsight.profileLine}</Text> : null}
            {(smartInsight.actions || []).slice(0, 2).map((action) => (
              <Text key={action} style={styles.supportLine}>• {action}</Text>
            ))}
          </>
        ) : null}
        <Text style={styles.progressLine}>Progresso do dia: {coachCard.completedGoals || 0}/{coachCard.totalGoals || 3} metas</Text>
        {coachCard.isPerfectDay ? <Text style={styles.perfectDayLine}>Dia perfeito 🔥</Text> : null}
        {actionFeedback ? <Text style={styles.feedbackLine}>{actionFeedback}</Text> : null}

        <View style={styles.quickActionRow}>
          <PrimaryButton testID="btn-chat-train" title={coachCard.quickActions?.trainingTitle || 'Iniciar treino'} onPress={openWorkout} style={styles.quickMainBtn} />
          <SecondaryButton testID="btn-chat-eat" title={coachCard.quickActions?.nutritionTitle || 'Registrar refeição'} onPress={openNutrition} style={styles.quickBtn} />
          <SecondaryButton testID="btn-add-water-chat" title={coachCard.quickActions?.waterTitle || '💧 Registrar água'} onPress={() => setShowWaterPicker((v) => !v)} style={styles.quickBtn} />
          <SecondaryButton testID="btn-chat-routine" title={coachCard.quickActions?.routineTitle || 'Ver rotina'} onPress={openRoutines} style={styles.quickBtn} />
        </View>
        {showWaterPicker ? (
          <View style={styles.waterPickerRow}>
            {WATER_PRESETS.map((ml) => (
              <TouchableOpacity key={ml} style={styles.waterPresetChip} onPress={() => addWaterAmount(ml)}>
                <Text style={styles.waterPresetText}>{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}</Text>
              </TouchableOpacity>
            ))}
            <TextInput
              value={customWaterInput}
              onChangeText={setCustomWaterInput}
              placeholder="outro ml"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.waterCustomInput}
              returnKeyType="done"
              onSubmitEditing={() => addWaterAmount(Number(customWaterInput))}
            />
            <TouchableOpacity style={styles.waterCustomBtn} onPress={() => addWaterAmount(Number(customWaterInput))}>
              <Text style={styles.waterCustomBtnText}>✓</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </AppCard>

      <FlatList
        style={styles.chatBox}
        contentContainerStyle={styles.chatContent}
        data={messages}
        keyExtractor={(item, index) => String(item?.id || index)}
        renderItem={({ item: message }) => {
          const actionSuggestions = message.role === 'coach' ? extractCoachAction(message.text) : null;
          
          return (
            <View testID={message.role === 'user' ? 'message-user' : 'message-coach'} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.coachBubble]}>
              <Text style={[styles.bubbleText, message.role === 'user' ? styles.userText : styles.coachText]}>{message.role === 'coach' ? toCoachShortText(message.text) : message.text}</Text>
              
              {/* BLOCO 7: Coach Evoluído - Botões de ação rápida */}
              {actionSuggestions && actionSuggestions.length > 0 ? (
                <View style={styles.coachActionButtons}>
                  {actionSuggestions.map((action, idx) => (
                    <TouchableOpacity key={idx} style={styles.coachActionButton} onPress={() => {
                      if (action.intent === 'training') openWorkout();
                      else if (action.intent === 'nutrition') openNutrition();
                      else if (action.intent === 'water') {
                        setShowWaterPicker(true);
                        setActionFeedback('Escolha o volume de água para registrar.');
                      }
                      else if (action.intent === 'routine') openRoutines();
                    }}>
                      <Text style={styles.coachActionButtonText}>{action.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <View style={styles.suggestionChips}>
        {[
          { label: '💪 Meu treino hoje', text: 'como esta meu treino hoje' },
          { label: '🍗 Falta proteína?', text: 'quanto falta de proteina hoje' },
          { label: '💧 Registrar água', text: 'quero registrar agua' },
          { label: '📊 Progresso', text: 'como esta meu progresso' },
        ].map((chip) => (
          <TouchableOpacity
            key={chip.label}
            style={styles.suggestionChip}
            onPress={() => { setInput(chip.text); }}
          >
            <Text style={styles.suggestionChipText}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          testID="chat-input"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
          blurOnSubmit={false}
          placeholder="Pergunte ao seu coach..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        <TouchableOpacity testID="btn-chat-send" style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Enviar</Text>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  chatBox: {
    flex: 1,
    backgroundColor: colors.cardElevated,
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
    color: colors.textPrimary,
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
  detailsToggle: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailsToggleText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  progressLine: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  smartInsightLine: {
    color: '#C4F1D3',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
  },
  perfectDayLine: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  feedbackLine: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  supportLine: {
    color: colors.textSecondary,
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
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  quickBtn: {
    minWidth: 88,
  },
  chatContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  bubble: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    maxWidth: '90%',
  },
  userBubble: {
    backgroundColor: '#2A5FA8',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: '#111C2E',
    borderWidth: 1,
    borderColor: '#2C3D55',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  userText: {
    color: colors.textPrimary,
  },
  coachText: {
    color: colors.textPrimary,
  },
  // BLOCO 7: Coach Evoluído - Action buttons após mensagem
  coachActionButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  coachActionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  coachActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  sendButton: {
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 15,
  },
  waterPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    alignItems: 'center',
  },
  waterPresetChip: {
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  waterPresetText: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  waterCustomInput: {
    flex: 1,
    minWidth: 70,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  waterCustomBtn: {
    height: 36,
    width: 36,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterCustomBtnText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  devFeatureTagWrap: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#0B1730',
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  devFeatureTag: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
});
