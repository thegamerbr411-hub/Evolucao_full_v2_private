import { normalizeDisplayName } from './displayText';

export function getSocialProfileLabel(user) {
  const name = normalizeDisplayName(user?.name);
  if (name) {
    return name;
  }
  if (String(user?.email || '').trim()) {
    return 'Perfil conectado';
  }
  return 'Perfil social ainda não conectado';
}

export function getProfileDisplayEmail(email) {
  const raw = String(email || '').trim();
  if (!raw) {
    return null;
  }

  const isFixtureEmail = /fixture\.local/i.test(raw) || /^qa\+/i.test(raw);
  if (!isFixtureEmail) {
    return raw;
  }

  return __DEV__ ? 'Conta de teste (QA)' : 'Usuario Evolucao';
}
