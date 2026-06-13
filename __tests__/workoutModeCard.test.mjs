import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkoutModePresentation } from '../src/services/workoutModeCopy.js';

test('1: simpleMode true -> Treino guiado', () => {
  const presentation = buildWorkoutModePresentation({ simpleMode: true });
  assert.equal(presentation.modeLabel, 'Treino guiado');
});

test('2: simpleMode false -> Visao completa', () => {
  const presentation = buildWorkoutModePresentation({ simpleMode: false });
  assert.equal(presentation.modeLabel, 'Visao completa');
});

test('3: toggleLabel is always Trocar', () => {
  assert.equal(buildWorkoutModePresentation({ simpleMode: true }).toggleLabel, 'Trocar');
  assert.equal(buildWorkoutModePresentation({ simpleMode: false }).toggleLabel, 'Trocar');
});

test('4: compactLabel contains mode and Trocar', () => {
  const simple = buildWorkoutModePresentation({ simpleMode: true });
  const advanced = buildWorkoutModePresentation({ simpleMode: false });

  assert.match(simple.compactLabel, /Treino guiado/);
  assert.match(simple.compactLabel, /Trocar/);
  assert.match(advanced.compactLabel, /Visao completa/);
  assert.match(advanced.compactLabel, /Trocar/);
});

test('5: showHelper false in simple mode', () => {
  const presentation = buildWorkoutModePresentation({ simpleMode: true });
  assert.equal(presentation.showHelper, false);
});

test('6: showHelper true in advanced mode', () => {
  const presentation = buildWorkoutModePresentation({ simpleMode: false });
  assert.equal(presentation.showHelper, true);
});

test('7: helper text differs between modes', () => {
  const simple = buildWorkoutModePresentation({ simpleMode: true });
  const advanced = buildWorkoutModePresentation({ simpleMode: false });

  assert.notEqual(simple.helperText, advanced.helperText);
  assert.match(simple.helperText, /Registre sua carga/i);
  assert.match(advanced.helperText, /detalhes extras/i);
});

test('8: undefined input defaults to simple mode', () => {
  const presentation = buildWorkoutModePresentation();
  assert.equal(presentation.modeLabel, 'Treino guiado');
  assert.equal(presentation.showHelper, false);
});

test('9: labels do not contain ativo', () => {
  const simple = buildWorkoutModePresentation({ simpleMode: true });
  const advanced = buildWorkoutModePresentation({ simpleMode: false });

  for (const value of [
    simple.modeLabel,
    advanced.modeLabel,
    simple.compactLabel,
    advanced.compactLabel,
    simple.toggleLabel,
    advanced.toggleLabel,
  ]) {
    assert.doesNotMatch(value, /ativo/i);
  }
});

test('10: compactLabel is not the old bloated button copy', () => {
  const simple = buildWorkoutModePresentation({ simpleMode: true });
  const advanced = buildWorkoutModePresentation({ simpleMode: false });

  assert.notEqual(simple.compactLabel, 'Modo simples ativo');
  assert.notEqual(advanced.compactLabel, 'Modo avancado ativo');
  assert.doesNotMatch(simple.compactLabel, /ativo/i);
  assert.doesNotMatch(advanced.compactLabel, /ativo/i);
});
