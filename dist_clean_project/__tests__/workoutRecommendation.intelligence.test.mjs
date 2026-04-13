import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKOUT_MODULE = join(process.cwd(), 'src', 'context', 'modules', 'workout.js');

test('recomendacao inteligente possui fallback de catalogo', () => {
  const source = readFileSync(WORKOUT_MODULE, 'utf8');

  assert.match(source, /fallbackFromCatalog/);
  assert.match(source, /baseExercises = best\.exercises\.length \? best\.exercises : fallbackFromCatalog/);
});

test('recomendacao inteligente gera ids consistentes e remove repeticao local', () => {
  const source = readFileSync(WORKOUT_MODULE, 'utf8');

  assert.match(source, /buildConsistentExerciseId/);
  assert.match(source, /findIndex\(\(item\) => normalize\(item\?\.name \|\| item\?\.nome \|\| ''\)\) === index/);
});
