export function buildWorkoutModePresentation({ simpleMode = true } = {}) {
  const isSimple = Boolean(simpleMode);

  return {
    modeLabel: isSimple ? 'Modo simples' : 'Modo avancado',
    toggleLabel: 'Alternar',
    compactLabel: isSimple ? 'Modo simples · Alternar' : 'Modo avancado · Alternar',
    helperText: isSimple
      ? 'Foco em registrar series rapido.'
      : 'Mostra detalhes extras do treino.',
    showHelper: !isSimple,
  };
}
