import gymExerciseCatalog from './exerciseCatalogGym.json';

const exerciseDatabase = {
  peito: [
    { id: '0001', nome: 'Supino Reto com Barra', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0002', '0003'], equipamento: 'Barra', dicas: ['Escapulas aduzidas', 'Barra no meio do peito', 'Pes firmes'], dificuldade: 'medio' },
    { id: '0002', nome: 'Supino Inclinado com Halteres', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0001', '0003'], equipamento: 'Halteres', dicas: ['Angulo de 30-45 graus', 'Controlar a descida', 'Foco no peitoral superior'], dificuldade: 'medio' },
    { id: '0003', nome: 'Crucifixo Maquina', grupo: 'peito', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0002'], equipamento: 'Maquina', dicas: ['Cotovelos levemente flexionados', 'Alongar bem o peito', 'Nao bater os pesos'], dificuldade: 'facil' },
    { id: '0004', nome: 'Supino Declinado com Barra', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0001'], equipamento: 'Barra', dicas: ['Ponte leve e estavel', 'Barra na linha inferior do peito', 'Controle no retorno'], dificuldade: 'medio' },
    { id: '0005', nome: 'Crossover no Cabo', grupo: 'peito', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0003'], equipamento: 'Cabo', dicas: ['Passo a frente', 'Fechar com controle', 'Manter peito aberto'], dificuldade: 'facil' },
    { id: '0006', nome: 'Flexao de Bracos', grupo: 'peito', tipo: 'composto', nivel: 'iniciante', substitutos: ['0001', '0002'], equipamento: 'Peso corporal', dicas: ['Linha neutra do corpo', 'Descer com controle', 'Subir sem perder tronco'], dificuldade: 'facil' },
    { id: '0007', nome: 'Pullover com Halter', grupo: 'peito', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0005'], equipamento: 'Halteres', dicas: ['Bracos semi-flexionados', 'Alongar sem perder lombar', 'Subir focando peitoral'], dificuldade: 'medio' },
    { id: '0051', nome: 'Supino Maquina (Chest Press)', grupo: 'peito', tipo: 'composto', nivel: 'iniciante', substitutos: ['0001', '0003', '0056'], equipamento: 'Maquina', dicas: ['Ajustar banco na linha do peito', 'Empurrar sem perder escapulas', 'Retorno controlado'], dificuldade: 'facil', aliases: ['chest press', 'maquina de peito', 'supino guiado', 'press de peito', 'maquina de empurrar', 'supino maquina'] },
    { id: '0056', nome: 'Supino Inclinado Maquina', grupo: 'peito', tipo: 'composto', nivel: 'intermediario', substitutos: ['0051', '0002'], equipamento: 'Maquina', dicas: ['Ajustar inclinacao para peitoral superior', 'Empurrar com cotovelos alinhados', 'Evitar tranco no final'], dificuldade: 'medio', aliases: ['incline chest press', 'supino inclinado guiado', 'supino inclinado maquina'] }
  ],
  costas: [
    { id: '0008', nome: 'Puxada Frente no Pulldown', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0009'], equipamento: 'Cabo', dicas: ['Puxar com o cotovelo', 'Peito estufado', 'Nao balancar tronco'], dificuldade: 'facil' },
    { id: '0009', nome: 'Remada Curvada com Barra', grupo: 'costas', tipo: 'composto', nivel: 'avancado', substitutos: ['0010'], equipamento: 'Barra', dicas: ['Coluna neutra', 'Trazer barra ao umbigo', 'Joelhos semi-flexionados'], dificuldade: 'dificil' },
    { id: '0010', nome: 'Remada Unilateral com Halter', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0009'], equipamento: 'Halteres', dicas: ['Apoio estavel', 'Puxar para o quadril', 'Nao girar tronco'], dificuldade: 'facil' },
    { id: '0011', nome: 'Remada Baixa no Cabo', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0008', '0010'], equipamento: 'Cabo', dicas: ['Peito aberto', 'Cotovelos junto ao tronco', 'Retorno controlado'], dificuldade: 'facil' },
    { id: '0012', nome: 'Barra Fixa Pronada', grupo: 'costas', tipo: 'composto', nivel: 'avancado', substitutos: ['0008'], equipamento: 'Peso corporal', dicas: ['Corpo em bloco', 'Subir com escapulas', 'Descer completo'], dificuldade: 'dificil' },
    { id: '0013', nome: 'Face Pull no Cabo', grupo: 'costas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0011'], equipamento: 'Cabo', dicas: ['Puxar para altura dos olhos', 'Cotovelos altos', 'Foco em escapulas'], dificuldade: 'facil' },
    { id: '0014', nome: 'Pulldown com Bracos Estendidos', grupo: 'costas', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0008'], equipamento: 'Cabo', dicas: ['Bracos semi-rigidos', 'Puxar ate coxa', 'Nao roubar com lombar'], dificuldade: 'medio' },
    { id: '0052', nome: 'Remada Sentada Maquina', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0011', '0057'], equipamento: 'Maquina', dicas: ['Peito aberto no apoio', 'Puxar com cotovelos para tras', 'Segurar 1s na contracao'], dificuldade: 'facil', aliases: ['seated row', 'remada sentada', 'remada maquina', 'maquina de remada', 'maquina de costas', 'remada baixa'] },
    { id: '0055', nome: 'Graviton (Barra Assistida)', grupo: 'costas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0008', '0037'], equipamento: 'Maquina', dicas: ['Ajustar carga de assistencia', 'Controlar descida completa', 'Evitar balanço do tronco'], dificuldade: 'facil', aliases: ['graviton', 'assisted pull-up', 'assisted pull up', 'assisted dip', 'barra assistida', 'maquina de barra'] },
    { id: '0057', nome: 'Remada Articulada', grupo: 'costas', tipo: 'composto', nivel: 'intermediario', substitutos: ['0052', '0009'], equipamento: 'Maquina', dicas: ['Apoio estavel no peito', 'Puxar unilateral ou bilateral com controle', 'Sem girar tronco'], dificuldade: 'medio', aliases: ['hammer row', 'remada articulada', 'remada unilateral maquina'] }
  ],
  pernas: [
    { id: '0015', nome: 'Agachamento Livre', grupo: 'pernas', tipo: 'composto', nivel: 'avancado', substitutos: ['0016', '0017'], equipamento: 'Barra', dicas: ['Quadril para tras', 'Joelhos para fora', 'Peito aberto'], dificuldade: 'dificil' },
    { id: '0016', nome: 'Leg Press 45', grupo: 'pernas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0015'], equipamento: 'Maquina', dicas: ['Pes largura dos ombros', 'Nao travar joelhos', 'Lombar colada no banco'], dificuldade: 'medio' },
    { id: '0017', nome: 'Agachamento Goblet', grupo: 'pernas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0015'], equipamento: 'Halteres', dicas: ['Halter perto do peito', 'Descida controlada', 'Subir empurrando o chao'], dificuldade: 'facil' },
    { id: '0018', nome: 'Levantamento Terra Romeno', grupo: 'pernas', tipo: 'composto', nivel: 'intermediario', substitutos: ['0020'], equipamento: 'Barra', dicas: ['Quadril para tras', 'Barra perto da coxa', 'Coluna neutra'], dificuldade: 'medio' },
    { id: '0019', nome: 'Stiff com Halteres', grupo: 'pernas', tipo: 'composto', nivel: 'iniciante', substitutos: ['0018'], equipamento: 'Halteres', dicas: ['Joelho semi-flexionado', 'Alongar posterior', 'Subir com quadril'], dificuldade: 'medio' },
    { id: '0020', nome: 'Cadeira Flexora', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0019'], equipamento: 'Maquina', dicas: ['Quadril fixo no banco', 'Subida forte', 'Retorno lento'], dificuldade: 'facil' },
    { id: '0021', nome: 'Cadeira Extensora', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0016'], equipamento: 'Maquina', dicas: ['Alinhar joelho ao eixo', 'Subir sem tranco', 'Descer controlado'], dificuldade: 'facil' },
    { id: '0022', nome: 'Passada Caminhando', grupo: 'pernas', tipo: 'composto', nivel: 'intermediario', substitutos: ['0017'], equipamento: 'Halteres', dicas: ['Passo medio', 'Tronco alinhado', 'Empurrar pelo calcanhar'], dificuldade: 'medio' },
    { id: '0023', nome: 'Panturrilha em Pe', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0024'], equipamento: 'Maquina', dicas: ['Amplitude completa', 'Pausa no topo', 'Descida lenta'], dificuldade: 'facil' },
    { id: '0024', nome: 'Panturrilha Sentado', grupo: 'pernas', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0023'], equipamento: 'Maquina', dicas: ['Amplitude completa', 'Sem impulso', 'Controle na descida'], dificuldade: 'facil' }
  ],
  ombros: [
    { id: '0025', nome: 'Desenvolvimento Militar com Barra', grupo: 'ombros', tipo: 'composto', nivel: 'intermediario', substitutos: ['0026'], equipamento: 'Barra', dicas: ['Abdomen firme', 'Barra sobe reta', 'Nao arquear lombar'], dificuldade: 'medio' },
    { id: '0026', nome: 'Desenvolvimento com Halteres', grupo: 'ombros', tipo: 'composto', nivel: 'iniciante', substitutos: ['0025'], equipamento: 'Halteres', dicas: ['Punhos neutros', 'Subida controlada', 'Descer ate 90 graus'], dificuldade: 'facil' },
    { id: '0027', nome: 'Elevacao Lateral', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0028'], equipamento: 'Halteres', dicas: ['Cotovelo levemente flexionado', 'Subir ate linha do ombro', 'Sem embalo'], dificuldade: 'facil' },
    { id: '0028', nome: 'Elevacao Frontal', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0027'], equipamento: 'Halteres', dicas: ['Subir ate linha dos olhos', 'Controle total', 'Alternar bracos'], dificuldade: 'facil' },
    { id: '0029', nome: 'Crucifixo Inverso no Peck Deck', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0013'], equipamento: 'Maquina', dicas: ['Peito no apoio', 'Abrir com cotovelos', 'Pausa curta no pico'], dificuldade: 'facil' },
    { id: '0030', nome: 'Arnold Press', grupo: 'ombros', tipo: 'composto', nivel: 'intermediario', substitutos: ['0026'], equipamento: 'Halteres', dicas: ['Rotacao fluida', 'Sem perder postura', 'Controle na descida'], dificuldade: 'medio' },
    { id: '0031', nome: 'Desenvolvimento na Maquina', grupo: 'ombros', tipo: 'composto', nivel: 'iniciante', substitutos: ['0026'], equipamento: 'Maquina', dicas: ['Ajustar banco', 'Empurrar em linha', 'Descer completo'], dificuldade: 'facil', aliases: ['shoulder press', 'maquina de ombro', 'maquina de ombros', 'desenvolvimento maquina', 'ombro maquina'] },
    { id: '0053', nome: 'Elevacao Lateral Maquina', grupo: 'ombros', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0027', '0031'], equipamento: 'Maquina', dicas: ['Ajustar apoio de cotovelo', 'Subir ate linha do ombro', 'Descer sem relaxar totalmente'], dificuldade: 'facil', aliases: ['lateral raise machine', 'elevacao lateral', 'lateral', 'maquina lateral', 'ombro lateral maquina'] }
  ],
  biceps: [
    { id: '0032', nome: 'Rosca Direta com Barra', grupo: 'biceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0033'], equipamento: 'Barra', dicas: ['Cotovelos fixos', 'Subir sem balancar', 'Descer devagar'], dificuldade: 'facil' },
    { id: '0033', nome: 'Rosca Alternada', grupo: 'biceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0032'], equipamento: 'Halteres', dicas: ['Supinacao no topo', 'Cotovelos junto ao corpo', 'Controle total'], dificuldade: 'facil' },
    { id: '0034', nome: 'Rosca Martelo', grupo: 'biceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0033'], equipamento: 'Halteres', dicas: ['Pegada neutra', 'Sem giro de tronco', 'Descida completa'], dificuldade: 'facil' },
    { id: '0035', nome: 'Rosca Scott na Maquina', grupo: 'biceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0032'], equipamento: 'Maquina', dicas: ['Braco apoiado', 'Subida controlada', 'Nao perder tensao'], dificuldade: 'medio' },
    { id: '0036', nome: 'Rosca no Cabo com Barra Reta', grupo: 'biceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0032'], equipamento: 'Cabo', dicas: ['Cotovelos estaveis', 'Pico de contracao', 'Ritmo constante'], dificuldade: 'medio' }
  ],
  triceps: [
    { id: '0037', nome: 'Triceps Corda no Cabo', grupo: 'triceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0038'], equipamento: 'Cabo', dicas: ['Cotovelos fixos', 'Abrir corda no final', 'Voltar sem perder controle'], dificuldade: 'facil' },
    { id: '0038', nome: 'Triceps Frances com Halter', grupo: 'triceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0037'], equipamento: 'Halteres', dicas: ['Cotovelos apontando para frente', 'Amplitude total', 'Sem forcar lombar'], dificuldade: 'medio' },
    { id: '0039', nome: 'Triceps Testa com Barra EZ', grupo: 'triceps', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0038'], equipamento: 'Barra EZ', dicas: ['Cotovelos estaveis', 'Descer perto da testa', 'Subir com controle'], dificuldade: 'medio' },
    { id: '0040', nome: 'Mergulho entre Bancos', grupo: 'triceps', tipo: 'composto', nivel: 'iniciante', substitutos: ['0037'], equipamento: 'Peso corporal', dicas: ['Quadril proximo ao banco', 'Descer ate 90 graus', 'Subir sem travar'], dificuldade: 'facil' },
    { id: '0041', nome: 'Triceps no Banco com Pegada Fechada', grupo: 'triceps', tipo: 'composto', nivel: 'intermediario', substitutos: ['0039'], equipamento: 'Barra', dicas: ['Pegada fechada firme', 'Cotovelos junto ao corpo', 'Controle da descida'], dificuldade: 'medio' },
    { id: '0054', nome: 'Triceps Maquina', grupo: 'triceps', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0037', '0039'], equipamento: 'Maquina', dicas: ['Ajustar eixo no cotovelo', 'Estender sem deslocar ombro', 'Retorno controlado'], dificuldade: 'facil', aliases: ['triceps press', 'triceps maquina', 'triceps na maquina', 'maquina de triceps', 'triceps sentado'] }
  ],
  abdomen: [
    { id: '0042', nome: 'Prancha Frontal', grupo: 'abdomen', tipo: 'composto', nivel: 'iniciante', substitutos: ['0043'], equipamento: 'Peso corporal', dicas: ['Quadril alinhado', 'Abdomen contraido', 'Respiracao controlada'], dificuldade: 'facil' },
    { id: '0043', nome: 'Abdominal Infra no Banco', grupo: 'abdomen', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0044'], equipamento: 'Banco', dicas: ['Lombar apoiada', 'Subir com controle', 'Nao puxar pescoço'], dificuldade: 'facil' },
    { id: '0044', nome: 'Abdominal na Polia', grupo: 'abdomen', tipo: 'isolado', nivel: 'intermediario', substitutos: ['0043'], equipamento: 'Cabo', dicas: ['Quadril estavel', 'Flexionar tronco', 'Retorno lento'], dificuldade: 'medio' },
    { id: '0045', nome: 'Prancha Lateral', grupo: 'abdomen', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0042'], equipamento: 'Peso corporal', dicas: ['Corpo em linha reta', 'Quadril alto', 'Manter respiracao'], dificuldade: 'facil' },
    { id: '0046', nome: 'Dead Bug', grupo: 'abdomen', tipo: 'isolado', nivel: 'iniciante', substitutos: ['0042'], equipamento: 'Peso corporal', dicas: ['Lombar no chao', 'Movimento alternado', 'Controle fino'], dificuldade: 'facil' }
  ],
  cardio: [
    { id: '0047', nome: 'Caminhada Inclinada na Esteira', grupo: 'cardio', tipo: 'composto', nivel: 'iniciante', substitutos: ['0048'], equipamento: 'Esteira', dicas: ['Postura ereta', 'Passo constante', 'Respirar ritmado'], dificuldade: 'facil' },
    { id: '0048', nome: 'Bike Ergometrica', grupo: 'cardio', tipo: 'composto', nivel: 'iniciante', substitutos: ['0047'], equipamento: 'Bicicleta', dicas: ['Selim ajustado', 'Cadencia estavel', 'Nao tensionar ombros'], dificuldade: 'facil' },
    { id: '0049', nome: 'Remo Ergometro', grupo: 'cardio', tipo: 'composto', nivel: 'intermediario', substitutos: ['0048'], equipamento: 'Remo', dicas: ['Pernas iniciam o movimento', 'Tronco neutro', 'Retorno suave'], dificuldade: 'medio' },
    { id: '0050', nome: 'Escada Ergometro', grupo: 'cardio', tipo: 'composto', nivel: 'intermediario', substitutos: ['0047'], equipamento: 'Escada', dicas: ['Passadas curtas', 'Sem apoiar demais nas maos', 'Ritmo constante'], dificuldade: 'medio' }
  ]
};

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeWords(value = '') {
  return normalize(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeGroupName(group = '') {
  const normalized = normalize(group);
  if (normalized === 'pernas') return 'perna';
  if (normalized === 'ombros') return 'ombro';
  return normalized;
}

export const allExercises = Object.values(exerciseDatabase).flat();

const gymCatalog = Array.isArray(gymExerciseCatalog) ? gymExerciseCatalog : [];
const gymCatalogById = gymCatalog.reduce((acc, item) => {
  acc[String(item?.id || '')] = item;
  return acc;
}, {});

const exerciseIndexById = allExercises.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;
}, {});

const exerciseNameAliasMap = allExercises.reduce((acc, item) => {
  const key = normalize(item.nome);
  acc[key] = item;
  (Array.isArray(item.aliases) ? item.aliases : []).forEach((alias) => {
    const aliasKey = normalize(alias);
    if (aliasKey) {
      acc[aliasKey] = item;
    }
  });
  return acc;
}, {
  'supino reto barra': null,
  'supino inclinado halter': null,
  'desenvolvimento militar barra': null,
  'desenvolvimento militar halter': null,
  'puxada frontal polia': null,
  'rosca direta barra': null,
  'triceps corda polia': null,
  'triceps testa barra ez': null,
  'remada curvada barra': null,
  'remada baixa triangulo': null,
  'face pull polia': null,
  'leg press': null,
  'stiff': null,
  'levantamento terra romeno': null,
  'panturrilha em pe': null,
  'panturrilha sentado': null,
  'elevacao lateral halter': null,
  'rosca martelo halter': null,
});

function buildAliasLink(alias, target) {
  const normalizedAlias = normalize(alias);
  const normalizedTarget = normalize(target);
  const resolved = exerciseNameAliasMap[normalizedTarget] || allExercises.find((item) => normalize(item.nome).includes(normalizedTarget));
  if (resolved) {
    exerciseNameAliasMap[normalizedAlias] = resolved;
  }
}

buildAliasLink('supino reto barra', 'supino reto com barra');
buildAliasLink('supino inclinado halter', 'supino inclinado com halteres');
buildAliasLink('desenvolvimento militar barra', 'desenvolvimento militar com barra');
buildAliasLink('desenvolvimento militar halter', 'desenvolvimento com halteres');
buildAliasLink('puxada frontal polia', 'puxada frente no pulldown');
buildAliasLink('rosca direta barra', 'rosca direta com barra');
buildAliasLink('triceps corda polia', 'triceps corda no cabo');
buildAliasLink('triceps testa barra ez', 'triceps testa com barra ez');
buildAliasLink('remada curvada barra', 'remada curvada com barra');
buildAliasLink('remada baixa triangulo', 'remada baixa no cabo');
buildAliasLink('face pull polia', 'face pull no cabo');
buildAliasLink('leg press', 'leg press 45');
buildAliasLink('stiff', 'stiff com halteres');
buildAliasLink('levantamento terra romeno', 'levantamento terra romeno');
buildAliasLink('panturrilha em pe', 'panturrilha em pe');
buildAliasLink('panturrilha sentado', 'panturrilha sentado');
buildAliasLink('elevacao lateral halter', 'elevacao lateral');
buildAliasLink('rosca martelo halter', 'rosca martelo');

gymCatalog.forEach((entry) => {
  const canonicalId = String(entry?.canonical_exercise_id || '').trim();
  const canonicalExercise = canonicalId ? getExerciseById(canonicalId) : null;
  if (!canonicalExercise) {
    return;
  }

  const preferredNames = [entry?.nome_principal, ...(Array.isArray(entry?.aliases) ? entry.aliases : [])];
  preferredNames.forEach((name) => {
    const key = normalize(name);
    if (key) {
      exerciseNameAliasMap[key] = canonicalExercise;
    }
  });
});

export function getExerciseNamesFromDatabase() {
  const exerciseNames = allExercises.map((item) => item.nome);
  const gymNames = gymCatalog.map((item) => String(item?.nome_principal || '').trim()).filter(Boolean);
  const exerciseAliases = allExercises
    .flatMap((item) => (Array.isArray(item.aliases) ? item.aliases : []))
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const gymAliases = gymCatalog
    .flatMap((item) => (Array.isArray(item.aliases) ? item.aliases : []))
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return Array.from(new Set([...exerciseNames, ...gymNames, ...exerciseAliases, ...gymAliases]));
}

export function findExerciseByName(query = '') {
  const normalized = normalize(query);
  if (!normalized) {
    return null;
  }

  if (exerciseNameAliasMap[normalized]) {
    return exerciseNameAliasMap[normalized];
  }

  const exact = allExercises.find((item) => normalize(item.nome) === normalized);
  if (exact) {
    return exact;
  }

  return allExercises.find((item) => normalize(item.nome).includes(normalized)) || null;
}

function mapFallbackIdToExercise(fallbackId = '') {
  const normalizedId = String(fallbackId || '').trim();
  if (!normalizedId) {
    return null;
  }

  const byExerciseId = getExerciseById(normalizedId);
  if (byExerciseId) {
    return byExerciseId;
  }

  const gymEntry = gymCatalogById[normalizedId];
  if (!gymEntry) {
    return null;
  }

  const canonicalId = String(gymEntry?.canonical_exercise_id || '').trim();
  return canonicalId ? getExerciseById(canonicalId) : null;
}

function getDefaultGroupSuggestions(groupName = '', limit = 4) {
  const normalizedGroup = normalize(groupName);
  if (!normalizedGroup) {
    return [];
  }

  return allExercises
    .filter((item) => normalizeGroupName(item.grupo) === normalizedGroup)
    .slice(0, limit)
    .map((item) => item.nome);
}

export function getGymExerciseCatalog() {
  return gymCatalog;
}

export function getGymCatalogMappingReport() {
  const recognized = [];
  const mappedFromPhoto = [];
  const largeGymPattern = [];
  const needsReview = [];

  gymCatalog.forEach((entry) => {
    const canonicalId = String(entry?.canonical_exercise_id || '').trim();
    const canonical = canonicalId ? getExerciseById(canonicalId) : null;
    const payload = {
      aliases: Array.isArray(entry?.aliases) ? entry.aliases : [],
      canonicalExerciseId: canonical?.id || canonicalId || '',
      canonicalExerciseName: canonical?.nome || '',
      equipment: String(entry?.equipamento || ''),
      id: String(entry?.id || ''),
      nomePrincipal: String(entry?.nome_principal || ''),
      needsReview: Boolean(entry?.needs_review),
      observacoes: String(entry?.observacoes || ''),
    };

    recognized.push(payload);

    if (payload.observacoes.toLowerCase().includes('foto')) {
      mappedFromPhoto.push(payload);
    }

    if (payload.observacoes.toLowerCase().includes('academias padronizadas') || payload.observacoes.toLowerCase().includes('rede grande')) {
      largeGymPattern.push(payload);
    }

    if (payload.needsReview || !payload.canonicalExerciseId) {
      needsReview.push(payload);
    }
  });

  return {
    largeGymPattern,
    mappedFromPhoto,
    needsReview,
    recognized,
  };
}

export function resolveGymExerciseMention(text = '') {
  const normalizedText = normalize(text);
  if (!normalizedText) {
    return null;
  }

  const matchedEntry = gymCatalog.find((entry) => {
    const primary = normalize(entry?.nome_principal);
    if (primary && normalizedText.includes(primary)) {
      return true;
    }

    return (Array.isArray(entry?.aliases) ? entry.aliases : [])
      .some((alias) => {
        const normalizedAlias = normalize(alias);
        return normalizedAlias && normalizedText.includes(normalizedAlias);
      });
  });

  if (!matchedEntry) {
    return null;
  }

  const canonicalId = String(matchedEntry?.canonical_exercise_id || '').trim();
  const canonicalExercise = canonicalId ? getExerciseById(canonicalId) : null;
  const aliases = Array.isArray(matchedEntry?.aliases) ? matchedEntry.aliases : [];
  const aliasMatched = aliases.find((alias) => normalizedText.includes(normalize(alias))) || '';

  return {
    id: matchedEntry.id,
    nomePrincipal: matchedEntry.nome_principal,
    aliasMatched,
    grupoMuscular: Array.isArray(matchedEntry.grupo_muscular) ? matchedEntry.grupo_muscular : [],
    equipamento: String(matchedEntry.equipamento || ''),
    padraoMovimento: String(matchedEntry.padrao_de_movimento || ''),
    needsReview: Boolean(matchedEntry.needs_review),
    canonicalExercise,
  };
}

export function getExerciseFallbackSuggestions(query = '', limit = 5) {
  const mention = resolveGymExerciseMention(query);
  if (mention) {
    const fallbackBySimilarity = (gymCatalogById[mention.id]?.fallback || [])
      .map((fallbackId) => mapFallbackIdToExercise(fallbackId))
      .filter(Boolean)
      .map((item) => item.nome)
      .slice(0, limit);

    const primaryGroup = mention.grupoMuscular[0] || '';
    const fallbackByGroup = getDefaultGroupSuggestions(primaryGroup, limit);
    const fallbackByMachine = allExercises
      .filter((item) => normalize(item.equipamento).includes('maquina'))
      .slice(0, limit)
      .map((item) => item.nome);

    return {
      matched: mention,
      similar: Array.from(new Set(fallbackBySimilarity)),
      byGroup: Array.from(new Set(fallbackByGroup)),
      byMachine: Array.from(new Set(fallbackByMachine)),
    };
  }

  const words = normalizeWords(query);
  const inferredGroup = words.find((word) => ['peito', 'costas', 'ombro', 'triceps', 'biceps', 'perna'].includes(word)) || '';
  return {
    matched: null,
    similar: [],
    byGroup: getDefaultGroupSuggestions(inferredGroup, limit),
    byMachine: allExercises
      .filter((item) => normalize(item.equipamento).includes('maquina'))
      .slice(0, limit)
      .map((item) => item.nome),
  };
}

export function getExerciseById(exerciseId = '') {
  return exerciseIndexById[String(exerciseId || '')] || null;
}

export function getCanonicalExerciseData(exerciseName = '') {
  const found = findExerciseByName(exerciseName);
  if (!found) {
    return null;
  }

  return {
    id: found.id,
    name: found.nome,
    group: normalizeGroupName(found.grupo),
    type: found.tipo,
    level: found.nivel,
  };
}

export function getCanonicalExerciseId(exerciseName = '') {
  return getCanonicalExerciseData(exerciseName)?.id || null;
}

export function getCanonicalMuscleGroup(exerciseName = '') {
  return getCanonicalExerciseData(exerciseName)?.group || null;
}

export function getExerciseTipsForPain(painText = '') {
  const pain = normalize(painText);
  if (!pain) {
    return [];
  }

  if (pain.includes('ombro')) {
    return allExercises
      .filter((item) => !['peito', 'ombros', 'triceps'].includes(item.grupo) || item.tipo === 'isolado')
      .slice(0, 8)
      .map((item) => ({ nome: item.nome, dicas: item.dicas }));
  }

  if (pain.includes('joelho')) {
    return allExercises
      .filter((item) => item.grupo !== 'pernas' || item.nome.includes('Cadeira') || item.nome.includes('Panturrilha'))
      .slice(0, 8)
      .map((item) => ({ nome: item.nome, dicas: item.dicas }));
  }

  if (pain.includes('lombar') || pain.includes('coluna')) {
    return allExercises
      .filter((item) => !item.nome.includes('Terra') && !item.nome.includes('Agachamento Livre'))
      .slice(0, 8)
      .map((item) => ({ nome: item.nome, dicas: item.dicas }));
  }

  return allExercises.slice(0, 6).map((item) => ({ nome: item.nome, dicas: item.dicas }));
}

export default exerciseDatabase;
