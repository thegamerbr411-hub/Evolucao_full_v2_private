import { createFoodFromText, parseNutritionLabel } from './nutritionIntelligence.js';

export const NUTRITION_FLOW_SOURCES = {
  FREE_TEXT: 'free_text',
  NUTRITION_LABEL: 'nutrition_label',
  PLATE_ESTIMATE: 'plate_estimate',
};

export const LABEL_EMPTY_MESSAGE =
  'Cole ou digite o texto da tabela nutricional para eu montar o rascunho. A leitura automática da foto ainda não está disponível.';

export const LABEL_INSUFFICIENT_MESSAGE =
  'Inclua no texto valor energético (kcal) e pelo menos carboidratos ou proteínas ou gorduras (ex.: Porção 200 ml, 6 kcal, Carboidratos 2,8 g).';

const FLOW_META = {
  [NUTRITION_FLOW_SOURCES.FREE_TEXT]: {
    title: 'Descricao por texto',
    confidence: 'media',
    hint: 'Revise cada item antes de salvar no rascunho.',
  },
  [NUTRITION_FLOW_SOURCES.NUTRITION_LABEL]: {
    title: 'Tabela nutricional',
    confidence: 'media',
    hint: 'Confira porcao e macros com a embalagem.',
  },
  [NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE]: {
    title: 'Estimativa de prato',
    confidence: 'baixa',
    hint: 'Estimativa aproximada — revise porcoes antes de salvar.',
  },
  photo_ocr: {
    title: 'Tabela nutricional',
    confidence: 'media',
    hint: 'Confira porcao e macros com a embalagem.',
  },
};

export function getNutritionFlowMeta(source = '') {
  const key = String(source || '').trim();
  return FLOW_META[key] || {
    title: 'Estimativa',
    confidence: 'baixa',
    hint: 'Revise antes de salvar no rascunho.',
  };
}

function scaleMacroTotals(totals = {}, factor = 1) {
  const safeFactor = Number(factor || 1);
  return {
    calories: Math.round(Number(totals.calories || 0) * safeFactor),
    protein: Math.round(Number(totals.protein || 0) * safeFactor),
    carbs: Math.round(Number(totals.carbs || 0) * safeFactor),
    fats: Math.round(Number(totals.fats || totals.fat || 0) * safeFactor),
    saturatedFat: Math.round(Number(totals.saturatedFat || 0) * safeFactor),
    transFat: Math.round(Number(totals.transFat || 0) * safeFactor),
    fiber: Math.round(Number(totals.fiber || 0) * safeFactor),
    sodium: Math.round(Number(totals.sodium || 0) * safeFactor),
  };
}

function buildLabelResult(parsedLabel, { ocrText, portionFactor }) {
  const factor = Number(portionFactor || 1);
  const totals = scaleMacroTotals(
    {
      calories: parsedLabel.calories,
      protein: parsedLabel.protein,
      carbs: parsedLabel.carbs,
      fats: parsedLabel.fat,
      saturatedFat: parsedLabel.saturatedFat,
      transFat: parsedLabel.transFat,
      fiber: parsedLabel.fiber,
      sodium: parsedLabel.sodium,
    },
    factor
  );

  const confidenceLabel = parsedLabel.confidence === 'high'
    ? 'alta'
    : parsedLabel.confidence === 'medium'
    ? 'media'
    : 'baixa';

  return {
    ok: true,
    source: NUTRITION_FLOW_SOURCES.NUTRITION_LABEL,
    confidence: parsedLabel.confidence || 'medium',
    totals,
    items: [
      {
        label: parsedLabel.productName || ocrText || 'Alimento da tabela',
        quantity: 1,
        source: NUTRITION_FLOW_SOURCES.NUTRITION_LABEL,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fats: totals.fats,
        saturatedFat: totals.saturatedFat,
        transFat: totals.transFat,
        fiber: totals.fiber,
        sodium: totals.sodium,
        serving: parsedLabel.serving || null,
        consumedQuantity: parsedLabel.consumedQuantity || null,
      },
    ],
    serving: parsedLabel.serving || null,
    consumedQuantity: parsedLabel.consumedQuantity || null,
    message: `Tabela nutricional lida com confianca ${confidenceLabel}. Revise antes de salvar.`,
  };
}

export function buildDraftFromLabel({ ocrText = '', portionFactor = 1 } = {}) {
  const normalizedHint = String(ocrText || '').trim();

  if (!normalizedHint) {
    return {
      ok: false,
      source: NUTRITION_FLOW_SOURCES.NUTRITION_LABEL,
      message: LABEL_EMPTY_MESSAGE,
    };
  }

  const parsedLabel = parseNutritionLabel({ ocrText: normalizedHint });

  if (parsedLabel.insufficientData) {
    return {
      ok: false,
      source: NUTRITION_FLOW_SOURCES.NUTRITION_LABEL,
      message: LABEL_INSUFFICIENT_MESSAGE,
    };
  }

  return buildLabelResult(parsedLabel, { ocrText: normalizedHint, portionFactor });
}

export function buildDraftFromPlateHint({ description = '', portionFactor = 1 } = {}) {
  const trimmed = String(description || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      source: NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE,
      message: 'Descreva o prato (ex: arroz, feijao, frango) antes de estimar.',
    };
  }

  const parsedFromFreeText = createFoodFromText(trimmed);
  if (!parsedFromFreeText?.items?.length) {
    return {
      ok: false,
      source: NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE,
      message:
        'Nao identifiquei itens no prato. Tente nomes simples separados por virgula (ex: 100g frango, arroz, salada).',
    };
  }

  const factor = Number(portionFactor || 1);
  const totals = scaleMacroTotals(parsedFromFreeText.totals, factor);
  const items = parsedFromFreeText.items.map((item) => ({
    label: item.label,
    quantity: Number(item.quantity || 1),
    quantityUnit: item.quantityUnit || 'x',
    source: NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE,
    calories: Math.round(Number(item.calories || 0) * factor),
    protein: Math.round(Number(item.protein || 0) * factor),
    carbs: Math.round(Number(item.carbs || 0) * factor),
    fats: Math.round(Number(item.fats || 0) * factor),
  }));

  return {
    ok: true,
    source: NUTRITION_FLOW_SOURCES.PLATE_ESTIMATE,
    confidence: 'low',
    totals,
    items,
    message: 'Estimativa aproximada do prato. Revise porcoes no rascunho antes de salvar.',
  };
}

export function buildDraftFromFreeText({ text = '', portionFactor = 1 } = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      source: NUTRITION_FLOW_SOURCES.FREE_TEXT,
      message: 'Digite alimentos e quantidades para estimar.',
    };
  }

  const parsedFromFreeText = createFoodFromText(trimmed);
  if (!parsedFromFreeText?.items?.length) {
    return {
      ok: false,
      source: NUTRITION_FLOW_SOURCES.FREE_TEXT,
      message: 'Nao foi possivel estimar com esse texto. Inclua quantidade e alimento.',
    };
  }

  const factor = Number(portionFactor || 1);
  return {
    ok: true,
    source: NUTRITION_FLOW_SOURCES.FREE_TEXT,
    confidence: 'medium',
    items: parsedFromFreeText.items,
    totals: scaleMacroTotals(parsedFromFreeText.totals, factor),
    message: `Texto processado. Porcao aplicada: ${factor}x. Revise no rascunho.`,
  };
}
