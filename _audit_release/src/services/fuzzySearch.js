function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const QUERY_ALIASES = {
  elevacao: 'elevacao',
  elevaçao: 'elevacao',
  elevacaoo: 'elevacao',
  panturilha: 'panturrilha',
  panturrila: 'panturrilha',
  panturrrilha: 'panturrilha',
  triceps: 'triceps',
  tricepis: 'triceps',
  biceps: 'biceps',
  bicepis: 'biceps',
  gluteo: 'gluteo',
  gluteos: 'gluteo',
  quad: 'quadriceps',
  quadri: 'quadriceps',
  quadril: 'quadriceps',
  quadris: 'quadriceps',
  quadricepss: 'quadriceps',
  quadricepis: 'quadriceps',
  cross: 'crossover',
  peck: 'peck deck',
  pecdeck: 'peck deck',
};

const SEMANTIC_NAME_HINTS = [
  {
    tokens: ['extensora', 'agachamento', 'hack', 'leg press', 'bulgaro', 'afundo', 'passada'],
    tags: ['quadriceps', 'legs'],
  },
  {
    tokens: ['hip thrust', 'coice', 'kickback', 'abdutora', 'glute', 'pelvica'],
    tags: ['gluteo', 'glutes'],
  },
  {
    tokens: ['flexora', 'stiff', 'good morning', 'mesa flexora'],
    tags: ['hamstrings', 'posterior'],
  },
];

function normalizeWithAliases(value = '') {
  const normalized = normalize(value);
  if (!normalized) return '';
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const mapped = tokens.map((token) => QUERY_ALIASES[token] || token);
  return mapped.join(' ').trim();
}

function levenshtein(a = '', b = '') {
  const s = normalize(a);
  const t = normalize(b);
  const rows = s.length + 1;
  const cols = t.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

function getEntryText(item) {
  const entryName = typeof item === 'string' ? item : item?.name;
  const inferredTags = SEMANTIC_NAME_HINTS
    .filter(({ tokens }) => tokens.some((token) => normalize(entryName).includes(normalize(token))))
    .flatMap(({ tags }) => tags);

  const parts = [entryName];
  if (Array.isArray(item?.tags)) {
    parts.push(item.tags.join(' '));
  }
  if (inferredTags.length) {
    parts.push(inferredTags.join(' '));
  }

  return parts.filter(Boolean).join(' ');
}

function getEntryName(item) {
  return typeof item === 'string' ? item : String(item?.name || '');
}

function getNormalizedTokens(value = '') {
  return normalizeWithAliases(value).split(/\s+/).filter(Boolean);
}

function getTokenMatchScore(queryToken, candidateToken) {
  if (!queryToken || !candidateToken) {
    return 0;
  }

  if (candidateToken === queryToken) {
    return 360;
  }

  if (candidateToken.startsWith(queryToken)) {
    if (queryToken.length <= 4) return 300;
    if (queryToken.length <= 6) return 240;
    return 220;
  }

  if (queryToken.length >= 6 && candidateToken.includes(queryToken)) {
    return 120;
  }

  if (queryToken.length <= 4) {
    return 0;
  }

  const distance = levenshtein(queryToken, candidateToken);
  const maxDistance = queryToken.length <= 6 ? 1 : 2;
  return distance <= maxDistance ? 90 - distance * 20 : 0;
}

function hasStrongShortQueryMatch(queryTokens, candidateTokens) {
  return queryTokens.some((queryToken) =>
    queryToken.length <= 4 && candidateTokens.some((candidateToken) => candidateToken.startsWith(queryToken))
  );
}

function getStrictThreshold(query = '') {
  const size = String(query || '').length;
  if (size <= 4) return 260;
  if (size <= 6) return 190;
  return 140;
}

function scoreCandidate(query, candidate) {
  const q = normalizeWithAliases(query);
  const searchable = normalizeWithAliases(getEntryText(candidate));
  const candidateName = normalizeWithAliases(getEntryName(candidate));

  if (!q) {
    return 0;
  }

  if (candidateName === q) {
    return 1000;
  }

  const qTokens = getNormalizedTokens(q);
  const candidateTokens = getNormalizedTokens(searchable);
  if (!qTokens.length || !candidateTokens.length) {
    return 0;
  }

  const hasShortTokens = qTokens.some((token) => token.length <= 4);
  if (hasShortTokens && !hasStrongShortQueryMatch(qTokens, candidateTokens)) {
    return 0;
  }

  let score = 0;
  let matchedTokens = 0;

  qTokens.forEach((queryToken, tokenIndex) => {
    const bestTokenScore = candidateTokens.reduce((best, candidateToken) => {
      const current = getTokenMatchScore(queryToken, candidateToken);
      return current > best ? current : best;
    }, 0);

    if (bestTokenScore > 0) {
      matchedTokens += 1;
      const lengthWeight = queryToken.length >= 8 ? 1.2 : queryToken.length <= 4 ? 1.1 : 1;
      const positionBoost = tokenIndex === 0 ? 1.05 : 1;
      score += Math.round(bestTokenScore * lengthWeight * positionBoost);
    }
  });

  if (matchedTokens === 0) {
    return 0;
  }

  if (matchedTokens < qTokens.length && qTokens.length > 1) {
    score -= (qTokens.length - matchedTokens) * 140;
  }

  if (candidateName.startsWith(q)) {
    score += 320;
  } else if (searchable.startsWith(q)) {
    score += 220;
  }

  if (candidateName.includes(q)) {
    score += 150;
  } else if (q.length >= 6 && searchable.includes(q)) {
    score += 80;
  }

  const phraseDistance = levenshtein(q, candidateName);
  score += Math.max(0, 120 - phraseDistance * 18);

  score -= Math.max(0, candidateName.length - q.length) * 2;

  const threshold = getStrictThreshold(q);
  return score >= threshold ? score : 0;
}

export const fuzzySearch = (query, list) => {
  const q = normalizeWithAliases(query);
  const qTokens = getNormalizedTokens(q);

  return (Array.isArray(list) ? list : []).filter((item) => {
    const searchable = normalizeWithAliases(getEntryText(item));
    const candidateTokens = getNormalizedTokens(searchable);
    if (!qTokens.length || !candidateTokens.length) return false;

    if (q.length <= 4) {
      return hasStrongShortQueryMatch(qTokens, candidateTokens);
    }

    return qTokens.every((token) =>
      candidateTokens.some((candidateToken) => getTokenMatchScore(token, candidateToken) > 0)
    );
  });
};

export function fuzzySearchExercises(query, list = [], limit = 30) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  const normalizedQuery = normalizeWithAliases(query);

  if (!normalizedQuery) {
    return safeList.slice(0, limit);
  }

  const ranked = safeList
    .map((item) => ({ item, name: getEntryName(item), score: scoreCandidate(normalizedQuery, item) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));

  return ranked.slice(0, limit).map((item) => item.name);
}

export function findBestFuzzyMatch(query, list = []) {
  const results = fuzzySearchExercises(query, list, 1);
  return results[0] || '';
}

export function normalizeSearchText(value = '') {
  return normalizeWithAliases(value);
}
