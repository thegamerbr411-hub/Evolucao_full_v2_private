import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  getExerciseByName,
  normalizeExerciseName,
  resolveExerciseForDetail,
} from '../src/data/exercises.js';

const ROUTINES_FILE = join(process.cwd(), 'src', 'screens', 'RoutinesScreen.js');

const AUDIT_CASES = [
  { label: 'Cadeira Extensora', query: 'Cadeira Extensora', canonical: 'Cadeira Extensora' },
  { label: 'Supino Inclinado', query: 'Supino Inclinado', canonical: 'Supino Inclinado Barra' },
  { label: 'Puxada Alta', query: 'Puxada Alta', canonical: 'Puxada Frontal Polia' },
  { label: 'Agachamento Hack', query: 'Agachamento Hack', canonical: 'Hack Machine' },
  { label: 'Tríceps na Polia', query: 'Tríceps na Polia', canonical: 'Triceps Corda Polia' },
  { label: 'Triceps na Polia sem acento', query: 'Triceps na Polia', canonical: 'Triceps Corda Polia' },
];

test('normalizeExerciseName removes accents and lowercases', () => {
  assert.equal(normalizeExerciseName('Tríceps na Polia'), 'triceps-na-polia');
  assert.equal(normalizeExerciseName('Triceps na Polia'), 'triceps-na-polia');
  assert.equal(normalizeExerciseName('Cadeira Extensora'), 'cadeira-extensora');
});

test('resolveExerciseForDetail resolves audited exercise names', () => {
  for (const item of AUDIT_CASES) {
    const resolved = resolveExerciseForDetail(item.query);
    assert.ok(resolved, `${item.label}: expected exercise for "${item.query}"`);
    assert.equal(resolved.name, item.canonical, `${item.label}: wrong canonical name`);
    assert.ok(resolved.id, `${item.label}: missing id`);
    assert.ok(Array.isArray(resolved.instructions), `${item.label}: instructions must be array`);
  }
});

test('getExerciseByName still resolves canonical catalog names', () => {
  assert.equal(getExerciseByName('Hack Machine')?.id, 'hack_machine');
  assert.equal(getExerciseByName('Puxada Frontal Polia')?.id, 'puxada_frontal_polia');
});

test('RoutinesScreen opens ExerciseDetail before closing catalog modal', () => {
  const source = readFileSync(ROUTINES_FILE, 'utf8');
  assert.match(source, /resolveExerciseForDetail/);
  assert.match(source, /row-routine-detail-/);
  assert.match(
    source,
    /navigation\.navigate\('ExerciseDetail', payload\);\s*\n\s*setShowCatalogModal\(false\)/,
    'navigate must run before closing catalog modal'
  );
  assert.doesNotMatch(
    source,
    /setShowCatalogModal\(false\);\s*\n\s*InteractionManager\.runAfterInteractions\(\(\) => \{\s*\n\s*navigation\.navigate\('ExerciseDetail'/,
    'must not defer navigation until after modal closes'
  );
});
