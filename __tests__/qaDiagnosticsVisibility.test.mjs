import test from 'node:test';
import assert from 'node:assert/strict';

test('shouldShowQaDiagnostics returns false when __DEV__ is false', async () => {
  const previousDev = globalThis.__DEV__;
  globalThis.__DEV__ = false;

  try {
    const { shouldShowQaDiagnostics } = await import(
      `../src/utils/qaDiagnosticsVisibility.js?ts=${Date.now()}`
    );
    assert.equal(shouldShowQaDiagnostics(), false);
  } finally {
    globalThis.__DEV__ = previousDev;
  }
});

test('shouldShowQaDiagnostics returns true when __DEV__ is true', async () => {
  const previousDev = globalThis.__DEV__;
  globalThis.__DEV__ = true;

  try {
    const { shouldShowQaDiagnostics } = await import(
      `../src/utils/qaDiagnosticsVisibility.js?ts=${Date.now()}`
    );
    assert.equal(shouldShowQaDiagnostics(), true);
  } finally {
    globalThis.__DEV__ = previousDev;
  }
});
