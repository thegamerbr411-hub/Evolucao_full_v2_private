function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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

function scoreCandidate(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);

  if (!q) {
    return 0;
  }

  if (c === q) {
    return 1000;
  }

  let score = 0;

  if (c.startsWith(q)) {
    score += 400;
  }

  if (c.includes(q)) {
    score += 250;
  }

  const qTokens = q.split(/\s+/).filter(Boolean);
  const tokenHits = qTokens.filter((token) => c.includes(token)).length;
  score += tokenHits * 80;

  const distance = levenshtein(q, c);
  score += Math.max(0, 220 - distance * 24);

  score -= Math.max(0, c.length - q.length) * 2;

  return score;
}

export function fuzzySearchExercises(query, list = [], limit = 30) {
  const safeList = Array.isArray(list) ? list.filter(Boolean) : [];
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return safeList.slice(0, limit);
  }

  const ranked = safeList
    .map((name) => ({ name, score: scoreCandidate(normalizedQuery, name) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)));

  return ranked.slice(0, limit).map((item) => item.name);
}

export function findBestFuzzyMatch(query, list = []) {
  const results = fuzzySearchExercises(query, list, 1);
  return results[0] || '';
}

export function normalizeSearchText(value = '') {
  return normalize(value);
}
