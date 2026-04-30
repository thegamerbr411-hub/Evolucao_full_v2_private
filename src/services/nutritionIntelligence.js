import { searchNutritionDatabase } from '../data/nutritionDatabase.js';

const TEXT_CONNECTORS = /(?:\+|,|;|\be\b|\bcom\b)/i;
const FOOD_STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'sem', 'no', 'na', 'em']);
const UNIT_HINTS = new Set(['fatia', 'fatias', 'colher', 'colheres', 'scoop', 'un', 'unid', 'unidade', 'unidades', 'copo', 'copos', 'xicara', 'xicaras']);

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

function buildFoodSearchVariants(label = '') {
  const normalized = normalize(label)
    .replace(/\b(fatia|fatias|colher|colheres|scoop|unidade|unidades|unid|copo|copos|xicara|xicaras)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const baseTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && !FOOD_STOP_WORDS.has(token));

  const singularTokens = baseTokens.map((token) => (token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token));
  const tokenPool = Array.from(new Set([...baseTokens, ...singularTokens]));
  const phrases = [];

  for (let size = Math.min(3, tokenPool.length); size >= 1; size -= 1) {
    for (let index = 0; index <= tokenPool.length - size; index += 1) {
      phrases.push(tokenPool.slice(index, index + size).join(' '));
    }
  }

  return Array.from(new Set([normalized, ...phrases].filter(Boolean)));
}

function getMatchQualityScore(candidate, phrase = '') {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase || !candidate) {
    return 0;
  }

  const candidateLabel = normalize(candidate.label);
  const candidateAliases = Array.isArray(candidate.aliases) ? candidate.aliases.map((alias) => normalize(alias)) : [];

  if (candidateLabel === normalizedPhrase || candidateAliases.includes(normalizedPhrase)) {
    return 300;
  }

  if (candidateLabel.includes(normalizedPhrase) || candidateAliases.some((alias) => alias.includes(normalizedPhrase))) {
    return 180 + normalizedPhrase.split(/\s+/).length * 10;
  }

  return 0;
}

function findFlexibleFoodMatches(label = '') {
  const phrases = buildFoodSearchVariants(label);
  const matches = new Map();

  phrases.forEach((phrase) => {
    const candidates = searchNutritionDatabase(phrase);
    candidates.forEach((candidate) => {
      const score = getMatchQualityScore(candidate, phrase);
      if (score <= 0) {
        return;
      }

      const current = matches.get(candidate.id);
      if (!current || score > current.score) {
        matches.set(candidate.id, { ...candidate, score });
      }
    });
  });

  return Array.from(matches.values())
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 3);
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

  const pieces = raw
    .split(TEXT_CONNECTORS)
    .map((item) => item.trim())
    .filter(Boolean);
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

    const dbMatches = findFlexibleFoodMatches(label);
    const resolvedMatches = dbMatches.length
      ? dbMatches
      : [{
          label,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
        }];

    resolvedMatches.forEach((match, matchIndex) => {
      const base = Number(match.calories || match.protein || match.carbs || match.fats)
        ? {
            label: match.label,
            calories: Number(match.calories || 0),
            protein: Number(match.protein || 0),
            carbs: Number(match.carbs || 0),
            fats: Number(match.fats || 0),
          }
        : {
            label: match.label,
            ...macroTemplate(match.label),
          };

      const shouldUseExactWeight = quantityMatch && /g|ml/i.test(quantityMatch[2] || '');
      const hasUnitHint = label.split(/\s+/).some((token) => UNIT_HINTS.has(token));
      const factor = shouldUseExactWeight
        ? quantity / 100
        : matchIndex === 0 || hasUnitHint
          ? quantity
          : 1;

      entries.push({
        label: base.label,
        quantity: matchIndex === 0 || hasUnitHint ? quantity : 1,
        quantityUnit,
        calories: Number((base.calories * factor).toFixed(1)),
        protein: Number((base.protein * factor).toFixed(1)),
        carbs: Number((base.carbs * factor).toFixed(1)),
        fats: Number((base.fats * factor).toFixed(1)),
      });
    });
  });

  const dedupedEntries = entries.reduce((acc, entry) => {
    const existing = acc.find((item) => normalize(item.label) === normalize(entry.label));
    if (!existing) {
      acc.push(entry);
      return acc;
    }

    existing.quantity += Number(entry.quantity || 0);
    existing.calories = Number((existing.calories + Number(entry.calories || 0)).toFixed(1));
    existing.protein = Number((existing.protein + Number(entry.protein || 0)).toFixed(1));
    existing.carbs = Number((existing.carbs + Number(entry.carbs || 0)).toFixed(1));
    existing.fats = Number((existing.fats + Number(entry.fats || 0)).toFixed(1));
    return acc;
  }, []);

  return {
    source: 'text',
    items: dedupedEntries,
    totals: dedupedEntries.reduce(
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
