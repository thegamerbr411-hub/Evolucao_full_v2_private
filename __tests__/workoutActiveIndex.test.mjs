import test from 'node:test';
import assert from 'node:assert/strict';

function shouldResyncRoutineExercises(sessionKey, targetKey) {
  return sessionKey !== targetKey;
}

function shouldPreserveActiveExerciseIndex({
  guidedSetsToday = 0,
  sessionNames = [],
  routineNames = [],
} = {}) {
  if (guidedSetsToday <= 0) {
    return false;
  }
  return sessionNames.join('|') === routineNames.join('|');
}

test('nao ressincroniza rotina quando sessionKey ja coincide com targetKey', () => {
  const key = 'Leg Press 45|Agachamento Livre';
  assert.equal(shouldResyncRoutineExercises(key, key), false);
});

test('ressincroniza rotina quando sessionKey difere de targetKey', () => {
  assert.equal(shouldResyncRoutineExercises('', 'Leg Press 45'), true);
  assert.equal(shouldResyncRoutineExercises('A|B', 'A|B|C'), true);
});

test('salvar serie no exercicio 4 mantem indice quando sessao ja alinhada', () => {
  const names = ['A', 'B', 'C', 'D'];
  const preserve = shouldPreserveActiveExerciseIndex({
    guidedSetsToday: 2,
    sessionNames: names,
    routineNames: names,
  });
  assert.equal(preserve, true);
});

test('sessao em andamento nao reseta indice quando lista de exercicios coincide', () => {
  const activeIndex = 3;
  const preserve = shouldPreserveActiveExerciseIndex({
    guidedSetsToday: 5,
    sessionNames: ['Ex1', 'Ex2', 'Ex3', 'Ex4'],
    routineNames: ['Ex1', 'Ex2', 'Ex3', 'Ex4'],
  });
  const nextIndex = preserve ? activeIndex : 0;
  assert.equal(nextIndex, 3);
});
