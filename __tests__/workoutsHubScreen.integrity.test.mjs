import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HUB_FILE = join(process.cwd(), 'src', 'screens', 'WorkoutsHubScreen.js');

test('workouts hub screen source should keep a valid clean structure', () => {
  const source = readFileSync(HUB_FILE, 'utf8');

  assert.ok(source.includes('export default function WorkoutsHubScreen'));
  assert.ok(source.includes('ScreenHeader title="Treinos"'));
  assert.ok(/PrimaryButton[\s\S]*title="Iniciar treino"/.test(source));

  // Guards against previously observed corruption patterns.
  assert.equal(source.includes('pra escalar sem medoimport'), false);
  assert.equal(source.includes('getTodayinfra+regra'), false);
});
