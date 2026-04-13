// openai-fix.js
// Gera patch de código real usando OpenAI GPT-4
const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function sanitizeText(value) {
  return String(value || '').slice(0, 5000);
}

function extractPatch(text) {
  const trimmed = String(text || '').trim();
  const markerIndex = trimmed.indexOf('*** Begin Patch');
  if (markerIndex >= 0) {
    const chunk = trimmed.slice(markerIndex);
    const endIndex = chunk.indexOf('*** End Patch');
    if (endIndex >= 0) {
      return `${chunk.slice(0, endIndex + '*** End Patch'.length)}`;
    }
    return chunk;
  }

  return trimmed;
}

function scoreSuggestion(patch, bug) {
  if (!patch.startsWith('*** Begin Patch')) return 0;
  const hasUpdate = patch.includes('*** Update File:');
  const hasChange = patch.includes('\n-') && patch.includes('\n+');
  const stackWeight = bug?.stack ? 0.1 : 0;
  const fileWeight = bug?.file || bug?.sourceFile ? 0.1 : 0;
  const base = hasUpdate && hasChange ? 0.75 : 0.45;
  return Math.min(0.98, Number((base + stackWeight + fileWeight).toFixed(2)));
}

async function gerarPatchParaBug(bug) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY não configurada');
  const safeBug = bug && typeof bug === 'object' ? bug : {};
  const targetFile = sanitizeText(safeBug.file || safeBug.sourceFile || safeBug.meta?.file || '');
  const prompt = [
    'Você é um assistente sênior de correção de bugs.',
    'Gere APENAS um patch no formato apply_patch deste projeto:',
    '*** Begin Patch',
    '*** Update File: <arquivo>',
    '@@',
    '-linha_antiga',
    '+linha_nova',
    '*** End Patch',
    '',
    `Mensagem do bug: ${sanitizeText(safeBug.message || 'N/A')}`,
    `Stack trace: ${sanitizeText(safeBug.stack || 'N/A')}`,
    `Arquivo alvo sugerido: ${targetFile || 'N/A'}`,
    `Contexto adicional: ${sanitizeText(JSON.stringify(safeBug.meta || {}))}`,
    '',
    'Restrições:',
    '- Não alterar arquivos críticos de infra/deploy.',
    '- Corrigir causa raiz com mudança mínima.',
    '- Se não houver segurança suficiente, retornar patch vazio válido com comentário no próprio patch.',
  ].join('\n');

  const res = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'Você é um assistente de correção de código experiente.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 800,
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    }
  });

  const content = String(res?.data?.choices?.[0]?.message?.content || '').trim();
  const patch = extractPatch(content);
  if (!patch.startsWith('*** Begin Patch')) throw new Error('Resposta OpenAI não é um patch válido');

  return {
    confidence: scoreSuggestion(patch, safeBug),
    model: OPENAI_MODEL,
    patch,
    reason: 'ai_generated_patch',
  };
}

module.exports = { gerarPatchParaBug };
