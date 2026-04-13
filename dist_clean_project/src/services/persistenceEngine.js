export function serializeSessionState(state = {}) {
  return JSON.stringify({
    workoutDrafts: state.workoutDrafts || {},
    nutritionDraft: state.nutritionDraft || [],
    lastUpdatedAt: state.lastUpdatedAt || new Date().toISOString(),
  });
}

export function hydrateSessionState(raw = '') {
  try {
    const parsed = JSON.parse(String(raw || '{}'));
    return {
      workoutDrafts: parsed.workoutDrafts && typeof parsed.workoutDrafts === 'object' ? parsed.workoutDrafts : {},
      nutritionDraft: Array.isArray(parsed.nutritionDraft) ? parsed.nutritionDraft : [],
      lastUpdatedAt: parsed.lastUpdatedAt || null,
    };
  } catch (error) {
    return {
      workoutDrafts: {},
      nutritionDraft: [],
      lastUpdatedAt: null,
    };
  }
}
