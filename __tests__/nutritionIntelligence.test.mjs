import test from 'node:test';
import assert from 'node:assert/strict';
import { createFoodFromText, parseNutritionLabel } from '../src/services/nutritionIntelligence.js';

test('nutrição inteligente cria alimento por texto livre', () => {
  const parsed = createFoodFromText('2 ovos + 150g frango + 1 pao');
  assert.ok(parsed);
  assert.ok(Array.isArray(parsed.items));
  assert.ok(parsed.items.length >= 2);
  assert.ok(parsed.totals.protein > 0);
});

test('parseNutritionLabel extrai macros e fallback quando faltam dados', () => {
  const parsed = parseNutritionLabel('calorias 140 carboidratos 12 proteina 15 gorduras totais 3 sodio 95');
  assert.equal(parsed.calories, 140);
  assert.equal(parsed.carbs, 12);
  assert.equal(parsed.protein, 15);

  const fallback = parseNutritionLabel('imagem sem texto claro');
  assert.ok(fallback.fallback);
  assert.ok(fallback.calories > 0);
});
