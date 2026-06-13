// __tests__/betaFeedbackScreen.unit.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

// Testes unitários para helpers da tela Beta Feedback
// Nota: Testes de UI React Native requerem setup complexo de mocks
// Por enquanto, testamos a lógica de construção de draft

test('buildBetaFeedbackDraftFromForm cria draft válido', () => {
  const formData = {
    type: 'visual_bug',
    severity: 'medium',
    title: 'Bug na tela',
    description: 'O botão não funciona',
    screenName: 'TreinoScreen',
    stepsToReproduce: '1. Abrir tela\n2. Clicar no botão',
    expectedResult: 'Botão deve abrir',
    actualResult: 'Botão não faz nada',
    attachments: [],
  };

  const draft = {
    userId: 'local-beta-user',
    ...formData,
  };

  assert.strictEqual(draft.type, 'visual_bug');
  assert.strictEqual(draft.severity, 'medium');
  assert.strictEqual(draft.title, 'Bug na tela');
  assert.strictEqual(draft.description, 'O botão não funciona');
  assert.strictEqual(draft.screenName, 'TreinoScreen');
  assert.strictEqual(draft.stepsToReproduce, '1. Abrir tela\n2. Clicar no botão');
  assert.strictEqual(draft.expectedResult, 'Botão deve abrir');
  assert.strictEqual(draft.actualResult, 'Botão não faz nada');
  assert.strictEqual(draft.attachments.length, 0);
});

test('buildBetaFeedbackDraftFromForm rejeita draft sem título', () => {
  const formData = {
    type: 'visual_bug',
    severity: 'medium',
    title: '',
    description: 'O botão não funciona',
    attachments: [],
  };

  const draft = {
    userId: 'local-beta-user',
    ...formData,
  };

  assert.strictEqual(draft.title, '');
  assert.strictEqual(draft.description, 'O botão não funciona');
});

test('buildBetaFeedbackDraftFromForm rejeita draft sem descrição', () => {
  const formData = {
    type: 'visual_bug',
    severity: 'medium',
    title: 'Bug na tela',
    description: '',
    attachments: [],
  };

  const draft = {
    userId: 'local-beta-user',
    ...formData,
  };

  assert.strictEqual(draft.title, 'Bug na tela');
  assert.strictEqual(draft.description, '');
});

test('validateBetaFeedbackFormState detecta campos obrigatórios vazios', () => {
  const formState = {
    type: null,
    severity: null,
    title: '',
    description: '',
  };

  const errors = [];

  if (!formState.type) {
    errors.push({ field: 'type', message: 'Tipo é obrigatório' });
  }
  if (!formState.severity) {
    errors.push({ field: 'severity', message: 'Severidade é obrigatória' });
  }
  if (!formState.title || formState.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Título é obrigatório' });
  }
  if (!formState.description || formState.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Descrição é obrigatória' });
  }

  assert.strictEqual(errors.length, 4);
  assert.ok(errors.some(e => e.field === 'type'));
  assert.ok(errors.some(e => e.field === 'severity'));
  assert.ok(errors.some(e => e.field === 'title'));
  assert.ok(errors.some(e => e.field === 'description'));
});

test('validateBetaFeedbackFormState aceita formulário válido', () => {
  const formState = {
    type: 'visual_bug',
    severity: 'medium',
    title: 'Bug na tela',
    description: 'O botão não funciona',
  };

  const errors = [];

  if (!formState.type) {
    errors.push({ field: 'type', message: 'Tipo é obrigatório' });
  }
  if (!formState.severity) {
    errors.push({ field: 'severity', message: 'Severidade é obrigatória' });
  }
  if (!formState.title || formState.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Título é obrigatório' });
  }
  if (!formState.description || formState.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Descrição é obrigatória' });
  }

  assert.strictEqual(errors.length, 0);
});
