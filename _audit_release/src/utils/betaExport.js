import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { auth } from '../services/firebase.js';
import { getSocialOverviewFromApi } from '../services/socialApiService.js';
import { APP_VERSION, BUILD_VERSION } from './appVersion.js';
import { getObservabilitySnapshot } from '../core/observability.js';
import { useAppStore } from '../stores/useAppStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useCoachStore } from '../stores/useCoachStore';
import { useGamificationStore } from '../stores/useGamificationStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useChallengesStore } from '../stores/useChallengesStore';
import { useUserStore } from '../stores/useUserStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, fallback = '') {
  const text = String(value ?? fallback).trim();
  return text || String(fallback || '');
}

function toIsoValue(value) {
  const timestamp = new Date(value || '').getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function getAuthProviderInfo() {
  const currentUser = auth?.currentUser || null;
  const providerIds = safeArray(currentUser?.providerData)
    .map((item) => String(item?.providerId || '').trim().toLowerCase())
    .filter(Boolean);

  if (providerIds.includes('google.com')) {
    return { source: 'google', label: 'Google', providerIds };
  }

  if (providerIds.includes('password')) {
    return { source: 'email', label: 'E-mail', providerIds };
  }

  if (currentUser?.isAnonymous) {
    return { source: 'local', label: 'Local', providerIds };
  }

  if (providerIds.length > 0) {
    return { source: providerIds[0], label: providerIds[0], providerIds };
  }

  if (currentUser?.email) {
    return { source: 'email', label: 'E-mail', providerIds };
  }

  const storeUser = useAuthStore.getState().user;
  if (storeUser?.email) {
    return { source: 'email', label: 'E-mail', providerIds };
  }

  return { source: 'unknown', label: 'Indeterminado', providerIds };
}

function normalizeTimelineEvent(item, defaultType) {
  const timestamp =
    toIsoValue(item?.timestampIso || item?.timestamp || item?.createdAt || item?.loggedAt || item?.date || null)
    || new Date().toISOString();

  return {
    type: defaultType,
    timestamp,
    screen: item?.screen || item?.route || item?.type || 'unknown',
    label: item?.label || item?.title || item?.name || item?.event || item?.message || defaultType,
    payload: item,
  };
}

function buildTimeline({ observability, workoutLogs, nutritionLogs, history, challenges, coachSuggestions }) {
  const timeline = [];

  safeArray(observability?.events).forEach((event) => {
    timeline.push({
      type: 'observability',
      timestamp: event?.timestamp || event?.timestampIso || new Date().toISOString(),
      screen: event?.screen || 'unknown',
      label: event?.type || event?.name || 'evento',
      payload: event,
    });
  });

  safeArray(workoutLogs).forEach((log) => {
    timeline.push(normalizeTimelineEvent({
      timestamp: log?.createdAt,
      screen: 'Treino',
      label: `${log?.exerciseName || 'Exercicio'} • ${Number(log?.weight || 0)}kg x ${Number(log?.reps || 0)}`,
      ...log,
    }, 'workout_log'));
  });

  safeArray(nutritionLogs).forEach((log) => {
    timeline.push(normalizeTimelineEvent({
      timestamp: log?.loggedAt,
      screen: 'Nutricao',
      label: `${log?.label || 'Alimento'} • ${Number(log?.quantity || 0)}x`,
      ...log,
    }, 'nutrition_log'));
  });

  safeArray(history).forEach((entry) => {
    timeline.push(normalizeTimelineEvent({
      timestamp: entry?.date ? `${entry.date}T12:00:00.000Z` : null,
      screen: 'Home',
      label: `${entry?.date || 'dia'} • ${Number(entry?.calories || 0)} kcal`,
      ...entry,
    }, 'nutrition_history'));
  });

  safeArray(challenges).forEach((challenge) => {
    timeline.push(normalizeTimelineEvent({
      timestamp: challenge?.completedAt,
      screen: 'Social',
      label: challenge?.title || 'Desafio',
      ...challenge,
    }, 'challenge'));
  });

  safeArray(coachSuggestions).forEach((suggestion) => {
    timeline.push(normalizeTimelineEvent({
      timestamp: suggestion?.createdAt || suggestion?.timestamp,
      screen: 'Coach',
      label: suggestion?.title || suggestion?.message || 'Sugestao do coach',
      ...suggestion,
    }, 'coach_suggestion'));
  });

  return timeline
    .sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))
    .slice(-500);
}

function summarizeCounts(bundle) {
  const { profile, workoutLogs, nutritionLogs, history, challenges, social, timeline, observability } = bundle;
  return [
    `Usuario: ${bundle.account?.displayName || bundle.account?.email || 'indeterminado'}`,
    `Fonte de login: ${bundle.account?.authLabel || 'Indeterminado'}`,
    `App: ${bundle.metadata.appVersion} | build ${bundle.metadata.buildVersion}`,
    `Treinos registrados: ${safeArray(workoutLogs).length}`,
    `Refeicoes/alimentos: ${safeArray(nutritionLogs).length}`,
    `Historico nutricional: ${safeArray(history).length}`,
    `Desafios locais: ${safeArray(challenges).length}`,
    `Amigos backend: ${safeArray(social?.friends).length}`,
    `Desafios backend: ${safeArray(social?.activeChallenges).length}`,
    `Timeline total: ${safeArray(timeline).length}`,
    `Eventos observados: ${safeArray(observability?.events).length}`,
    `Erros observados: ${safeArray(observability?.errors).length}`,
    `OCR (estimado): ${Number(bundle?.testingContext?.ocrLogs || 0)}`,
    `Registro manual (estimado): ${Number(bundle?.testingContext?.manualLogs || 0)}`,
    `Sessao online: ${bundle?.testingContext?.isOnline ? 'sim' : 'nao'}`,
    `Peso atual: ${Number(profile?.currentWeight || 0)}kg`,
  ].join('\n');
}

function summarizeNutritionSourceQuality(nutritionLogs = []) {
  let ocrLogs = 0;
  let manualLogs = 0;

  safeArray(nutritionLogs).forEach((entry) => {
    const source = safeString(entry?.quality?.source || entry?.source || '').toLowerCase();
    const label = safeString(entry?.label || '').toLowerCase();

    const looksLikeOcr =
      source.includes('ocr')
      || source.includes('photo')
      || label.includes('tabela nutricional')
      || label.includes('scanner');

    if (looksLikeOcr) {
      ocrLogs += 1;
    } else {
      manualLogs += 1;
    }
  });

  return { ocrLogs, manualLogs };
}

export function getBetaExportContext() {
  const userState = useUserStore.getState();
  const appState = useAppStore.getState();
  const workoutState = useWorkoutStore.getState();
  const nutritionState = useNutritionStore.getState();
  const coachState = useCoachStore.getState();
  const gamificationState = useGamificationStore.getState();
  const challengesState = useChallengesStore.getState();
  const authState = useAuthStore.getState();
  const authProvider = getAuthProviderInfo();

  return {
    user: userState.user,
    profile: userState.profile,
    app: appState,
    workout: workoutState,
    nutrition: nutritionState,
    coach: coachState,
    gamification: gamificationState.gamification,
    challenges: challengesState.challenges,
    auth: {
      user: authState.user,
      providerIds: authProvider.providerIds,
      source: authProvider.source,
      label: authProvider.label,
      isFirebaseAnonymous: Boolean(auth?.currentUser?.isAnonymous),
    },
  };
}

export async function buildBetaExportBundle({ kind = 'full', feedback = '', socialOverview = null } = {}) {
  const context = getBetaExportContext();
  const observability = getObservabilitySnapshot();
  const social = socialOverview || (context.user?.id ? await getSocialOverviewFromApi({ userId: context.user.id }) : null);
  const timeline = buildTimeline({
    observability,
    workoutLogs: context.workout.workoutLogs,
    nutritionLogs: context.nutrition.nutritionLogs,
    history: context.nutrition.history,
    challenges: context.challenges,
    coachSuggestions: safeArray(context.coach.suggestions),
  });

  const metadata = {
    kind: safeString(kind, 'full'),
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    buildVersion: BUILD_VERSION,
    exportFormat: 'multi-file-package',
    platform: {
      os: Platform.OS,
      version: String(Platform.Version || ''),
      isPad: Boolean(Platform.isPad),
      isTV: Boolean(Platform.isTV),
      isTesting: Boolean(Platform.isTesting),
    },
  };

  const sourceSummary = summarizeNutritionSourceQuality(context.nutrition.nutritionLogs);

  const account = {
    userId: context.user?.id || context.auth.user?.id || null,
    displayName: context.user?.name || context.auth.user?.name || null,
    email: context.user?.email || context.auth.user?.email || null,
    role: context.user?.role || null,
    authSource: context.auth.source,
    authLabel: context.auth.label,
    providerIds: context.auth.providerIds,
  };

  const bundle = {
    metadata,
    account,
    user: context.user,
    profile: context.profile,
    app: {
      hasCompletedQuestionnaire: Boolean(context.app?.hasCompletedQuestionnaire),
      userRoutines: safeArray(context.app?.userRoutines),
      monetization: context.app?.monetization || null,
    },
    gamification: context.gamification || null,
    workout: {
      workout: context.workout.workout || null,
      workoutLogs: safeArray(context.workout.workoutLogs),
      exerciseTargets: context.workout.exerciseTargets || {},
      currentExercise: context.workout.currentExercise || null,
      currentSet: context.workout.currentSet || 0,
      isResting: Boolean(context.workout.isResting),
      workoutSessionId: context.workout.workoutSessionId || null,
    },
    nutrition: {
      nutritionLogs: safeArray(context.nutrition.nutritionLogs),
      history: safeArray(context.nutrition.history),
      plan: context.nutrition.plan || null,
      hydration: context.nutrition.hydration || null,
    },
    coach: {
      message: context.coach.message || null,
      suggestions: safeArray(context.coach.suggestions),
      missions: safeArray(context.coach.missions),
      completedToday: Array.from(context.coach.completedToday || []),
      loadSuggestion: context.coach.loadSuggestion || null,
    },
    social: {
      ok: Boolean(social?.ok),
      error: social?.error || null,
      friends: safeArray(social?.data?.friends || social?.data?.friendIds || []),
      friendsLeaderboard: safeArray(social?.data?.friendsLeaderboard || []),
      activeChallenges: safeArray(social?.data?.activeChallenges || []),
      overview: social?.data || null,
    },
    observability,
    timeline,
    feedback: safeString(feedback, ''),
    quality: {
      workoutLogs: safeArray(context.workout.workoutLogs).length,
      nutritionLogs: safeArray(context.nutrition.nutritionLogs).length,
      historyDays: safeArray(context.nutrition.history).length,
      socialFriends: safeArray(social?.data?.friends || []).length,
      socialChallenges: safeArray(social?.data?.activeChallenges || []).length,
      errors: safeArray(observability?.errors).length,
      events: safeArray(observability?.events).length,
    },
    testingContext: {
      isOnline: Boolean(context.app?.isOnline),
      isSyncing: Boolean(context.app?.isSyncing),
      authFlow: context.auth.source,
      authFlowLabel: context.auth.label,
      ocrLogs: sourceSummary.ocrLogs,
      manualLogs: sourceSummary.manualLogs,
      sessionType: context.user?.email ? 'authenticated' : 'local',
      hasPendingFeedback: Boolean(safeString(feedback, '')),
    },
  };

  const summary = summarizeCounts({
    ...bundle,
    workoutLogs: bundle.workout.workoutLogs,
    nutritionLogs: bundle.nutrition.nutritionLogs,
    history: bundle.nutrition.history,
    challenges: context.challenges,
    social: bundle.social,
    timeline: bundle.timeline,
    observability: bundle.observability,
  });

  const fullSummary = [
    summary,
    '',
    'Melhorias relatadas:',
    safeString(feedback, '') || 'Nenhuma melhoria registrada.',
    '',
    'Alertas relevantes:',
    safeArray(observability?.releaseBlockStatus?.blockers || []).map((item) => `- ${item}`).join('\n') || '- Nenhum bloqueio critico.',
  ].join('\n');

  return {
    bundle,
    summary,
    fullSummary,
  };
}

export async function exportBetaAnalysisToFile({ kind = 'full', feedback = '', socialOverview = null } = {}) {
  const { bundle, summary, fullSummary } = await buildBetaExportBundle({ kind, feedback, socialOverview });
  const dirBase = FileSystem.documentDirectory || FileSystem.cacheDirectory;

  if (!dirBase) {
    return { ok: false, error: 'no_writable_directory' };
  }

  const exportsDir = `${dirBase}beta-exports/`;
  const safeKind = safeString(kind, 'full').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  const fileBase = `beta-${safeKind}-${Date.now()}`;
  const packageDir = `${exportsDir}${fileBase}/`;
  const jsonUri = `${exportsDir}${fileBase}.json`;
  const txtUri = `${exportsDir}${fileBase}.txt`;

  await FileSystem.makeDirectoryAsync(exportsDir, { intermediates: true });
  await FileSystem.makeDirectoryAsync(packageDir, { intermediates: true });
  await FileSystem.writeAsStringAsync(jsonUri, JSON.stringify(bundle, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await FileSystem.writeAsStringAsync(txtUri, fullSummary || summary, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Promise.all([
    FileSystem.writeAsStringAsync(`${packageDir}metadata.json`, JSON.stringify(bundle.metadata || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}account.json`, JSON.stringify(bundle.account || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}timeline.json`, JSON.stringify(bundle.timeline || [], null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}nutrition.json`, JSON.stringify(bundle.nutrition || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}workout.json`, JSON.stringify(bundle.workout || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}social.json`, JSON.stringify(bundle.social || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}observability.json`, JSON.stringify(bundle.observability || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}testing-context.json`, JSON.stringify(bundle.testingContext || {}, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
    FileSystem.writeAsStringAsync(`${packageDir}summary.txt`, String(fullSummary || summary || ''), {
      encoding: FileSystem.EncodingType.UTF8,
    }),
  ]);

  return {
    ok: true,
    fileName: `${fileBase}.json`,
    jsonUri,
    txtUri,
    packageDir,
    bundle,
    summary,
  };
}

export function getBetaAuthSourceLabel() {
  return getAuthProviderInfo().label;
}
