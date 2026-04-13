import { generateCoach } from './coachEngine.js';
import { getAIResponse } from './aiCoachService.js';

export const getCoach = async (context) => {
  const base = generateCoach(context || {});

  if (Number(base.priority || 0) >= 8) {
    return base;
  }

  const ai = await getAIResponse(context || {});

  return {
    message: ai?.message || base.message,
    action: ai?.action || base.action,
    priority: ai?.priority || base.priority,
  };
};
