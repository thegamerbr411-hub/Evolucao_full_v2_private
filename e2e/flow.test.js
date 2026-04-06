describe('Fluxo continuo do app', () => {
  async function captureStep(stepName) {
    await device.takeScreenshot(stepName);
  }

  async function waitVisible(id) {
    await waitFor(element(by.id(id))).toBeVisible().withTimeout(5000);
  }

  async function assertAppActive() {
    await waitVisible('app-root');
    await expect(element(by.id('app-root'))).toBeVisible();
  }

  async function waitAndTap(id) {
    await waitVisible(id);
    await element(by.id(id)).tap();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  async function typeAndCloseKeyboard(id, value) {
    await waitVisible(id);
    await element(by.id(id)).tap();
    await element(by.id(id)).clearText();
    await element(by.id(id)).replaceText(value);
    await expect(element(by.id(id))).toHaveText(value);
    await device.pressBack();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  async function fillQuestionnaireAndContinue() {
    const alreadyAtHome = await (async () => {
      try {
        await waitVisible('screen-home');
        return true;
      } catch (_error) {
        return false;
      }
    })();
    const alreadyAtTabs = await (async () => {
      try {
        await waitVisible('tab-treino');
        return true;
      } catch (_error) {
        return false;
      }
    })();

    if (alreadyAtHome || alreadyAtTabs) {
      return;
    }

    await waitVisible('questionnaire-screen');
    await typeAndCloseKeyboard('input-peso-atual', '82');
    await typeAndCloseKeyboard('input-peso-meta', '77');
    await typeAndCloseKeyboard('input-altura', '178');

    await waitFor(element(by.id('btn-continuar')))
      .toBeVisible()
      .whileElement(by.id('scroll-container'))
      .scroll(200, 'down');

    await (async () => {
      try {
        await element(by.id('scroll-container')).scroll(260, 'down');
      } catch (_error) {
        // Ignora se ja estiver no limite do scroll.
      }
    })();

    await waitVisible('btn-continuar');

    await waitAndTap('btn-continuar');

    const reachedHomeOnFirstTry = await (async () => {
      try {
        await waitFor(element(by.id('home-ready'))).toBeVisible().withTimeout(2500);
        return true;
      } catch (_error) {
        return false;
      }
    })();

    if (!reachedHomeOnFirstTry) {
      const continueStillVisible = await (async () => {
        try {
          await waitFor(element(by.id('btn-continuar'))).toBeVisible().withTimeout(1200);
          return true;
        } catch (_error) {
          return false;
        }
      })();

      if (continueStillVisible) {
        await waitAndTap('btn-continuar');
      }
    }

    await waitFor(element(by.id('home-ready'))).toBeVisible().withTimeout(5000);
    await new Promise((resolve) => setTimeout(resolve, 500));

    await (async () => {
      try {
        await waitFor(element(by.id('questionnaire-screen'))).toBeNotVisible().withTimeout(1200);
      } catch (_error) {
        // A tela pode permanecer montada fora de foco; nao bloquear o fluxo por isso.
      }
    })();
  }

  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  it('executa onboarding e treino sem reiniciar app', async () => {
    try {
      console.log('[E2E] Etapa 0: app ativo');
      await assertAppActive();

      console.log('[E2E] Etapa 1: aguardando questionario');
      await waitVisible('questionnaire-screen');
      await waitVisible('input-peso-atual');
      await captureStep('step-1-app-open');
      await assertAppActive();

      console.log('[E2E] Etapa 2 e 3: preenchendo e enviando questionario');
      await fillQuestionnaireAndContinue();
      await captureStep('step-2-questionario-preenchido');
      await assertAppActive();

      console.log('[E2E] Etapa 4: validando chegada na home');
      await waitVisible('home-ready');
      await waitVisible('tab-treino');
      await assertAppActive();

      console.log('[E2E] Etapa 5: navegando para treino');
      await waitAndTap('tab-treino');
      await waitVisible('screen-treinos');
      await assertAppActive();

      await waitAndTap('btn-iniciar-treino');
      await waitVisible('screen-workout');
      await captureStep('step-3-entrada-treino');
      await assertAppActive();

      console.log('[E2E] Etapa 6: preenchendo serie');
      await waitVisible('input-peso');
      await waitVisible('input-reps');
      await typeAndCloseKeyboard('input-peso', '80');
      await typeAndCloseKeyboard('input-reps', '10');
      await assertAppActive();

      console.log('[E2E] Etapa 7: salvando serie');
      await device.disableSynchronization();
      try {
        await waitAndTap('btn-salvar-serie');
        await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(8000);
        console.log('[E2E] Etapa 8: validando serie salva');
        await waitFor(element(by.id('serie-salva-indicator'))).toExist().withTimeout(3000);
        await captureStep('step-4-serie-salva');
      } finally {
        await device.enableSynchronization();
      }
    } catch (error) {
      console.log('[E2E] Falha no fluxo:', error?.message || error);
      await captureStep('error-final');
      throw error;
    }
  });
});
