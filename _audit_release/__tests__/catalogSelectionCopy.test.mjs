import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCatalogAddLabel,
  isCatalogAddEnabled,
} from '../src/utils/catalogSelectionCopy.js';

test('zero selection uses disabled copy', () => {
  assert.equal(formatCatalogAddLabel(0), 'Selecione exercícios');
  assert.equal(isCatalogAddEnabled(0), false);
});

test('single selection uses singular copy', () => {
  assert.equal(formatCatalogAddLabel(1), 'Adicionar 1 exercício');
  assert.equal(isCatalogAddEnabled(1), true);
});

test('multiple selection uses plural copy', () => {
  assert.equal(formatCatalogAddLabel(3), 'Adicionar 3 exercícios');
  assert.equal(isCatalogAddEnabled(3), true);
});
