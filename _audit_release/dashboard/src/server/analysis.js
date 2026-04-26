const SEVERITY_WEIGHTS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const PATTERNS = [
  {
    key: 'axios',
    category: 'dependency',
    rootCause: 'Dependencia HTTP ausente ou import quebrado',
    suggestion: 'Instale axios ou verifique import',
  },
  {
    key: 'undefined',
    category: 'runtime',
    rootCause: 'Valor indefinido acessado sem guarda',
    suggestion: 'Adicione guarda para valores ausentes antes de acessar propriedades',
  },
  {
    key: 'network',
    category: 'network',
    rootCause: 'Falha de comunicacao com backend ou servico externo',
    suggestion: 'Erro de conexao com backend',
  },
  {
    key: 'timeout',
    category: 'network',
    rootCause: 'Tempo de resposta acima do esperado',
    suggestion: 'Timeout de rede. Ajuste retry e timeout da chamada',
  },
  {
    key: 'permission',
    category: 'auth',
    rootCause: 'Permissao insuficiente para concluir a acao',
    suggestion: 'Verifique regras de permissao/autorizacao',
  },
  {
    key: 'jwt',
    category: 'auth',
    rootCause: 'Token invalido, ausente ou expirado',
    suggestion: 'Token invalido ou expirado. Renove autenticacao',
  },
];

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getPattern(message = '') {
  const normalized = String(message || '').toLowerCase();
  return PATTERNS.find((item) => normalized.includes(item.key)) || {
    category: 'runtime',
    rootCause: 'Falha nao classificada automaticamente',
    suggestion: 'Revise fluxo, stack e telemetria para reduzir recorrencia',
  };
}

function sumHistory(history = [], fromIndex = 0, toIndex = history.length) {
  return history
    .slice(fromIndex, toIndex)
    .reduce((acc, item) => acc + Math.max(0, toSafeNumber(item?.count, 0)), 0);
}

function getTrend(history = []) {
  const safeHistory = Array.isArray(history) ? history.slice(-14) : [];
  if (!safeHistory.length) {
    return {
      delta: 0,
      label: 'novo',
      last7Days: 0,
      previous7Days: 0,
    };
  }

  const splitIndex = Math.max(0, safeHistory.length - 7);
  const previous7Days = sumHistory(safeHistory, 0, splitIndex);
  const last7Days = sumHistory(safeHistory, splitIndex);
  const delta = previous7Days === 0
    ? last7Days > 0 ? 100 : 0
    : Math.round(((last7Days - previous7Days) / previous7Days) * 100);

  let label = 'estavel';
  if (previous7Days === 0 && last7Days > 0) {
    label = 'novo';
  } else if (delta >= 25) {
    label = 'subindo';
  } else if (delta <= -25) {
    label = 'caindo';
  }

  return {
    delta,
    label,
    last7Days,
    previous7Days,
  };
}

function getFrequencyLabel(count) {
  if (count >= 25) return 'muito_alta';
  if (count >= 10) return 'alta';
  if (count >= 4) return 'media';
  return 'baixa';
}

function getPriorityScore(bug = {}, trend = null) {
  const severityWeight = SEVERITY_WEIGHTS[String(bug?.severity || 'LOW').toUpperCase()] || 1;
  const count = Math.max(1, toSafeNumber(bug?.count, 1));
  const recencyHours = Math.max(
    0,
    (Date.now() - new Date(bug?.lastOccurrence || bug?.timestamp || Date.now()).getTime()) / (1000 * 60 * 60)
  );
  const recencyScore = recencyHours <= 6 ? 20 : recencyHours <= 24 ? 12 : recencyHours <= 72 ? 6 : 2;
  const trendScore = trend?.label === 'subindo'
    ? 12
    : trend?.label === 'novo'
    ? 8
    : trend?.label === 'caindo'
    ? -4
    : 0;

  return (severityWeight * 25) + Math.min(25, count * 2) + recencyScore + trendScore;
}

function getPriorityLabel(score) {
  if (score >= 120) return 'P0';
  if (score >= 90) return 'P1';
  if (score >= 60) return 'P2';
  return 'P3';
}

function analyzeBug(bug = {}) {
  const pattern = getPattern(bug?.message || '');
  const trend = getTrend(bug?.history);
  const count = Math.max(1, toSafeNumber(bug?.count, 1));
  const priorityScore = getPriorityScore(bug, trend);

  return {
    ...bug,
    rootCause: pattern.rootCause,
    suggestion: pattern.suggestion,
    category: pattern.category,
    frequencyLabel: getFrequencyLabel(count),
    trend,
    priorityScore,
    priorityLabel: getPriorityLabel(priorityScore),
  };
}

function analyzeBatch(bugs = []) {
  if (!Array.isArray(bugs)) {
    return [];
  }

  return bugs
    .map(analyzeBug)
    .sort((a, b) => b.priorityScore - a.priorityScore || toSafeNumber(b.count, 0) - toSafeNumber(a.count, 0));
}

function buildSummary(insights = []) {
  const summary = {
    bugs: insights.length,
    critical: 0,
    high: 0,
    occurrences: 0,
    rising: 0,
  };

  insights.forEach((item) => {
    const severity = String(item?.severity || '').toUpperCase();
    summary.occurrences += Math.max(1, toSafeNumber(item?.count, 1));
    if (severity === 'CRITICAL') summary.critical += 1;
    if (severity === 'HIGH' || severity === 'CRITICAL') summary.high += 1;
    if (item?.trend?.label === 'subindo' || item?.trend?.label === 'novo') summary.rising += 1;
  });

  return summary;
}

function buildInsightsPayload(clientId, bugs = []) {
  const allBugs = Array.isArray(bugs) ? bugs : [];
  const realBugs = allBugs.filter((item) => !item?.synthetic);
  const insights = analyzeBatch(realBugs);
  return {
    clientId: String(clientId || 'default'),
    generatedAt: new Date().toISOString(),
    insights,
    summary: buildSummary(insights),
    excludedSynthetic: Math.max(0, allBugs.length - realBugs.length),
    totalInsights: insights.length,
  };
}

module.exports = {
  analyzeBatch,
  analyzeBug,
  buildInsightsPayload,
  buildSummary,
  getPattern,
  getTrend,
};
