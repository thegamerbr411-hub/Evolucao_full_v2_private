const { completeOnboardingIfNeeded, navigateTo, typeText } = require('./helpers/actions');

describe('Nutricao', () => {
  const tapWithVisibilityFallback = async (id) => {
    const tryVisible = async () => {
      try {
        await waitFor(element(by.id(id))).toBeVisible().withTimeout(700);
        return true;
      } catch (_error) {
        return false;
      }
    };

    if (!(await tryVisible())) {
      for (let i = 0; i < 4; i += 1) {
        try {
          await element(by.id('screen-nutricao')).scroll(220, 'down');
        } catch (_error) {
          break;
        }
        if (await tryVisible()) {
          break;
        }
      }
    }

    if (!(await tryVisible())) {
      for (let i = 0; i < 4; i += 1) {
        try {
          await element(by.id('screen-nutricao')).scroll(220, 'up');
        } catch (_error) {
          break;
        }
        if (await tryVisible()) {
          break;
        }
      }
    }

    await waitFor(element(by.id(id))).toBeVisible().withTimeout(5000);

    await element(by.id(id)).tap();
  };

  beforeEach(async () => {
    await device.launchApp({ delete: true });
    await completeOnboardingIfNeeded();
  });

  it('deve validar soma de calorias acumuladas', async () => {
    console.log('[E2E][Nutricao] Abrindo tab de nutricao');
    await navigateTo('tab-nutricao', 'screen-nutricao');
    await waitFor(element(by.id('calorias-total-inline'))).toHaveText('Calorias hoje: 0 kcal').withTimeout(5000);

    console.log('[E2E][Nutricao] Registrando refeicao 1: whey');
    await typeText('input-alimento-nome', 'whey');
    await tapWithVisibilityFallback('btn-adicionar-alimento');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(element(by.id('btn-salvar-alimento'))).toExist().withTimeout(5000);

    await tapWithVisibilityFallback('btn-salvar-alimento');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(element(by.id('alimento-salvo-indicator'))).toExist().withTimeout(5000);
    await waitFor(element(by.id('calorias-total-inline'))).toHaveText('Calorias hoje: 120 kcal').withTimeout(5000);

    console.log('[E2E][Nutricao] Registrando refeicao 2: whey');
    await typeText('input-alimento-nome', 'whey');
    await tapWithVisibilityFallback('btn-adicionar-alimento');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(element(by.id('btn-salvar-alimento'))).toExist().withTimeout(5000);

    await tapWithVisibilityFallback('btn-salvar-alimento');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await waitFor(element(by.id('alimento-salvo-indicator'))).toExist().withTimeout(5000);
    await waitFor(element(by.id('calorias-total-inline'))).toHaveText('Calorias hoje: 240 kcal').withTimeout(5000);

    console.log('[E2E][Nutricao] Soma calorica validada com sucesso');
  });
});
