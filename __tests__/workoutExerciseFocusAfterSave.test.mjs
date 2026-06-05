import test from 'node:test';
import assert from 'node:assert/strict';

function shouldSkipRoutineResync(sessionKey, targetKey) {
  return sessionKey === targetKey;
}

function shouldResetIndexOnRoutineSync({
  sessionExerciseKey = '',
  targetKey = '',
  guidedSetsToday = 0,
} = {}) {
  if (sessionExerciseKey === targetKey) {
    return false;
  }
  const shouldPreserveSessionState = guidedSetsToday > 0 && !sessionExerciseKey;
  return !shouldPreserveSessionState;
}

function resolveJumpToNextExerciseIndex(currentIndex, exercises, progressByName) {
  for (let index = currentIndex + 1; index < exercises.length; index += 1) {
    const item = exercises[index];
    const progress = progressByName[item.name] || { isDone: false };
    if (!progress.isDone) {
      return index;
    }
  }
  return currentIndex;
}

function resolveActiveIndexAfterSave({
  exerciseIndex,
  setIndex,
  plannedSets,
  currentActiveIndex,
  exercises,
  progressByName,
}) {
  const completedAfterSave = setIndex + 1;
  if (completedAfterSave < plannedSets) {
    return currentActiveIndex;
  }
  return resolveJumpToNextExerciseIndex(exerciseIndex, exercises, progressByName);
}

function appendGuidedSetLog(logs, { exerciseName, weight, reps, dayKey }) {
  return [
    {
      id: `log-${logs.length + 1}`,
      date: dayKey,
      exerciseName,
      weight,
      reps,
      mode: 'guided',
    },
    ...logs,
  ];
}

const FOUR_EXERCISES = [
  { id: 'ex-1', name: 'Ex1' },
  { id: 'ex-2', name: 'Ex2' },
  { id: 'ex-3', name: 'Ex3' },
  { id: 'ex-4', name: 'Ex4' },
];

test('salvar serie intermediaria no exercicio 4 mantem indice 3', () => {
  const before = 3;
  const after = resolveActiveIndexAfterSave({
    exerciseIndex: 3,
    setIndex: 0,
    plannedSets: 3,
    currentActiveIndex: before,
    exercises: FOUR_EXERCISES,
    progressByName: {},
  });
  assert.equal(after, 3);
  assert.equal(FOUR_EXERCISES[after].name, 'Ex4');
});

test('salvar ultima serie do exercicio 4 preserva foco quando nao ha proximo incompleto', () => {
  const progressByName = {
    Ex1: { isDone: true },
    Ex2: { isDone: true },
    Ex3: { isDone: true },
    Ex4: { isDone: false },
  };
  const after = resolveActiveIndexAfterSave({
    exerciseIndex: 3,
    setIndex: 2,
    plannedSets: 3,
    currentActiveIndex: 3,
    exercises: FOUR_EXERCISES,
    progressByName,
  });
  assert.equal(after, 3);
  assert.equal(FOUR_EXERCISES[after].id, 'ex-4');
});

test('jumpToNextExercise vai para proximo incompleto quando existe apos ex4', () => {
  const progressByName = {
    Ex1: { isDone: true },
    Ex2: { isDone: true },
    Ex3: { isDone: false },
    Ex4: { isDone: true },
  };
  const next = resolveJumpToNextExerciseIndex(3, FOUR_EXERCISES, progressByName);
  assert.equal(next, 3);
});

test('sessao alinhada nao reseta indice apos save no exercicio 4', () => {
  const names = FOUR_EXERCISES.map((item) => item.name);
  const sessionKey = names.join('|');
  const targetKey = names.join('|');
  const activeIndex = 3;

  const skipResync = shouldSkipRoutineResync(sessionKey, targetKey);
  const resetIndex = shouldResetIndexOnRoutineSync({
    sessionExerciseKey: sessionKey,
    targetKey,
    guidedSetsToday: 2,
  });
  const nextIndex = skipResync || !resetIndex ? activeIndex : 0;

  assert.equal(skipResync, true);
  assert.equal(resetIndex, false);
  assert.equal(nextIndex, 3);
});

test('sessao divergente sem sets guiados reseta indice para 0', () => {
  const resetIndex = shouldResetIndexOnRoutineSync({
    sessionExerciseKey: 'Ex1|Ex2',
    targetKey: 'Ex1|Ex2|Ex3|Ex4',
    guidedSetsToday: 0,
  });
  assert.equal(resetIndex, true);
});

test('serie salva entra no exercicio 4 sem reordenar exercicios', () => {
  const dayKey = '2026-06-02';
  let logs = [];
  logs = appendGuidedSetLog(logs, {
    exerciseName: 'Ex4',
    weight: 40,
    reps: 10,
    dayKey,
  });

  const ex4Logs = logs.filter((item) => item.exerciseName === 'Ex4' && item.date === dayKey);
  const exerciseOrder = FOUR_EXERCISES.map((item) => item.name);

  assert.equal(ex4Logs.length, 1);
  assert.equal(ex4Logs[0].weight, 40);
  assert.equal(ex4Logs[0].reps, 10);
  assert.deepEqual(exerciseOrder, ['Ex1', 'Ex2', 'Ex3', 'Ex4']);
});
