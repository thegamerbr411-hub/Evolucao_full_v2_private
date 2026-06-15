export function formatCatalogAddLabel(count) {
  const total = Math.max(0, Number(count) || 0);
  if (total === 0) {
    return 'Selecione exercícios';
  }
  if (total === 1) {
    return 'Adicionar 1 exercício';
  }
  return `Adicionar ${total} exercícios`;
}

export function isCatalogAddEnabled(count) {
  return Math.max(0, Number(count) || 0) > 0;
}
