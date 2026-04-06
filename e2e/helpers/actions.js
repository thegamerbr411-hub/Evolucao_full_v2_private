const waitAndTap = async (id) => {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(5000);
  await element(by.id(id)).tap();
  await new Promise((resolve) => setTimeout(resolve, 300));
};

const typeText = async (id, value) => {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(5000);
  await element(by.id(id)).tap();
  await element(by.id(id)).clearText();
  await element(by.id(id)).replaceText(value);
  await device.pressBack();
  await new Promise((resolve) => setTimeout(resolve, 250));
};

const navigateTo = async (tabId, screenId) => {
  await waitAndTap(tabId);
  await waitFor(element(by.id(screenId))).toBeVisible().withTimeout(5000);
};

const completeOnboardingIfNeeded = async ({ peso = '82', meta = '77', altura = '178' } = {}) => {
  const alreadyDone = await (async () => {
    try {
      await waitFor(element(by.id('home-ready'))).toBeVisible().withTimeout(1200);
      return true;
    } catch (_error) {
      return false;
    }
  })();

  if (alreadyDone) {
    return;
  }

  await waitFor(element(by.id('questionnaire-screen'))).toBeVisible().withTimeout(5000);
  await typeText('input-peso-atual', peso);
  await typeText('input-peso-meta', meta);
  await typeText('input-altura', altura);

  await waitFor(element(by.id('btn-continuar')))
    .toBeVisible()
    .whileElement(by.id('scroll-container'))
    .scroll(200, 'down');

  await (async () => {
    try {
      await element(by.id('scroll-container')).scroll(260, 'down');
    } catch (_error) {
      // Ignora se o scroll ja estiver no limite.
    }
  })();

  await waitAndTap('btn-continuar');

  const reachedHomeOnFirstTry = await (async () => {
    try {
      await waitFor(element(by.id('home-ready'))).toBeVisible().withTimeout(2000);
      return true;
    } catch (_error) {
      return false;
    }
  })();

  if (!reachedHomeOnFirstTry) {
    const stillOnQuestionnaire = await (async () => {
      try {
        await waitFor(element(by.id('btn-continuar'))).toBeVisible().withTimeout(1000);
        return true;
      } catch (_error) {
        return false;
      }
    })();

    if (stillOnQuestionnaire) {
      await waitAndTap('btn-continuar');
    }
  }

  await waitFor(element(by.id('home-ready'))).toBeVisible().withTimeout(5000);
};

module.exports = {
  waitAndTap,
  typeText,
  navigateTo,
  completeOnboardingIfNeeded,
};
