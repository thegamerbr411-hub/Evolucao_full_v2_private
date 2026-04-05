export const nutritionDatabase = [
  { id: 'arroz_branco_cozido', nome: 'Arroz Branco Cozido', aliases: ['arroz', 'arroz branco'], porcao: '100g', kcal: 130, carbo: 28, prot: 2.5, gord: 0.2 },
  { id: 'feijao_carioca_cozido', nome: 'Feijao Carioca Cozido', aliases: ['feijao', 'feijao carioca'], porcao: '100g', kcal: 76, carbo: 14, prot: 5, gord: 0.5 },
  { id: 'peito_frango_grelhado', nome: 'Peito de Frango Grelhado', aliases: ['frango', 'peito frango', 'frango grelhado'], porcao: '100g', kcal: 165, carbo: 0, prot: 31, gord: 3.6 },
  { id: 'ovo_inteiro_cozido', nome: 'Ovo Inteiro Cozido', aliases: ['ovo', 'ovos', 'ovo cozido'], porcao: '50g (1 unid)', kcal: 78, carbo: 0.6, prot: 6.3, gord: 5.3 },
  { id: 'pao_frances', nome: 'Pao Frances', aliases: ['pao', 'pao frances', 'paozinho'], porcao: '50g (1 unid)', kcal: 150, carbo: 29, prot: 4.5, gord: 1.5 },
  { id: 'banana_prata', nome: 'Banana Prata', aliases: ['banana', 'banana prata'], porcao: '80g (1 unid)', kcal: 70, carbo: 18, prot: 0.9, gord: 0.3 },
  { id: 'whey_protein_concentrado', nome: 'Whey Protein Concentrado', aliases: ['whey', 'whey protein'], porcao: '30g (1 scoop)', kcal: 120, carbo: 3, prot: 24, gord: 1.5 },
  { id: 'iogurte_natural', nome: 'Iogurte Natural', aliases: ['iogurte', 'iogurte natural'], porcao: '170g', kcal: 105, carbo: 8, prot: 9, gord: 4 },
  { id: 'aveia_flocos', nome: 'Aveia em Flocos', aliases: ['aveia', 'aveia flocos'], porcao: '30g', kcal: 114, carbo: 19, prot: 4, gord: 2.5 },
  { id: 'leite_desnatado', nome: 'Leite Desnatado', aliases: ['leite', 'leite desnatado'], porcao: '200ml', kcal: 70, carbo: 10, prot: 7, gord: 0.2 },
  { id: 'carne_bovina_magra', nome: 'Carne Bovina Magra', aliases: ['carne', 'patinho', 'carne magra'], porcao: '100g', kcal: 190, carbo: 0, prot: 29, gord: 8 },
  { id: 'atum_agua', nome: 'Atum em Agua', aliases: ['atum', 'atum agua'], porcao: '100g', kcal: 132, carbo: 0, prot: 28, gord: 1 },
  { id: 'macarrao_cozido', nome: 'Macarrao Cozido', aliases: ['macarrao', 'massa'], porcao: '100g', kcal: 158, carbo: 31, prot: 5.8, gord: 0.9 },
  { id: 'batata_cozida', nome: 'Batata Cozida', aliases: ['batata', 'batata cozida'], porcao: '100g', kcal: 86, carbo: 20, prot: 2, gord: 0.1 },
  { id: 'batata_doce_cozida', nome: 'Batata Doce Cozida', aliases: ['batata doce', 'batata-doce'], porcao: '100g', kcal: 86, carbo: 20, prot: 1.6, gord: 0.1 },
  { id: 'queijo_mussarela', nome: 'Queijo Mussarela', aliases: ['queijo', 'mussarela', 'muzzarela'], porcao: '30g', kcal: 86, carbo: 1, prot: 6, gord: 6 },
  { id: 'queijo_cottage', nome: 'Queijo Cottage', aliases: ['cottage', 'queijo cottage'], porcao: '100g', kcal: 98, carbo: 3.4, prot: 11, gord: 4.3 },
  { id: 'abacate', nome: 'Abacate', aliases: ['abacate'], porcao: '100g', kcal: 96, carbo: 6, prot: 1.2, gord: 8.4 },
  { id: 'maca', nome: 'Maca', aliases: ['maca'], porcao: '130g (1 unid)', kcal: 72, carbo: 19, prot: 0.4, gord: 0.2 },
  { id: 'laranja', nome: 'Laranja', aliases: ['laranja'], porcao: '130g (1 unid)', kcal: 62, carbo: 15, prot: 1.2, gord: 0.2 },
  { id: 'pasta_amendoim', nome: 'Pasta de Amendoim', aliases: ['pasta amendoim', 'amendoim'], porcao: '15g', kcal: 88, carbo: 3, prot: 4, gord: 7.5 },
  { id: 'castanha_caju', nome: 'Castanha de Caju', aliases: ['castanha', 'castanha caju'], porcao: '15g', kcal: 84, carbo: 4.5, prot: 2.7, gord: 6.7 },
  { id: 'brocolis_cozido', nome: 'Brocolis Cozido', aliases: ['brocolis'], porcao: '100g', kcal: 35, carbo: 7, prot: 2.8, gord: 0.4 },
  { id: 'tomate', nome: 'Tomate', aliases: ['tomate'], porcao: '100g', kcal: 18, carbo: 3.9, prot: 0.9, gord: 0.2 },
  { id: 'alface', nome: 'Alface', aliases: ['alface'], porcao: '100g', kcal: 15, carbo: 2.9, prot: 1.4, gord: 0.2 },
];

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function toCatalogItem(item) {
  return {
    id: item.id,
    key: normalize(item.aliases?.[0] || item.nome),
    label: item.nome,
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    calories: Number(item.kcal || 0),
    protein: Number(item.prot || 0),
    carbs: Number(item.carbo || 0),
    fats: Number(item.gord || 0),
  };
}

const foodById = nutritionDatabase.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const foodAliasMap = nutritionDatabase.reduce((acc, item) => {
  const normalizedName = normalize(item.nome);
  acc[normalizedName] = item;
  (item.aliases || []).forEach((alias) => {
    acc[normalize(alias)] = item;
  });
  return acc;
}, {});

export function getFoodCatalog() {
  return nutritionDatabase.map(toCatalogItem);
}

export function getFoodById(foodId = '') {
  const safeId = String(foodId || '').trim();
  return safeId ? foodById[safeId] || null : null;
}

export function getCanonicalFoodData(input = '') {
  const safeInput = String(input || '').trim();
  if (!safeInput) {
    return null;
  }

  if (foodById[safeInput]) {
    return toCatalogItem(foodById[safeInput]);
  }

  const normalized = normalize(safeInput);
  if (foodAliasMap[normalized]) {
    return toCatalogItem(foodAliasMap[normalized]);
  }

  const containsMatch = nutritionDatabase.find((item) => {
    if (normalize(item.nome).includes(normalized)) {
      return true;
    }
    return (item.aliases || []).some((alias) => normalize(alias).includes(normalized));
  });

  return containsMatch ? toCatalogItem(containsMatch) : null;
}

export function getCanonicalFoodId(input = '') {
  return getCanonicalFoodData(input)?.id || null;
}

export function searchNutritionDatabase(query = '') {
  const normalized = normalize(query);
  if (!normalized) {
    return nutritionDatabase.slice(0, 20).map(toCatalogItem);
  }

  return nutritionDatabase
    .filter((item) => {
      const byName = normalize(item.nome).includes(normalized);
      const byAlias = (item.aliases || []).some((alias) => normalize(alias).includes(normalized));
      return byName || byAlias;
    })
    .slice(0, 20)
    .map(toCatalogItem);
}

export function matchNutritionToken(token = '') {
  const normalized = normalize(token);
  if (!normalized) {
    return null;
  }

  const exactByName = nutritionDatabase.find((item) => normalize(item.nome) === normalized);
  if (exactByName) {
    return {
      ...toCatalogItem(exactByName),
      confidenceScore: 1,
      matchedBy: 'name_exact',
    };
  }

  const exactByAlias = nutritionDatabase.find((item) =>
    (item.aliases || []).some((alias) => normalize(alias) === normalized)
  );
  if (exactByAlias) {
    return {
      ...toCatalogItem(exactByAlias),
      confidenceScore: 0.9,
      matchedBy: 'alias_exact',
    };
  }

  const containsAlias = nutritionDatabase.find((item) =>
    (item.aliases || []).some((alias) => normalize(alias).includes(normalized))
  );
  if (containsAlias) {
    return {
      ...toCatalogItem(containsAlias),
      confidenceScore: 0.7,
      matchedBy: 'alias_contains',
    };
  }

  return null;
}
