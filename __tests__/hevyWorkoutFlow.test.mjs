import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzySearchExercises } from '../src/services/fuzzySearch.js';
import { calculateXpForWorkout, getLevelFromXp } from '../src/services/gamificationEngine.js';

test('fluxo treino hevy: fuzzy encontra variação com typo', () => {
  const list = ['Leg Press 45', 'Agachamento Livre', 'Supino Reto Barra'];
  const result = fuzzySearchExercises('leg prees', list, 3);
  assert.equal(result[0], 'Leg Press 45');
});

test('fluxo treino hevy: ganho de xp e level automático', () => {
  const xp = calculateXpForWorkout({ sets: 20, volume: 8000, hitPr: true, streakDays: 4 });
  assert.ok(xp > 0);
  assert.ok(getLevelFromXp(xp) >= 1);
});
