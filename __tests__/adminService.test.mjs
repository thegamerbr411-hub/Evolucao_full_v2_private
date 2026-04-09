import test from 'node:test';
import assert from 'node:assert/strict';
import { createMission } from '../src/services/adminService.js';

test('createMission gera objeto de missão com id e recompensa', () => {
  const mission = createMission('Treine 3 dias', 100);

  assert.ok(mission.id);
  assert.equal(mission.title, 'Treine 3 dias');
  assert.equal(mission.rewardXP, 100);
});
