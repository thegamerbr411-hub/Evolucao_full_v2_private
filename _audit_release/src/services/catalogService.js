/**
 * catalogService.js
 * Serviço de catálogo de exercícios/máquinas para o app mobile.
 * Busca catálogo oficial do servidor e usa fallback local se offline.
 */

const SERVER_BASE_URL = process?.env?.EXPO_PUBLIC_DASHBOARD_URL
  || process?.env?.EXPO_PUBLIC_API_BASE_URL
  || null;

const SERVER_CATALOG_URL = SERVER_BASE_URL
  ? `${String(SERVER_BASE_URL).replace(/\/$/, '')}/api/catalog/official`
  : null;

const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min

let _cache = null;
let _cacheTime = 0;

/**
 * Dados locais embutidos como fallback (gerados a partir de gym-catalog-report.json).
 */
const LOCAL_EXERCISE_FALLBACK = [
  { id: 'local-exc-01', type: 'exercise', title: 'Supino Maquina', muscleGroup: 'peito', equipment: 'maquina', difficulty: 'intermediate', active: true },
  { id: 'local-exc-02', type: 'exercise', title: 'Remada Sentada', muscleGroup: 'costas', equipment: 'maquina', difficulty: 'intermediate', active: true },
  { id: 'local-exc-03', type: 'exercise', title: 'Desenvolvimento de Ombros', muscleGroup: 'ombro', equipment: 'maquina', difficulty: 'intermediate', active: true },
  { id: 'local-exc-04', type: 'exercise', title: 'Elevacao Lateral Maquina', muscleGroup: 'ombro', equipment: 'maquina', difficulty: 'beginner', active: true },
  { id: 'local-exc-05', type: 'exercise', title: 'Triceps Maquina', muscleGroup: 'triceps', equipment: 'maquina', difficulty: 'beginner', active: true },
  { id: 'local-exc-06', type: 'exercise', title: 'Supino Inclinado Maquina', muscleGroup: 'peito', equipment: 'maquina', difficulty: 'intermediate', active: true },
  { id: 'local-exc-07', type: 'exercise', title: 'Remada Articulada', muscleGroup: 'costas', equipment: 'maquina', difficulty: 'intermediate', active: true },
];

const LOCAL_MACHINE_FALLBACK = [
  { id: 'local-mac-01', title: 'Puxador Alto', category: 'musculacao', active: true },
  { id: 'local-mac-02', title: 'Peck Deck', category: 'musculacao', active: true },
  { id: 'local-mac-03', title: 'Graviton', category: 'musculacao', active: true },
  { id: 'local-mac-04', title: 'Crossover / Polia', category: 'musculacao', active: true },
];

function isCacheValid() {
  return _cache !== null && Date.now() - _cacheTime < CACHE_TTL_MS;
}

/**
 * Busca o catálogo oficial do servidor com fallback local.
 * @returns {Promise<{exercises: object[], machines: object[]}>}
 */
export async function getOfficialCatalog() {
  if (isCacheValid()) return _cache;

  if (SERVER_CATALOG_URL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(SERVER_CATALOG_URL, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'content-type': 'application/json' },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const result = {
          exercises: Array.isArray(data?.exercises) ? data.exercises : LOCAL_EXERCISE_FALLBACK,
          machines: Array.isArray(data?.machines) ? data.machines : LOCAL_MACHINE_FALLBACK,
        };
        _cache = result;
        _cacheTime = Date.now();
        return result;
      }
    } catch {
      // network error or timeout — fall through to local fallback
    }
  }

  const fallback = {
    exercises: LOCAL_EXERCISE_FALLBACK,
    machines: LOCAL_MACHINE_FALLBACK,
  };
  _cache = fallback;
  _cacheTime = Date.now();
  return fallback;
}

/**
 * Envia uma submissão de exercício/máquina para o servidor.
 * Requer token de autenticação.
 * @param {object} params
 * @param {string} params.token - JWT do usuário
 * @param {string} params.clientId - ID do cliente
 * @param {object} params.item - payload do item
 * @returns {Promise<{ok: boolean, submission?: object, error?: string}>}
 */
export async function submitCatalogItem({ token, clientId, item }) {
  if (!SERVER_CATALOG_URL) {
    return { ok: false, error: 'Servidor não configurado.' };
  }

  const baseUrl = SERVER_CATALOG_URL.replace('/api/catalog/official', '');
  const submitUrl = `${baseUrl}/api/catalog/submit`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const sanitized = {
      title: String(item?.title || '').replace(/[<>]/g, '').trim().slice(0, 120),
      description: String(item?.description || '').replace(/[<>]/g, '').trim().slice(0, 500),
      type: ['exercise', 'machine'].includes(String(item?.type || '')) ? item.type : 'exercise',
      muscleGroup: String(item?.muscleGroup || '').replace(/[<>]/g, '').trim().slice(0, 60),
      equipment: String(item?.equipment || '').replace(/[<>]/g, '').trim().slice(0, 60),
      difficulty: ['beginner', 'intermediate', 'advanced'].includes(String(item?.difficulty || ''))
        ? item.difficulty
        : 'intermediate',
      source: 'mobile-app',
      createdBy: String(clientId || 'user').replace(/[<>]/g, '').slice(0, 60),
    };

    const response = await fetch(submitUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-qa-client-id': String(clientId || 'user'),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(sanitized),
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return { ok: false, error: data?.error || `http_${response.status}` };
    }

    // Invalida o cache para forçar refresh
    _cache = null;
    _cacheTime = 0;

    return { ok: true, submission: data?.submission };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'Tempo esgotado. Tente novamente.' };
    }
    return { ok: false, error: 'Sem conexão com o servidor.' };
  }
}

/**
 * Busca exercícios filtrados por grupo muscular.
 * @param {string} muscleGroup
 * @returns {Promise<object[]>}
 */
export async function getExercisesByMuscle(muscleGroup) {
  const { exercises } = await getOfficialCatalog();
  if (!muscleGroup) return exercises;
  const normalized = String(muscleGroup).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return exercises.filter((ex) => {
    const muscle = String(ex.muscleGroup || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return muscle.includes(normalized) || normalized.includes(muscle);
  });
}

/**
 * Invalida o cache local (força re-fetch na próxima chamada).
 */
export function invalidateCatalogCache() {
  _cache = null;
  _cacheTime = 0;
}
