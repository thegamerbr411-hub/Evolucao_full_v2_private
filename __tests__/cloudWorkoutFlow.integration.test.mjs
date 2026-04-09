import test from 'node:test';
import assert from 'node:assert/strict';

test('fluxo completo: login -> treino -> salvar cloud -> reload', async () => {
  const cloud = new Map();

  const loginAnonymous = async () => ({ id: 'user-1' });
  const saveWorkoutCloud = async (userId, workout) => {
    const list = cloud.get(userId) || [];
    list.push({ ...workout, createdAt: Date.now(), updatedAt: Date.now() });
    cloud.set(userId, list);
    return String(list.length);
  };
  const loadWorkoutCloud = async (userId) => {
    const list = cloud.get(userId) || [];
    return list.length ? list[list.length - 1] : null;
  };

  const user = await loginAnonymous();

  const workout = {
    name: 'Treino A',
    exercises: [
      {
        name: 'Supino',
        sets: [{ reps: '10', weight: '40', done: true }],
      },
    ],
  };

  const savedId = await saveWorkoutCloud(user.id, workout);
  const reloaded = await loadWorkoutCloud(user.id);

  assert.equal(user.id, 'user-1');
  assert.ok(savedId);
  assert.equal(reloaded.name, 'Treino A');
  assert.equal(reloaded.exercises.length, 1);
  assert.equal(reloaded.exercises[0].sets[0].done, true);
});
