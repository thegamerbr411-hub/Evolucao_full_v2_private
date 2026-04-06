const { completeOnboardingIfNeeded, navigateTo, typeText, waitAndTap } = require('./helpers/actions');
const { expectVisible } = require('./helpers/asserts');

describe('Multi-flow realista', () => {
  const scenarios = [
    { label: 'cenario-a', user: { peso: '68', meta: '72', altura: '170' }, set: { peso: '60', reps: '10' } },
    { label: 'cenario-b', user: { peso: '98', meta: '90', altura: '182' }, set: { peso: '75', reps: '8' } },
  ];

  for (const scenario of scenarios) {
    it(`deve completar fluxo cruzado ${scenario.label}`, async () => {
      console.log(`[E2E][MultiFlow] Iniciando ${scenario.label}`);
      await device.launchApp({ delete: true });

      console.log('[E2E][MultiFlow] Etapa 1 - onboarding');
      await completeOnboardingIfNeeded(scenario.user);
      await expectVisible('home-ready');

      console.log('[E2E][MultiFlow] Etapa 2 - iniciar treino e salvar parcial');
      await navigateTo('tab-treino', 'screen-treinos');
      await waitAndTap('btn-iniciar-treino');
      await expectVisible('screen-workout');
      await typeText('input-peso', scenario.set.peso);
      await typeText('input-reps', scenario.set.reps);
      await device.disableSynchronization();
      try {
        await waitAndTap('btn-salvar-serie');
        await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(8000);
      } finally {
        await device.enableSynchronization();
      }
      await waitAndTap('btn-salvar-parcial');
      await expectVisible('screen-treinos');

      console.log('[E2E][MultiFlow] Etapa 3 - registrar nutricao');
      await navigateTo('tab-nutricao', 'screen-nutricao');
      await typeText('input-alimento-nome', '1 whey');
      await waitAndTap('btn-adicionar-alimento');
      await waitAndTap('btn-salvar-alimento');
      await waitFor(element(by.id('calorias-total-inline'))).toHaveText('Calorias hoje: 120 kcal').withTimeout(5000);

      console.log('[E2E][MultiFlow] Etapa 4 - voltar treino e salvar nova serie');
      await navigateTo('tab-treino', 'screen-treinos');
      await waitAndTap('btn-iniciar-treino');
      await expectVisible('screen-workout');
      await typeText('input-peso', String(Number(scenario.set.peso) + 5));
      await typeText('input-reps', String(Math.max(6, Number(scenario.set.reps) - 1)));
      await device.disableSynchronization();
      try {
        await waitAndTap('btn-salvar-serie');
        await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(8000);
      } finally {
        await device.enableSynchronization();
      }
      await waitFor(element(by.id('series-salvas-total'))).toBeVisible().withTimeout(5000);

      console.log('[E2E][MultiFlow] Etapa 5 - reabrir app e validar estado');
      await device.launchApp({ newInstance: true });
      await expectVisible('home-ready');
      await navigateTo('tab-nutricao', 'screen-nutricao');
      await waitFor(element(by.id('calorias-total-inline'))).toHaveText('Calorias hoje: 120 kcal').withTimeout(5000);

      console.log(`[E2E][MultiFlow] Finalizado ${scenario.label}`);
    });
  }
});
