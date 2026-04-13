const { getUserProfile } = require('./helpers/userProfiles');
const { ensureOnboarded, goToNutrition, launchApp } = require('./helpers/flows');

const BASE_URL = 'http://127.0.0.1:3000';

async function setFaults(payload) {
  await fetch(`${BASE_URL}/api/test/faults`, {
    body: JSON.stringify(payload),
    headers: {
      'content-type': 'application/json',
      'x-qa-client-id': 'admin',
      'x-qa-local': '1',
    },
    method: 'POST',
  });
}

describe('10 - error resilience', () => {
  const profile = getUserProfile();

  afterEach(async () => {
    await setFaults({ active: false, apiDelayMs: 0, forceApiError: false });
  });

  it('simula API lenta e erro backend sem crashar o app', async () => {
    await setFaults({ active: true, apiDelayMs: 1500, forceApiError: false });

    await launchApp({ deleteApp: true });
    await ensureOnboarded(profile);
    await goToNutrition();
    await expect(element(by.id('screen-nutricao'))).toBeVisible();

    await setFaults({ active: true, apiDelayMs: 0, forceApiError: true });
    await element(by.id('tab-home')).tap();
    await expect(element(by.id('screen-home'))).toBeVisible();
  });
});
