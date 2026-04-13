import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOOK_FILE = join(process.cwd(), 'src', 'hooks', 'useNutrition.js');
const APP_CONTEXT_FILE = join(process.cwd(), 'src', 'context', 'AppContext.js');

test('hook de nutricao usa dominio do AppContext (evita contexto paralelo morto)', () => {
  const source = readFileSync(HOOK_FILE, 'utf8');

  assert.match(source, /useNutritionDomain\(/, 'useNutrition deve usar useNutritionDomain do AppContext');
  assert.equal(source.includes('context/NutritionContext'), false, 'hook nao deve depender de NutritionContext paralelo');
});

test('dominio de nutricao expoe addWaterIntake para refletir no resumo diario', () => {
  const source = readFileSync(APP_CONTEXT_FILE, 'utf8');

  assert.match(source, /const nutritionValue = useMemo\(\(\) => \(\{[\s\S]*addWaterIntake[\s\S]*\}\)/, 'nutritionValue deve incluir addWaterIntake');
});
