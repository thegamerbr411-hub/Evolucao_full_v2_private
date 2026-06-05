import { MUSCLE_GROUP_LABELS } from '../data/exercises.js';

export const EXERCISE_VIDEO_COMING_SOON =
  'Demonstração em vídeo em preparação. Use as instruções abaixo para executar com segurança.';

export const EXERCISE_INSTRUCTIONS_COMING_SOON =
  'Instruções detalhadas em construção. Em breve você verá o passo a passo completo aqui.';

const PLACEHOLDER_HOST_PATTERNS = [
  /cdn\.app\.com/i,
  /placehold\.co/i,
];

export function isValidHttpUrl(value = '') {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isPlaceholderMediaUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) {
    return true;
  }
  if (!isValidHttpUrl(raw)) {
    return true;
  }
  return PLACEHOLDER_HOST_PATTERNS.some((pattern) => pattern.test(raw));
}

export function formatMuscleLabel(muscleKey = '') {
  const key = String(muscleKey || '').trim().toLowerCase();
  if (!key) {
    return 'Geral';
  }
  return MUSCLE_GROUP_LABELS[key] || key.replace(/_/g, ' ');
}

export function resolveExerciseMedia(exercise = {}) {
  const videoUrl = String(exercise?.videoUrl || exercise?.video || '').trim();
  const thumbnailUrl = String(
    exercise?.thumbnailUrl || exercise?.thumbnail || exercise?.gif || ''
  ).trim();

  const videoIsPlaceholder = isPlaceholderMediaUrl(videoUrl);
  const thumbnailIsPlaceholder = isPlaceholderMediaUrl(thumbnailUrl);

  const hasRealVideo = isValidHttpUrl(videoUrl) && !videoIsPlaceholder;
  const hasRealThumbnail = isValidHttpUrl(thumbnailUrl) && !thumbnailIsPlaceholder;

  return {
    videoUrl,
    thumbnailUrl,
    hasRealVideo,
    hasRealThumbnail,
    isPlaceholder: !hasRealVideo && !hasRealThumbnail,
    showVideoComingSoon: !hasRealVideo,
  };
}

export function getExerciseMuscleKey(exercise = {}) {
  const primary = exercise?.primaryMuscle
    || exercise?.musclePrimary?.[0]
    || exercise?.muscle
    || '';
  return String(primary || '').trim().toLowerCase();
}

export function shouldShowExecutionVideoCta(media = {}) {
  return Boolean(media?.hasRealVideo);
}
