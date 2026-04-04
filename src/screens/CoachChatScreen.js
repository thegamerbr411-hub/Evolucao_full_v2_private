import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

const COACH_MEMORY_KEY = 'coach.memory.v1';

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
    `Posso te ajudar agora em treino, proteina ou rotina da semana. Hoje voce esta com ${context.proteinToday}/${context.proteinTarget}g de proteina.`,
    `Me chama para decidir o proximo passo: treino, nutricao ou hidratacao. Agua atual: ${context.waterToday}/${context.waterTarget}ml.`,
    `Vamos por prioridade: primeiro treino do dia, depois fechar proteina. Estado da semana: ${context.smart.trainedThisWeek}/${context.smart.weeklyTarget}.`
  ], seed);
}

export default function CoachChatScreen() {
  const { history, getDailyMacroTargets, plan, workoutLogs, getSmartWorkoutRecommendation, getTodayFoodLog, getWorkoutGamification } = useApp();
  const [input, setInput] = useState('');
  const [memory, setMemory] = useState({
    lastUserIntent: null,
    lastCoachMessage: '',
  });
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'coach',
      text: 'Sou seu coach. Me conte como foi seu dia e eu ajusto treino e nutricao em tempo real.',
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

  const smart = getSmartWorkoutRecommendation();
  const workoutGamification = getWorkoutGamification();
  const trainedToday = workoutLogs.some((item) => item.date === today);
  const todayMeals = getTodayFoodLog();
  const weakMeals = todayMeals.filter((meal) => meal.quality?.level === 'weak_protein').length;
  const dayPeriod = getDayPeriod();

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

  useEffect(() => {
    setMessages((prev) => {
      const proactiveId = `proactive-${today}-${dayPeriod}`;
      const hasProactive = prev.some((item) => item.id === proactiveId);
      if (hasProactive) {
        return prev;
      }

      const proactiveTexts = [];

      if (dayPeriod === 'morning') {
        proactiveTexts.push(`Hoje e dia de ${smart.title}. Foco nisso.`);
      }

      if (dayPeriod === 'afternoon' && context.proteinToday < context.proteinTarget) {
        proactiveTexts.push(`Tarde de ajuste: faltam ${Math.max(0, context.proteinTarget - context.proteinToday)}g de proteina. Bora fechar isso hoje.`);
      }

      if (dayPeriod === 'night' && !trainedToday && workoutGamification.streakDays > 0) {
        proactiveTexts.push(`Noite decisiva: se nao treinar hoje, pode quebrar seu streak de ${workoutGamification.streakDays} dias.`);
      }

      if (!trainedToday && smart.isBehindWeek) {
        proactiveTexts.push(`Voce esta em ${smart.trainedThisWeek}/${smart.weeklyTarget} na semana. Um treino curto agora evita acumulacao.`);
      }
      if (context.proteinToday < context.proteinTarget) {
        proactiveTexts.push(`Faltam ${Math.max(0, context.proteinTarget - context.proteinToday)}g de proteina hoje. Bora fechar isso com uma refeicao proteica ainda hoje.`);
      }
      if (weakMeals > 0) {
        proactiveTexts.push(`Voce teve ${weakMeals} refeicoes fracas em proteina. Proxima refeicao precisa ter fonte proteica principal.`);
      }
      if (context.waterToday < context.waterTarget) {
        proactiveTexts.push(`Hidratacao em ${context.waterToday}/${context.waterTarget}ml. Adicione +300ml agora para recuperar foco.`);
      }

      if (!proactiveTexts.length) {
        return prev;
      }

      return [
        ...prev,
        {
          id: proactiveId,
          role: 'coach',
          text: proactiveTexts.join(' '),
        },
      ];
    });
  }, [dayPeriod, trainedToday, smart.isBehindWeek, smart.trainedThisWeek, smart.weeklyTarget, context.proteinToday, context.proteinTarget, context.waterToday, context.waterTarget, weakMeals, today, workoutGamification.streakDays]);

  const sendMessage = () => {
    const trimmed = String(input || '').trim();
    if (!trimmed) {
      return;
    }
    const userMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    const intents = detectIntents(trimmed);
    const intent = intents[0] || 'general';
    const liveContext = {
      ...context,
      smart,
      trainedToday,
      weakMeals,
    };
    const coachMessage = {
      id: `c-${Date.now()}`,
      role: 'coach',
      text: getCoachReply(trimmed, liveContext, messages.length, memory),
    };

    if (coachMessage.text === memory.lastCoachMessage) {
      coachMessage.text = `${coachMessage.text} Se quiser, eu te passo 1 acao unica para agora.`;
    }

    setMessages((prev) => [...prev, userMessage, coachMessage]);
    setMemory({
      lastUserIntent: intent,
      lastCoachMessage: coachMessage.text,
    });
    setInput('');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Conversa com o Personal/Nutri" subtitle="Conversa orientada pelo seu treino, agua e macros do dia." />

      <ScrollView style={styles.chatBox} contentContainerStyle={styles.chatContent}>
        {messages.map((message) => (
          <View key={message.id} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.coachBubble]}>
            <Text style={[styles.bubbleText, message.role === 'user' ? styles.userText : styles.coachText]}>{message.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ex: nao consegui treinar hoje"
          placeholderTextColor="#7A8B99"
          style={styles.input}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
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
