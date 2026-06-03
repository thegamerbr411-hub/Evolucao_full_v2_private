import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyExerciseSwapToWorkout,
  buildDraftCleanupForSwap,
  buildExerciseSwapActionCopy,
  buildExerciseSwapPlan,
  countCompletedSetsForExercise,
  formatExerciseSwapConfirmationMessage,
  hasNonEmptyDraftRows,
  migrateSetCountForSwap,
} from '../src/services/workoutExerciseSwap.js';

const baseExercises = [
  { id: 'agachamento-0', name: 'Agachamento Livre', sets: 4, reps: '8-12' },
  { id: 'supino-1', name: 'Supino Reto', sets: 4, reps: '8-12' },
  { id: 'remada-2', name: 'Remada Curvada', sets: 3, reps: '8-12' },
];

test('1: swap without completed sets or draft does not require strong confirmation', () => {
  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: false,
    hasDraftSets: false,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.requiresConfirmation, false);
});

test('2: swap with completed sets requires confirmation', () => {
  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.preserveExistingSets, true);
});

test('3: swap with filled draft requires confirmation', () => {
  assert.equal(hasNonEmptyDraftRows([{ weight: '40', reps: '', rpe: '8' }]), true);

  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[1],
    replacementExercise: { name: 'Supino Inclinado' },
    exerciseIndex: 1,
    totalExercises: baseExercises.length,
    hasCompletedSets: false,
    hasDraftSets: true,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.requiresConfirmation, true);
  assert.ok(plan.warnings.includes('unsaved_draft_will_be_discarded'));
});

test('4: applyExerciseSwapToWorkout replaces only the target index', () => {
  const result = applyExerciseSwapToWorkout({
    exercises: baseExercises,
    exerciseIndex: 1,
    replacementExercise: { name: 'Puxada Frontal Polia', id: 'puxada-1' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.exercises[0].name, 'Agachamento Livre');
  assert.equal(result.exercises[1].name, 'Puxada Frontal Polia');
  assert.equal(result.exercises[2].name, 'Remada Curvada');
});

test('5: applyExerciseSwapToWorkout keeps total exercise count', () => {
  const result = applyExerciseSwapToWorkout({
    exercises: baseExercises,
    exerciseIndex: 0,
    replacementExercise: { name: 'Leg Press' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.exerciseCount, baseExercises.length);
  assert.equal(result.exercises.length, baseExercises.length);
});

test('6: applyExerciseSwapToWorkout does not mutate the original array', () => {
  const original = baseExercises.map((item) => ({ ...item }));
  const snapshot = JSON.stringify(original);

  const result = applyExerciseSwapToWorkout({
    exercises: original,
    exerciseIndex: 2,
    replacementExercise: { name: 'Remada Baixa' },
  });

  assert.equal(result.ok, true);
  assert.notEqual(result.exercises, original);
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(original[2].name, 'Remada Curvada');
});

test('7: swap plan never transfers old logs to the new exercise', () => {
  const logs = [
    { exerciseName: 'Agachamento Livre', weight: 80, reps: 8 },
    { exerciseName: 'Agachamento Livre', weight: 85, reps: 6 },
  ];

  assert.equal(countCompletedSetsForExercise(logs, 'Agachamento Livre'), 2);

  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.equal(plan.transferLogsToNewExercise, false);
  assert.equal(countCompletedSetsForExercise(logs, 'Leg Press'), 0);
});

test('8: swap keeps exerciseIndex valid after apply', () => {
  const result = applyExerciseSwapToWorkout({
    exercises: baseExercises,
    exerciseIndex: 1,
    replacementExercise: { name: 'Supino Inclinado' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.exerciseIndex, 1);
  assert.ok(result.exerciseIndex < result.exerciseCount);
});

test('9: invalid exercise index returns error', () => {
  const result = applyExerciseSwapToWorkout({
    exercises: baseExercises,
    exerciseIndex: 9,
    replacementExercise: { name: 'Leg Press' },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid_exercise_index');

  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 9,
    totalExercises: baseExercises.length,
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'invalid_exercise_index');
});

test('10: missing replacementExercise returns error', () => {
  const result = applyExerciseSwapToWorkout({
    exercises: baseExercises,
    exerciseIndex: 0,
    replacementExercise: { name: '' },
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'missing_replacement_exercise');

  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: '' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.error, 'missing_replacement_exercise');
});

test('11: confirmation copy cites old and new exercise names', () => {
  const message = formatExerciseSwapConfirmationMessage('Supino Reto', 'Puxada Frontal Polia', {
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.match(message, /Supino Reto/);
  assert.match(message, /Puxada Frontal Polia/);
  assert.match(message, /historico/i);

  const plan = buildExerciseSwapPlan({
    currentExercise: { name: 'Supino Reto' },
    replacementExercise: { name: 'Puxada Frontal Polia' },
    exerciseIndex: 1,
    totalExercises: 3,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.match(plan.message, /Supino Reto/);
  assert.match(plan.message, /Puxada Frontal Polia/);
  assert.equal(plan.confirmLabel, 'Trocar exercicio');
});

test('12: buttonLabel is Trocar exercicio, not bare Substituir', () => {
  const copy = buildExerciseSwapActionCopy({
    currentExerciseName: 'Agachamento Livre',
  });

  assert.equal(copy.buttonLabel, 'Trocar exercicio');
  assert.notEqual(copy.buttonLabel, 'Substituir');
  assert.match(copy.helperText, /exercicio atual/i);
});

test('13: no saved sets and no draft allows direct swap', () => {
  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: false,
    hasDraftSets: false,
  });

  assert.equal(plan.requiresConfirmation, false);
  assert.equal(plan.message, '');
});

test('14: saved sets require confirmation', () => {
  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.title, 'Trocar exercicio?');
});

test('15: confirmation message cites old exercise and historico', () => {
  const copy = buildExerciseSwapActionCopy({
    currentExerciseName: 'Agachamento Livre',
    replacementExerciseName: 'Leg Press',
    hasSavedSets: true,
  });

  assert.match(copy.confirmationMessage, /Agachamento Livre/);
  assert.match(copy.confirmationMessage, /historico/i);
});

test('16: confirmation message says series will not be transferred', () => {
  const copy = buildExerciseSwapActionCopy({
    currentExerciseName: 'Agachamento Livre',
    replacementExerciseName: 'Leg Press',
    hasSavedSets: true,
  });

  assert.match(copy.confirmationMessage, /nao serao transferidas/i);
});

test('17: confirmation plan exposes cancel and confirm labels without executing swap', () => {
  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.cancelLabel, 'Cancelar');
  assert.equal(plan.confirmLabel, 'Trocar exercicio');
  assert.equal(typeof plan.requiresConfirmation, 'boolean');
});

test('18: applyExerciseSwapToWorkout replaces only active index on confirm path', () => {
  const result = applyExerciseSwapToWorkout({
    exercises: baseExercises,
    exerciseIndex: 0,
    replacementExercise: { name: 'Leg Press' },
  });

  assert.equal(result.exercises[0].name, 'Leg Press');
  assert.equal(result.exercises[1].name, 'Supino Reto');
});

test('19: old exercise logs remain after planning swap with saved sets', () => {
  const logs = [
    { exerciseName: 'Agachamento Livre', weight: 80, reps: 8 },
    { exerciseName: 'Agachamento Livre', weight: 85, reps: 6 },
  ];

  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.equal(countCompletedSetsForExercise(logs, 'Agachamento Livre'), 2);
  assert.equal(plan.transferLogsToNewExercise, false);
  assert.equal(countCompletedSetsForExercise(logs, 'Leg Press'), 0);
});

test('20: plan never sets transferLogsToNewExercise when saved sets exist', () => {
  const plan = buildExerciseSwapPlan({
    currentExercise: baseExercises[0],
    replacementExercise: { name: 'Leg Press' },
    exerciseIndex: 0,
    totalExercises: baseExercises.length,
    hasCompletedSets: true,
    hasDraftSets: false,
  });

  assert.equal(plan.transferLogsToNewExercise, false);
});

test('21: missing exercise names use safe fallback copy', () => {
  const copy = buildExerciseSwapActionCopy({
    currentExerciseName: '',
    replacementExerciseName: '',
    hasSavedSets: true,
  });

  assert.match(copy.confirmationMessage, /este exercicio/i);
  assert.match(copy.confirmationMessage, /outro exercicio/i);
  assert.match(copy.successToast, /treino de hoje/i);
});

test('migrateSetCountForSwap moves planned set count without touching logs', () => {
  const next = migrateSetCountForSwap({
    setCountByExercise: { 'Agachamento Livre': 4, 'Supino Reto': 3 },
    oldExerciseName: 'Agachamento Livre',
    newExerciseName: 'Leg Press',
  });

  assert.equal(next['Leg Press'], 4);
  assert.equal(next['Agachamento Livre'], undefined);
  assert.equal(next['Supino Reto'], 3);
});

test('buildDraftCleanupForSwap only clears draft keys for previous exercise', () => {
  const cleanup = buildDraftCleanupForSwap({
    oldExerciseName: 'Agachamento Livre',
    hasDraftSets: true,
  });

  assert.deepEqual(cleanup, { 'Agachamento Livre': undefined });
  assert.deepEqual(buildDraftCleanupForSwap({ oldExerciseName: 'Agachamento Livre', hasDraftSets: false }), {});
});
