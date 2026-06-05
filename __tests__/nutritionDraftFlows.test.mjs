import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDraftFromFreeText,
  buildDraftFromLabel,
  buildDraftFromPlateHint,
  getNutritionFlowMeta,
  LABEL_EMPTY_MESSAGE,
  LABEL_INSUFFICIENT_MESSAGE,
  NUTRITION_FLOW_SOURCES,
} from '../src/services/nutritionDraftProvider.js';

test('getNutritionFlowMeta returns plate as low confidence', () => {
  const meta = getNutritionFlowMeta(NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE);
  assert.equal(meta.confidence, 'baixa');
  assert.match(meta.hint, /aproximada/i);
});

test('getNutritionFlowMeta returns label title for result card', () => {
  const meta = getNutritionFlowMeta(NUTRITION_FLOW_SOURCES.NUTRITION_LABEL);
  assert.equal(meta.title, 'Tabela nutricional');
});

test('buildDraftFromLabel returns friendly error when text is empty', () => {
  const result = buildDraftFromLabel({ ocrText: '' });
  assert.equal(result.ok, false);
  assert.equal(result.source, NUTRITION_FLOW_SOURCES.NUTRITION_LABEL);
  assert.equal(result.message, LABEL_EMPTY_MESSAGE);
  assert.match(result.message, /leitura automática da foto ainda não está disponível/i);
  assert.doesNotMatch(result.message, /\bIA\b/i);
});

test('buildDraftFromLabel fails without macro text', () => {
  const result = buildDraftFromLabel({ ocrText: 'produto sem tabela' });
  assert.equal(result.ok, false);
  assert.equal(result.source, NUTRITION_FLOW_SOURCES.NUTRITION_LABEL);
  assert.equal(result.message, LABEL_INSUFFICIENT_MESSAGE);
});

test('buildDraftFromLabel parses Monster Energy label text', () => {
  const ocrText = [
    'Porção 200 ml',
    'Valor energético 6 kcal',
    'Carboidratos 2,8 g',
    'Proteínas 0 g',
    'Gorduras totais 0 g',
    'Sódio 156 mg',
  ].join('\n');
  const result = buildDraftFromLabel({ ocrText, portionFactor: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.source, NUTRITION_FLOW_SOURCES.NUTRITION_LABEL);
  assert.notEqual(result.source, NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE);
  assert.equal(result.totals.calories, 6);
  assert.ok(result.totals.carbs >= 2 && result.totals.carbs <= 3);
  assert.equal(result.totals.protein, 0);
  assert.equal(result.totals.fats, 0);
  assert.equal(result.totals.sodium, 156);
});

test('buildDraftFromLabel parses nutrition label text', () => {
  const ocrText = [
    'Iogurte natural',
    'Porcao de 100 g',
    'Valor energetico 60 kcal',
    'Carboidratos 8 g',
    'Proteinas 5 g',
    'Gorduras totais 2 g',
  ].join('\n');
  const result = buildDraftFromLabel({ ocrText, portionFactor: 1 });
  assert.equal(result.ok, true);
  assert.equal(result.source, NUTRITION_FLOW_SOURCES.NUTRITION_LABEL);
  assert.ok(result.totals.calories > 0);
  assert.equal(result.items.length, 1);
});

test('buildDraftFromPlateHint requires description', () => {
  const result = buildDraftFromPlateHint({ description: '' });
  assert.equal(result.ok, false);
});

test('buildDraftFromPlateHint estimates from description', () => {
  const result = buildDraftFromPlateHint({
    description: '100g frango, arroz, feijao',
    portionFactor: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE);
  assert.equal(result.confidence, 'low');
  assert.ok(result.items.length >= 1);
});

test('buildDraftFromFreeText parses meal description', () => {
  const result = buildDraftFromFreeText({
    text: '2 ovos, 1 pao',
    portionFactor: 1,
  });
  assert.equal(result.ok, true);
  assert.equal(result.source, NUTRITION_FLOW_SOURCES.FREE_TEXT);
});
