import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkoutNavigationParams } from '../src/services/workoutActiveRoutine.js';

function shouldInitializeGuidedSession({
  selectedWorkoutId = '',
  normalizedExercises = [],
  sessionExercises = [],
} = {}) {
  if (String(selectedWorkoutId || '').trim()) {
    return false;
  }
  if (!Array.isArray(normalizedExercises) || normalizedExercises.length < 2) {
    return false;
  }
  if (!Array.isArray(sessionExercises) || sessionExercises.length === 0) {
    return normalizedExercises;
  }
  if (sessionExercises.length >= normalizedExercises.length) {
    return false;
  }
  const sessionKey = sessionExercises.map((item) => item.name).join('|');
  const targetKey = normalizedExercises.map((item) => item.name).join('|');
  if (sessionKey === targetKey) {
    return false;
  }
  return normalizedExercises;
}

function resolveSaveTargetExercise({
  activeExerciseIndex = 0,
  exercises = [],
} = {}) {
  const safeIndex = Math.max(0, Number(activeExerciseIndex) || 0);
  const target = exercises[safeIndex] || null;
  return {
    activeExerciseIndex: safeIndex,
    exerciseName: target?.name || null,
  };
}

test('INICIAR treino ignora rotina stale no storage', () => {
  const params = resolveWorkoutNavigationParams({
    isContinue: false,
    activeRoutineId: 'routine-stale-1ex',
  });
  assert.equal(params, undefined);
});

test('INICIAR treino sem rotina stale abre treino recomendado', () => {
  const params = resolveWorkoutNavigationParams({
    isContinue: false,
    activeRoutineId: null,
  });
  assert.equal(params, undefined);
});

test('CONTINUAR treino usa workoutId quando rotina ativa existe', () => {
  const params = resolveWorkoutNavigationParams({
    isContinue: true,
    activeRoutineId: 'routine-abc-123',
  });
  assert.deepEqual(params, { workoutId: 'routine-abc-123' });
});

test('treino guiado preserva multiplos exercicios do recommended', () => {
  const normalized = [
    { name: 'Supino Reto Barra', sets: 4 },
    { name: 'Supino Inclinado Halter', sets: 3 },
    { name: 'Triceps Testa Barra EZ', sets: 3 },
  ];

  const initialized = shouldInitializeGuidedSession({
    selectedWorkoutId: '',
    normalizedExercises: normalized,
    sessionExercises: [],
  });

  assert.equal(Array.isArray(initialized), true);
  assert.equal(initialized.length, 3);
});

test('activeExerciseIndex comeca em 0 na sessao multi-ex', () => {
  const exercises = [
    { name: 'Ex1' },
    { name: 'Ex2' },
    { name: 'Ex3' },
  ];
  const saveTarget = resolveSaveTargetExercise({
    activeExerciseIndex: 0,
    exercises,
  });
  assert.equal(saveTarget.activeExerciseIndex, 0);
  assert.equal(saveTarget.exerciseName, 'Ex1');
});

test('salvar serie no indice 1 mantem foco no exercicio 2', () => {
  const exercises = [
    { name: 'Ex1' },
    { name: 'Ex2' },
    { name: 'Ex3' },
  ];
  const saveTarget = resolveSaveTargetExercise({
    activeExerciseIndex: 1,
    exercises,
  });
  assert.equal(saveTarget.activeExerciseIndex, 1);
  assert.equal(saveTarget.exerciseName, 'Ex2');
});

test('salvar serie no indice 2 mantem foco no exercicio 3', () => {
  const exercises = [
    { name: 'Ex1' },
    { name: 'Ex2' },
    { name: 'Ex3' },
  ];
  const saveTarget = resolveSaveTargetExercise({
    activeExerciseIndex: 2,
    exercises,
  });
  assert.equal(saveTarget.activeExerciseIndex, 2);
  assert.equal(saveTarget.exerciseName, 'Ex3');
});

test('workoutId bloqueia inicializacao do treino recomendado', () => {
  const normalized = [
    { name: 'Supino Reto Barra' },
    { name: 'Supino Inclinado Halter' },
    { name: 'Triceps Testa Barra EZ' },
  ];
  const initialized = shouldInitializeGuidedSession({
    selectedWorkoutId: 'routine-stale-1ex',
    normalizedExercises: normalized,
    sessionExercises: [],
  });
  assert.equal(initialized, false);
});
