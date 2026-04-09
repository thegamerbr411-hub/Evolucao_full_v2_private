const PATTERNS = [
  { key: 'axios', fix: 'Instale axios ou verifique import' },
  { key: 'undefined', fix: 'Variavel nao definida' },
  { key: 'network', fix: 'Erro de conexao com backend' },
  { key: 'timeout', fix: 'Timeout de rede. Ajuste retry e timeout da chamada' },
  { key: 'permission', fix: 'Verifique regras de permissao/autorizacao' },
  { key: 'jwt', fix: 'Token invalido ou expirado. Renove autenticacao' },
];

function analyzeMessage(message = '') {
  const normalized = String(message || '').toLowerCase();
  const found = PATTERNS.find((item) => normalized.includes(item.key));
  return found ? found.fix : 'Erro desconhecido';
}

function analyzeBug(bug = {}) {
  const message = String(bug?.message || '');
  return {
    ...bug,
    suggestion: analyzeMessage(message),
  };
}

function analyzeBatch(bugs = []) {
  if (!Array.isArray(bugs)) return [];
  return bugs.map(analyzeBug);
}

module.exports = {
  analyzeBatch,
  analyzeBug,
  analyzeMessage,
};
