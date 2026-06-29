import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkoutModePresentation } from '../src/services/workoutModeCopy.js';
import { buildWorkoutProgressCopy } from '../src/services/workoutProgressCopy.js';
import { buildWorkoutSetRowState } from '../src/services/workoutSetRowState.js';

test('post PR50 polish exposes accented workout mode copy', () => {
  const advanced = buildWorkoutModePresentation({ simpleMode: false });
  assert.match(advanced.modeLabel, /Visão completa/);
  assert.doesNotMatch(advanced.modeLabel, /\bVisao\b/);
});

test('post PR50 polish exposes accented progress header and footer', () => {
  const partial = buildWorkoutProgressCopy({
    completedSets: 1,
    plannedSets: 17,
    currentExerciseIndex: 0,
    totalExercises: 5,
  });
  assert.match(partial.headerLabel, /Exercício atual/);

  const complete = buildWorkoutProgressCopy({
    completedSets: 17,
    plannedSets: 17,
    canFinish: true,
  });
  assert.match(complete.footerHint, /séries planejadas foram concluídas/);
});

test('post PR50 polish exposes accented set row actions', () => {
  const ready = buildWorkoutSetRowState({
    weight: '80',
    reps: '10',
    isActiveSet: true,
  });
  assert.equal(ready.actionLabel, 'Salvar série');
  assert.match(ready.accessibilityLabel, /Salvar série/);

  const invalid = buildWorkoutSetRowState({
    weight: '999',
    reps: '10',
    isActiveSet: true,
  });
  assert.equal(invalid.label, 'Inválida');
});

test('post PR50 polish invalid saved accessibility labels use accents', () => {
  const saved = buildWorkoutSetRowState({ isSaved: true });
  assert.match(saved.accessibilityLabel, /Série salva/);
});
