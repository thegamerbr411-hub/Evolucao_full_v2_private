import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXERCISE_VIDEO_COMING_SOON,
  isPlaceholderMediaUrl,
  resolveExerciseMedia,
  shouldShowExecutionVideoCta,
} from '../src/utils/exerciseMedia.js';

test('cdn.app.com is placeholder', () => {
  assert.equal(
    isPlaceholderMediaUrl('https://cdn.app.com/exercises/agachamento.mp4'),
    true
  );
});

test('empty URL is placeholder', () => {
  assert.equal(isPlaceholderMediaUrl(''), true);
  assert.equal(isPlaceholderMediaUrl(null), true);
});

test('real URL is not placeholder', () => {
  assert.equal(
    isPlaceholderMediaUrl('https://cdn.example.com/video.mp4'),
    false
  );
});

test('placehold.co is placeholder', () => {
  assert.equal(isPlaceholderMediaUrl('https://placehold.co/320x180'), true);
});

test('exercise with cdn video shows fallback flags', () => {
  const media = resolveExerciseMedia({
    name: 'Agachamento Livre',
    video: 'https://cdn.app.com/exercises/agachamento-livre.mp4',
    thumbnail: 'https://cdn.app.com/exercises/thumbs/agachamento-livre.png',
  });
  assert.equal(media.isPlaceholder, true);
  assert.equal(media.hasRealVideo, false);
  assert.equal(media.hasRealThumbnail, false);
  assert.equal(media.showVideoComingSoon, true);
});

test('CTA does not promise real video when placeholder', () => {
  const media = resolveExerciseMedia({
    video: 'https://cdn.app.com/exercises/x.mp4',
  });
  assert.equal(shouldShowExecutionVideoCta(media), false);
});

test('CTA can promise video when real URL exists', () => {
  const media = resolveExerciseMedia({
    video: 'https://media.evolucao.app/real/agachamento.mp4',
  });
  assert.equal(shouldShowExecutionVideoCta(media), true);
});

test('EXERCISE_VIDEO_COMING_SOON mentions video preparation', () => {
  assert.match(EXERCISE_VIDEO_COMING_SOON, /vídeo|video|preparação|preparacao/i);
});

test('formatExerciseName decodes encoded exercise names', async () => {
  const { formatExerciseName } = await import('../src/utils/displayText.js');
  assert.equal(formatExerciseName('Cadeira%20Extensora'), 'Cadeira Extensora');
});
