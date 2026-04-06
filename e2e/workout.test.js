const { completeOnboardingIfNeeded, navigateTo, typeText, waitAndTap } = require('./helpers/actions');
const { expectVisible } = require('./helpers/asserts');
const { getWorkoutData } = require('./helpers/data');

describe('Treino', () => {
  beforeEach(async () => {
    await device.launchApp({ delete: true });
    await completeOnboardingIfNeeded();
  });

  it('deve executar treino com multiplas series e edicao', async () => {
    const data = getWorkoutData();
    const editedWeight = String(Number(data.peso) + 5);
    const editedReps = String(Math.max(6, Number(data.reps) - 1));

    console.log('[E2E][Treino] Abrindo fluxo de treino');
    await navigateTo('tab-treino', 'screen-treinos');
    await waitAndTap('btn-iniciar-treino');
    await expectVisible('screen-workout');
    await waitFor(element(by.id('series-salvas-total'))).toHaveText('Series salvas: 0').withTimeout(5000);

    console.log('[E2E][Treino] Salvando primeira serie');
    await typeText('input-peso', data.peso);
    await typeText('input-reps', data.reps);

    await device.disableSynchronization();
    try {
      await waitAndTap('btn-salvar-serie');
      await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(8000);
    } finally {
      await device.enableSynchronization();
    }

    await waitFor(element(by.id('series-salvas-total'))).toHaveText('Series salvas: 1').withTimeout(5000);

    console.log('[E2E][Treino] Editando serie salva');
    await waitAndTap('btn-editar-serie');
    await typeText('input-peso', editedWeight);
    await typeText('input-reps', editedReps);
    await device.disableSynchronization();
    try {
      await waitAndTap('btn-salvar-serie');
      await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(8000);
    } finally {
      await device.enableSynchronization();
    }
    await waitFor(element(by.id('series-salvas-total'))).toHaveText('Series salvas: 1').withTimeout(5000);

    console.log('[E2E][Treino] Removendo serie e validando retorno para zero');
    await waitAndTap('btn-remover-serie');
    await waitFor(element(by.id('series-salvas-total'))).toHaveText('Series salvas: 0').withTimeout(5000);

    console.log('[E2E][Treino] Salvando duas series para validar acumulacao');
    await typeText('input-peso', data.peso);
    await typeText('input-reps', data.reps);
    await waitAndTap('btn-salvar-serie');

    await waitFor(element(by.id('input-peso'))).toBeVisible().withTimeout(5000);
    await typeText('input-peso', editedWeight);
    await typeText('input-reps', editedReps);
    await device.disableSynchronization();
    try {
      await waitAndTap('btn-salvar-serie');
      await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(8000);
    } finally {
      await device.enableSynchronization();
    }

    await waitFor(element(by.id('series-salvas-total'))).toHaveText('Series salvas: 2').withTimeout(5000);

    await expectVisible('serie-salva-indicator');
    console.log('[E2E][Treino] Fluxo avancado concluido');
  });
});
