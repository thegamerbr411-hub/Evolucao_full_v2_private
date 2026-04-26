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
    const quantityUnit = String(quantityMatch?.[2] || 'x').toLowerCase();
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
      quantityUnit,
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

  const parseNumericValue = (value = '') => {
    const normalized = String(value || '').replace(',', '.').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const extractFirst = (labels) => {
    const pattern = new RegExp(`(?:${labels.join('|')})[^\\d]*(\\d+[\\.,]?\\d*)`, 'i');
    const match = text.match(pattern);
    return match ? parseNumericValue(match[1]) : 0;
  };

  const extractFromRows = (labels) => {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const allKnownLabels = [
      'kcal',
      'calorias',
      'valor energetico',
      'energia',
      'carboidratos',
      'carboidrato',
      'carbs',
      'proteinas',
      'proteina',
      'protein',
      'gorduras totais',
      'gordura total',
      'gorduras',
      'fat',
      'sodio',
      'sodium',
      'acucares totais',
      'acucar',
      'sugars',
      'acucares adicionados',
      'cafeina',
      'caffeine',
    ];
    const labelPattern = new RegExp(`(?:${labels.join('|')})`, 'i');
    const boundaryPattern = new RegExp(`(?:${allKnownLabels.join('|')})`, 'i');
    const valuePattern = /(\d+[\.,]?\d*)\s*(kcal|g|mg|ml)?/gi;

    for (const line of lines) {
      if (!labelPattern.test(line)) {
        continue;
      }

      const labelMatch = line.match(labelPattern);
      if (!labelMatch || typeof labelMatch.index !== 'number') {
        continue;
      }

      const afterLabel = line.slice(labelMatch.index + labelMatch[0].length);
      const nextBoundaryIndex = afterLabel.search(boundaryPattern);
      const segment = nextBoundaryIndex >= 0 ? afterLabel.slice(0, nextBoundaryIndex) : afterLabel;

      const values = [];
      let match;
      while ((match = valuePattern.exec(segment)) !== null) {
        values.push(parseNumericValue(match[1]));
      }

      if (!values.length) {
        continue;
      }

      const hasReferenceColumns = /100\s*(g|ml)|por\s*100/i.test(line);
      if (values.length >= 2 && hasReferenceColumns) {
        return values[1];
      }

      return values[0];
    }

    return 0;
  };

  const extractMacro = (labels) => extractFromRows(labels) || extractFirst(labels);

  const detectProductName = () => {
    const lines = String(rawText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines.slice(0, 4)) {
      const normalizedLine = normalize(line);
      if (!normalizedLine) {
        continue;
      }
      if (normalizedLine.includes('informacao nutricional') || normalizedLine.includes('tabela nutricional')) {
        continue;
      }
      if (/\d/.test(line) && line.length < 6) {
        continue;
      }
      return line;
    }

    return '';
  };

  const servingMatch = String(rawText || '').match(/por[cç][aã]o\s*de\s*(\d+[\.,]?\d*)\s*(g|ml)/i);
  const serving = servingMatch
    ? {
        value: parseNumericValue(servingMatch[1]),
        unit: String(servingMatch[2] || '').toLowerCase(),
      }
    : null;

  const parsed = {
    productName: detectProductName(),
    serving,
    calories: extractMacro(['kcal', 'calorias', 'valor energetico', 'energia']),
    carbs: extractMacro(['carboidratos', 'carboidrato', 'carbs']),
    protein: extractMacro(['proteinas', 'proteina', 'protein']),
    fat: extractMacro(['gorduras totais', 'gordura total', 'gorduras', 'fat']),
    sodium: extractMacro(['sodio', 'sodium']),
    sugars: extractMacro(['acucares totais', 'acucar', 'sugars']),
    addedSugars: extractMacro(['acucares adicionados']),
    caffeine: extractMacro(['cafeina', 'caffeine']),
  };

  const extractedFields = ['calories', 'carbs', 'protein', 'fat'].filter((field) => Number(parsed[field] || 0) > 0).length;
  const confidence = extractedFields >= 4 ? 'high' : extractedFields >= 2 ? 'medium' : 'low';
  const insufficientData = extractedFields < 2;

  return {
    ...parsed,
    confidence,
    insufficientData,
    fallback: false,
  };
}
