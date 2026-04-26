import { allExercises } from './exerciseDatabase';

export type Exercise = {
  name: string;
  muscle: string;
  category: 'machine' | 'free' | 'cable';
};

type GroupedExercises = {
  peito: Exercise[];
  costas: Exercise[];
  pernas: Exercise[];
  ombro: Exercise[];
  bracos: Exercise[];
};

const normalize = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const toCategory = (equipamento: string): Exercise['category'] => {
  const value = normalize(equipamento);
  if (value.includes('cabo') || value.includes('polia')) {
    return 'cable';
  }
  if (value.includes('maquina')) {
    return 'machine';
  }
  return 'free';
};

const toMuscleGroup = (grupo: string): keyof GroupedExercises | null => {
  const value = normalize(grupo);
  if (value === 'peito') return 'peito';
  if (value === 'costas') return 'costas';
  if (value === 'pernas' || value === 'perna') return 'pernas';
  if (value === 'ombros' || value === 'ombro') return 'ombro';
  if (value === 'biceps' || value === 'triceps') return 'bracos';
  return null;
};

const seen = new Set<string>();

const base: GroupedExercises = {
  peito: [],
  costas: [],
  pernas: [],
  ombro: [],
  bracos: [],
};

for (const item of allExercises) {
  const group = toMuscleGroup(item?.grupo);
  if (!group) continue;

  const name = String(item?.nome || '').trim();
  if (!name) continue;

  const uniqueKey = `${normalize(name)}:${group}`;
  if (seen.has(uniqueKey)) continue;
  seen.add(uniqueKey);

  base[group].push({
    name,
    muscle: group,
    category: toCategory(String(item?.equipamento || '')),
  });
}

export const exercises: GroupedExercises = {
  peito: base.peito.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  costas: base.costas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  pernas: base.pernas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  ombro: base.ombro.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  bracos: base.bracos.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
};
