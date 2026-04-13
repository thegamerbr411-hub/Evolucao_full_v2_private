import { safeExecute } from './safeExecute.js';

export const getAIResponse = async (context) => {
  return safeExecute(async () => {
    const res = await fetch('https://SEU_BACKEND/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context || {}),
    });

    if (!res.ok) {
      throw new Error(`coach_http_${res.status}`);
    }

    return res.json();
  }, {});
};
