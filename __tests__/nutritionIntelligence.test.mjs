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

test('nutrição inteligente aceita linguagem natural sem match exato', () => {
  const parsed = createFoodFromText('2 ovos + 1 pao fatia de mussarela');
  assert.ok(parsed);
  assert.ok(Array.isArray(parsed.items));
  assert.ok(parsed.items.some((item) => /ovo/i.test(item.label)));
  assert.ok(parsed.items.some((item) => /pao/i.test(item.label)));
  assert.ok(parsed.items.some((item) => /mussarela/i.test(item.label)));
  assert.ok(parsed.totals.calories > 0);
});

test('parseNutritionLabel extrai macros e sinaliza quando faltam dados', () => {
  const parsed = parseNutritionLabel('calorias 140 carboidratos 12 proteina 15 gorduras totais 3 sodio 95');
  assert.equal(parsed.calories, 140);
  assert.equal(parsed.carbs, 12);
  assert.equal(parsed.protein, 15);
  assert.equal(parsed.insufficientData, false);

  const lowData = parseNutritionLabel('imagem sem texto claro');
  assert.equal(lowData.fallback, false);
  assert.equal(lowData.insufficientData, true);
});
