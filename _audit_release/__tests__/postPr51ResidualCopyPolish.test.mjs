import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateCoachInsight } from '../src/services/coachInsight.js';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const coachChatSource = readFileSync(join(rootDir, 'src/screens/CoachChatScreen.js'), 'utf8');
const nutritionSource = readFileSync(join(rootDir, 'src/context/modules/nutrition.js'), 'utf8');

test('post PR51 residual polish exposes Já foi feito in Coach UI', () => {
  assert.match(coachChatSource, />Já foi feito</);
  assert.doesNotMatch(coachChatSource, />Ja foi feito</);
  assert.match(coachChatSource, /Já foi feito:/);
  assert.doesNotMatch(coachChatSource, /Ja foi feito:/);
});

test('post PR51 residual polish exposes accented coach insight copy', () => {
  const insight = generateCoachInsight({
    trainedToday: false,
    protein: 80,
    proteinTarget: 140,
    water: 500,
    waterTarget: 2000,
    weeklyDone: 1,
    weeklyTarget: 4,
    weakMeals: 1,
    hasRoutine: false,
  });

  assert.match(insight.summary, /Treino é a maior alavanca/);
  assert.match(insight.actions.join(' '), /proteína/);
  assert.match(insight.actions.join(' '), /água/);
  assert.match(insight.actions.join(' '), /não depender/);
  assert.doesNotMatch(insight.actions.join(' '), /\bgap de agua\b/);

  const maintenance = generateCoachInsight({
    trainedToday: true,
    protein: 150,
    proteinTarget: 140,
    water: 2500,
    waterTarget: 2000,
    weeklyDone: 4,
    weeklyTarget: 4,
    weakMeals: 0,
    hasRoutine: true,
  });
  assert.match(maintenance.summary, /próximo bloco/);
});

test('post PR51 residual polish exposes accented macro insight copy', () => {
  assert.match(nutritionSource, /Meta de proteína atingida/);
  assert.match(nutritionSource, /de proteína para bater a meta/);
  assert.doesNotMatch(nutritionSource, /Meta de proteina atingida/);
  assert.doesNotMatch(nutritionSource, /de proteina para bater a meta/);
});
