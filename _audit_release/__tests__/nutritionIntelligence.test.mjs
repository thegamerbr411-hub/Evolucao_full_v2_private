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

test('parseNutritionLabel extrai campos avancados da tabela nutricional', () => {
  const parsed = parseNutritionLabel([
    'Monster Zero',
    'Informacao Nutricional',
    'Porcao de 200 ml',
    'Valor energetico 10 kcal',
    'Carboidratos 2,4 g',
    'Proteinas 0 g',
    'Gorduras totais 0 g',
    'Gorduras saturadas 0 g',
    'Gorduras trans 0 g',
    'Fibra alimentar 0 g',
    'Sodio 180 mg',
  ].join('\n'));

  assert.equal(parsed.productName, 'Monster Zero');
  assert.equal(parsed.serving?.value, 200);
  assert.equal(parsed.serving?.unit, 'ml');
  assert.equal(parsed.calories, 10);
  assert.equal(parsed.carbs, 2.4);
  assert.equal(parsed.fat, 0);
  assert.equal(parsed.saturatedFat, 0);
  assert.equal(parsed.transFat, 0);
  assert.equal(parsed.fiber, 0);
  assert.equal(parsed.sodium, 180);
  assert.equal(parsed.insufficientData, false);
});

test('parseNutritionLabel usa coluna de porcao quando houver 100ml e porcao', () => {
  const parsed = parseNutritionLabel([
    'Informacao Nutricional',
    'Porcao de 200 ml',
    'Energia 5 10 kcal',
    'Carboidratos 1,2 2,4 g',
    'Proteinas 0 0 g',
    'Gorduras totais 0 0 g',
    'Sodio 90 180 mg',
  ].join('\n'));

  assert.equal(parsed.calories, 10);
  assert.equal(parsed.carbs, 2.4);
  assert.equal(parsed.sodium, 180);
});
