import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateSessionState, serializeSessionState } from '../src/services/persistenceEngine.js';

test('QA fluxo completo: iniciar treino, adicionar exercício, salvar e reabrir mantendo dados', () => {
  const workout = { exercises: [] };

  // iniciar treino
  workout.name = 'Treino A';

  // adicionar exercício
  workout.exercises.push({
    name: 'Supino Reto',
    sets: [
      {
        reps: '',
        weight: '',
        done: false,
      },
    ],
  });

  // preencher e salvar automaticamente
  workout.exercises[0].sets[0].reps = '10';
  workout.exercises[0].sets[0].weight = '60';
  workout.exercises[0].sets[0].done = true;

  const persisted = serializeSessionState({
    workoutDrafts: {
      workout,
    },
    nutritionDraft: [],
  });

  // fechar app / reabrir app
  const reopened = hydrateSessionState(persisted);

  // dados mantidos
  assert.equal(reopened.workoutDrafts.workout.name, 'Treino A');
  assert.equal(reopened.workoutDrafts.workout.exercises[0].name, 'Supino Reto');
  assert.equal(reopened.workoutDrafts.workout.exercises[0].sets[0].reps, '10');
  assert.equal(reopened.workoutDrafts.workout.exercises[0].sets[0].weight, '60');
  assert.equal(reopened.workoutDrafts.workout.exercises[0].sets[0].done, true);
});
