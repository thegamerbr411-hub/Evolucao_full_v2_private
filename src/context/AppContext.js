
import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AppContext=createContext();
const STORAGE_KEY = 'evolucao.profile_plan.v1';

const CALORIE_RANGES = {
  cutting: { min: 1200, max: 2500 },
  bulking: { min: 2000, max: 3500 },
  recomposicao: { min: 1800, max: 2800 },
};

const XP_RULES = {
  completeSet: 5,
  newLoadPR: 20,
  completeWorkout: 50,
  consistencyBonus: 30,
  xpPerLevel: 300,
};

const DEFAULT_MONETIZATION = {
  plan: 'free',
  trialStartedAt: null,
  trialDays: 3,
  proSince: null,
};

const NUTRITION_DB = [
  { key: 'pao', label: 'Pao', calories: 140, protein: 5, carbs: 25, fats: 2 },
  { key: 'pao frances', label: 'Pao frances', calories: 135, protein: 4.5, carbs: 26, fats: 1.8 },
  { key: 'ovo', label: 'Ovo', calories: 78, protein: 6, carbs: 1, fats: 5 },
  { key: 'ovo inteiro', label: 'Ovo inteiro', calories: 78, protein: 6, carbs: 1, fats: 5 },
  { key: 'queijo', label: 'Queijo', calories: 95, protein: 6, carbs: 1, fats: 7 },
  { key: 'queijo mussarela', label: 'Queijo mussarela', calories: 86, protein: 6, carbs: 1, fats: 6 },
  { key: 'frango', label: 'Frango', calories: 165, protein: 31, carbs: 0, fats: 4 },
  { key: 'arroz', label: 'Arroz', calories: 130, protein: 2.5, carbs: 28, fats: 0.3 },
  { key: 'feijao', label: 'Feijao', calories: 77, protein: 5, carbs: 14, fats: 0.5 },
  { key: 'banana', label: 'Banana', calories: 90, protein: 1, carbs: 23, fats: 0.2 },
  { key: 'iogurte', label: 'Iogurte', calories: 120, protein: 8, carbs: 12, fats: 4 },
  { key: 'whey', label: 'Whey', calories: 120, protein: 24, carbs: 4, fats: 2 },
  { key: 'carne', label: 'Carne', calories: 220, protein: 26, carbs: 0, fats: 13 },
  { key: 'batata', label: 'Batata', calories: 86, protein: 2, carbs: 20, fats: 0.1 },
  { key: 'aveia', label: 'Aveia', calories: 110, protein: 4, carbs: 19, fats: 2.5 },
  { key: 'leite', label: 'Leite', calories: 103, protein: 8, carbs: 12, fats: 2.4 },
  { key: 'macarrao', label: 'Macarrao', calories: 158, protein: 5.8, carbs: 31, fats: 0.9 },
  { key: 'atum', label: 'Atum', calories: 132, protein: 28, carbs: 0, fats: 1 },
];

const FRACTION_WORDS = {
  metade: 0.5,
  meia: 0.5,
  terco: 1 / 3,
  quarto: 0.25,
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
};

const NUTRITION_SYNONYMS = {
  'muçarela': 'mussarela',
  'mussarela': 'queijo mussarela',
  'muzarela': 'queijo mussarela',
  'queijo muçarela': 'queijo mussarela',
  'queijo mussarela': 'queijo mussarela',
  'pao frances': 'pao frances',
  'paozinho': 'pao frances',
  'pao': 'pao',
  'ovos': 'ovo',
  'ovo inteiro': 'ovo inteiro',
};

const WORKOUT_LIBRARY = {
  fullBody: [
    { name: 'Agachamento Livre', sets: 4, reps: '6-10' },
    { name: 'Supino Reto Barra', sets: 4, reps: '6-10' },
    { name: 'Remada Curvada Barra', sets: 3, reps: '8-12' },
    { name: 'Desenvolvimento Militar Barra', sets: 3, reps: '8-12' },
    { name: 'Levantamento Terra Romeno', sets: 3, reps: '8-12' },
  ],
  upper: [
    { name: 'Supino Reto Barra', sets: 4, reps: '6-10' },
    { name: 'Puxada Frontal Polia', sets: 4, reps: '8-12' },
    { name: 'Desenvolvimento Militar Halter', sets: 3, reps: '8-12' },
    { name: 'Remada Baixa Triangulo', sets: 3, reps: '8-12' },
    { name: 'Rosca Direta Barra', sets: 3, reps: '10-12' },
    { name: 'Triceps Corda Polia', sets: 3, reps: '10-12' },
  ],
  lower: [
    { name: 'Agachamento Livre', sets: 4, reps: '6-10' },
    { name: 'Leg Press', sets: 4, reps: '10-12' },
    { name: 'Stiff', sets: 3, reps: '8-12' },
    { name: 'Cadeira Extensora', sets: 3, reps: '12-15' },
    { name: 'Panturrilha em Pe', sets: 4, reps: '12-20' },
  ],
  push: [
    { name: 'Supino Reto Barra', sets: 4, reps: '6-10' },
    { name: 'Supino Inclinado Halter', sets: 3, reps: '8-12' },
    { name: 'Desenvolvimento Militar Halter', sets: 3, reps: '8-12' },
    { name: 'Elevacao Lateral Halter', sets: 3, reps: '12-15' },
    { name: 'Triceps Testa Barra EZ', sets: 3, reps: '10-12' },
  ],
  pull: [
    { name: 'Puxada Frontal Polia', sets: 4, reps: '8-12' },
    { name: 'Remada Curvada Barra', sets: 4, reps: '8-12' },
    { name: 'Face Pull Polia', sets: 3, reps: '12-15' },
    { name: 'Rosca Direta Barra', sets: 3, reps: '10-12' },
    { name: 'Rosca Martelo Halter', sets: 3, reps: '10-12' },
  ],
  legs: [
    { name: 'Agachamento Livre', sets: 4, reps: '6-10' },
    { name: 'Levantamento Terra Romeno', sets: 4, reps: '8-10' },
    { name: 'Passada', sets: 3, reps: '10-12' },
    { name: 'Cadeira Flexora', sets: 3, reps: '12-15' },
    { name: 'Panturrilha Sentado', sets: 4, reps: '15-20' },
  ],
};

const MUSCLE_SUGGESTION_MAP = {
  peito: ['Triceps Corda Polia', 'Triceps Testa Barra EZ', 'Desenvolvimento Militar Halter'],
  costas: ['Rosca Direta Barra', 'Rosca Martelo Halter', 'Face Pull Polia'],
  perna: ['Cadeira Extensora', 'Cadeira Flexora', 'Panturrilha em Pe'],
  ombro: ['Elevacao Lateral Halter', 'Desenvolvimento Militar Halter', 'Face Pull Polia'],
  triceps: ['Supino Reto Barra', 'Supino Inclinado Halter', 'Desenvolvimento Militar Barra'],
  biceps: ['Puxada Frontal Polia', 'Remada Curvada Barra', 'Rosca Martelo Halter'],
};

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeHistoryStatus(insightStatus) {
  if (insightStatus === 'otimo') {
    return 'ok';
  }

  if (insightStatus === 'abaixo_meta' || insightStatus === 'recuperacao_baixa') {
    return 'abaixo';
  }

  return 'acima';
}

function round(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(value, step = 2.5) {
  return Math.round(value / step) * step;
}

function isLowerBodyExercise(exerciseName) {
  const lowerKeywords = [
    'Agachamento',
    'Leg Press',
    'Stiff',
    'Passada',
    'Panturrilha',
    'Terra',
    'Extensora',
    'Flexora',
  ];

  return lowerKeywords.some((keyword) => exerciseName.includes(keyword));
}

function getProgressionStep(exerciseName) {
  return isLowerBodyExercise(exerciseName) ? 5 : 2.5;
}

function parseRepRange(repsText) {
  if (!repsText || typeof repsText !== 'string') {
    return { min: 8, max: 12 };
  }

  const parts = repsText.split('-').map((part) => Number(part.trim()));
  if (parts.length === 2 && parts.every((num) => Number.isFinite(num))) {
    return { min: parts[0], max: parts[1] };
  }

  return { min: 8, max: 12 };
}

function getExerciseTemplate(exerciseName) {
  const all = Object.values(WORKOUT_LIBRARY).flat();
  return all.find((exercise) => exercise.name === exerciseName) || null;
}

function getDefaultStartingWeight(exerciseName, level) {
  const lower = isLowerBodyExercise(exerciseName);

  if (level === 'intermediario') {
    return lower ? 30 : 20;
  }

  return lower ? 20 : 10;
}

function buildConfidence(totalLogs, recentLogs) {
  if (totalLogs >= 8 && recentLogs.length >= 3) {
    return 'alta';
  }

  if (totalLogs >= 3) {
    return 'media';
  }

  return 'baixa';
}

function getCaloriesRangeByStrategy(strategy) {
  return CALORIE_RANGES[strategy] || CALORIE_RANGES.recomposicao;
}

function clampCaloriesByStrategy(calories, strategy) {
  const range = getCaloriesRangeByStrategy(strategy);
  return clamp(calories, range.min, range.max);
}

function buildInitialTraining(daysPerWeek, level) {
  if (daysPerWeek <= 3) {
    return 'Full body 3x semana';
  }

  if (daysPerWeek === 4) {
    return 'Superior/Inferior 4x semana';
  }

  if (level === 'iniciante') {
    return 'Push/Pull/Legs + Full body (5x semana)';
  }

  return 'Divisao classica (5x semana)';
}

function getWorkoutDayIndex() {
  const jsDay = new Date().getDay();
  return (jsDay + 6) % 7;
}

function getWorkoutBySplit(split) {
  const dayIndex = getWorkoutDayIndex();

  if (!split || split.includes('Full body')) {
    return WORKOUT_LIBRARY.fullBody;
  }

  if (split.includes('Superior/Inferior')) {
    return dayIndex % 2 === 0 ? WORKOUT_LIBRARY.upper : WORKOUT_LIBRARY.lower;
  }

  if (split.includes('Push/Pull/Legs')) {
    const ppl = [WORKOUT_LIBRARY.push, WORKOUT_LIBRARY.pull, WORKOUT_LIBRARY.legs];
    return ppl[dayIndex % 3];
  }

  const classic = [WORKOUT_LIBRARY.push, WORKOUT_LIBRARY.pull, WORKOUT_LIBRARY.legs, WORKOUT_LIBRARY.upper, WORKOUT_LIBRARY.lower];
  return classic[dayIndex % classic.length];
}

function getLevelFromXp(xp) {
  return Math.max(1, Math.floor(Number(xp || 0) / XP_RULES.xpPerLevel) + 1);
}

function getLevelLabel(level) {
  if (level <= 1) {
    return 'Iniciante';
  }

  if (level === 2) {
    return 'Intermediario';
  }

  return 'Avancado';
}

function getPreviousDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseQuantityFromText(text) {
  const normalized = normalizeText(text);
  const fractionMatch = normalized.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator > 0) {
      return numerator / denominator;
    }
  }

  const decimalMatch = normalized.match(/(\d+[\.,]?\d*)/);
  if (decimalMatch) {
    return Number(String(decimalMatch[1]).replace(',', '.'));
  }

  const word = Object.keys(FRACTION_WORDS).find((item) => normalized.includes(item));
  if (word) {
    return FRACTION_WORDS[word];
  }

  return 1;
}

function getNutritionMacroTargets(planData, profileData) {
  const calories = Number(planData?.caloriesPerDay || 0);
  const weight = Number(profileData?.currentWeight || 70);
  const goal = profileData?.goal;
  const proteinFactor = goal === 'emagrecer' ? 2 : goal === 'ganhar_massa' ? 1.8 : 1.9;
  const proteinTarget = round(weight * proteinFactor);
  const fatsTarget = round((calories * 0.27) / 9);
  const carbsTarget = round(Math.max(0, (calories - proteinTarget * 4 - fatsTarget * 9) / 4));

  const overrides = planData?.macroOverrides || {};
  return {
    protein: overrides.protein != null ? overrides.protein : proteinTarget,
    carbs: overrides.carbs != null ? overrides.carbs : carbsTarget,
    fats: overrides.fats != null ? overrides.fats : fatsTarget,
    calories,
  };
}

function classifyMacro(consumed, target) {
  if (!target) {
    return 'ok';
  }

  const ratio = Number(consumed || 0) / Number(target);

  if (ratio < 0.8) {
    return 'baixo';
  }

  if (ratio > 1.2) {
    return 'alto';
  }

  return 'ok';
}

function buildMacroInsight({ protein, carbs, fats, targets, trainedToday }) {
  const status = {
    protein: classifyMacro(protein, targets.protein),
    carbs: classifyMacro(carbs, targets.carbs),
    fats: classifyMacro(fats, targets.fats),
  };

  const feedback = [];

  if (status.protein === 'baixo') {
    feedback.push(
      trainedToday
        ? 'Proteina baixa hoje. Isso pode atrapalhar recuperacao muscular do treino.'
        : 'Proteina abaixo da meta. Subir proteina ajuda composicao corporal.'
    );
  }

  if (status.carbs === 'baixo' && trainedToday) {
    feedback.push('Carbo baixo para dia de treino. Energia e performance podem cair.');
  }

  if (status.fats === 'alto') {
    feedback.push('Gordura acima da meta. Ajuste porcoes para equilibrar calorias.');
  }

  if (!feedback.length) {
    feedback.push('Macros do dia estao em faixa aceitavel. Mantenha consistencia.');
  }

  return {
    status,
    message: feedback.join(' '),
  };
}

function estimateNutritionFromTextInput(inputText) {
  let text = normalizeText(inputText || '');
  if (!text.trim()) {
    return {
      ok: false,
      message: 'Digite os alimentos para estimar macros.',
    };
  }

  Object.entries(NUTRITION_SYNONYMS).forEach(([from, to]) => {
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedFrom}\\b`, 'g');
    text = text.replace(regex, to);
  });

  const chunks = text
    .split(/[,+;]|\se\s/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const items = [];
  const unknown = [];

  for (const chunk of chunks) {
    const food = NUTRITION_DB.find((entry) => chunk.includes(entry.key));
    if (!food) {
      unknown.push(chunk);
      continue;
    }

    const quantity = parseQuantityFromText(chunk);
    items.push({
      label: food.label,
      quantity,
      calories: round(food.calories * quantity),
      protein: round(food.protein * quantity),
      carbs: round(food.carbs * quantity),
      fats: round(food.fats * quantity),
    });
  }

  if (!items.length) {
    return {
      ok: false,
      message: 'Nao consegui identificar alimentos conhecidos. Tente termos simples.',
    };
  }

  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fats: acc.fats + item.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  return {
    ok: true,
    source: 'text',
    totals,
    items,
    unknown,
    message: unknown.length
      ? 'Estimativa concluida com alguns itens nao reconhecidos.'
      : 'Estimativa concluida com sucesso.',
  };
}

function estimateNutritionFromPhotoHintInput(description, portionFactor = 1) {
  const result = estimateNutritionFromTextInput(description);
  if (!result.ok) {
    return result;
  }

  const conservative = 1.1;
  const multiplier = Number(portionFactor || 1) * conservative;
  const totals = {
    calories: round(result.totals.calories * multiplier),
    protein: round(result.totals.protein * multiplier),
    carbs: round(result.totals.carbs * multiplier),
    fats: round(result.totals.fats * multiplier),
  };

  return {
    ...result,
    source: 'photo_hint',
    totals,
    message: 'Estimativa foto beta aplicada de forma conservadora (+10%).',
  };
}

function inferMuscleGroup(exerciseName = '') {
  const name = String(exerciseName);

  if (
    name.includes('Supino') ||
    name.includes('Crucifixo') ||
    name.includes('Peck')
  ) {
    return 'peito';
  }

  if (
    name.includes('Remada') ||
    name.includes('Puxada') ||
    name.includes('Pull')
  ) {
    return 'costas';
  }

  if (
    name.includes('Agachamento') ||
    name.includes('Leg Press') ||
    name.includes('Passada') ||
    name.includes('Extensora') ||
    name.includes('Flexora') ||
    name.includes('Panturrilha') ||
    name.includes('Stiff') ||
    name.includes('Terra')
  ) {
    return 'perna';
  }

  if (name.includes('Triceps')) {
    return 'triceps';
  }

  if (name.includes('Rosca') || name.includes('Biceps')) {
    return 'biceps';
  }

  if (name.includes('Desenvolvimento') || name.includes('Elevacao')) {
    return 'ombro';
  }

  return null;
}

function getExerciseCatalogFromSources(logs) {
  const libraryNames = Object.values(WORKOUT_LIBRARY)
    .flat()
    .map((item) => item.name);
  const loggedNames = logs.map((item) => item.exerciseName).filter(Boolean);
  return Array.from(new Set([...libraryNames, ...loggedNames])).sort((a, b) => a.localeCompare(b));
}

function generatePlan(profile) {
  const weight = Number(profile.currentWeight);
  const height = Number(profile.height);
  const days = Number(profile.trainingDaysPerWeek);

  const baseCalories = weight * 30 + height * 4 + days * 80;

  const strategy =
    profile.goal === 'emagrecer'
      ? 'cutting'
      : profile.goal === 'ganhar_massa'
      ? 'bulking'
      : 'recomposicao';

  const calories =
    strategy === 'cutting'
      ? round(baseCalories - 350)
      : strategy === 'bulking'
      ? round(baseCalories + 300)
      : round(baseCalories);

  const waterLiters = (weight * 35 + days * 250) / 1000;

  return {
    caloriesPerDay: clampCaloriesByStrategy(calories, strategy),
    waterLitersPerDay: Number(waterLiters.toFixed(1)),
    trainingSplit: buildInitialTraining(days, profile.level),
    strategy,
  };
}

function buildDailyInsight(planData, consumedCalories, trainedToday) {
  if (!planData) {
    return {
      status: 'sem_plano',
      message: 'Complete o questionario para liberar analise diaria.',
    };
  }

  const target = Number(planData.caloriesPerDay);
  const consumed = Number(consumedCalories);
  const delta = target - consumed;

  if (!consumed || consumed < 500) {
    return {
      status: 'dados_insuficientes',
      message: 'Informe calorias consumidas realistas para gerar recomendacao.',
    };
  }

  if (trainedToday && delta > 500) {
    return {
      status: 'recuperacao_baixa',
      message:
        'Hoje voce treinou e ficou com deficit alto. Aumente proteina e carboidrato no pos-treino para recuperar melhor.',
    };
  }

  if (!trainedToday && delta < -350) {
    return {
      status: 'excesso_sem_treino',
      message:
        'Hoje voce passou bastante das calorias sem treino. Tente equilibrar no proximo dia com refeicoes mais leves.',
    };
  }

  if (Math.abs(delta) <= 250) {
    return {
      status: 'otimo',
      message: 'Excelente. Seu dia ficou bem alinhado com o plano. Mantenha constancia.',
    };
  }

  if (delta > 250) {
    return {
      status: 'abaixo_meta',
      message: 'Voce ficou abaixo da meta calorica. Inclua uma refeicao estrategica para bater o objetivo.',
    };
  }

  return {
    status: 'acima_meta',
    message: 'Voce ficou acima da meta calorica. Ajuste porcoes nas proximas refeicoes do dia.',
  };
}

function buildWeeklyInsight({ summary, analyzedDays, profileData }) {
  if (!analyzedDays) {
    return {
      consistencyScore: 0,
      diagnosis: 'Ainda nao ha dados suficientes para analisar a semana.',
      recommendation: 'Registre pelo menos 3 dias para liberar um diagnostico util.',
    };
  }

  const expectedWeeklyDays = Number(profileData?.trainingDaysPerWeek || 3);
  const expectedInWindow = Math.max(1, round((expectedWeeklyDays / 7) * analyzedDays));
  const trainedRatio = Math.min(summary.trainedDays / expectedInWindow, 1);
  const targetRatio = (analyzedDays - summary.outOfTargetDays) / analyzedDays;
  const consistencyScore = round(trainedRatio * 45 + targetRatio * 55);

  if (consistencyScore >= 80) {
    return {
      consistencyScore,
      diagnosis:
        'Semana consistente. Voce manteve boa aderencia entre treino e nutricao na maior parte dos dias.',
      recommendation:
        'Mantenha a estrategia atual e ajuste apenas detalhes de porcao e horario para continuar evoluindo.',
    };
  }

  if (consistencyScore >= 55) {
    return {
      consistencyScore,
      diagnosis:
        'Semana mediana. Houve consistencia parcial, mas ainda com oscilacoes em treino ou meta calorica.',
      recommendation:
        'Priorize 1 ajuste por vez: bater calorias por 3 dias seguidos e manter frequencia minima de treino.',
    };
  }

  return {
    consistencyScore,
    diagnosis:
      'Semana irregular. Baixa consistencia entre treino e alimentacao pode atrasar seu resultado.',
    recommendation:
      'Simplifique o plano desta semana: foco em treinar nos dias planejados e reduzir desvios caloricos grandes.',
  };
}

function buildTrainingAdjustment({ trainingGap, consistencyScore }) {
  if (trainingGap >= 2) {
    return 'Reduzir intensidade do treino por 1 semana e priorizar execucao e recuperacao.';
  }

  if (consistencyScore >= 80) {
    return 'Manter intensidade e progredir carga levemente nos exercicios principais.';
  }

  return 'Manter intensidade atual e focar em consistencia nos proximos 7 dias.';
}

export const AppProvider=({children})=>{
  const [user,setUser]=useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [exerciseTargets, setExerciseTargets] = useState({});
  const [gamification, setGamification] = useState({
    xp: 0,
    lastWorkoutXpDate: null,
    streakDays: 0,
    lastWorkoutDate: null,
    completedMissions: {},
  });
  const [monetization, setMonetization] = useState(DEFAULT_MONETIZATION);
  const [isHydrated, setIsHydrated] = useState(false);

  const hasCompletedQuestionnaire = useMemo(() => Boolean(profile && plan), [profile, plan]);

  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed?.profile && parsed?.plan) {
          setProfile(parsed.profile);
          setPlan(parsed.plan);
        }

        if (Array.isArray(parsed?.history)) {
          setHistory(parsed.history);
        }

        if (Array.isArray(parsed?.workoutLogs)) {
          setWorkoutLogs(parsed.workoutLogs);
        }

        if (parsed?.exerciseTargets && typeof parsed.exerciseTargets === 'object') {
          setExerciseTargets(parsed.exerciseTargets);
        }

        if (parsed?.gamification && typeof parsed.gamification === 'object') {
          setGamification({
            xp: Number(parsed.gamification.xp || 0),
            lastWorkoutXpDate: parsed.gamification.lastWorkoutXpDate || null,
            streakDays: Number(parsed.gamification.streakDays || 0),
            lastWorkoutDate: parsed.gamification.lastWorkoutDate || null,
            completedMissions: (parsed.gamification.completedMissions && typeof parsed.gamification.completedMissions === 'object')
              ? parsed.gamification.completedMissions
              : {},
          });
        }

        if (parsed?.monetization && typeof parsed.monetization === 'object') {
          setMonetization({
            plan: parsed.monetization.plan === 'pro' ? 'pro' : 'free',
            trialStartedAt: parsed.monetization.trialStartedAt || null,
            trialDays: Number(parsed.monetization.trialDays || 3),
            proSince: parsed.monetization.proSince || null,
          });
        }
      } catch (error) {
        // Silently ignore corrupted local data.
      } finally {
        setIsHydrated(true);
      }
    };

    loadFromStorage();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persist = async () => {
      try {
        if (profile && plan) {
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              profile,
              plan,
              history,
              workoutLogs,
              exerciseTargets,
              gamification,
              monetization,
            })
          );
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        // Ignore storage write errors to avoid breaking UX.
      }
    };

    persist();
  }, [profile, plan, history, workoutLogs, exerciseTargets, gamification, monetization, isHydrated]);

  const saveQuestionnaire = (formData) => {
    const normalized = {
      goal: formData.goal,
      level: formData.level,
      currentWeight: Number(formData.currentWeight),
      targetWeight: Number(formData.targetWeight),
      height: Number(formData.height),
      trainingDaysPerWeek: Number(formData.trainingDaysPerWeek),
    };

    setProfile(normalized);
    setPlan(generatePlan(normalized));
  };

  const resetQuestionnaire = () => {
    setProfile(null);
    setPlan(null);
    setHistory([]);
    setWorkoutLogs([]);
    setExerciseTargets({});
    setGamification({
      xp: 0,
      lastWorkoutXpDate: null,
      streakDays: 0,
      lastWorkoutDate: null,
      completedMissions: {},
    });
    setMonetization(DEFAULT_MONETIZATION);
  };

  const getSubscriptionStatus = () => {
    const isProPlan = monetization.plan === 'pro';
    const trialStart = monetization.trialStartedAt;
    const trialDays = Number(monetization.trialDays || 3);

    if (isProPlan) {
      return {
        isPro: true,
        source: 'pro',
        trialRemainingDays: 0,
      };
    }

    if (!trialStart) {
      return {
        isPro: false,
        source: 'free',
        trialRemainingDays: 0,
      };
    }

    const startDate = new Date(`${trialStart}T12:00:00`);
    const todayDate = new Date(`${getTodayKey()}T12:00:00`);
    const elapsed = Math.max(0, Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)));
    const remaining = Math.max(0, trialDays - elapsed);

    return {
      isPro: remaining > 0,
      source: remaining > 0 ? 'trial' : 'free',
      trialRemainingDays: remaining,
    };
  };

  const hasFeatureAccess = (featureKey) => {
    const freeFeatures = new Set([
      'guided_workout',
      'free_workout',
      'sets_logging',
      'scanner_text',
      'history_basic',
      'xp_levels',
      'day_analysis',
    ]);

    if (freeFeatures.has(featureKey)) {
      return true;
    }

    return getSubscriptionStatus().isPro;
  };

  const startProTrial = () => {
    setMonetization((prev) => {
      if (prev.plan === 'pro' || prev.trialStartedAt) {
        return prev;
      }

      return {
        ...prev,
        trialStartedAt: getTodayKey(),
        trialDays: Number(prev.trialDays || 3),
      };
    });
  };

  const activateProPlan = () => {
    setMonetization((prev) => ({
      ...prev,
      plan: 'pro',
      proSince: getTodayKey(),
    }));
  };

  const saveDailyHistory = ({ consumedCalories, protein, carbs, fats, trainedToday, insight, macroInsight }) => {
    const entryDate = getTodayKey();
    const normalizedEntry = {
      date: entryDate,
      calories: Number(consumedCalories),
      protein: Number(protein || 0),
      carbs: Number(carbs || 0),
      fats: Number(fats || 0),
      trained: Boolean(trainedToday),
      status: normalizeHistoryStatus(insight.status),
      insight: insight.message,
      macroInsight: macroInsight?.message || '',
    };

    setHistory((prev) => {
      const withoutToday = prev.filter((item) => item.date !== entryDate);
      const next = [normalizedEntry, ...withoutToday];
      return next.slice(0, 30);
    });
  };

  const saveNutritionEntry = ({ calories, protein, carbs, fats }) => {
    const entryDate = getTodayKey();

    setHistory((prev) => {
      const existing = prev.find((item) => item.date === entryDate);
      const normalizedEntry = {
        date: entryDate,
        calories: Number(calories || 0),
        protein: Number(protein || 0),
        carbs: Number(carbs || 0),
        fats: Number(fats || 0),
        trained: Boolean(existing?.trained),
        status: existing?.status || 'ok',
        insight: existing?.insight || 'Nutricao registrada pelo scanner.',
        macroInsight: existing?.macroInsight || '',
      };

      const withoutToday = prev.filter((item) => item.date !== entryDate);
      const next = [normalizedEntry, ...withoutToday];
      return next.slice(0, 30);
    });

    return {
      ok: true,
      message: 'Nutricao salva no historico de hoje.',
    };
  };

  const analyzeDay = ({ consumedCalories, protein, carbs = 0, fats = 0, trainedToday }) => {
    const insight = buildDailyInsight(plan, consumedCalories, trainedToday);
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const macroInsight = buildMacroInsight({
      protein: Number(protein || 0),
      carbs: Number(carbs || 0),
      fats: Number(fats || 0),
      targets: macroTargets,
      trainedToday,
    });

    if (insight.status !== 'sem_plano' && insight.status !== 'dados_insuficientes') {
      saveDailyHistory({
        consumedCalories,
        protein,
        carbs,
        fats,
        trainedToday,
        insight,
        macroInsight,
      });
    }

    return {
      ...insight,
      macroInsight,
      macroTargets,
    };
  };

  const getRecentHistory = () => {
    return history.slice(0, 7);
  };

  const getWeeklySummary = () => {
    const last7 = history.slice(0, 7);

    if (!last7.length) {
      return {
        averageCalories: 0,
        trainedDays: 0,
        outOfTargetDays: 0,
      };
    }

    const totalCalories = last7.reduce((acc, item) => acc + Number(item.calories || 0), 0);
    const trainedDays = last7.filter((item) => item.trained).length;
    const outOfTargetDays = last7.filter((item) => item.status !== 'ok').length;

    return {
      averageCalories: round(totalCalories / last7.length),
      trainedDays,
      outOfTargetDays,
    };
  };

  const getWeeklyInsight = () => {
    const summary = getWeeklySummary();
    const analyzedDays = history.slice(0, 7).length;
    return buildWeeklyInsight({
      summary,
      analyzedDays,
      profileData: profile,
    });
  };

  const getWeeklyMacroSummary = () => {
    const last7 = history.slice(0, 7);
    const macroTargets = getNutritionMacroTargets(plan, profile);

    if (!last7.length) {
      return {
        days: [],
        avgProtein: 0,
        avgCarbs: 0,
        avgFats: 0,
        avgCalories: 0,
        trainedDays: 0,
        lowProteinDays: 0,
        lowCarbDays: 0,
        highFatDays: 0,
        trainedWithLowProtein: 0,
        macroTargets,
        insight: '',
        analyzedDays: 0,
      };
    }

    let totalProtein = 0, totalCarbs = 0, totalFats = 0, totalCalories = 0;
    let trainedDays = 0, lowProteinDays = 0, lowCarbDays = 0, highFatDays = 0;
    let trainedWithLowProtein = 0;

    const days = last7.map((item) => {
      const p = Number(item.protein || 0);
      const c = Number(item.carbs || 0);
      const f = Number(item.fats || 0);
      const cal = Number(item.calories || 0);

      totalProtein += p;
      totalCarbs += c;
      totalFats += f;
      totalCalories += cal;

      const proteinStatus = classifyMacro(p, macroTargets.protein);
      const carbStatus = classifyMacro(c, macroTargets.carbs);
      const fatStatus = classifyMacro(f, macroTargets.fats);

      if (item.trained) trainedDays++;
      if (proteinStatus === 'baixo') lowProteinDays++;
      if (carbStatus === 'baixo') lowCarbDays++;
      if (fatStatus === 'alto') highFatDays++;
      if (item.trained && proteinStatus === 'baixo') trainedWithLowProtein++;

      return {
        date: item.date,
        calories: cal,
        protein: p,
        carbs: c,
        fats: f,
        trained: item.trained,
        status: item.status,
        proteinStatus,
        carbStatus,
        fatStatus,
      };
    });

    const n = last7.length;
    const avgProtein = round(totalProtein / n);
    const avgCarbs = round(totalCarbs / n);
    const avgFats = round(totalFats / n);
    const avgCalories = round(totalCalories / n);

    const insightParts = [];

    if (trainedWithLowProtein >= 2) {
      insightParts.push(
        `Voce treinou com proteina insuficiente ${trainedWithLowProtein} vez(es) esta semana — isso pode estar limitando sua recuperacao e ganho de forca.`
      );
    } else if (lowProteinDays >= 3) {
      insightParts.push(
        `Sua proteina esteve baixa em ${lowProteinDays} dos ${n} dias registrados. Aumentar esse macro acelera resultados.`
      );
    }

    if (lowCarbDays >= 3 && trainedDays >= 2) {
      insightParts.push(
        `Carbo baixo em dias de treino reduz energia disponivel e pode comprometer a performance.`
      );
    }

    if (highFatDays >= 3) {
      insightParts.push(
        `Gordura acima do ideal em ${highFatDays} dias pode estar deslocando calorias de proteina e carbo.`
      );
    }

    if (trainedDays === 0 && n >= 3) {
      insightParts.push(
        'Nenhum treino registrado nessa semana. Retome a consistencia para nao perder o progresso.'
      );
    } else if (trainedDays >= 4 && lowProteinDays <= 1) {
      insightParts.push(
        'Excelente: treino consistente e proteina em dia. Suas chances de evolucao estao altas!'
      );
    }

    if (!insightParts.length) {
      insightParts.push(
        'Continue assim! Seus macros e treinos estao dentro do esperado para esta semana.'
      );
    }

    return {
      days,
      avgProtein,
      avgCarbs,
      avgFats,
      avgCalories,
      trainedDays,
      lowProteinDays,
      lowCarbDays,
      highFatDays,
      trainedWithLowProtein,
      macroTargets,
      insight: insightParts.join(' '),
      analyzedDays: n,
    };
  };

  const getAutoAdjustmentSuggestion = () => {
    if (!plan || !profile) {
      return {
        canApply: false,
        message: 'Complete o questionario para liberar ajuste automatico.',
      };
    }

    const last7 = history.slice(0, 7);
    const analyzedDays = last7.length;

    if (analyzedDays < 3) {
      return {
        canApply: false,
        message: 'Registre ao menos 3 dias para gerar ajuste automatico seguro.',
      };
    }

    const summary = getWeeklySummary();
    const weeklyInsight = getWeeklyInsight();
    const expectedWeeklyDays = Number(profile.trainingDaysPerWeek || 3);
    const expectedInWindow = Math.max(1, round((expectedWeeklyDays / 7) * analyzedDays));
    const trainingGap = Math.max(0, expectedInWindow - summary.trainedDays);
    const belowDays = last7.filter((item) => item.status === 'abaixo').length;
    const aboveDays = last7.filter((item) => item.status === 'acima').length;

    let calorieDelta = 0;

    if (profile.goal === 'emagrecer') {
      if (aboveDays >= belowDays + 1) {
        calorieDelta -= 120;
      } else if (belowDays >= aboveDays + 2) {
        calorieDelta += 80;
      }
    } else if (profile.goal === 'ganhar_massa') {
      if (belowDays >= aboveDays + 1) {
        calorieDelta += 120;
      } else if (aboveDays >= belowDays + 2) {
        calorieDelta -= 80;
      }
    } else {
      if (aboveDays - belowDays >= 2) {
        calorieDelta -= 100;
      } else if (belowDays - aboveDays >= 2) {
        calorieDelta += 100;
      }
    }

    if (weeklyInsight.consistencyScore < 50) {
      calorieDelta = round(calorieDelta * 0.5);
    }

    calorieDelta = clamp(calorieDelta, -150, 150);
    const currentCalories = Number(plan.caloriesPerDay);
    const newCalories = clampCaloriesByStrategy(currentCalories + calorieDelta, plan.strategy);

    return {
      canApply: true,
      currentCalories,
      newCalories,
      calorieDelta: newCalories - currentCalories,
      trainingAdjustment: buildTrainingAdjustment({
        trainingGap,
        consistencyScore: weeklyInsight.consistencyScore,
      }),
      message:
        newCalories === currentCalories
          ? 'Plano calorico mantido. Ajuste principal da semana sera na consistencia de execucao.'
          : 'Ajuste calculado com limite seguro para a proxima semana.',
      generatedAt: getTodayKey(),
    };
  };

  const applyAutoPlanAdjustment = () => {
    const suggestion = getAutoAdjustmentSuggestion();

    if (!suggestion.canApply) {
      return suggestion;
    }

    setPlan((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        caloriesPerDay: suggestion.newCalories,
        weeklyTrainingAdjustment: suggestion.trainingAdjustment,
        lastAutoAdjustmentAt: suggestion.generatedAt,
      };
    });

    return suggestion;
  };

  const getTodayWorkout = () => {
    return getWorkoutBySplit(plan?.trainingSplit).map((exercise, index) => ({
      ...exercise,
      id: `${exercise.name}-${index}`,
      targetWeight: Number(exerciseTargets[exercise.name]?.targetWeight || 0),
    }));
  };

  const prepareTodayWorkoutTargets = () => {
    const today = getTodayKey();
    const todayWorkout = getWorkoutBySplit(plan?.trainingSplit);

    if (!todayWorkout.length) {
      return;
    }

    setExerciseTargets((prev) => {
      let hasChanged = false;
      const next = { ...prev };

      for (const exercise of todayWorkout) {
        const current = next[exercise.name] || {};

        if (current.lastAutoAppliedDate === today) {
          continue;
        }

        const suggestion = getExerciseProgressionSuggestion(exercise.name);

        if (suggestion.level === 'aumentar' || suggestion.level === 'reduzir') {
          next[exercise.name] = {
            targetWeight: suggestion.suggestedWeight,
            lastAutoAppliedDate: today,
            lastSuggestionLevel: suggestion.level,
          };
          hasChanged = true;
          continue;
        }

        if (!current.targetWeight && suggestion.suggestedWeight > 0) {
          next[exercise.name] = {
            ...current,
            targetWeight: suggestion.suggestedWeight,
          };
          hasChanged = true;
        }
      }

      return hasChanged ? next : prev;
    });
  };

  const saveWorkoutSet = ({ exerciseName, weight, reps, failed, mode = 'guided' }) => {
    const parsedWeight = Number(weight);
    const parsedReps = Number(reps);

    if (!exerciseName || !parsedWeight || !parsedReps || parsedWeight < 0 || parsedReps <= 0) {
      return { ok: false, message: 'Informe peso e repeticoes validos.' };
    }

    const todayKey = getTodayKey();
    const previousLogsForExercise = workoutLogs.filter((item) => item.exerciseName === exerciseName);
    const bestPreviousWeight = previousLogsForExercise
      .filter((item) => !item.failed)
      .reduce((best, item) => Math.max(best, Number(item.weight || 0)), 0);
    const isNewLoadPR = !failed && parsedWeight > bestPreviousWeight;

    let workoutCompletionXp = 0;
    const todayGuidedBefore = workoutLogs.filter(
      (item) => item.date === todayKey && (item.mode || 'guided') !== 'free'
    ).length;
    const plannedGuidedSets = getWorkoutBySplit(plan?.trainingSplit).reduce(
      (acc, item) => acc + Number(item.sets || 0),
      0
    );
    const willCompleteWorkoutToday =
      mode === 'guided' &&
      plannedGuidedSets > 0 &&
      todayGuidedBefore + 1 >= plannedGuidedSets &&
      gamification.lastWorkoutXpDate !== todayKey;

    if (willCompleteWorkoutToday) {
      workoutCompletionXp += XP_RULES.completeWorkout;
    }

    const consistencyBonusXp =
      willCompleteWorkoutToday &&
      gamification.lastWorkoutDate === getPreviousDateKey(todayKey) &&
      (Number(gamification.streakDays || 0) + 1) % 3 === 0
        ? XP_RULES.consistencyBonus
        : 0;

    const xpDelta =
      XP_RULES.completeSet +
      (isNewLoadPR ? XP_RULES.newLoadPR : 0) +
      workoutCompletionXp +
      consistencyBonusXp;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: todayKey,
      createdAt: new Date().toISOString(),
      exerciseName,
      weight: parsedWeight,
      reps: parsedReps,
      failed: Boolean(failed),
      mode,
    };

    setWorkoutLogs((prev) => [entry, ...prev]);

    setExerciseTargets((prev) => ({
      ...prev,
      [exerciseName]: {
        ...(prev[exerciseName] || {}),
        targetWeight: parsedWeight,
      },
    }));

    setGamification((prev) => {
      const prevXp = Number(prev?.xp || 0);
      const previousDate = prev?.lastWorkoutDate || null;
      const isConsecutive = previousDate === getPreviousDateKey(todayKey);
      const sameDay = previousDate === todayKey;
      const nextStreak = willCompleteWorkoutToday
        ? sameDay
          ? Number(prev?.streakDays || 1)
          : isConsecutive
          ? Number(prev?.streakDays || 0) + 1
          : 1
        : Number(prev?.streakDays || 0);

      return {
        xp: prevXp + xpDelta,
        lastWorkoutXpDate: willCompleteWorkoutToday ? todayKey : prev?.lastWorkoutXpDate || null,
        streakDays: nextStreak,
        lastWorkoutDate: willCompleteWorkoutToday ? todayKey : previousDate,
      };
    });

    return {
      ok: true,
      xpDelta,
      xpEvents: [
        `+${XP_RULES.completeSet} XP por serie concluida`,
        ...(isNewLoadPR ? [`+${XP_RULES.newLoadPR} XP por nova carga`] : []),
        ...(workoutCompletionXp ? [`+${workoutCompletionXp} XP por treino completo`] : []),
        ...(consistencyBonusXp ? [`+${consistencyBonusXp} XP bonus de consistencia`] : []),
      ],
    };
  };

  const getExerciseSetProgress = (exerciseName, plannedSets = 3) => {
    const today = getTodayKey();
    const todayExerciseLogs = workoutLogs.filter(
      (item) => item.date === today && item.exerciseName === exerciseName
    );
    const completedSets = todayExerciseLogs.length;
    const totalSets = Math.max(1, Number(plannedSets) || 1);
    const nextSet = Math.min(totalSets, completedSets + 1);

    return {
      completedSets,
      totalSets,
      nextSet,
      isDone: completedSets >= totalSets,
    };
  };

  const getExerciseCatalog = () => {
    return getExerciseCatalogFromSources(workoutLogs);
  };

  const getFreeWorkoutSuggestions = (selectedExercises = []) => {
    const normalized = Array.isArray(selectedExercises) ? selectedExercises : [];
    const used = new Set(normalized);
    const groups = Array.from(
      new Set(normalized.map((name) => inferMuscleGroup(name)).filter(Boolean))
    );
    const catalog = getExerciseCatalogFromSources(workoutLogs);
    const suggestions = [];

    for (const group of groups) {
      const defaults = MUSCLE_SUGGESTION_MAP[group] || [];
      for (const name of defaults) {
        if (!used.has(name) && !suggestions.includes(name)) {
          suggestions.push(name);
        }
      }
    }

    for (const item of catalog) {
      if (suggestions.length >= 5) {
        break;
      }

      if (!used.has(item) && !suggestions.includes(item)) {
        suggestions.push(item);
      }
    }

    return suggestions.slice(0, 5);
  };

  const saveFreeWorkoutSet = ({ exerciseName, weight, reps, failed }) => {
    const result = saveWorkoutSet({ exerciseName, weight, reps, failed, mode: 'free' });

    if (!result.ok) {
      return result;
    }

    setWorkoutLogs((prev) => {
      if (!prev.length) {
        return prev;
      }

      const [latest, ...rest] = prev;
      return [{ ...latest, mode: 'free' }, ...rest];
    });

    return result;
  };

  const getExerciseProgress = (exerciseName) => {
    const logs = workoutLogs.filter((item) => item.exerciseName === exerciseName);

    if (!logs.length) {
      return {
        bestWeight: 0,
        totalSets: 0,
        recentAverageReps: 0,
      };
    }

    const successful = logs.filter((item) => !item.failed);
    const recent = successful.slice(0, 5);
    const totalReps = recent.reduce((acc, item) => acc + Number(item.reps || 0), 0);

    return {
      bestWeight: successful.length
        ? Math.max(...successful.map((item) => Number(item.weight || 0)))
        : 0,
      totalSets: logs.length,
      recentAverageReps: recent.length ? round(totalReps / recent.length) : 0,
    };
  };

  const getExerciseProgressionSuggestion = (exerciseName) => {
    const logs = workoutLogs.filter((item) => item.exerciseName === exerciseName);
    const template = getExerciseTemplate(exerciseName);
    const repRange = parseRepRange(template?.reps);
    const step = getProgressionStep(exerciseName);

    const withFallback = (partial) => ({
      confidence: buildConfidence(logs.length, logs.slice(0, 3)),
      reason: partial.message,
      ...partial,
    });

    if (!logs.length) {
      const starter = getDefaultStartingWeight(exerciseName, profile?.level);
      return {
        level: 'sem_dados',
        suggestedWeight: starter,
        delta: 0,
        confidence: 'baixa',
        message: 'Primeiro uso deste exercicio. Carga inicial sugerida com foco em tecnica.',
        reason: 'Sem historico anterior.',
      };
    }

    const recent = logs.slice(0, 6);
    const recentSuccess = recent.filter((item) => !item.failed);
    const last3 = recent.slice(0, 3);
    const failInLast3 = last3.filter((item) => item.failed).length;
    const successInLast3 = last3.filter((item) => !item.failed).length;
    const reference = Number((recentSuccess[0] || recent[0]).weight || 0);

    if (!reference || reference <= 0) {
      const starter = getDefaultStartingWeight(exerciseName, profile?.level);
      return {
        level: 'sem_dados',
        suggestedWeight: starter,
        delta: 0,
        confidence: 'baixa',
        message: 'Carga anterior invalida. Usando valor inicial seguro.',
        reason: 'Historico sem carga valida.',
      };
    }

    if (last3.length < 3) {
      return withFallback({
        level: 'manter',
        suggestedWeight: roundToStep(reference),
        delta: 0,
        message: 'Mais alguns registros sao necessarios para ajustar com seguranca.',
      });
    }

    if (failInLast3 >= 2) {
      const suggested = Math.max(5, roundToStep(reference - step));
      return withFallback({
        level: 'reduzir',
        suggestedWeight: suggested,
        delta: roundToStep(suggested - reference),
        message: 'Houve falhas recentes. Reduza carga para manter tecnica e diminuir risco.',
      });
    }

    if (successInLast3 === 3) {
      const last3AvgReps = round(
        last3.reduce((acc, item) => acc + Number(item.reps || 0), 0) / successInLast3
      );

      if (last3AvgReps >= repRange.max) {
        const suggested = roundToStep(reference + step);
        return withFallback({
          level: 'aumentar',
          suggestedWeight: suggested,
          delta: roundToStep(suggested - reference),
          message: 'Boa consistencia. Sugestao de progressao leve para proxima sessao.',
        });
      }
    }

    return withFallback({
      level: 'manter',
      suggestedWeight: roundToStep(reference),
      delta: 0,
      message: 'Mantenha a carga e busque estabilidade de repeticoes antes de subir peso.',
    });
  };

  const getTodayWorkoutSummary = () => {
    const today = getTodayKey();
    const todayLogs = workoutLogs.filter((item) => item.date === today);
    const todayGuidedLogs = todayLogs.filter((item) => (item.mode || 'guided') !== 'free');
    const plannedSets = getWorkoutBySplit(plan?.trainingSplit).reduce(
      (acc, item) => acc + Number(item.sets || 0),
      0
    );
    const uniqueExercises = new Set(todayLogs.map((item) => item.exerciseName));

    return {
      totalSets: todayLogs.length,
      totalExercises: uniqueExercises.size,
      guidedSets: todayGuidedLogs.length,
      plannedSets,
      completionRate: plannedSets ? clamp(todayGuidedLogs.length / plannedSets, 0, 1) : 0,
    };
  };

  const getWorkoutGamification = () => {
    const xp = Number(gamification.xp || 0);
    const level = getLevelFromXp(xp);
    const currentLevelBaseXp = (level - 1) * XP_RULES.xpPerLevel;
    const nextLevelXp = level * XP_RULES.xpPerLevel;
    const xpInLevel = xp - currentLevelBaseXp;
    const xpNeeded = nextLevelXp - currentLevelBaseXp;

    return {
      xp,
      level,
      levelLabel: getLevelLabel(level),
      streakDays: Number(gamification.streakDays || 0),
      xpInLevel,
      xpNeeded,
      progress: xpNeeded ? clamp(xpInLevel / xpNeeded, 0, 1) : 0,
    };
  };

  const estimateNutritionFromText = (inputText) => {
    return estimateNutritionFromTextInput(inputText);
  };

  const estimateNutritionFromPhotoHint = ({ description, portionFactor = 1 }) => {
    return estimateNutritionFromPhotoHintInput(description, portionFactor);
  };

  const getDailyMacroTargets = () => {
    return getNutritionMacroTargets(plan, profile);
  };

  const getPerformanceScore = () => {
    const last7 = history.slice(0, 7);
    const n = last7.length;
    if (!n) {
      return { score: 0, training: 0, diet: 0, consistency: 0, label: 'Sem dados', maxTraining: 40, maxDiet: 35, maxConsistency: 25 };
    }
    const gamif = getWorkoutGamification();
    const expectedDays = Number(profile?.trainingDaysPerWeek || 3);
    const expectedInWindow = Math.max(1, round((expectedDays / 7) * 7));
    const trainedDays = last7.filter((h) => h.trained).length;
    const trainingScore = Math.round(clamp(trainedDays / expectedInWindow, 0, 1) * 40);
    const macroTargets = getNutritionMacroTargets(plan, profile);
    let dietPoints = 0;
    last7.forEach((h) => {
      const pRatio = macroTargets.protein ? clamp(Number(h.protein || 0) / macroTargets.protein, 0, 1.2) : 0;
      const calRatio = plan?.caloriesPerDay ? clamp(Number(h.calories || 0) / plan.caloriesPerDay, 0, 1.2) : 0;
      dietPoints += (pRatio + calRatio) / 2;
    });
    const dietScore = Math.round(clamp(dietPoints / n, 0, 1) * 35);
    const daysLoggedRatio = clamp(n / 7, 0, 1);
    const streakFactor = clamp(gamif.streakDays / 7, 0, 1);
    const consistencyScore = Math.round(((daysLoggedRatio * 0.6) + (streakFactor * 0.4)) * 25);
    const totalScore = trainingScore + dietScore + consistencyScore;
    let label;
    if (totalScore >= 85) label = 'Elite';
    else if (totalScore >= 70) label = 'Forte';
    else if (totalScore >= 50) label = 'Em evolucao';
    else if (totalScore >= 30) label = 'Iniciando';
    else label = 'Pouco dados';
    return { score: totalScore, training: trainingScore, diet: dietScore, consistency: consistencyScore, label, maxTraining: 40, maxDiet: 35, maxConsistency: 25 };
  };

  const getAutoCoachSuggestions = () => {
    const weeklyMacro = getWeeklyMacroSummary();
    const { avgProtein, avgCarbs, avgFats, trainedDays, lowProteinDays, lowCarbDays, highFatDays, trainedWithLowProtein, macroTargets, analyzedDays } = weeklyMacro;
    if (analyzedDays < 3) {
      return { hasData: false, message: 'Registre ao menos 3 dias para o Auto Coach agir.', suggestions: [] };
    }
    const overrides = plan?.macroOverrides || {};
    const suggestions = [];
    if (lowProteinDays >= 3 || trainedWithLowProtein >= 2) {
      const currentTarget = overrides.protein != null ? overrides.protein : macroTargets.protein;
      const newTarget = Math.round(currentTarget * 1.1);
      suggestions.push({
        id: 'protein_up',
        icon: '💪',
        title: 'Aumentar meta de proteina',
        reason: trainedWithLowProtein >= 2
          ? `Voce treinou ${trainedWithLowProtein}x com proteina insuficiente esta semana. Sua recuperacao e ganho de forca podem estar comprometidos.`
          : `Proteina abaixo da meta em ${lowProteinDays} de ${analyzedDays} dias registrados.`,
        action: `Meta vai de ${Math.round(currentTarget)}g → ${newTarget}g por dia (+${newTarget - Math.round(currentTarget)}g)`,
        payload: { protein: newTarget },
      });
    }
    if (lowCarbDays >= 3 && trainedDays >= 2) {
      const currentTarget = overrides.carbs != null ? overrides.carbs : macroTargets.carbs;
      const newTarget = Math.round(currentTarget * 1.1);
      suggestions.push({
        id: 'carbs_up',
        icon: '⚡',
        title: 'Ajustar carboidrato para treinos',
        reason: `Carbo abaixo do ideal em ${lowCarbDays} dias com ${trainedDays} treinos na semana. Isso reduz energia disponivel para performance.`,
        action: `Meta vai de ${Math.round(currentTarget)}g → ${newTarget}g por dia (+${newTarget - Math.round(currentTarget)}g)`,
        payload: { carbs: newTarget },
      });
    }
    if (highFatDays >= 3) {
      const currentTarget = overrides.fats != null ? overrides.fats : macroTargets.fats;
      const newTarget = Math.round(currentTarget * 0.9);
      suggestions.push({
        id: 'fats_down',
        icon: '🎯',
        title: 'Reduzir gordura',
        reason: `Gordura acima do ideal em ${highFatDays} dias. Pode estar deslocando calorias de proteina e carbo.`,
        action: `Meta vai de ${Math.round(currentTarget)}g → ${newTarget}g por dia (${newTarget - Math.round(currentTarget)}g)`,
        payload: { fats: newTarget },
      });
    }
    if (trainedDays === 0 && analyzedDays >= 3) {
      suggestions.push({
        id: 'training_alert',
        icon: '🏋️',
        title: 'Nenhum treino registrado',
        reason: `Voce nao registrou nenhum treino nos ultimos ${analyzedDays} dias. A consistencia e o fator mais importante para evolucao.`,
        action: 'Acesse Treino PRO ou Treino Livre para iniciar hoje',
        payload: null,
      });
    }
    const applied = plan?.macroOverrides?.lastAppliedAt;
    return { hasData: true, suggestions, applied, weeklyMacro };
  };

  const applyMacroOverride = (payload) => {
    if (!payload) return;
    setPlan((prev) => ({
      ...prev,
      macroOverrides: {
        ...(prev?.macroOverrides || {}),
        ...payload,
        lastAppliedAt: getTodayKey(),
      },
    }));
  };

  const getDailyMissions = () => {
    const todayKey = getTodayKey();
    const completed = gamification.completedMissions?.[todayKey] || [];
    const todayHistory = history.find((h) => h.date === todayKey);
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const todayLogs = workoutLogs.filter((l) => l.date === todayKey);
    const gamif = getWorkoutGamification();
    const missions = [
      {
        id: 'hit_protein_today',
        icon: '🥩',
        title: 'Bater proteina hoje',
        description: `Consumir ${Math.round(macroTargets.protein)}g de proteina`,
        xpReward: 20,
        completed: completed.includes('hit_protein_today'),
        type: 'nutrition',
      },
      {
        id: 'complete_workout_today',
        icon: '🏋️',
        title: 'Completar treino hoje',
        description: 'Registrar ao menos 3 series no treino de hoje',
        xpReward: 30,
        completed: completed.includes('complete_workout_today') || todayLogs.length >= 3,
        type: 'workout',
      },
      {
        id: 'log_day_today',
        icon: '📊',
        title: 'Analisar o dia hoje',
        description: 'Registrar calorias e macros do dia na analise diaria',
        xpReward: 15,
        completed: completed.includes('log_day_today') || Boolean(todayHistory),
        type: 'consistency',
      },
    ];
    if (gamif.streakDays >= 2) {
      missions.push({
        id: 'keep_streak',
        icon: '🔥',
        title: `Manter streak de ${gamif.streakDays + 1} dias`,
        description: 'Treinar hoje para manter o streak ativo',
        xpReward: 25,
        completed: completed.includes('keep_streak') || todayLogs.length >= 1,
        type: 'streak',
      });
    }
    return missions;
  };

  const completeMission = (missionId, xpReward) => {
    const todayKey = getTodayKey();
    setGamification((prev) => {
      const prevCompleted = prev.completedMissions?.[todayKey] || [];
      if (prevCompleted.includes(missionId)) return prev;
      return {
        ...prev,
        xp: Number(prev.xp || 0) + Number(xpReward || 10),
        completedMissions: {
          ...(prev.completedMissions || {}),
          [todayKey]: [...prevCompleted, missionId],
        },
      };
    });
  };

  return(
    <AppContext.Provider
      value={{
        user,
        setUser,
        profile,
        plan,
        history,
        workoutLogs,
        exerciseTargets,
        gamification,
        monetization,
        hasCompletedQuestionnaire,
        isHydrated,
        saveQuestionnaire,
        resetQuestionnaire,
        analyzeDay,
        getRecentHistory,
        getWeeklySummary,
        getWeeklyInsight,
        getAutoAdjustmentSuggestion,
        applyAutoPlanAdjustment,
        getTodayWorkout,
        prepareTodayWorkoutTargets,
        saveWorkoutSet,
        saveFreeWorkoutSet,
        getExerciseProgress,
        getExerciseProgressionSuggestion,
        getTodayWorkoutSummary,
        getExerciseSetProgress,
        getExerciseCatalog,
        getFreeWorkoutSuggestions,
        getWorkoutGamification,
        estimateNutritionFromText,
        estimateNutritionFromPhotoHint,
        getDailyMacroTargets,
        getWeeklyMacroSummary,
        getPerformanceScore,
        getAutoCoachSuggestions,
        applyMacroOverride,
        getDailyMissions,
        completeMission,
        saveNutritionEntry,
        getSubscriptionStatus,
        hasFeatureAccess,
        startProTrial,
        activateProPlan,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp=()=>useContext(AppContext);
