import { searchNutritionDatabase } from '../data/nutritionDatabase.js';

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function macroTemplate(name) {
  const text = normalize(name);
  if (text.includes('whey') || text.includes('frango') || text.includes('atum') || text.includes('patinho') || text.includes('tilapia')) {
    return { calories: 130, protein: 24, carbs: 4, fats: 2 };
  }
  if (text.includes('salmao')) {
    return { calories: 208, protein: 20, carbs: 0, fats: 13 };
  }
  if (text.includes('iogurte') || text.includes('yopro')) {
    return { calories: 140, protein: 15, carbs: 12, fats: 2 };
  }
  if (text.includes('pao') || text.includes('arroz') || text.includes('batata') || text.includes('banana') || text.includes('tapioca') || text.includes('cuscuz') || text.includes('mandioca')) {
    return { calories: 120, protein: 3, carbs: 25, fats: 1 };
  }
  return { calories: 100, protein: 6, carbs: 12, fats: 3 };
}

export function createFoodFromText(input = '') {
  const raw = String(input || '').trim();
  if (!raw) {
    return {
      name: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  }

  if (!/[,+;]|\se\s/i.test(raw)) {
    return {
      name: raw,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
  }

  const pieces = raw.split(/[,+;]|\se\s/).map((item) => item.trim()).filter(Boolean);
  const entries = [];

  pieces.forEach((piece) => {
    const quantityMatch = piece.match(/(\d+[\.,]?\d*)\s*(g|ml|x|un)?/i);
    const quantity = quantityMatch ? Math.max(0.1, toNumber(quantityMatch[1], 1)) : 1;
    const label = normalize(piece)
      .replace(/(\d+[\.,]?\d*)\s*(g|ml|x|un)?/ig, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!label) {
      return;
    }

    const dbMatch = searchNutritionDatabase(label)[0] || null;
    const base = dbMatch
      ? {
          label: dbMatch.label,
          calories: Number(dbMatch.calories || 0),
          protein: Number(dbMatch.protein || 0),
          carbs: Number(dbMatch.carbs || 0),
          fats: Number(dbMatch.fats || 0),
        }
      : {
          label,
          ...macroTemplate(label),
        };

    const factor = quantityMatch && /g|ml/i.test(quantityMatch[2] || '') ? quantity / 100 : quantity;
    entries.push({
      label: base.label,
      quantity,
      calories: Number((base.calories * factor).toFixed(1)),
      protein: Number((base.protein * factor).toFixed(1)),
      carbs: Number((base.carbs * factor).toFixed(1)),
      fats: Number((base.fats * factor).toFixed(1)),
    });
  });

  return {
    source: 'text',
    items: entries,
    totals: entries.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fats: acc.fats + item.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    ),
  };
}

export function parseNutritionLabel(image) {
  const rawText = typeof image === 'string'
    ? image
    : String(image?.ocrText || image?.hint || image?.uri || '');

  const text = normalize(rawText);

  const extract = (labels) => {
    const pattern = new RegExp(`(?:${labels.join('|')})[^\\d]*(\\d+[\\.,]?\\d*)`, 'i');
    const match = text.match(pattern);
    return match ? toNumber(match[1], 0) : 0;
  };

  const parseFromRequiredPattern = (raw) => {
    const extractRequired = (regex) => {
      const match = String(raw || '').match(regex);
      return match ? Number(match[1]) : 0;
    };

    return {
      calories: extractRequired(/(\d+)\s*kcal/i),
      carbs: extractRequired(/carboidratos\s*(\d+)/i),
    };
  };

  const required = parseFromRequiredPattern(rawText);

  const parsed = {
    calories: required.calories || extract(['kcal', 'calorias', 'energia']),
    carbs: required.carbs || extract(['carboidratos', 'carboidrato', 'carbs']),
    protein: extract(['proteinas', 'proteina', 'protein']),
    fat: extract(['gorduras totais', 'gordura total', 'gorduras', 'fat']),
    sodium: extract(['sodio', 'sodium']),
  };

  if (!parsed.calories && !parsed.carbs && !parsed.protein && !parsed.fat) {
    return {
      ...parsed,
      calories: 120,
      carbs: 10,
      protein: 12,
      fat: 4,
      sodium: parsed.sodium || 100,
      fallback: true,
    };
  }

  return parsed;
}
