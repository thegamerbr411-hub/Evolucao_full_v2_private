export function buildWorkoutModePresentation({ simpleMode = true } = {}) {
  const isSimple = Boolean(simpleMode);

  return {
    modeLabel: isSimple ? 'Treino guiado' : 'Visão completa',
    toggleLabel: 'Trocar',
    compactLabel: isSimple ? 'Treino guiado · Trocar' : 'Visão completa · Trocar',
    helperText: isSimple
      ? 'Registre sua carga e avance no treino.'
      : 'Mostra detalhes extras do treino.',
    showHelper: !isSimple,
  };
}
