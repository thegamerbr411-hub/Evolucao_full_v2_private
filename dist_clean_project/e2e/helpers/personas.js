const { buildProfile } = require('./userProfiles');

const PERSONAS = {
  dieta: buildProfile('inconsistente', 'legacy-dieta-seed'),
  iniciante: buildProfile('iniciante', 'legacy-iniciante-seed'),
  maromba: buildProfile('avancado', 'legacy-maromba-seed'),
};

function createSeededRandom(seedInput) {
  return buildProfile('iniciante', seedInput).rng;
}

function getPersona(name = process.env.QA_PERSONA || 'iniciante') {
  const legacyMap = {
    avancado: 'avancado',
    dieta: 'inconsistente',
    iniciante: 'iniciante',
    inconsistente: 'inconsistente',
    maromba: 'avancado',
  };
  const selected = legacyMap[String(name || '').toLowerCase()] || 'iniciante';
  return buildProfile(selected, process.env.QA_SEED || `${selected}-seed`);
}

module.exports = {
  PERSONAS,
  createSeededRandom,
  getPersona,
};
