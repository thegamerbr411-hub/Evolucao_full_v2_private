const STATE_LABELS = {
  pending: 'Pendente',
  ready: 'Pronta',
  saved: 'Série salva',
  invalid: 'Inválida',
};

const STATE_TEST_IDS = {
  pending: 'set-pending-state',
  ready: 'set-ready-state',
  saved: 'set-saved-state',
  invalid: 'set-pending-state',
};

export function resolveWorkoutSetStatusKey(rowState) {
  const status = String(rowState?.status || 'pending');
  if (status === 'ready' || status === 'saved' || status === 'invalid') {
    return status;
  }
  return 'pending';
}

export function buildWorkoutSetStatePresentation(rowState = {}) {
  const statusKey = resolveWorkoutSetStatusKey(rowState);
  const label = STATE_LABELS[statusKey] || STATE_LABELS.pending;
  const stateTestID = STATE_TEST_IDS[statusKey] || STATE_TEST_IDS.pending;

  return {
    statusKey,
    label: rowState?.label || label,
    stateTestID,
    checkTestID: statusKey === 'saved' ? 'set-saved-check' : undefined,
    actionAccessibilityLabel: rowState?.accessibilityLabel || label,
    savedFeedbackLabel: 'Série salva',
  };
}
