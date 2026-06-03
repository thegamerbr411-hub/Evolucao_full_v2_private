export function normalizeSetFieldValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function hasDisplayableValue(value) {
  return normalizeSetFieldValue(value).trim().length > 0;
}

export function buildWorkoutSetInputDisplay({
  rawValue = '',
  savedValue = '',
  placeholder = '',
  isSaving = false,
  isSaved = false,
  isDisabled = false,
} = {}) {
  const normalizedRaw = normalizeSetFieldValue(rawValue);
  const normalizedSaved = normalizeSetFieldValue(savedValue);
  const safePlaceholder = String(placeholder || '');

  if (hasDisplayableValue(normalizedRaw)) {
    return {
      displayValue: normalizedRaw,
      showPlaceholder: false,
      isPlaceholderStyle: false,
    };
  }

  if (isSaved && hasDisplayableValue(normalizedSaved)) {
    return {
      displayValue: normalizedSaved,
      showPlaceholder: false,
      isPlaceholderStyle: false,
    };
  }

  if (isSaving) {
    const pinnedValue = hasDisplayableValue(normalizedRaw)
      ? normalizedRaw
      : normalizedSaved;

    if (hasDisplayableValue(pinnedValue)) {
      return {
        displayValue: pinnedValue,
        showPlaceholder: false,
        isPlaceholderStyle: false,
      };
    }
  }

  if (isDisabled || !hasDisplayableValue(normalizedRaw) && !hasDisplayableValue(normalizedSaved)) {
    return {
      displayValue: '',
      showPlaceholder: true,
      isPlaceholderStyle: true,
      placeholder: safePlaceholder,
    };
  }

  return {
    displayValue: '',
    showPlaceholder: true,
    isPlaceholderStyle: true,
    placeholder: safePlaceholder,
  };
}

export function formatDisplayText({
  displayValue = '',
  placeholder = '',
  showPlaceholder = false,
} = {}) {
  if (showPlaceholder) {
    return String(placeholder || '');
  }

  return normalizeSetFieldValue(displayValue);
}
